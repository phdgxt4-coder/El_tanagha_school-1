# STATUS (branch platform/63-stability only, never merged on its own)

Delivery time (final, chosen at phase 0): 13:00 Cairo, Thu 26 Nov 2026. Freeze: 12:15. Reason: ~24 items, each main merge waits for a deploy and a live check; the session itself ends 13:49, so the latest safe delivery is 13:00. Not to be extended.

## Restore point
Branch + tag `backup-2026-11-26-start` = 0e2357a63855390b77ec78dd768616c5886797ed (main at start of this session). الرجوع لحالة بداية هذه الجلسة = الـ hash الجديد (0e2357a63855390b77ec78dd768616c5886797ed)، وليس 601eb38.
`backup-before-release` (601eb38) is kept untouched.

## Phase log
- 02:16-02:28 Phase 0 DONE. backup branch `backup-before-release` + tag `backup-before-release-tag` = 601eb38. Rollback tested locally (reset and revert -m 1). Rules/indexes copies in docs/rollback/. No storage rules in repo. Baseline: 128 tests (rules suite runs with emulator, JDK in /tmp/jdk), build OK. Rules vs old client compat: 26-flow run against old rules (c0c0ebf) passes, so no feature flag needed.
- Phase 1 DONE earlier: #54 open, #56/#57/#58/#59/#60/#61/#62 merged. #54 not yet handled (last).
- Phase 2 IN PROGRESS: error boundary + render fallback + PII scrub committed on this branch (b5f338d). Not yet merged to main (batch with other small fixes).
- Browser UI traversal against emulators done: 4 roles, 0 JS errors. Parent dashboard tab selector returned empty in the harness, to check.

## Next
Phase 2 rest (timeouts, 404, listeners), 3 (security docs, npm audit, git history scan), 4 (screens with data), 5, 6, then 7-9, items 16-24, final docs, one merge for docs.
Resume rule: read this file and `git log`, continue from the last DONE phase.

## Added condition (user, 02:29): before the deadline
Rerun the 26 scenarios + image upload + chat + unauthorized attempts with the FINAL code against the NEW proposed rules and the old rules; write each result in HANDOFF.md; failures documented by name and code shows "service unavailable" or is fixed; never loosen rules. HANDOFF.md top = safe deploy order: indexes first, wait until built, then rules, then immediate test with real accounts, rollback command for old rules ready. STATUS: PENDING (do after code changes freeze, before 12:15).
## 02:29 UI e2e with data (emulator): teacher publishes lesson + task via UI, student sees task; 0 JS errors both roles. Parent dashboard has no tabs by design (children chips).

## 02:49 MERGE #63 (error boundary, PII scrub) -> main b34d76c. Tests 131/131 with emulator, build OK, deploy success, live bundle main-CtnZSqAq.js, 16 routes at 360/390 no overflow, no broken images. Phase 2 partially done. Remaining queue: timeouts + "unavailable now" state (7.1/7.2), visibility pausing, listener audit, bundle/Lighthouse measurements, double-click/validation, update notice, Excel import hardening, parent-link cooldown, a11y, then 7-9 and items 16-24, scenario rerun vs new rules (condition 02:29).

## 03:10 Finding: chat listener leak (cleanup returned by mountChat/mountParentChat was never called). Fix on branch fix/listener-cleanup, OPEN PR (touches chat, not merged). Baseline measurements in docs/MEASUREMENTS.md.

## 03:31 PR fix/import-hardening opened (not merged, admin import). Done: size limit, formula sanitising. Not done: per-row error display, CSV over-200KB message.
