# Accessibility

Target: **WCAG 2.2 AA**. Verified automatically in three places — `eslint-plugin-jsx-a11y`
in its `strict` preset on every component, axe-core in component tests (jsdom), and axe-core
in Playwright against the real rendered pages on desktop and mobile — with **zero
violations** on `/` and on every tab of `/plan/[id]`. Manual checks are listed below.

## What is in place

| Need | Implementation |
|---|---|
| Structure | `header` / `nav` / `main` / `footer` landmarks, one `h1` per page, chapter `section`s labelled by their headings, skip link to `#main` |
| Heading order | The plan title is the page's `h1` on `/plan/[id]` and an `h2` where the plan unfolds on `/`. Every heading inside the plan is a `<Heading depth>` (`src/components/plan/Heading.tsx`) that `PlanView` ranks from the title's level, so the outline never skips one: on the share page chapters are `h2`, and vendor-card titles, overview cards, idea names and tips are `h3`; on the landing page they are `h3` and `h4`. The vendor results heading sits one level below its card |
| Forms | Every field has a visible `<label>` — the Ask question field included, so its placeholder is never its only name; hints and errors are tied with `aria-describedby`; invalid fields get `aria-invalid`; the event type is a native radio group in a `fieldset` with a `legend`. The one deliberate exception is the "spent so far" input in each budget row: it sits under the visible "Spent so far" column header and carries an `aria-label` naming its category |
| Errors | On submit, a GOV.UK-style error summary receives focus, announces itself (`role="alert"`) and links to each field; messages say what happened and what to do. The inline "spent so far" error in the budget table is a `role="alert"` too and its field points at it with `aria-describedby`, so it is announced when it appears (the check runs on blur) and read again when the field is revisited |
| Live messages | Async results are announced through polite live regions (`role="status"` or `aria-live="polite"`): planning progress, the autosave status, the overspend alerts, the "link copied" confirmation, vendor lookups (results and errors) and the Ask status line. Only messages that need immediate attention are `role="alert"`: the form error summary and the budget row error |
| Ask FestiPlan | The question field has a visible label. While an answer streams, the Ask and suggestion buttons are `aria-disabled` instead of `disabled` and ignore presses, so keyboard focus is never stranded on a dead button. One polite status line says "Thinking about your question…", then "Answer ready." or the error. The streamed answer is not a live region (it would be read out chunk by chunk) and there is no `aria-busy` |
| Vendor lookup | "Find real vendors" stays focusable (`aria-disabled`) while it searches and ignores presses. When the results replace the button, focus moves to their heading (`tabindex="-1"`) if it was on the button or nowhere; if the visitor has moved on, focus stays where they put it. After a failed search the button, and focus on it, remain and the error is announced |
| Autosave status | The save status is a polite `role="status"`: "Saving…", "All changes saved" (only when nothing is pending or in flight), and "retrying in a moment" only while a retry is actually scheduled (waits of 2, 4, 6 and 8 s). When the fourth retry fails it says the changes are kept in the tab and saving resumes when the browser is back online or the visitor makes another change; the window's `online` event does retry automatically, from a fresh set of retries. A save that throws unexpectedly counts as a failed attempt: the in-flight counter comes down and the change is put back, never dropped |
| Plan workspace | The plan chapters are a WAI-ARIA tab interface: `role="tablist"`, roving `tabindex`, ←/→/Home/End, `aria-selected`/`aria-controls`, labelled `tabpanel`s; inactive panels use `hidden`; the URL hash deep-links a tab; timeline phases and vendor questions use native `<details>`/`<summary>`; print shows every panel and unfolds every group |
| Focus not obscured | The tab bar is sticky at the top of the viewport and 4.25 rem tall (`py-3` twice around 2.75 rem tabs). `<html>` carries `scroll-pt-17` (also 4.25 rem; `STICKY_BAR_SCROLL_PADDING` in `src/app/layout.tsx`), so the browser scrolls a focused element or an anchor target to just below the bar instead of under it (WCAG 2.4.11). A test fails if the bar's classes and the padding ever differ |
| Keyboard | Native controls throughout (`input type=range`, checkboxes, buttons, links); visible 3 px focus ring with 7.6:1 contrast; budget sliders announce rupees via `aria-valuetext`; the horizontal timeline rail is a focusable region |
| Targets | Every interactive element is at least 24 × 24 px (WCAG 2.2 SC 2.5.8, measured — see below); primary buttons, chips and slider rows are 44 px tall, and the Pause animation toggle is at least 44 × 44 px |
| Colour | Token contrasts measured in `docs/DESIGN.md` §3 (cream on espresso 17.26:1, muted 8.90:1, button labels 4.88:1); budget categories pair colour with a pattern **and** a text label; done tasks use a line-through rather than fading (fading failed contrast and was fixed); an overdue task or an overdue, unbooked vendor carries a visible "Overdue" text badge, so lateness is never shown by colour alone (WCAG 1.4.1) |
| Language | `<html lang="en">`; AI-written text in Hindi, Bengali, Tamil, Telugu, Marathi, Kannada or Gujarati carries the matching `lang` attribute so screen readers switch voices; template plans (always English) do not. In an Ask answer only the model's text carries the plan's `lang`: the English template fallback ("Template answer — AI unavailable.", whole or appended after a mid-stream failure) does not |
| Screen-reader names | Repeated actions carry hidden context ("Lock Venue", "Add to Google Calendar: Book the photographer (opens in a new tab)"); a test caught names being run together ("LockVenue") and it was fixed. The Pause animation toggle is always named "Pause animation" (below the `md` breakpoint only "Pause" is visible), with the space between the words outside the visually hidden span so no engine trims it |
| Motion | `prefers-reduced-motion: reduce` → no WebGL, a static poster, instant reveals, no smooth scrolling; Save-Data and low-power devices also get the poster; no scroll hijacking — scroll is native and the camera only listens |
| Pause, stop, hide | WCAG 2.2.2: a "Pause animation" toggle in the header on `/`, `/plan/[id]` and the 404 page (a button with `aria-pressed`). Pressed, it stops the lantern sky and shows its static poster; pressed again, a fresh scene starts. The choice is kept in `localStorage`, reaches other open tabs through the `storage` event, and holds for the current page only if storage is blocked; server markup always says "not paused" so hydration matches. The Budget Flow particles in the Budget chapter also honour the toggle: pressing "Pause animation" switches to the static chart; releasing mounts a fresh scene (the component remounts via a `key` change so all scene state resets cleanly) |
| Canvas | Every canvas is `aria-hidden`; every number it shows is in the DOM (the budget table is the source of truth) |
| Readability over the live sky | Text over the WebGL sky has a soft espresso halo, and lanterns dim to 30 % in the working chapters |
| High contrast | Under `forced-colors: active` (Windows High Contrast) the system palette takes over; states that were shown only by colour get system-colour equivalents: the selected tab uses `Highlight`/`HighlightText`, primary buttons keep a `ButtonText` border, progress meters draw in `Highlight` on `Canvas`, and palette swatches (content, not decoration) keep their real colours |
| Print | A print stylesheet produces a clean black-on-white plan |

## Covered by component tests (jsdom)

| Behaviour | Test file (`tests/components/`) |
|---|---|
| Pause animation: pressed state, stored choice, other-tab sync, blocked storage, header placement; the scene stops and a fresh one starts | `animation-pause.test.tsx`, `scene-backdrop.test.tsx` |
| Heading levels on both pages; the Overdue badge | `plan-headings.test.tsx` |
| Ask: visible label, `aria-disabled` and focus, status line, `lang` only on the model's text | `ask-section.test.tsx` |
| Vendor lookup: focus stays, moves to the results, is not stolen; error handling | `vendor-finder.test.tsx` |
| Budget row error: `role="alert"` and `aria-describedby` | `budget-row.test.tsx` |
| Autosave: the final retry, the `online` resume, a throwing save, the status wording | `autosave.test.tsx` |
| Scroll padding equals the sticky tab bar's height | `scroll-padding.test.tsx` |

jsdom has no layout, no scrolling and no screen reader, so these tests prove the markup,
the attributes and the focus order, not how a browser renders or speaks them. Not yet
measured: where focused controls land relative to the tab bar in Chromium at 320 and
1440 px, and how NVDA and VoiceOver speak the Ask status line, the save status and the
budget row alert.

## Checks performed (scripted in Chromium, 2026-10-24)

| Check | Result |
|---|---|
| `prefers-reduced-motion: reduce` | no canvas mounted, static poster shown |
| Horizontal overflow at 320, 375 and 720 px (≈ 200 % zoom of 1440) on `/` and `/plan/[id]` | 0 px on every page and width |
| Keyboard tab order on `/` | skip link → header links → hero CTAs → three demo briefs → event-type radios → date → city → guests → budget → name → vibe → constraints; every stop shows the 3 px ring (the native date picker button draws its own) |
| Interactive targets smaller than 24 px on an editable plan | none (checkboxes were 13–20 px and two link styles 20 px tall before this check; both fixed) |
| axe-core, WCAG 2.0–2.2 A/AA, desktop 1440 and Pixel 7, `/` and `/plan/[id]` | 0 violations (Playwright, every CI run) |

The header has gained the Pause animation toggle since that run: it is the last stop in
the header, right after "Start planning" and before the hero buttons.
