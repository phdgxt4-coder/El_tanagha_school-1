# Alex Animation Bible (pilot)

Status: pilot. Alex only. Renderer: `src/studycrew/Shared/rig-renderer.js`. Art: `src/studycrew/Characters/Alex/art/*.webp` (AI-generated, cut into layers in code).

## Rig
Layers: body (torso, arms, scroll), tail, head (face and cap), left ear, right ear, eyelids (overlay on the head). Poses are full images (happy, thinking, success, error, hidden) that crossfade as groups while head, ears and tail keep moving through the swap, so a change of expression is always carried by a body move.

## Physics
Every channel (head rotation/x/y, each ear, tail, body lift, body squash, body roll, eyelid) is a spring. Each action = anticipation (small opposite move) -> action -> follow-through (spring overshoot) -> settle. Ears and tail lag the head (overlapping action). Eyes follow the pointer by turning the head first (the eyes are part of the head image, so they cannot move alone).

## Always on (idle)
Breathing (scale + lift), slow weight shift (body roll), tiny head sway, tail sway, ear lag. Blinks every 2.6-5.8 s and also when the head moves fast. A blink never fires without a head move or a timer, and never in the password cover or sleep.

## Situations
| Situation | State | What Alex does |
|---|---|---|
| Waiting | Idle | Breathes, shifts weight, blinks, now and then an ear twitch, tail wag, curious tilt (idle scheduler). |
| Greeting | Wave | Dips (anticipation), lifts, head tilts, ears perk, tail wags three times, settles. |
| Thinking / Loading / Reading / Searching / Typing | Thinking | Head tilts and turns aside, one ear drops, slow blink, pose swaps to thinking, then sways softly. |
| Success / Celebrate | Success | Crouch, jump with pose swap at the top (arms up with the scroll), tail wag, landing squash, settle. |
| Error | Error | Small flinch back, head and body drop, ears fall, slow blink, pose swaps to worried, slow breathing. |
| Password cover | HiddenPassword | Looks away, slow blink, shoulders dip, pose swaps to paws over eyes, holds while breathing. Leaving: reverse (swap first, then head back). |
| Helping | (play recipe) | Leans in, head tilts, ears forward. |
| Sleep / Wake | Sleep, Wake | Head and ears droop, eyes close, slower breathing. Wake: eyes open, stretch, ears perk. |
| Password reset | uses Success after the reset, Error on failure | Same as above. |

## Quality tiers
- Rig (default): layered, springs, all of the above.
- Light (weak device: deviceMemory <= 2 or 2 cores or `?quality=low`): simple image renderer, float and breathe only.
- Reduced motion: no motion, only crossfade between poses.
Images load lazily per pose (about 40 KB each as WebP).

## Known limits
- Layers are cut from flat images. No hidden art exists behind moving parts, so keep angles small (a few degrees). Large turns, a real blink with lashes, finger motion and arm swings need layers drawn separately (Rive or Spine by an artist).
- Eyelids are a fur-colored overlay, an approximation.
- Not tested on a real phone.
