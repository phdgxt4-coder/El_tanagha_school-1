# Study Crew characters: status and plan (26 Nov 2026)

Checked from the files in `src/studycrew/Characters/`. No new character art was generated in this session (the brief forbids external models, and I have no drawing tool in the loop).

| Character | Art on main | State |
|---|---|---|
| Alex | puppet (v7 to v10, released in #61) with its own animation chunk | Wired: login help/success, welcome back on student home, rare delight ticks, and 404. |
| Arthur | 5 soft-3D expressions (webp, ~181 KB total) | Wired: password errors on login, welcome on the teacher and parent dashboards. |
| Oscar | 5 soft-3D expressions already on main: happy, thinking, success, error, hidden (~156 KB total). Contact sheet checked by eye: clean cutouts, consistent style, pencil with bow tie. | Wired: appears on the student's tasks tab (امتحانات وواجبات), once per session. |
| Leo | 5 expressions (~197 KB) | Wired: network states — a calm note when the connection drops and when it returns (NotificationCharacter). |
| Chloe | 5 expressions (~185 KB) | Wired: appears on the student's grades tab (درجاتي), once per session. |

## Wiring (27 Nov 2026)

All five characters are reachable through the Living layer (`src/studycrew/Living/wire.js`), which is ON by default. Every appearance goes through the Director's `hint` event with copy in `COPY.hints` (emotion.js), so the same rules hold everywhere: absolute silence on exam screens, no bubbles while reading or typing, reduced motion gives a static face, each spot shows once per session, and every character stays a lazy chunk. `AchievementBanner` and `CelebrationOverlay` remain unused until a real achievement/score event exists in the app.

## Honest limits
- These are raster images switched between expressions (image renderer), not a rigged skeleton. Motion comes from CSS and the idle scheduler. The result is a good sticker-style character, not film-grade animation.
- Edges depend on the original cutouts. Over very light backgrounds a faint halo can show; test on the real theme colors before turning the Living layer on for everyone.
- Nothing was tested on a real phone.

## Plan for Leo and Chloe (done)
1. ~~Review their 5 frames on dark and light themes at 360 and 390 px, note any halo or crop issues.~~ Still worth a real-phone check.
2. ~~Decide the screens they appear on~~ Done: Chloe on the grades tab, Leo on network states, reusing the existing wiring. Next candidate: Chloe for report-card success and loading scenes.
3. Keep each character under the size budget in `Shared/budget.js`, lazy-load per screen.
4. ~~Turn on the Living flag for a small group first.~~ The flag is ON for everyone (PR #76).

## Owner decisions
- Turn the Living layer on or keep it off: recommendation, enable for staff first, then students after a real-phone check.
