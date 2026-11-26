Local scenario runs (emulators only, never against the live project).
1. `git apply scripts/e2e/emulator-wiring.patch`; create `src/e2e-fs.js` with `export * from 'firebase/firestore';`
2. Make a firebase config with auth 9099 and firestore 8181 pointing `rules` at the rules file to test (new = firestore.rules, old = any older copy).
3. `firebase emulators:exec --config <that file> --project demo-e2e --only auth,firestore "node scripts/e2e/scenarios.mjs"` (needs JDK 21 and Chrome).
Revert the patch and delete the helper file before committing anything else.
