# Measurements (baseline at main b34d76c, 26 Nov 2026 ~03:07)
Method: `pnpm build`, then `gzip -9` on each file in dist/assets. Numbers are measured, not estimated. Lighthouse and Slow-4G runs: not done yet (marked below when done).

## Bundle (gzip, largest first)
| file | raw B | gzip B |
|---|---|---|
| index.esm-C07055Nu.js (Firebase Firestore/Auth SDK) | 583899 | 170608 |
| index.esm-7y4tYbIq.js | 128417 | 36133 |
| components-enjordEQ.js | 53089 | 19064 |
| main-DK_9eJ5L.js (app) | 59309 | 18035 |
| main-BrxVskW2.css | 66571 | 14499 |
| index.esm-DH3k_xyM.js | 29527 | 9836 |
| Alex-*.js | 13752 | 9529 |
| admin-*.js | 32284 | 9386 |
Dashboards (admin, teacher...) and Alex are already separate lazy chunks. The Firebase SDK is about 70% of the gzip weight and cannot be reduced without dropping features.

## Realtime listeners (onSnapshot call sites in src)
chat.js 3 (conversation list, open thread messages, thread doc), parent-chat.js 3, notifications-service.js 2, content-service.js 1. All other screens use one-shot getDocs with limit/pager. Listeners opened by chat are closed by the returned cleanup (stopThread/stopList) when leaving the screen; the thread listeners are closed on back. Peak per role (chat open): student/teacher 3 + notifications, parent 3 + notifications. Not measured at runtime against live Firebase.

## Images over 200KB
Only public/assets/icons/icon-512.png (424194 B), used as the app icon; the 512 size is required by the manifest. Could be compressed with a tool (not changed).

## Lighthouse mobile (local `vite preview` of main 57cd01d, Lighthouse default mobile emulation with simulated throttling, measured 26 Nov 05:14)
| page | Performance | Accessibility | Best Practices | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| home | 96 | 100 | 100 | 92 | 1.5 s | 220 ms | 0.002 |
| /login/student | 99 | 100 | 100 | 92 | 1.4 s | 120 ms | 0.036 |
SEO 92: the only failed audit is `robots.txt` missing. Not added: whether a school site with minors' data should be indexed is the owner's decision (recommendation: add a robots.txt that allows public pages and disallows /dashboard and /login).
These are lab numbers on this machine's local server, not real phones and not the live GitHub Pages network path. Performance under load is not measured. No "before" run exists for the earlier releases, so there is no before/after comparison, only this baseline.
