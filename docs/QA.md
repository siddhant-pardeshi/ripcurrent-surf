# QA notes - Ripcurrent

## What was tested

**Build agent verification (dedicated browser tab):** menu over the live auto-rider, rideable within ~2s of Play, carve physics (speed gain dropping, loss carving), lip launches with trick labels and clean/nose-dive landings, tube window with double score, wipeout flow with hearts, calm channel between sets, results screen with personal best, zero console errors, 390px HUD check.

**Reviewer verification:** menu + gameplay screenshots captured, learn layer wired (board briefings during the calm channel with +250 reward and world pause), song data linted, syntax clean.

## What was NOT tested (honest gaps)

- Full 3-heart session to the results board was exercised by the agent; the exact heart-exhaustion path was verified by code review.
- Physical mobile devices; touch verified in emulated frames only.
- Audio judged by engine paths and lint; no human listened in this pass.
- Firefox/Safari untested.

## Known limitations

- The surfer is a deliberate dusk silhouette - readable, but not a detailed character on the water.
- The wave shape is a stylized procedural curl, not a fluid simulation.
