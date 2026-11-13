=== home_intro ===
{kithHeld:
    You walk back over the ridge, and your old friends wait for you at the gate. #placeholder
- else:
    You walk back over the ridge into Kith. #placeholder
}
-> END

=== home_welcome ===
At least three of your old friends are glad to see you. #placeholder
-> END

=== home_close_call ===
Fewer than three of your old friends are warm to you yet. #placeholder
-> END

=== home_bench ===
Pim comes to find you. #placeholder
{
- hero_softness == 0 && hero_tightness == 0:
    Pim says your line has not changed. #placeholder
- hero_softness > hero_tightness:
    Pim says your line has grown soft. #placeholder
- hero_tightness > hero_softness:
    Pim says your line has grown tight. #placeholder
- else:
    Pim says your line is as soft as it is tight. #placeholder
}
-> END
