# Release notes

## Merged to main (one at a time, tests green before each)
- #57 (earlier): Alex v5/v6. #56 (earlier): parent code layout.
- #58 and #59 had been merged only into their stacked branches, so Alex v7 to v10 were not on main. Re-targeted as #61 and merged (merge 5d4c0ee).
- #60: /login/admin shows the admin login page (merge f242107).
- Backup branch before release: `backup-before-release` at 601eb38.

## Verified
- 128/128 tests with the Firestore emulator before each merge; build OK.
- CI deploy to GitHub Pages succeeded for 5d4c0ee; live site opened at 360 and 390 px on 16 routes with no horizontal overflow, no broken images and no JS errors after #61.
- 26 flows against local Auth and Firestore emulators (temporary wiring, not committed): first admin by Console doc, admin setup (classes, subjects), student/parent/teacher registration, teacher approval and assignment, parent code (single use), roster import, admin invite, student cannot self-promote.

## Not tested
- Real phones and browsers, real Firebase project, real email delivery (verification, reset), push when the app is closed, load or quota (Spark limits 50k reads/20k writes per day are an unverified estimate), chat/timetable/tasks/attendance by clicking.

## Waiting for the owner
- Firebase: run the commands in DEPLOY.md (`firebase deploy --only firestore:rules,firestore:indexes`). Not done: no Firebase login here.
- Create the first admin in Firebase Console (docs/ADMIN_BOOTSTRAP.md). No password or key is in the repo.
- Change any password pasted in chat earlier.
- Oscar, Leo, Chloe characters not started.
- The 9-phase maintenance brief pasted at 2:06 AM was marked "do not execute, tell me what is missing"; nothing from it was run.

## Not done on purpose
No weakening of Firestore rules, no secrets in code, no data deleted.
