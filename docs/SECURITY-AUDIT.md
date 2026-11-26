# Security audit (frontend + dependencies), 26 Nov 2026

Measured by running the commands below on the repo. Not a penetration test.

## Secrets in code and git history
- Current tree: `git grep` found no passwords, tokens or private keys. Only the env name `VITE_FIREBASE_VAPID_KEY` (a name, no value).
- Full history (`git log --all -p -G` for ghp_, github_pat_, sk_live, PRIVATE KEY, AKIA, xox): no matches.
- Firebase web `apiKey` (starts with AIza) appears in old committed `dist/` bundles (8 commits touch `dist`). This key is public by design for web apps. It does not grant data access; rules do. Not deleted (deleting would not remove it from clones and would break nothing useful).
- Manual step for the owner: restrict this key by HTTP referrer in Google Cloud Console (APIs & Services > Credentials) to `phdgxt4-coder.github.io/*` (and localhost for development).

## Dependencies (`pnpm audit`: 1 high, 4 moderate, 1 low)
| Package | Severity | Path | Runtime in browser? |
|---|---|---|---|
| @grpc/grpc-js < 1.13.6 | high + low | firebase > @firebase/firestore | No. grpc-js is the Node transport; the browser bundle uses the web transport. |
| uuid, @opentelemetry/core, glob, minimatch | moderate | firebase-tools (dev CLI) | No. Dev tool only, not shipped. |
Not fixed: the fix needs a firebase SDK upgrade or a tools upgrade (major-library rule). Re-check after the next planned `firebase` update.

## External domains used by the pages
fonts.googleapis.com and fonts.gstatic.com (Cairo font), the Firebase endpoints (Auth, Firestore) through the SDK, www.w3.org (SVG namespace strings only, not requests). No analytics, no CDN scripts, no other third party found in index.html, src, public, styles.
Data flow: the font request exposes visitor IP and user agent to Google Fonts. Self-hosting the font would remove it (suggested, not done).

## CSP
Not added (needs full testing of Firebase and font origins). Suggested starting policy for the host if headers become possible: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com; img-src 'self' data: https:. GitHub Pages cannot set headers, so a meta CSP would be the only route.
