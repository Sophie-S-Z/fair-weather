=== home_intro ===
{kithHeld:
    You walk back over the ridge, and your old friends are waiting at the gate.
- else:
    You walk back over the ridge into Kith, and the benches are empty.
}
-> END

=== home_welcome ===
Your old friends come close again, and Kith feels like home.
-> END

=== home_close_call ===
Fewer than three of your old friends are warm to you yet; winning Kith back will take more than a day.
-> END

=== home_bench ===
Pim comes and sits beside you on the first bench.
{
- hero_softness == 0 && hero_tightness == 0:
    Pim looks at your line and says you have not changed a bit, and seems glad of it.
- hero_softness > hero_tightness:
    Pim looks at your line and says it has gone soft at the edges, the way a line does when someone was kind to it.
- hero_tightness > hero_softness:
    Pim looks at your line and says it has pulled tight, and asks, gently, who did that.
- else:
    Pim says your line is as soft as it is tight, and that this is what a long walk does.
}
{wispHome:
    Wisp sits on Pim's other side, as if it never left.
- else:
    Beside the bench, Wisp's seed has come up, a green thread in the grass.
}
-> END
