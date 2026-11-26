# CHANGELOG (ملف – ماذا – لماذا)

## 26 Nov 2026, merged to main during the overnight session
Each merge ran all tests with the rules emulator, a build, a CI deploy and a live check of 16 routes at 360 and 390 px.

| PR / merge | File | What | Why |
|---|---|---|---|
| #63 b34d76c | `src/ui/error-boundary.js`, `src/app.js`, `styles/states.css`, `tests/error-boundary.test.js` | Arabic error toast with retry, fallback card if a page render throws | A JS error used to leave a blank or broken page with no message |
| #63 | `src/services/error-reporter.js` | Scrubs emails, phones, link codes and long ids from logged errors | Minors' data must not end up in the error log |
| #63 | `docs/rollback/*` | Copies of the rules and indexes before this session | Quick rollback reference |
| #66 3f78086 | `index.html`, `tests/meta.test.js` | Favicon link and Open Graph tags | Link previews and browser tab icon |
| #67 57cd01d | `src/ui/update-notice.js`, `src/app.js`, `styles/states.css` | Small top bar "يوجد إصدار أحدث" when a new service worker takes over a running page. Hidden while typing, never reloads by itself | Users on an old page were never told |
| link checker b9eb8fa | `scripts/check-links.mjs` | Checks every relative link in the built site | Catch broken links before deploy (not wired into CI) |
| load-states 7bfefeb | `src/utils/load-state.js`, `src/pages/dashboards/common.js` | Lists time out after 15 s, show a retry button, and say "هذه الخدمة غير متاحة الآن" on permission-denied or missing index | Avoid endless skeletons and silent failures when rules or indexes are not published |
| touch-targets 9c3dcc5 | `styles/dashboards.css` | 44 px targets for the bell, attendance chips and text buttons | They measured 28 to 36 px at 390 px |
| cairo-dates 499ddf0 | `src/pages/dashboards/common.js`, `src/app.js`, `src/pages/report-card.js` | Dates formatted in Africa/Cairo | A phone in another time zone showed the wrong school day |

Earlier in the same session: #61 (Alex v7 to v10, 5d4c0ee), #60 (/login/admin, f242107), #62 (RELEASE_NOTES.md, 0e2357a).

## Open pull requests (not merged on purpose, they touch sensitive areas)
| PR | File | What | Why |
|---|---|---|---|
| #64 | `src/ui/cleanups.js`, `src/pages/chat.js`, `src/pages/parent-chat.js`, `src/app.js` | Close chat listeners on route change and sign-out | Listeners stayed open after leaving (cleanup was returned but never called) |
| #65 | `src/utils/xlsx-reader.js` | 5 MB limit, strip = + - @ at the start of cells | Formula injection and huge files in the roster import |
| #68 | `src/utils/attempt-limiter.js`, `src/pages/dashboards/parent.js` | 60 s wait after 5 wrong parent-link codes (front end only) | Slow down guessing; a real limit needs the server |

## Docs added on the work branch (merged to main once, at the end)
`HANDOFF.md`, `RUNBOOK.md`, `docs/guides/*`, `docs/SCENARIOS.md`, `docs/SECURITY-AUDIT.md`, `docs/MEASUREMENTS.md`, `docs/CHARACTERS.md`, `scripts/e2e/*`.
