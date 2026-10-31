# Accessibility

Target: **WCAG 2.2 AA**. Verified automatically in three places — `eslint-plugin-jsx-a11y`
in its `strict` preset on every component, axe-core in component tests (jsdom), and axe-core
in Playwright against the real rendered pages on desktop and mobile — with **zero
violations** on `/` and on every tab of `/plan/[id]`. Manual checks are listed below.

## What is in place

| Need | Implementation |
|---|---|
| Structure | `header` / `nav` / `main` / `footer` landmarks, one `h1` per page, chapter `section`s labelled by their headings, skip link to `#main` |
| Forms | Every control has a visible `<label>`; hints and errors are tied with `aria-describedby`; invalid fields get `aria-invalid`; the event type is a native radio group in a `fieldset` with a `legend` |
| Errors | On submit, a GOV.UK-style error summary receives focus, announces itself (`role="alert"`) and links to each field; messages say what happened and what to do |
| Async results | Staged progress, save status, vendor results, overspend alerts and the streamed "Ask FestiPlan" answer are `aria-live` regions |
| Plan workspace | The plan chapters are a WAI-ARIA tab interface: `role="tablist"`, roving `tabindex`, ←/→/Home/End, `aria-selected`/`aria-controls`, labelled `tabpanel`s; inactive panels use `hidden`; the URL hash deep-links a tab; timeline phases and vendor questions use native `<details>`/`<summary>`; print shows every panel and unfolds every group |
| Keyboard | Native controls throughout (`input type=range`, checkboxes, buttons, links); visible 3 px focus ring with 7.6:1 contrast; budget sliders announce rupees via `aria-valuetext`; the horizontal timeline rail is a focusable region |
| Targets | Every interactive element is at least 24 × 24 px (WCAG 2.2 SC 2.5.8, measured — see below); primary buttons, chips and slider rows are 44 px tall |
| Colour | Token contrasts measured in `docs/DESIGN.md` §3 (cream on espresso 17.26:1, muted 8.90:1, button labels 4.88:1); budget categories pair colour with a pattern **and** a text label; done tasks use a line-through rather than fading (fading failed contrast and was fixed) |
| Language | `<html lang="en">`; AI-written text in Hindi, Bengali, Tamil, Telugu, Marathi, Kannada or Gujarati carries the matching `lang` attribute so screen readers switch voices; template plans (always English) do not |
| Screen-reader names | Repeated actions carry hidden context ("Lock Venue", "Add to Google Calendar: Book the photographer (opens in a new tab)"); a test caught names being run together ("LockVenue") and it was fixed |
| Motion | `prefers-reduced-motion: reduce` → no WebGL, a static poster, instant reveals, no smooth scrolling; Save-Data and low-power devices also get the poster; no scroll hijacking — scroll is native and the camera only listens |
| Canvas | Every canvas is `aria-hidden`; every number it shows is in the DOM (the budget table is the source of truth) |
| Readability over the live sky | Text over the WebGL sky has a soft espresso halo, and lanterns dim to 30 % in the working chapters |
| High contrast | Under `forced-colors: active` (Windows High Contrast) the system palette takes over; states that were shown only by colour get system-colour equivalents: the selected tab uses `Highlight`/`HighlightText`, primary buttons keep a `ButtonText` border, progress meters draw in `Highlight` on `Canvas`, and palette swatches (content, not decoration) keep their real colours |
| Print | A print stylesheet produces a clean black-on-white plan |

## Checks performed (scripted in Chromium, 2026-10-24)

| Check | Result |
|---|---|
| `prefers-reduced-motion: reduce` | no canvas mounted, static poster shown |
| Horizontal overflow at 320, 375 and 720 px (≈ 200 % zoom of 1440) on `/` and `/plan/[id]` | 0 px on every page and width |
| Keyboard tab order on `/` | skip link → header links → hero CTAs → three demo briefs → event-type radios → date → city → guests → budget → name → vibe → constraints; every stop shows the 3 px ring (the native date picker button draws its own) |
| Interactive targets smaller than 24 px on an editable plan | none (checkboxes were 13–20 px and two link styles 20 px tall before this check; both fixed) |
| axe-core, WCAG 2.0–2.2 A/AA, desktop 1440 and Pixel 7, `/` and `/plan/[id]` | 0 violations (Playwright, every CI run) |
