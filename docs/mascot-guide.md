# Kai — the mascot guide

Kai is the beach buddy on towel duty: the deck's shared layered-SVG character — chibi kid in the pale-blue fox hoodie with the gold star charm — rebuilt from the studio's reference sheet as vector layers with a real animation state machine.

## Character invariants

- Pale-blue fox hoodie, cream lining and belly, gold four-point star charm, navy shorts, blue boots, cream-tipped tail.
- Wide-set angled fox ears, big brown eyes, soft blush.
- The reference sheet wins over any written description.

## States used in this game

| Trigger | Performance | Line |
| --- | --- | --- |
| First visit | Entrance + wave | "Kai here. Evening glass is firing." |
| Return visit | Wave | "Wind dropped off. Waves are waiting." |
| Session start | Alert | "Paddle, pop up, and stay loose." |
| Clean trick | Cheer | "Clean spin! Judges would have clapped." |
| Tube entry | Alert + hype | "YOU ARE IN THE TUBE — stay low, stay in!" |
| Wipeout | Sad | "Big one! Shake it off, plenty of waves left." |
| New set | Wave | "New set on the horizon — bigger grade." |
| Session won | Cheer | "Session of the month. Sunset got its show." |
| Pause | Sleep (z's) | — |

Lines rotate without back-to-back repeats; cooldowns gate rapid events.

## Where Kai lives

Bottom-right dock on desktop, bottom-left on touch, scaled down on small screens — never over the wave face or the joystick. Settings → **Show Kai** hides them; reduced motion keeps only slow blinks.

## Replacing the art

The character is one SVG string + one stylesheet in `js/mascot.js`. Keep the element ids (`m-armR`, `m-earL`, `m-eyeL`, `m-mouth`, `m-tail`, `m-charm`…), keep the layer order, swap colors in the palette object, and preview every state via `?mascot=gallery` on any game URL.
