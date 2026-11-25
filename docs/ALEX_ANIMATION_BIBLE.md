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

## Way of living (all five; only Alex is implemented)
- Alex: curious and smart. Glances around, head leads the eyes, quick ear perks, tilts when thinking, tail flicks when pleased.
- Arthur: calm and wise. Slow breathing, slow deliberate blinks, small nods, pages-edge (scarf) sways late. Never rushes.
- Oscar: fast and energetic. Quick bounces, snappy anticipation, arm waves, bow tie and tip bob after each move.
- Leo: calm and reassuring. Steady glow pulse like breathing, gentle sway, ring on top swings late, never sharp.
- Chloe: gentle, growing. Slow opening and closing of the petals over several seconds, leaves lag the stem, small happy bloom on success.

## Motion v3 (Alex)
Extra pieces: torso (shoulders and arms, warped with scale, skew and rotation around the waist), scroll and cap (own springs, lag the torso and head). Breathing shows in chest scale, shoulder lift and head follow with a delay. Weight shift is a slow 13 s cycle (torso slides and rolls, tail counter-sways, feet stay planted). Glances: irregular, head leads, blink starts after the head moves, ears counter-move. Transitions are staged: realisation beat -> head return -> pose crossfade (300 ms, inside the body move) -> body settle. No state swaps directly.

## What flat-image layers cannot do
No real deformation (bending a limb, turning the head in 3D, squashing the face), no revealed art behind moving parts (seams and thin ghosting during a pose crossfade, one visible frame on the Error swap), no eyelids that match the fur, no cloth or fur simulation. The last mile is an artist-rigged Rive (or Spine) file with separate layers and bones, driven by the same state names.

## Motion v5: puppet with arms (Alex only)
`src/studycrew/Shared/puppet-renderer.js` (Canvas 2D). Parts: torso clean plate (no head, tail or arms), two arms, tail, two ears, head,
irises, closed-eye lids. All came from one AI-generated base picture (arms hanging) split with the image tool and fitted by hand.
- Spine: 6 strips (breathing, lean, crouch, weight shift). Tail on the hip, arms on the shoulders, head on the neck.
- Arms: 6 strips each (shoulder lift, elbow curl, wrist), joints lag toward the hand. Wave comes from the shoulder.
- Tail: 5 strips following each other. Ears: 4 strips each, pushed by head and body acceleration.
- Eyes: irises slide inside the eye opening and the lid sweeps down. Eyes first, head 90 ms later, body 180 ms later.
- Clips: Idle, Curious, Happy, Thinking, Wave, HiddenPassword (look at screen, shrug, hands to eyes, hands come down on exit), Success, Error, Sleep, Wake.
Limits (honest): parts are cut from AI pictures, so bends stay moderate and arms look soft ("noodle") at big bends. No eyebrow or
mouth change, no finger poses, no leg movement, the cap and the scroll are not separate parts (the scroll was dropped with the new rest pose).
Weak devices and reduced motion use the simple image renderer. Not tested on a real phone. A real rig needs a Rive or Spine file.
