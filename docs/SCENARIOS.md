# Scenario results (final code at main 57cd01d)

Run 26 Nov 2026 04:55 on the Firebase emulators with the current client code (a real Chrome page calling the app's own functions).
- NEW = `firestore.rules` in the repo (the proposed rules).
- OLD = rules at commit c0c0ebf (about what was deployed on 25 Nov evening).
Script: `scripts/e2e/scenarios.mjs` (README next to it). 36 steps: registration (student, parent, teacher), verification, parent code and link, admin classes/subjects/approval/assignment/import/invite, teacher reads, chat (student to teacher, teacher reply), and negative (unauthorized) attempts.

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

Result: NEW 36/36 pass, OLD 36/36 pass, no failures.

Notes and gaps (honest):
- The chat reply needs a pause of more than 2 seconds after the previous message: that is the rules' rate limit (chatRateOk), not a bug. The first run without the pause was refused by the rules in both versions.
- An earlier harness version reported two failures ("list linked students", "list teacher applications"); those were the script reading the wrong result shape (the functions return an object with `students` / `applications`). Fixed in the script, both pass.
- Image upload: not run. The repo has no Storage rules and no upload code path was exercised; the teacher "images" section was only rendered (0 JS errors), not used with a file.
- Parent to teacher chat: covered by `tests/parent-chat-rules.test.js` (rules emulator), not by this script.
- Unauthorized attempts covered here: student self-promote to admin, student sending as the teacher, student writing grades, student reading admins, student creating a class, teacher approving a teacher. More in the rules test suites (138 tests with the emulator).
- Nothing was loosened to make a scenario pass.
- This is an emulator, not the live project: real email delivery, real indexes and real quotas are untested.
