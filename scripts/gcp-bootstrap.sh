#!/usr/bin/env bash
# One-time Google Cloud setup for Mehfil. Run locally with an Owner account:
#   bash scripts/gcp-bootstrap.sh <gcp-project-id> [github-owner/repo]
# Enables APIs, creates Firestore (+ TTL on plans.expireAt), grants the Cloud Run
# runtime identity Vertex AI + Firestore access, and lets GitHub Actions deploy via
# Workload Identity Federation (no service-account keys anywhere).
set -euo pipefail

PROJECT_ID="${1:?usage: bash scripts/gcp-bootstrap.sh <gcp-project-id> [owner/repo]}"
REPO="${2:-vv8446931264-max/mehfil}"
REGION=us-central1
POOL=github

gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
DEPLOY_SA="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

grant() { # grant <member> <role>
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="$1" --role="$2" \
    --condition=None >/dev/null || echo "WARN: could not grant $2 to $1"
}

echo "==> Enabling APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com aiplatform.googleapis.com firestore.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com logging.googleapis.com

echo "==> Firestore (Native) + TTL on plans.expireAt"
gcloud firestore databases create --location="$REGION" --type=firestore-native 2>/dev/null \
  || echo "    database already exists"
gcloud firestore fields ttls update expireAt --collection-group=plans --enable-ttl --async \
  >/dev/null || echo "WARN: TTL policy not set (retry later)"

echo "==> Runtime identity: Vertex AI, Firestore, logging, source builds"
for role in roles/aiplatform.user roles/datastore.user roles/logging.logWriter roles/run.builder; do
  grant "serviceAccount:$RUNTIME_SA" "$role"
done

echo "==> Deployer service account for GitHub Actions"
gcloud iam service-accounts describe "$DEPLOY_SA" >/dev/null 2>&1 \
  || gcloud iam service-accounts create github-deployer --display-name="GitHub Actions deployer"
for role in roles/run.admin roles/cloudbuild.builds.editor roles/artifactregistry.admin \
            roles/storage.admin roles/iam.serviceAccountUser roles/serviceusage.serviceUsageConsumer; do
  grant "serviceAccount:$DEPLOY_SA" "$role"
done

echo "==> Workload Identity Federation (only $REPO may deploy)"
gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub"
gcloud iam workload-identity-pools providers describe "$POOL" --location=global \
  --workload-identity-pool="$POOL" >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools providers create-oidc "$POOL" --location=global \
       --workload-identity-pool="$POOL" \
       --issuer-uri="https://token.actions.githubusercontent.com" \
       --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
       --attribute-condition="assertion.repository=='${REPO}'"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}" \
  >/dev/null

echo "==> GitHub repository variables"
gh variable set GCP_PROJECT_ID --body "$PROJECT_ID" -R "$REPO"
gh variable set GCP_DEPLOY_SA --body "$DEPLOY_SA" -R "$REPO"
gh variable set GCP_WIF_PROVIDER -R "$REPO" \
  --body "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${POOL}"

echo
echo "Done. Every green push to main now deploys to Cloud Run."
echo "Expected live URL: https://mehfil-${PROJECT_NUMBER}.${REGION}.run.app"
echo "Put that URL in the cloud environment as LIVE_URL."
