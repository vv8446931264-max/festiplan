#!/usr/bin/env bash
# One-time Google Cloud setup for FestiPlan. Run locally with an Owner account:
#   bash scripts/gcp-bootstrap.sh <gcp-project-id> [github-owner/repo]
# Enables APIs, creates Firestore (+ TTL on plans.expireAt), creates a dedicated
# least-privilege Cloud Run runtime identity (Vertex AI + Firestore + logging only), and
# lets GitHub Actions deploy via Workload Identity Federation (no service-account keys
# anywhere). Safe to re-run: every step is idempotent.
set -euo pipefail

PROJECT_ID="${1:?usage: bash scripts/gcp-bootstrap.sh <gcp-project-id> [owner/repo]}"
REPO="${2:-vv8446931264-max/festiplan}"
REGION=us-central1
POOL=github
DB=festiplan

# Scope the project to this run only; the global gcloud config is left untouched.
export CLOUDSDK_CORE_PROJECT="$PROJECT_ID" CLOUDSDK_CORE_DISABLE_PROMPTS=1
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
# Default compute SA: Cloud Build identity for `gcloud run deploy --source`, and the legacy
# runtime identity for deploys made before GCP_RUNTIME_SA existed.
DEFAULT_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
# Dedicated runtime identity (preferred): the deploy workflow passes it as --service-account.
RUNTIME_SA="festiplan-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOY_SA="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

grant() { # grant <member> <role>; retries because a just-created service account propagates slowly
  for _ in 1 2 3 4 5; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="$1" --role="$2" \
      --condition=None >/dev/null 2>&1 && return 0
    sleep 10
  done
  echo "WARN: could not grant $2 to $1"
}

grant_on_sa() { # grant_on_sa <service-account> <member> <role>; a binding on one SA, not the project
  for _ in 1 2 3 4 5; do
    gcloud iam service-accounts add-iam-policy-binding "$1" --member="$2" --role="$3" \
      >/dev/null 2>&1 && return 0
    sleep 10
  done
  echo "WARN: could not grant $3 on $1 to $2"
}

echo "==> Enabling APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com aiplatform.googleapis.com firestore.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com logging.googleapis.com

# A named Native-mode database, so an existing (possibly Datastore-mode) default DB is untouched.
echo "==> Firestore Native database '$DB' + TTL on plans.expireAt"
gcloud firestore databases create --database="$DB" --location="$REGION" --type=firestore-native \
  2>/dev/null || echo "    database $DB already exists"
gcloud firestore fields ttls update expireAt --database="$DB" --collection-group=plans \
  --enable-ttl --async >/dev/null || echo "WARN: TTL policy not set (retry later)"

echo "==> Dedicated runtime identity $RUNTIME_SA: Vertex AI, Firestore, logging — nothing else"
gcloud iam service-accounts describe "$RUNTIME_SA" >/dev/null 2>&1 \
  || gcloud iam service-accounts create festiplan-runtime --display-name="FestiPlan Cloud Run runtime"
for role in roles/aiplatform.user roles/datastore.user roles/logging.logWriter; do
  grant "serviceAccount:$RUNTIME_SA" "$role"
done

# Backward compatibility: projects bootstrapped before the dedicated SA ran the service as the
# default compute SA, and deploys without GCP_RUNTIME_SA still do. The dedicated SA above is
# preferred; once GCP_RUNTIME_SA is set and a deploy has gone out, the first three roles
# below can be removed from the default SA. roles/run.builder stays: --source builds run as it.
echo "==> Default compute SA: source builds (+ legacy runtime roles)"
for role in roles/aiplatform.user roles/datastore.user roles/logging.logWriter roles/run.builder; do
  grant "serviceAccount:$DEFAULT_SA" "$role"
done

echo "==> Deployer service account for GitHub Actions"
gcloud iam service-accounts describe "$DEPLOY_SA" >/dev/null 2>&1 \
  || gcloud iam service-accounts create github-deployer --display-name="GitHub Actions deployer"
for role in roles/run.admin roles/cloudbuild.builds.editor roles/artifactregistry.admin \
            roles/storage.admin roles/iam.serviceAccountUser roles/serviceusage.serviceUsageConsumer; do
  grant "serviceAccount:$DEPLOY_SA" "$role"
done
# The deployer must be able to act as the runtime identity it deploys the service with.
grant_on_sa "$RUNTIME_SA" "serviceAccount:$DEPLOY_SA" roles/iam.serviceAccountUser

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
gh variable set GCP_RUNTIME_SA --body "$RUNTIME_SA" -R "$REPO"
gh variable set GCP_WIF_PROVIDER -R "$REPO" \
  --body "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${POOL}"

echo
echo "Done. Every green push to main now deploys to Cloud Run."
echo "Expected live URL: https://festiplan-${PROJECT_NUMBER}.${REGION}.run.app"
echo "Put that URL in the cloud environment as LIVE_URL."
