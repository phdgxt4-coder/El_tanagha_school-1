# Scenario results (code at main 7e314cd)

Run 26 Nov 2026 08:03 on the Firebase emulators with the client code of that commit (a real Chrome page calling the app's own functions).
- NEW = `firestore.rules` in the repo (the proposed rules).
- OLD = rules at commit c0c0ebf (about what was deployed on 25 Nov evening).
Script: `scripts/e2e/scenarios.mjs` (README next to it). Steps: registration (student, parent, teacher), verification, parent code and link, admin classes/subjects/approval/assignment/import/invite, teacher reads, chat (student to teacher and reply), image resize and publish, and negative (unauthorized) attempts.

| # | Step | NEW rules | OLD rules |
|---|---|---|---|
| 1 | admin doc created per ADMIN_BOOTSTRAP steps (console-style write) | PASS | PASS |
| 2 | admin sign in + status=admin | PASS | PASS |
| 3 | admin: seed default subjects | PASS | PASS |
| 4 | admin: create class grade1 section A | PASS | PASS |
| 5 | admin: create class grade2 bac_med | PASS | PASS |
| 6 | admin: create class grade3 science | PASS | PASS |
| 7 | admin: add custom subject | PASS | PASS |
| 8 | student: register (grade1) | PASS | PASS |
| 9 | student: status active after verify | PASS | PASS |
| 10 | student: issue parent code | PASS | PASS |
| 11 | parent: register | PASS | PASS |
| 12 | parent: link with code | PASS | PASS |
| 13 | parent: list linked students | PASS | PASS |
| 14 | parent: code is single use (2nd link fails) | PASS | PASS |
| 15 | teacher: register (pending) | PASS | PASS |
| 16 | teacher: status pending | PASS | PASS |
| 17 | admin: list teacher applications | PASS | PASS |
| 18 | admin: approve teacher | PASS | PASS |
| 19 | admin: assign teacher to subject+class1 | PASS | PASS |
| 20 | admin: import roster rows | PASS | PASS |
| 21 | admin: search users (teacher) | PASS | PASS |
| 22 | admin: invite another admin | PASS | PASS |
| 23 | teacher: signs in and is active teacher | PASS | PASS |
| 24 | teacher: reads own assignments | PASS | PASS |
| 25 | teacher: reads class roster | PASS | PASS |
| 26 | student cannot self-promote (negative) | PASS | PASS |
| 27 | password reset email request | PASS | PASS |
| 28 | chat: student sends first message to teacher | PASS | PASS |
| 29 | chat: student reads own conversation messages | PASS | PASS |
| 30 | chat: student cannot send as someone else (negative) | PASS | PASS |
| 31 | student cannot write grades (negative) | PASS | PASS |
| 32 | student cannot read admins collection (negative) | PASS | PASS |
| 33 | student cannot create a class (negative) | PASS | PASS |
| 34 | chat: teacher replies (after the 2s rate limit) | PASS | PASS |
| 35 | chat: teacher lists own conversations | PASS | PASS |
| 36 | teacher cannot self-assign / approve (negative) | PASS | PASS |
| 37 | image: teacher resizes a real picture and publishes it | PASS | PASS |
| 38 | image: teacher cannot publish a non-jpeg payload (negative) | PASS | PASS |
| 39 | image: student of the class sees it | PASS | PASS |
| 40 | image: student cannot publish an image (negative) | PASS | PASS |

Result: NEW 40/40 pass, OLD 40/40 pass.

Notes and gaps (honest):
- The chat reply needs a pause of more than 2 seconds after the previous message: that is the rules' rate limit (chatRateOk), not a bug.
- Images are stored as resized JPEG data inside Firestore (no Storage): the step resizes a 2000x1200 picture in the browser and publishes it; a non-JPEG payload and a student upload are refused.
- Parent to teacher chat: covered by `tests/parent-chat-rules.test.js` (rules emulator), not by this script.
- Unauthorized attempts covered here: student self-promote to admin, student sending as the teacher, student writing grades, student reading admins, student creating a class, teacher approving a teacher, non-JPEG image, student image upload. More in the rules test suites.
- Nothing was loosened to make a scenario pass.
- This is an emulator, not the live project: real email delivery, real indexes and real quotas are untested.
