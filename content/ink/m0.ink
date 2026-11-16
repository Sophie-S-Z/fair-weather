VAR pim_sky_warmth = 0
VAR hero_softness = 0
VAR hero_tightness = 0

// A fixture for the director test (tests/unit/story/chapter-runner.test.ts); the game never plays it.
=== m0_test ===
Pim feels the sky warm at {pim_sky_warmth}.
Krit should meet Pim. #beat:arrange_meeting(krit,pim)
-> END
