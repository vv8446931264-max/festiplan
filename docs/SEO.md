# SEO

Only `/` is meant to be found. `/plan/[id]` pages are private share links: `noindex, nofollow`
(meta + `X-Robots-Tag`), `Disallow: /plan/` in robots.txt, and no canonical, `og:url` or
JSON-LD of their own. Search copy, structured data and the FAQ live in `src/lib/seo/`.

## How this was measured

- **Lighthouse 13.5.0** (`npx lighthouse@13.5.0`), headless Chromium 1243, categories
  performance / accessibility / best-practices / seo, default mobile settings (simulated slow 4G,
  4× CPU) and `--preset=desktop`. The target was `next start` on a production build with
  `RATE_LIMIT_SCALE=50` and no AI credentials (template mode), on localhost.
- **Raw HTML audit** of `/`, plus status codes for the crawl files, with `curl` and jsdom.
- **Controlled A/B.** Other engineers were editing the planner while this work ran. So the
  same source tree was built twice, with and without this change, and Lighthouse ran in
  alternation, 10 mobile and 3 desktop runs per side.

## Lighthouse, before → after

Median of 3 runs (individual runs in brackets). "Before" is the repository when this work
started; "after" is the final build.

| Category | Mobile before | Mobile after | Desktop before | Desktop after |
|---|---|---|---|---|
| Performance | 93 (76, 93, 94) | 92 (92, 90, 93) | 100 | 100 |
| Accessibility | 100 | 100 | 100 | 100 |
| Best practices | 100 | 100 | 100 | 100 |
| SEO | 100 | 100 | 100 | 100 |

Lighthouse SEO was already 100 because it only checks basics: a title, a description, a 200
status, crawlable links, a valid robots.txt. The real gaps were outside what it checks; see the
findings table. The first "before" mobile run was a cold start (TBT 970 ms against 130–160 ms
for the next two runs).

**Controlled A/B (mobile performance, n = 10 per side).** Median 92 against 92; mean 92.7
against 91.4. Simulated LCP 2.73 s against 2.76 s, TBT 207 ms against 249 ms; TBT alone
ranges from 114 to 291 ms between runs on the same build. Desktop scored 100 on both sides.
The first A/B, before the copy trims described below, measured 94 against 91. At that point the
page was 14.1 KB of gzip HTML plus 1.5 KB of headers, which needs a second TCP round trip
(the initial window is about 14.6 KB), and Lantern charges that round trip. Shorter FAQ answers
and a leaner `featureList` brought the score back within noise. The total is now 14.8 KB, still
just over the window.

**Mobile LCP.** The simulated mobile LCP ranges from 2.3 to 3.1 s across runs, both before and
after this change. The LCP element is the small "For every celebration" label, and the observed
(unthrottled) LCP equals FCP at about 0.23–0.28 s. Lantern adds the hydration JavaScript that
ran before that paint.

## Findings

| Check | Before | After | Evidence / file |
|---|---|---|---|
| Title | "FestiPlan — AI Celebration & Event Planner", 42 chars, no searcher terms | "AI Wedding, Birthday & Event Planner for India · FestiPlan", 58 chars | `src/lib/seo/copy.ts`; `tests/seo/metadata.test.ts`, `e2e/seo.spec.ts` (50–60) |
| Meta description | 173 chars (truncated in results) | 159 chars: free, weddings / birthday parties / community events, budget to the rupee, timeline, real vendors | same (140–160) |
| Canonical | missing | `https://…run.app` on `/` only. Root canonical = bare origin, the same string as the sitemap `<loc>` and JSON-LD `url` | `homeMetadata()` in `src/lib/seo/metadata.ts`; e2e asserts they are equal |
| Canonical leakage | — | not set in the layout, because metadata merges shallowly and `/plan/[id]` would inherit it | `rootMetadata()`; unit test "has no canonical or og:url" |
| Open Graph | title, description, site_name, type; no url, image or locale | + `og:url`, `og:locale=en_IN`, `og:image` 1200 × 630 PNG with alt | `src/app/opengraph-image.tsx` (`next/og`, bundled Geist font) |
| Twitter card | `summary`, no image | `summary_large_image` + `twitter:image` | `src/app/twitter-image.tsx` (re-exports the OG card) |
| Structured data | none | one `@graph`: `WebSite`, `Organization` (512 px logo), `WebApplication` (LifestyleApplication, OS Any, free, ₹0 offer, `en-IN`, featureList), `FAQPage`. Carries the request's CSP nonce; `<` escaped as `<` | `src/lib/seo/json-ld.ts`, `src/components/landing/JsonLd.tsx`; `tests/seo/json-ld.test.ts`; e2e checks nonce = CSP nonce |
| Answers to common questions | none | 6-question FAQ (budget split, free, which events, languages, real vendors, privacy) in native `<details>`. Numbers come from code constants (10 % contingency, 180-day TTL, guest and budget limits, language list) | `src/lib/seo/faq.ts`, `src/components/landing/Faq.tsx`; `tests/seo/faq.test.tsx` (visible text = JSON-LD text, axe clean) |
| H1 | one h1; screen-reader text "FestiPlan — AI Celebration & Event Planner"; its `textContent` ran into the visual letters ("…PlannerFestiPlan") | "FestiPlan — AI planner for weddings, birthdays & community events", separated from the wordmark | `src/components/landing/Hero.tsx` |
| Heading outline | h1 → h2 → h3 × 4 → h2 | unchanged + h2 for the FAQ. Questions sit in `<summary>`, not headings, because screen readers treat headings inside `<summary>` inconsistently | HTML audit |
| Images / alt | no `<img>` on the landing page (canvas is `aria-hidden`) | unchanged; the OG image has alt text | HTML audit |
| Link text | all descriptive | + "FAQ" link in the header (`/#faq`) | `src/components/landing/SiteHeader.tsx` |
| `lang` | `en` | unchanged (see below) | `src/app/layout.tsx` |
| Robots on `/` | none (indexable) | `max-image-preview:large` | `homeMetadata()` |
| `/plan/[id]` | `noindex, nofollow` meta + header | unchanged; now also shows the OG card in link previews | e2e "plan pages stay out of the index" |
| robots.txt | allow `/`, disallow `/api/`, `/plan/`, sitemap link | same rules; URL built by `absoluteUrl()` | `src/app/robots.ts` |
| sitemap.xml | 1 URL, no `lastmod` | 1 URL equal to the canonical, `lastmod` = build (deploy) time | `src/app/sitemap.ts` |
| Manifest | SVG icon only; description was the tagline | + `id`, `scope`, `lang`, `categories`; PNG 192 / 512 (`any`) and 512 `maskable`; search description | `src/app/manifest.ts`, `src/app/icon.tsx` |
| Icons | `icon.svg` only; no apple-touch-icon | + `/icon/192`, `/icon/512` (PNG favicons for browsers without SVG support), `/apple-icon` 180 × 180. Full-bleed, with the lantern inside the 40 % maskable safe zone | `src/lib/seo/icon-art.tsx`; `tests/seo/images.test.ts` decodes the PNG sizes |
| Status codes | `/` 200, `/sitemap.xml` 200 XML, `/robots.txt` 200, `/plan/doesnotexist` 404 + noindex | unchanged | e2e |
| HTML weight (gzip as served) | 9.3 KB | 13.3 KB: metadata +0.7, FAQ +2.2, JSON-LD +1.1 (each measured by building without it) | `curl -H "Accept-Encoding: gzip"`, same tree ± change |

## Deliberately not done

- **No ratings, reviews or `aggregateRating`.** There are none to cite. As a result Google won't
  show a software-app rich result, which requires one of them.
- **No FAQ rich result is expected.** Since August 2023 Google shows FAQ rich results only for
  well-known government and health sites. The `FAQPage` node stays because it mirrors visible text
  word for word and other consumers read it. If the bytes matter more, this is the place to cut.
  The whole JSON-LD costs 1.1 KB of gzip HTML, and `FAQPage` is 58 % of its characters. Each
  answer appears four times in the HTML: visible, React's RSC copy, JSON-LD, and the JSON-LD's
  RSC copy.
- **The JSON-LD stays a server component.** Rendering it from a client component removes its RSC
  copy (−0.7 KB HTML), but it moved the FAQ and the builder into the bundle (+2.6 KB gzip JS).
  That was measured and rejected.
- **Plans stay out of search.** They keep `noindex`, `Disallow: /plan/`, and are not in the sitemap.
- **No `hreflang`, and `lang` stays `en`.** The UI is English only. Plans written in Hindi,
  Tamil and other languages are user content behind `noindex`; the plan view marks them up with
  their own `lang`.
- **No `keywords` meta and no keyword stuffing.** Google ignores the tag.
- **No `/favicon.ico`.** Next.js cannot generate one from code, and browsers and Google use the
  declared `rel="icon"` links, so the path still returns 404.
- **Plan share previews still use the landing page's `og:title` and description.** `src/app/plan/`
  belongs to the planner work; a plan-specific `openGraph` in its `generateMetadata` would fix it.

## Next steps that need the live domain

1. **Search Console:** verify the property, either with a DNS TXT record on a custom domain or
   with a `verification: { google: "…" }` entry in `rootMetadata()` for the run.app URL prefix.
   Then submit `/sitemap.xml` and inspect `/`.
2. **Field data:** a new run.app origin will have no CrUX data until it has enough traffic. Use
   Search Console's Core Web Vitals report or PageSpeed Insights field data once they exist,
   instead of the lab numbers above.
3. **Validators:** run the live URL through the Rich Results Test, the Schema Markup Validator
   and the social debuggers (LinkedIn Post Inspector, a WhatsApp preview). This sandbox cannot
   reach Google.
4. **Custom domain:** set `SITE_URL` to it so the canonical, sitemap, robots, JSON-LD and OG URLs
   follow, and 301-redirect the run.app host.
5. **Bing Webmaster Tools:** import from Search Console.

## Reproduce

```bash
npm run build && RATE_LIMIT_SCALE=50 npx next start -p 3500 &
CHROME_PATH=/opt/pw-browsers/chromium npx lighthouse@13.5.0 http://localhost:3500/ \
  --only-categories=seo,performance,accessibility,best-practices \
  --chrome-flags="--headless=new --no-sandbox"            # add --preset=desktop for desktop
curl -s -H 'Accept-Encoding: gzip' localhost:3500/ | wc -c  # HTML bytes on the wire
E2E_PORT=3500 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/seo.spec.ts
```
