# Study Crew characters: status and plan (26 Nov 2026)

Checked from the files in `src/studycrew/Characters/`. No new character art was generated in this session (the brief forbids external models, and I have no drawing tool in the loop).

| Character | Art on main | State |
|---|---|---|
| Alex | puppet (v7 to v10, released in #61) with its own animation chunk | Polished earlier in this run. Login animation of Arthur was not touched. |
| Arthur | 5 soft-3D expressions (webp, ~181 KB total) | Existing, not changed. The login animation is protected by the brief. |
| Oscar | 5 soft-3D expressions already on main: happy, thinking, success, error, hidden (~156 KB total). Contact sheet checked by eye: clean cutouts, consistent style, pencil with bow tie. | A first version exists, so no new PR was opened. Used only through the Living layer, which is OFF by default (`FEATURES.living=false`). Nothing visible to students yet. |
| Leo | 5 expressions (~197 KB) | Plan only. |
| Chloe | 5 expressions (~185 KB) | Plan only. |

## Honest limits
- These are raster images switched between expressions (image renderer), not a rigged skeleton. Motion comes from CSS and the idle scheduler. The result is a good sticker-style character, not film-grade animation.
- Edges depend on the original cutouts. Over very light backgrounds a faint halo can show; test on the real theme colors before turning the Living layer on for everyone.
- Nothing was tested on a real phone.

## Plan for Leo and Chloe (not started)
1. Review their 5 frames on dark and light themes at 360 and 390 px, note any halo or crop issues.
2. Decide the screens they appear on (suggested: Leo for results, Chloe for loading), reusing the existing `LOADING_STATE` map.
3. Keep each character under the size budget in `Shared/budget.js`, lazy-load per screen.
4. Turn on the Living flag for a small group first.

## Owner decisions
- Turn the Living layer on or keep it off: recommendation, enable for staff first, then students after a real-phone check.
