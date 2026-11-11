# Fair Weather: Design Spec and PRD

- **Date:** 2026-11-11
- **Status:** Draft for review
- **Source documents:** the "Fair Weather: Combined Brainstorm" doc, the Inkwell Hollow research report, the Tanglepond brainstorm, and the eight design sections approved in conversation on 2026-11-11.

## 1. Summary

*Fair Weather* is a browser story game in two parts about small ink creatures, trust, and the worlds that shape them. In **Part 1, A Year in Kith**, the player is the weather over one small valley for one year. Sunlight, fog, wind, rain, and the seasons are the player's tools, and each tool holds one idea from game theory or network science. At the end of the year, the creatures tell a myth about the sky, built from what the player did. In **Part 2, Elsewhither**, the player falls as rain, takes the body of a chosen hero, and walks through six valleys to find a lost friend named Wisp. Each valley runs on a different social rule. A travel journal records the trip, and the player's reputation travels ahead of them. After the story, a sandbox opens with every rule as a tool.

The name comes from the "fair-weather friend", who leaves when times get hard. The game asks whether a valley's friendships can last through a winter, and whether the player, as the weather, can be fair.

**The big idea.** The valley shapes the creatures, and then the creatures shape the valley. Part 1 shows this from above. Part 2 makes the player feel it from below.

## 2. References and what each one gives

| Work | Lesson the game takes |
| --- | --- |
| Nicky Case, *The Evolution of Trust* | Characters as strategies. Bet before each reveal. Payoffs, repeat meetings, and noise decide whether trust lasts. A sandbox after the story. |
| Nicky Case, *The Wisdom and/or Madness of Crowds* | Draw and cut ties. Complex contagion and the majority illusion. An honest list of what the model leaves out. |
| Vi Hart and Nicky Case, *Parable of the Polygons* | "Mechanical plot twists" that players prove to themselves. Small preferences sort a whole population. |
| Nicky Case, *We Become What We Behold* | The player's attention is the input. The game implicates the player. |
| Nicky Case, *Parable of the Hill Climber* | Greedy climbing gets stuck on local peaks. Randomness and a step down help. |
| Nicky Case, *It's a(door)able* | A path that secretly writes a message. "The game cheats so the player cannot." |
| Nicky Case, *To Build a Better Ballot* | Position on a map equals preference. The voting rule picks the winner as much as the voters do. |
| Ralph Ammer, *No more boring drawings* | Composition carries meaning: gravity, depth, contrast, movement, and harmony. |
| Ralph Ammer, *The Creative Playground* | Freedom inside a structure. The one-continuous-line drawing game sets the house art style. |
| Bao To, *creative autonomy* article | Neither source brainstorm could read this article. The creative-autonomy ideas in this spec are our own reading of his visible work: hand-made pieces as "a small thread of connection" between maker and visitor. Check them against the article text before launch. |

## 3. Audience, goals, and success

### 3.1 Audience

Very mature teens (about 16 and up) and adults. The game holds dense ideas, moral gray areas, complex nuance, and a wide range of feelings. Endings can be bittersweet. The game has no graphic content. Loss comes through leaving, regret, and change. No creature dies.

### 3.2 Depth on demand

The main flow works for a first-time player. Three deeper layers wait for the curious player:

- **Diaries** in the Soul view show each creature's mixed feelings, such as pride and shame in one entry.
- **Margin notes** in the *Book of Skies* and the travel journal hold the real science, its limits, the strongest counter-arguments, and an open question, with sources.
- **The sandbox** lets the player test each claim.

### 3.3 Goals

- **G1.** Players leave able to explain the core ideas in their own words: trust in repeated games, noise and forgiveness, attention feedback loops, complex contagion and the majority illusion, local peaks, voting rules, sorting without malice, costly signals, and reputation.
- **G2.** The story moves through a wide range of feelings: wonder, tenderness, unease, guilt, shame, loneliness, grief, dread, solidarity, pride, doubt, and hope.
- **G3.** No stretch of play uses only one verb for more than about three minutes.
- **G4.** The game shows where its own model is wrong.

### 3.4 Non-goals

- No live multiplayer and no shared server.
- No score, leaderboard, or ranking of kindness.
- No player-drawn characters. A designer draws every character.
- No AI-generated content of any kind.
- No accounts, ads, streaks, or guilt for time away.
- The game is not a therapy tool and makes no claims about the player's real relationships.

### 3.5 Success criteria (playtest targets)

| ID | Target |
| --- | --- |
| S1 | Bet accuracy rises from chapter 2 to chapter 8, in aggregate. |
| S2 | At least 60% of players who start Part 1 finish it. At least 40% finish Part 2. |
| S3 | In a five-person playtest, each tester explains at least three core ideas without help. |
| S4 | In the same playtest, each tester names at least four different feelings they had. |
| S5 | Two different playthroughs give two different myths in at least 90% of seeded test runs. |
| S6 | 60 frames per second on the reference desktop and 30 on the reference phone, with 30 creatures on screen. |
| S7 | Full keyboard play. All interface text meets WCAG 2.2 AA contrast. |

### 3.6 Constraints

- Runs in a modern browser, on the client only.
- Works offline after the first load.
- Desktop first. Touch and phone screens work.

## 4. Structure

| Part | Player role | Shape | Length |
| --- | --- | --- | --- |
| Part 1: A Year in Kith | The weather | One valley, four seasons, 11 chapters, 5 interludes | About 30 to 35 minutes |
| The bridge | Falling rain | One scene, then hero choice | About 2 minutes |
| Part 2: Elsewhither | A chosen hero | Six valleys, then a homecoming | About 45 minutes |
| Sandbox | All roles | Open | Open |

**The thread.** Wisp leaves Kith in autumn and does not come back. At the last fire of Part 1, the creatures finish the sky myth and ask the sky to find Wisp. Part 2 is that search. Part 2 ends when the player brings Wisp's choice home to Kith.

## 5. Characters

### 5.1 The model sheet

A designer draws every creature and hero in one continuous line, after Ralph Ammer's Oneliner game. One model sheet keeps the cast consistent and cute:

- Two dot eyes set close together.
- One small blush mark.
- Rounded line ends.
- A head about as big as the body.
- At most one prop per character.
- Each species keeps one silhouette that reads at thumbnail size.

### 5.2 Shells are made of weather

No creature is born spiky or dim. Four shell values change only from history, and the renderer reads them to bend the line:

| Shell value | Rises after | Visual effect |
| --- | --- | --- |
| Tightness | Betrayal | The line pulls toward the center and forms a small knot |
| Bristle | Hunger | A fine zigzag runs along the line |
| Color | Loneliness (color falls) and warmth (color rises) | The accent fills the body or fades from it |
| Softness | Kindness received | The curve smooths |

So a body always tells a creature's history and never a fixed nature. This rule also applies to the player's hero in Part 2.

### 5.3 The named cast of Kith

| Name | Body | Strategy | Contradiction | Arc | Voice |
| --- | --- | --- | --- | --- | --- |
| Pim | Round and loopy, with a soft warm glow | Opener: shares with everyone | Gives freely, partly from a fear of being alone | Gets exploited in spring. Learns to forgive with limits. Ends as a generous copycat. | "Want half? I have a whole one!" |
| Krit | A spiky zigzag | Keeper: mostly keeps | Hoards, and secretly feeds Bell | Looks mean. Its diary shows that the spikes grew last winter, when it went hungry. Softens if fed and trusted. | "Mine. Probably." |
| Echo | A teardrop with big mirror eyes | Copycat: does what you did last | Its sense of fairness hardens into rigidity | Falls into a revenge loop with Krit in the autumn fog. Learns to forgive one slight in five. | "You first." |
| Old Moss | A pebble with tiny reading glasses and heavy downward arcs | Grudger: one betrayal ends trust | The grudge guards the memory of an old love | Carries one old grudge in its dreams. In winter, chooses whether to share with the one who hurt it. | "I remember. I always remember." |
| Wisp | A long ribbon squiggle | Drifter: climbs toward the nearest good thing | Curiosity that is also a way to escape | Gets stuck on a small hill. The player's wind sends it away. Found in Halcyon in Part 2. | "What's over there?" |
| Bell | A glass bell, half full of liquid | Threshold dancer: dances only when three friends dance | Shyness that hides sharp judgment | At the thaw festival, Bell's dance can tip the whole village into dancing. | "Maybe after you." |

### 5.4 Villagers

About 24 more villagers fill Kith. Each one has a designed body, a name, a hum, and its own starting dials. Newcomers arrive at the valley gate when berries are plentiful.

### 5.5 Heroes (Part 2)

The player chooses one of six designed heroes and names it. Each hero has a look, a hum, and one knack. A knack helps in one valley and costs in another. The player's choices, not the hero, decide the reputation.

| Hero | Look | Knack (exact rule) | Helps in | Costs in |
| --- | --- | --- | --- | --- |
| Lantern-bearer | A round body with a tiny lantern | Fog has half its usual effect on the hero's bids and gifts. | Foglight Heights | Hearsay Hollow: the drama sky finds the hero twice as fast. |
| Kite-rider | A long ribbon tied to a small kite | Moves 1.5 times faster and sees one ridge ahead. | Foglight Heights | Murmuration Fen: arrives before any local has an opinion, so first meetings start at warmth 0 with no rumor help. |
| Mosscoat | A pebble in a cloak of moss | Locals' Memory for the hero is doubled, for good and for bad. | Halcyon | Any valley where a bad rumor arrived first. |
| Glassling | A clear glass body; feelings show as color inside | The hero's bids and gifts are never misread. Locals see the hero's mood, and each warmth change toward the hero is 1.5 times larger. | Toadstool Council | Hearsay Hollow: every flash of anger is visible to the drama sky. |
| Seedcarrier | A small creature in an acorn cap, with a satchel | Can plant a gift: it costs 1 berry and grows into 3 berries after 2 days. The finder gains 0.1 warmth toward the hero. | Lily Shallows | Valleys the hero leaves within 2 days. |
| Bellchime | A small bell with a curl on top | One greeting bid reaches every creature within 6 world units. Each one answers separately. | Murmuration Fen | Hearsay Hollow: one bad moment reaches everyone too. |

Each valley is a little easier for some heroes than for others. The game never states this. Players who replay with a different hero notice that the same rules treat different bodies differently.

## 6. Part 1: A Year in Kith

### 6.1 Weather powers

| Power | Idea | Source |
| --- | --- | --- |
| Sunlight (attention) | What the player watches grows. | *We Become What We Behold* |
| Fog (miscommunication) | A friendly act can be misread. | *Trust*, the mistakes chapter |
| Wind (randomness) | A push off a small hill can find a bigger one. | *Hill Climber* |
| Seasons (payoffs) | Sharing pays less in winter, and distrust grows. | *Trust*, the win-win value |
| Rain (abundance) | Spare food brings newcomers. | Population dynamics |

The player also shapes the land: paths, friendship threads, benches, bridges, and lanterns.

### 6.2 Chapters

Each chapter teaches one new verb and ends on a twist that the player proves to themselves.

| # | Season | Chapter | New verb | What happens | Twist | Carries forward | Planned feeling |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Spring | First Light | Wake | The player is the dawn and touches sleeping creatures to wake them. Pim wakes first and looks straight up. | It knows something is up there. | Pim's bond with the sky | Wonder |
| 1 | Spring | The Wave | Respond | Pim waves at the sky. The player glows back, stays still, or rumbles. | The player is in the trust game from the first minute. | Pim's first opinion of the sky | Tenderness |
| 2 | Spring | Five Neighbors | Bet | The player meets the cast and bets who will have the most berries after a week. | Krit exploits Pim, the sweetest one. | Pim's first scar line | Surprise, unease |
| 3 | Spring | The Bench | Place | The player places one bench under a crooked tree. | One bench flips the village from cold to warm, because the same pairs meet again. | The first friendship threads | Relief, warmth |
| 4 | Summer | The Long Gaze | Shine | The player's light makes what it touches grow. The cloud shows what the player watches. | Fights are more fun to watch. The village grows thorns, and a heat map shows where the player's eyes went. | The village mood | Unease, guilt |
| 5 | Late summer | The Rumor | Whisper, draw and cut threads | A rumor about Krit starts. The pond reflection shows the crowd each creature imagines. | Too many threads let a silly rumor drown the truth. Krit's diary shows last winter's hunger. | Krit's reputation | Shame, understanding |
| 6 | Autumn | Fog | Paint fog | Echo and Krit fall into a revenge loop. | Forgiveness wins in light fog and loses in thick fog. | Echo's forgiveness dial | Frustration, doubt |
| 7 | Autumn | Wind | Blow | Wisp sits stuck on a small hill. The player's gust sends it over the ridge. | Leaving a good-enough place costs the village now. Wisp does not come back. | Wisp is gone | Grief |
| 8 | Winter | The Dew Mushroom | None: the player's powers weaken | Sharing pays less. One mushroom gives 10 drops each dawn. | Weather cannot fix winter. Only the culture the player helped build can carry the village. Old Moss decides. | Who stays and who leaves | Dread, solidarity |
| 9 | Thaw | Seed and Dance | None | A postcard from Wisp arrives with a seed. Bell waits for three friends to dance. | Earlier choices decide whether the dance spreads. | The festival result | Hope or ache |
| 10 | Thaw | The Sky Story | Listen | At the fire, the creatures tell the myth of the weather. Then they ask the sky to find Wisp. | The story was about the player as well. | Part 2 begins | Reckoning |

**Dew mushroom rule.** The mushroom gives 10 drops each dawn. If the village takes 6 or fewer, it gives 20 the next dawn. If the village takes 7 or 8, it gives 10 again. If the village takes 9 or 10, it withers and gives none for 3 days.

### 6.3 Pacing rules

- **P1.** One new world verb per chapter. A verb never goes away once taught. Chapter 5 is the one exception: it pairs whisper with threads, because the rumor needs both. The Mind verbs (peek, zoom, rewind) are reading tools. Each one appears with a one-line hint and does not count as a chapter's new verb.
- **P2.** Bet first, then reveal.
- **P3.** Every chapter can be skipped. A skipped chapter fills its carry-forward flags with gentle defaults.
- **P4.** One sentence of text per story beat in the main flow.
- **P5.** Fixed anchor beats with simulation between them (see section 10.2).
- **P6.** At most two variants per chapter, chosen by carry-forward flags. Example: if the player lit fights in summer and the rumor stuck, Krit leaves in winter. If Pim forgave Krit, Krit shares at the mushroom.

### 6.4 Interludes

| After chapter | Interlude | What the player does | Quiet meaning |
| --- | --- | --- | --- |
| 3 | The Door for Two | Two creatures sit on each side of frosted glass. The player helps them tap rhythms until they find one shared beat. | Signals and coordination. Their beat becomes the village greeting song for the rest of the year. |
| 4 | The Telephone Sketch | A drawing of a harmless beetle passes from creature to creature. Each copy changes a little, until it is a monster. | Small copying errors add up. It sets up the rumor chapter. |
| 5 | Dream Bubbles | At night, grudges float over sleepers as bubbles. The player pops them with a soft touch. | Old Moss's bubble will not pop. This sets up its winter choice. |
| 7 | Wisp's Postcard | The player reads a postcard from over the ridge and traces the path Wisp walked. | The path secretly spells the word "home". |
| 8 | The Long Night | The village shivers in the dark. The player holds the cursor still over them. | Stillness calms them. Sometimes the best weather does nothing. |

**The Quiet Visitor.** In any scene, if the player touches nothing for three minutes, a rare creature walks in, sits on a bench, and leaves a feather.

### 6.5 The myth

The myth is the end of Part 1. Section 10.6 gives the grammar. The myth can be wrong about the player, because the creatures see only from below.

## 7. Part 2: Elsewhither

### 7.1 The bridge

After the fire, the sky over Kith goes quiet. The player falls as the first spring rain. The screen holds the smell-of-rain moment, *petrichor*. Then the player chooses and names a hero and wakes on the ground. Pim gives the player Wisp's last postcard as a map. One line of text says: "You have no sky now."

### 7.2 How the player plays

- The hero is a creature under the same rules as every creature: bids, gifts, warmth, fog, and seasons.
- The player walks, waves, gives, keeps, and listens. Each valley adds one local verb.
- **Reputation travels.** Birds carry gossip about the hero to the next valley (section 9.6). A journal page called "What they say about you" shows the rumor that goes ahead of the hero. The player cannot edit it.
- **Postcards home.** Each valley offers 2 or 3 postcard choices, and the player sends one to Kith. Each postcard type nudges one dial across Kith by +0.1 while the player is away:

| Postcard type | Dial it raises |
| --- | --- |
| Generosity | Opener |
| Patience | Forgiveness |
| Remembering | Memory |
| Careful listening | Ear |
| Wandering | Wanderlust |

- **Other skies.** Each valley has its own weather, run by the game. One valley's sky lights only drama.

### 7.3 The valleys

Final order: Murmuration Fen, Hearsay Hollow, Foglight Heights, Toadstool Council, Lily Shallows, Halcyon. Each valley takes about 6 to 8 minutes.

| # | Valley | Social rule (source) | Guide | Local verb | Twist | Planned feeling |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Murmuration Fen | A starling flies only when enough of its 7 nearest neighbors fly. (complex contagion) | Tove, a young starling who has never flown | Join | The water shows a flying crowd that is not there, so Tove believes it is the only one on the ground. The player breaks the illusion by staying grounded and visible beside Tove. At dusk, a real flock forms, and Tove chooses to join. | Loneliness, belonging |
| 2 | Hearsay Hollow | The valley's sky lights only drama, and the frog gazette prints what it lights. (*We Become What We Behold*) | Quill, the gazette's tired editor | Pose or pass | Act kind, and the town forgets you. Act out, and you become famous and feared. The player was this sky in Part 1. | Exposure, temptation |
| 3 | Foglight Heights | Every snail climbs to the nearest high spot and stops. (*Hill Climber*) | Brume, an old snail on a small hill | Step down | To reach the high meadow, the player must walk down into the fog first. Brume asks to come along, which halves the hero's speed. | Fear, trust |
| 4 | Toadstool Council | Toadstools vote where the rain cloud goes. The voting rule picks the winner. (*To Build a Better Ballot*) | Ambry, a council clerk | Vote, and propose one rule | The player's favorite spot loses because a similar spot splits the vote. The player can propose a new rule once, and the council remembers who asked. | Frustration, agency |
| 5 | Lily Shallows | A frog hops away when fewer than a third of its pad neighbors share its favorite song. (*Parable of the Polygons*) | Pell, a frog who sings an old song | Sing, and learn a song | No frog dislikes anyone, and the pond still sorts itself. When frogs also want a little variety, the songs mix again. Songs are chosen and can change. | Melancholy, repair |
| 6 | Halcyon | No scarcity, no fog, no winter. Gifts cost nothing. (costly signals) | Wisp | Give a keepsake | Wisp found the higher meadow and is lonely there. Free gifts mean little, so only a costly gift from the journal shows the player came for Wisp. Then Wisp chooses to come home, or to stay. | Bittersweet freedom |

| Valley | Scene | Accent | Keepsake |
| --- | --- | --- | --- |
| Murmuration Fen | Reeds at dusk, a sky full of small dark marks | Rose | A starling feather |
| Hearsay Hollow | Crooked lanes, a printing press, a sky like a camera lens | Hot yellow | A clipping with the hero's face |
| Foglight Heights | Round hills and soup-steam fog | Pale teal | A spiral shell |
| Toadstool Council | A ring of toadstools under one cloud | Moss green | A ballot chit |
| Lily Shallows | Lily pads in rings across still water | Lilac | A reed whistle |
| Halcyon | A wide, calm meadow over a mirror sea | Soft white-gold | Wisp's seed, or Wisp |

### 7.4 Wisp's choice

Wisp can stay. Wisp comes home only when both conditions hold:

1. Wisp's warmth toward the hero is 0.6 or more.
2. The average warmth in Kith, after the postcard nudges, is 0.2 or more.

If either condition fails, Wisp stays in Halcyon and gives the hero its seed to plant in Kith. Both endings are complete and valid.

### 7.5 The homecoming

The player walks back over the ridge into Kith. During Part 2, Kith ran forward in fast time with the postcard nudges. If the culture held, the creatures meet the hero at the gate. If it frayed, the hero finds empty benches and must win them back. The myth gets a sixth verse: "The sky came down once, and walked with us." The last scene is the hero and Pim on the first bench, with Wisp beside them or with Wisp's seed growing nearby. Pim notices how the hero's line changed.

### 7.6 The travel journal

A sketchbook that the game draws as the player travels. Each valley adds a two-page spread with:

- A drawing of the key moment, in the house ink style.
- A pressed keepsake from the valley.
- Short notes from the locals, in their own voices.
- A stamp that shows how the hero left: welcomed, forgiven, or avoided.
- One line of the player's own, if the player writes a caption.
- The "What they say about you" page.
- The margin notes for that valley.

In Halcyon, the player may give away a keepsake. The keepsake then leaves the journal, and an empty pressed shape stays in its place.

## 8. Verbs

No verb lets the player draw a character.

| Family | Verb | What it does | Where it is learned |
| --- | --- | --- | --- |
| Weather | Wake | Touch a sleeping creature at dawn to wake it | Part 1, ch. 0 |
| Weather | Respond to a bid | Glow back (toward), stay still (away), or rumble (against) | Part 1, ch. 1 |
| Weather | Shine | Move the sunlight lens | Part 1, ch. 4 |
| Weather | Paint and clear fog | Raise or lower miscommunication in an area | Part 1, ch. 6 |
| Weather | Blow | A gust adds randomness and pushes stuck creatures | Part 1, ch. 7 |
| Weather | Hold still | Rest the cursor over upset creatures to calm them | Part 1, interlude after ch. 8 |
| Weather | Rain | Grow more berries | Sandbox |
| Weather | Welcome | Light the gate for a newcomer, or leave it dark | Sandbox |
| Land | Place | Benches, bridges, lanterns, berry bushes | Part 1, ch. 3 |
| Land | Draw and cut threads | Make or break friendship ties in the Cosmos view | Part 1, ch. 5 |
| Land | Draw paths | Change who meets whom | Sandbox |
| Talk | Whisper | Put a rumor in one creature's ear | Part 1, ch. 5 |
| Talk | Tap a rhythm | Find a shared beat | Part 1, interlude after ch. 3 |
| Talk | Listen | Hear the fireside myth | Part 1, ch. 10 |
| Walk | Choose a hero | Pick and name one of six heroes | Bridge |
| Walk | Walk and wave | Move and make bids | Part 2 start |
| Walk | Give or keep | Share a berry or hold on to it | Part 2 start |
| Walk | Join | Fly with the flock, or stay on the ground | Murmuration Fen |
| Walk | Pose or pass | Perform for the drama sky, or let the moment pass | Hearsay Hollow |
| Walk | Step down | Leave a good-enough hill and walk into fog | Foglight Heights |
| Walk | Vote and propose | Cast a vote, and propose one new voting rule | Toadstool Council |
| Walk | Sing and learn | Share a song, or learn a neighbor's song | Lily Shallows |
| Walk | Give a keepsake | Hand over something from the journal | Halcyon |
| Walk | Send a postcard | Choose one postcard home | Each valley |
| Mind | Bet | Predict an outcome before the reveal | Part 1, ch. 2 |
| Mind | Rewind | Scrub back to the moment a friendship broke | Part 1, ch. 6 |
| Mind | Peek under the hood | Show the payoff table and the rule a creature just used | Part 1, ch. 2 |
| Mind | Zoom | Move between the Cosmos, Meadow, and Soul views | Part 1, ch. 2 |
| Mind | Write in the journal | Add one line to a journal page | Part 2 |
| Mind | Pin a note | Leave an ink note on a moment in the timeline | Sandbox |
| Share | Seed link | Pack the valley into a URL | Sandbox |
| Share | Postcard GIF | Export a five-second loop with a caption | Sandbox |
| Share | Journal page | Export one journal spread as an image | Part 2 |
| Hidden | Over-poke | Poke often, and the village avoids the player's light | Found by accident |
| Hidden | Wait | Touch nothing, and the Quiet Visitor comes | Found by accident |
| Hidden | Collect | Feathers, fossils, and new personality mixes fill a collection book | Found by accident |

**Over-poke rule.** More than 8 pokes in 30 seconds lowers every creature's warmth toward the sky by 0.05 and makes creatures step out of the light for one day.

## 9. Simulation

### 9.1 Records

- **World:** seed, tick, day, season, current valley, creatures, ties, weather fields (light, fog, wind), berry bushes, structures (benches, bridges, lanterns, paths), rumors, and the action log.
- **Creature:** id, species, name, position, velocity, berries, state, five dials, four shell values, sky warmth, opinions of others, and a diary of its last 20 events.
- **Creature states:** wander, meet, sleep, leave, away.
- **Dials (0 to 1):** Opener, Forgiveness, Memory, Ear, Wanderlust.
- **Sky warmth (−1 to 1):** how a creature feels about the sky. Bids to the sky, the player's light, and over-pokes change it.
- **Tie (one per pair that has met):** warmth (−1 to 1), slights remembered, meeting count, last day met.
- **Friend:** a tie with warmth above 0.3.
- **World units:** a Part 1 scene is 1,600 world units wide.

### 9.2 Time

- The simulation steps 10 times per second.
- In the story, one day lasts 40 seconds at 1× speed. Chapter configs can change this.
- Gossip runs once per day, at dusk.
- Imitation runs every 3 days.

### 9.3 A meeting

Two creatures meet when they come within 24 world units of each other at a bench, a crossing, or on a path. Benches double the chance that the same pair meets again the next day.

1. **Bid.** One creature makes a bid: a wave, a hum, or a point at a cloud.
   - The chance of a "toward" reply is `sigmoid(4 × (warmth + 0.5 × Opener − 0.3 × hunger))`.
   - A reply is "against" only when warmth is below −0.4. Otherwise a reply that is not "toward" is "away".
   - Fog at that spot turns a "toward" into an "away" with a chance of `0.5 × fog`.
2. **Gift.** Each creature gives or keeps.
   - At a first meeting, a creature gives with a chance equal to its Opener.
   - Later, it gives unless its remembered slights from that partner are more than `round(3 × Forgiveness)`.
   - Slights fade with a half-life of `1 + 29 × Memory` days. A creature with Forgiveness 0 and Memory 1 acts as a Grudger.
3. **Payoff.** A gift costs the giver 1 berry, and the receiver gets 3. In winter, the receiver gets 2. Fog makes a gift look like a keep with a chance of `0.5 × fog`.
4. **Warmth change.**

| Event | Warmth change |
| --- | --- |
| Bid turned toward | +0.10 |
| Bid turned away | −0.05 |
| Bid turned against | −0.15 |
| Gift received | +0.15 |
| Keep after your gift | −0.20 |
| Each day with no meeting | Drifts 2% toward 0 |

`sigmoid` is the project's own rational approximation. It never calls `Math.exp`.

### 9.4 Daily rules

- **Gossip.** At dusk, each creature shares one opinion about a third creature with each friend.
  - If the listener's Ear is below 0.1, it takes on the opinion with a chance of 0.3 for each friend who holds it. This is simple contagion.
  - Otherwise, it takes on the opinion when the share of its friends who hold it is at least its Ear. This is complex contagion.
- **Imitation.** Every 3 days, each creature compares itself with one random neighbor within 200 world units. Fitness is berries plus 2 × friends. If the neighbor's fitness is higher, the creature copies one random dial with a chance equal to the imitation rate (default 0.3).
- **Wind.** Each gust gives each creature in its path a chance (default 0.2) to shift one dial by a random amount, with a spread of 0.15.
- **Population.**
  - Bushes regrow toward their limit each day: `berries += 0.2 × berries × (1 − berries / limit) + 0.5`.
  - When spare berries exceed 3 per creature and the population is below its cap, a newcomer arrives at the gate.
  - A creature with 0 berries at dusk for 4 days in a row and fewer than 2 friends leaves.
  - Each week, a creature that left returns with a chance of 0.25 if the average warmth in the valley is above 0.2.
- **Light.** A behavior inside the player's lens (toward, against, give, or keep) raises the chance of the same behavior by 0.15 in meetings within 300 world units for the next day. Boosts do not stack past 0.3.
- **Art.** When the average warmth stays above 0.4 and berries stay above 1.5 per creature for 2 days, creatures make art: pebble stacks, spiral trails, and small chimes.
- **Shell values.** Each betrayal raises tightness by 0.1. Each hungry dusk raises bristle by 0.05. Color follows the creature's count of friends. Each gift received raises softness by 0.05. All shell values slowly return toward their resting values.

### 9.5 Rule packs

Each valley in Part 2 adds one rule pack. Every rule pack has the same interface:

```ts
interface RulePack {
  id: string;
  setup(world: World, rng: Rng): void;
  step(world: World, rng: Rng): SimEvent[];
  onVerb(world: World, verb: LocalVerb, rng: Rng): SimEvent[];
  metrics(world: World): Record<string, number>;
}
```

| Valley | Rule pack |
| --- | --- |
| Murmuration Fen | 40 starlings. Each flies when the share of its 7 nearest neighbors in flight reaches its threshold (0.2 to 0.8; Tove 0.5). The reflection shows each starling's perceived share, weighted toward highly connected birds. |
| Hearsay Hollow | A drama sky (an NPC lens) moves toward the meeting with the highest drama score (against bids and keeps score high). The gazette prints that meeting, and townsfolk get the light boost from 9.4 for that behavior. Each print raises the subject's fame. Fame above 0.5 makes locals keep their distance. |
| Foglight Heights | A height map of soup flavor. Each snail climbs to the best spot within one step and stops. Fog hides everything more than one step away. "Step down" lets the hero move downhill. |
| Toadstool Council | 25 toadstools on a two-axis preference map (wet to dry, near to far). Four candidate spots, two of them close together. Plurality by default. The player may propose approval, instant runoff, or score voting once. If the new rule picks a spot that more toadstools rate above average, warmth toward the hero rises by 0.1 across the council. Otherwise it falls by 0.1. |
| Lily Shallows | 30 frogs on 6 pads, with 3 songs. A frog hops away when fewer than one third of its pad shares its song. "Sing" teaches the hero's song to one frog, which then knows two songs and counts as a match for both. "Learn" changes the hero's song. When at least 3 frogs know two songs, the variety rule turns on: frogs also hop when more than 90% of the pad shares their song. |
| Halcyon | Gifts cost nothing, and gift warmth is multiplied by 0.2. Giving a keepsake costs the keepsake and adds 0.6 warmth with the receiver. |

### 9.6 Reputation (Part 2)

- The hero's record is the share of gifts among the hero's last 20 give-or-keep choices, plus the share of bids the hero turned against.
- Leaving a valley creates a rumor about the hero. Its strength is the share of that valley's locals who hold a clear opinion of the hero.
- In the next valley, each local takes the rumor as its first opinion of the hero when its Ear is at or below the rumor's strength.

### 9.7 Determinism and performance

- The simulation uses only `+`, `−`, `×`, `÷`, and `Math.sqrt`. These give identical results in every browser.
- All randomness comes from one seeded generator (a small counter-based PRNG such as SplitMix32). The simulation never reads the clock and never calls `Math.random`.
- A uniform spatial grid finds nearby creatures.
- The creature cap is 30 in the story and 60 in the sandbox.
- Every number in section 9 is a default in `content/tuning.json`.

### 9.8 Trust mode

A test-only configuration runs Case-style tournaments: fixed strategies, a set number of rounds, a noise rate, and imitation as the evolution step. Section 18 uses it to check the simulation against known results.

## 10. Story engine

### 10.1 Configs

Each chapter and each valley is one JSON file in `content/chapters/` or `content/valleys/`, checked by a schema at build time. A config lists:

- id, season or valley, scene, and day length
- unlocked verbs and the one new verb
- starting state overrides (cast positions, dials, weather)
- anchor beats
- the bet: the question, the options, and how the answer is measured
- the twist check: a test on the world state and a time window
- carry-forward flags that it reads and writes
- up to two variants with conditions
- the exit condition
- the planned feeling and the margin notes

### 10.2 Anchor beats and the honesty rule

A beat has a **trigger** (a time, a sim event, or a player verb) and an **action**: move the camera, play an Ink knot, arrange a meeting, set the weather, pause, or open a bet.

**The honesty rule.** A beat may arrange who meets whom, and when. A beat never overwrites a sim result. If a twist does not happen in its time window, the beat arranges a new meeting and tries again, up to 3 times. After that, the chapter plays its "close call" variant, which tells what really happened.

### 10.3 Ink

- One Ink project holds all dialogue and branching text.
- Ink variables mirror the carry-forward flags.
- The director writes sim values into Ink variables before each knot, for example `pim_sky_warmth`.
- Ink never changes the world directly. It returns tags, such as `#beat:arrange_meeting(krit,pim)`, and the director acts on them.

### 10.4 Bets

The player picks an answer on a paper card. Then the real simulation runs visibly at 8× speed until the reveal. The answer and the result go into the action log and the optional analytics.

### 10.5 Writing rules

- No villain. Each named character holds a contradiction (section 5.3).
- Each chapter and valley has a planned feeling (sections 6.2 and 7.3).
- The main flow keeps one sentence per beat. Depth goes into diaries and margin notes.
- Each chapter and valley has 2 to 4 margin notes. Each note gives the science, its limits, the strongest counter-view, and one open question, with sources.
- Diary entries can hold mixed feelings, for example: "Gave Krit a berry. Felt good. Felt stupid. Both."

### 10.6 The myth grammar

1. **Features.** The action log becomes features: the share of light on conflict, the share of light on kindness, rumbles, fog area painted, gusts, welcomes, the most-lit creature, the winter result, the festival result, and how Wisp left.
2. **Verses.** The myth has five verses in Part 1: The Waking, The Sky's Eye, The Sky's Moods, The Long Winter, and The Asking.
3. **Templates.** Each verse has 6 to 8 templates. Each template has a feature condition. The grammar picks the first template whose condition holds, then fills its slots with names and events.
4. **Narrator.** The creature with the highest sky warmth tells the myth, in its own voice.
5. **Misreading.** Some templates read the player's actions from below and get them wrong. Example: fog painted near a fight can read as "the sky sulked". A margin note sets what the player did beside what the creatures believed.
6. **Part 2 verse.** A sixth verse comes from the hero's reputation and Wisp's choice.
7. **Storage.** Each finished year saves its myth as a page in the *Book of Skies*.
8. **No AI generation.** All myth text comes from written templates.

## 11. Art, rendering, and sound

### 11.1 Art pipeline

1. The designer draws each creature as one continuous vector path. Named markers set the eyes, the blush, and the prop.
2. `tools/svg-to-rig` samples each path into 128 points and groups them into head, body, and base regions. It writes a rig file to `content/rigs/`.
3. Scenes are layered files: paper, far layer, middle layer, near layer, a walk mesh, bench spots, and camera framings.
4. Composition follows Ammer's principles as story signals:
   - **Gravity:** a sad creature drifts low and looks heavy.
   - **Depth:** near things are urgent, and far hills are later.
   - **Contrast:** the creature a scene is about is the only one in the accent color.
   - **Movement:** a rumor travels as a visible line.
   - **Harmony:** friends who sit together sway in time.

### 11.2 Line rendering

- Each line is a triangle strip with varying width and a paper-texture shader.
- The line "boils" at 12 frames per second, like hand-drawn animation.
- Breathing, hops with squash and stretch, and swaying are procedural.
- The four shell values bend the line (section 5.2).

### 11.3 Views and effects

| View | What it shows | Color |
| --- | --- | --- |
| Cosmos (zoomed out) | The friendship network as a clean schematic over a faded valley, plus a thin timeline of population and trust | Ink |
| Meadow (default) | The valley and its creatures; at most 3 tools on screen | Ink and one accent |
| Soul (zoomed in on one creature) | A constellation of every creature it has met, with glowing friendships and dark scars, beside its diary and dials | Full color, for the first time |

- **Fog** is a noise mask over the scene. Lines inside fog break into dashes.
- **Light** is a warm radial glow that follows the lens.
- **Season accents:** spring warm orange, summer gold, late summer violet, autumn blue-grey, winter ember red, thaw spring green. Each Part 2 valley has its accent from section 7.3.
- **Night scenes** show soft glows, spores, and dream bubbles.

### 11.4 Performance budget

At most 100 draw calls per frame. Art lives in texture atlases. The budget covers 30 creatures at 128 points each.

### 11.5 Sound

- Each creature voice is a small Web Audio synthesizer with a timbre for its species. Pim plays a kalimba, and Krit snaps like dry twigs.
- The length of the creature's line sets its pitch on a pentatonic scale in the key of the season.

| Event | Sound |
| --- | --- |
| Bid turned toward | A harmony interval |
| Bid turned away | One note that fades |
| Bid turned against | A small clash |
| Broken trust | A porcelain clink |
| Forgiveness | A singing bowl |
| Warm cluster of friends | Their hums sum into one soft chord |
| Fog | A low-pass filter muffles the hums |

- Recorded sounds come from public-domain libraries.
- There is no soundtrack. Each Part 2 valley adds one quiet ambient bed.
- Sound starts off. The first unmute plays a short welcome chord.

### 11.6 Accessible art

- Meaning comes from shape and motion as well as color.
- Accent colors are safe for color blindness.
- A high-contrast mode thickens every line.
- Reduced-motion mode stops the boil, the wobble, and camera moves.

## 12. Screens and flows

### 12.1 Overall flow

1. **Title:** a paper page with one ink creature asleep. Buttons: Begin, Continue, *Book of Skies*, Settings. The sandbox stays locked until Part 1 ends.
2. **Part 1:** chapters 0 to 10, with the interludes.
3. **The bridge:** the rain-fall scene, then hero choice and naming.
4. **Part 2:** each valley runs one loop: arrive, meet the guide, learn the local verb, live the twist, send a postcard, close the journal spread.
5. **Homecoming,** then credits.
6. **After the end:** the *Book of Skies* and the sandbox stay open. A new year can start with a new seed.

### 12.2 Main game screen (desktop)

- The scene fills the whole window.
- The chapter or valley title sits small at the top left.
- A tool tray at the bottom center shows at most 3 tools.
- A chapter ribbon along the bottom edge allows skips.
- Time controls (pause, 1×, 2×) sit at the bottom right.
- A drawer on the right holds the diary and margin notes. It stays closed until opened.
- Bets appear as a paper card in the center.
- The scroll wheel, or Z and X, move between Cosmos, Meadow, and Soul.
- J opens the travel journal. B opens the *Book of Skies*.

### 12.3 Sandbox screen

The sandbox uses the same scene, with four collapsible panels on the left (Population, Rules, Weather, Network), a scrubbable timeline strip at the bottom, and a challenge card at the top right.

### 12.4 Phone

- In landscape, the scene fills the screen. In portrait, the scene sits above the tool tray.
- Drawers become full-screen sheets.
- Thread drawing snaps to the nearest creature, so a finger works.
- Pinch zooms between the three views.

### 12.5 Keyboard

| Key | Action |
| --- | --- |
| 1, 2, 3 | Pick a tool |
| Arrow keys | Move the lens or cursor |
| Tab | Move to the next creature |
| Enter | Act on the picked creature |
| Space | Pause |
| Z, X | Zoom out, zoom in |
| J, B | Journal, *Book of Skies* |
| ? | Help |

### 12.6 Teaching

Each new verb gets one line of prompt text. If the player does nothing for 10 seconds, a faint ghost hand shows the gesture once. There are no tutorial screens.

### 12.7 Type

A hand-lettered display face for titles. Atkinson Hyperlegible for body text. A setting changes text size.

### 12.8 Problem states

| Problem | What the game does |
| --- | --- |
| Broken or old seed link | Opens a page that says "This valley could not be found" and offers a fresh start |
| Browser storage full or blocked | Says so once and keeps playing without saves |
| No WebGL | Shows a still, illustrated version of each chapter with the full text |
| Asset fails to load | Tries again twice, then uses the still image |

## 13. Sandbox, discovery, and sharing

### 13.1 Sandbox

- The sandbox opens after Part 1 with Kith as the player left it.
- Knobs: gift value, fog level, bench density, gossip threshold, imitation rate, wind strength, season length.
- Advanced switches: one-way ties, weighted ties, mixed thresholds, rumors that change as they travel.
- Challenges: "Get through winter with nobody leaving." "Make Bell dance with only two bridges." "Soften Krit's spikes by spring."
- Each finished Part 2 valley adds its mode: flock thresholds, sky rules, landscapes, voting rules, song preferences.

### 13.2 Discovery

- A collection book of personality mixes the player has seen, with blanks for the rest.
- Ink fossils of long-gone creatures, found by scrubbing far back in time.
- Feathers from the Quiet Visitor.
- The *Book of Skies*, with one myth per finished year.

### 13.3 Creative autonomy

- A designer draws every character by hand.
- The player's creativity goes into the land (paths, fog, benches, threads), the hero's name, journal lines, and timeline notes.
- When villagers feel safe, they make their own art, which the player cannot script.

### 13.4 Sharing

- Seed links (section 15.2).
- Postcard GIFs: a five-second loop with a caption.
- Journal spreads as PNG images.
- Myth pages from the *Book of Skies* as PNG images.

## 14. Technical architecture

### 14.1 Stack

| Part | Choice |
| --- | --- |
| Language | TypeScript, strict mode |
| Build | Vite |
| Rendering | PixiJS (WebGL) |
| Interface | Svelte |
| Story script | Ink, run by inkjs |
| Simulation thread | Web Worker |
| Sound | Web Audio API |
| Saves | IndexedDB |
| Content checks | A schema library such as Zod |
| Unit and property tests | Vitest and fast-check |
| Browser tests | Playwright, with axe-core for accessibility |

### 14.2 Modules

| Module | Job | Input | Output | Depends on |
| --- | --- | --- | --- | --- |
| `sim` | The simulation (section 9) | World state, commands, seed | Next world state and events | Nothing |
| `sim-host` | Runs `sim` in a Web Worker at a fixed time step | Commands | Snapshots and events | `sim` |
| `story` | The director (section 10) | Sim events, player verbs | Sim commands, interface prompts, scene changes | `sim-host`, `content` |
| `myth` | The myth grammar (section 10.6) | Action log | Myth text | `content` |
| `render` | PixiJS scenes, rigs, effects, views | Snapshots | Pixels | `content` |
| `ui` | Svelte screens | Story prompts, snapshots | Player choices | `story` |
| `input` | Mouse, keyboard, and touch into verbs | Device events | Verb commands | `story` |
| `audio` | Voices, chords, event sounds | Events, snapshots | Sound | `content` |
| `persist` | Saves, seed links, exports | World and story state | Files and URLs | `sim`, `story` |
| `content` | Data only | n/a | Typed data | Nothing |

### 14.3 One tick

1. `input` turns a click into a verb, such as "shine at (x, y)".
2. `story` checks that the verb is unlocked and sends a command to `sim-host`.
3. The worker runs one `sim` step and returns a snapshot and events.
4. `story` checks events for anchor beats. `render` draws the snapshot. `audio` plays event sounds. `ui` updates diaries.
5. `story` adds the verb and its result to the action log.

### 14.4 Hard rules

- `sim` never reads the clock and never calls `Math.random`.
- `render` and `ui` read snapshots and never change the world.
- Only `story` changes the chapter, the valley, or the unlocked verbs.
- `content` holds no logic.

### 14.5 Directory layout

```
fair-weather/
  src/
    sim/          rules, rule packs, rng, spatial grid
    sim-host/     worker entry, message protocol, snapshot buffer
    story/        director, beats, bets, carry-forward flags
    myth/         features, verse selection, slot filling
    render/       rigs, line mesh, shaders, views, camera
    ui/           Svelte screens and components
    input/        verb mapping, gestures, hold-still, over-poke
    audio/        voices, chords, event sounds
    persist/      saves, migrations, seed links, exports
  content/
    cast/ rigs/ scenes/ chapters/ valleys/ ink/ myth/ notes/ palettes/
    tuning.json
  tools/
    svg-to-rig/  content-validate/
  tests/
    unit/ property/ golden/ science/ e2e/ visual/
```

## 15. Saves, seed links, and privacy

### 15.1 Saves

- IndexedDB holds 3 slots plus an autosave at each chapter and valley start.
- A save holds a format version, the seed, the Ink state, the carry-forward flags, the action log, and a sim snapshot.
- Migrations update old saves to the current format. If a save is damaged, the game loads the checkpoint before it.

### 15.2 Seed links

- A link holds the seed, the settings, the structures, and the player commands with their ticks. The deterministic sim rebuilds the rest.
- The data is compressed into the URL fragment, for example `#v1.<data>`. The fragment never goes to a server.
- If the link would be longer than about 2 KB, the game offers a small `.fairweather` file instead.

### 15.3 Exports

A ring buffer keeps the last 5 seconds of frames at 480 pixels wide for GIFs. Journal and myth pages export as PNG images.

### 15.4 Privacy

- No accounts and no cookies.
- Names and journal lines stay on the device unless the player shares them.
- Analytics are off by default. With opt-in, the game sends only counts: chapter reached, bet accuracy, and sandbox minutes. It sends no personal data and no identifiers.

## 16. Errors

- If the worker crashes, the game restarts it from the last snapshot.
- In development builds, the sim checks its limits every tick: berries never below 0, warmth and dials inside their ranges, and no creature outside the scene.
- At build time, a schema checks every content file, and the Ink project must compile.
- If an asset fails to load, the game tries again twice, then uses the still image.

## 17. Accessibility and performance

- Full keyboard play (section 12.5).
- Interface text meets WCAG 2.2 AA contrast.
- Text-size, high-contrast, and reduced-motion settings.
- Sound is off by default, and no information depends on sound alone.
- Meaning in the scene comes from shape and motion as well as color.
- Diaries, margin notes, the journal, and the myth are real HTML text that screen readers can read.
- 60 fps on the reference desktop and 30 fps on the reference phone, with 30 creatures.

## 18. Testing

| # | Kind | What it checks | Pass condition |
| --- | --- | --- | --- |
| T1 | Unit (Vitest) | Each sim rule, payoff math, gossip thresholds, imitation, each rule pack, the myth grammar | All pass |
| T2 | Property (fast-check) | The same seed and commands give the same state hash. Limits always hold. | No failing case in 10,000 runs |
| T3 | Golden runs | Each chapter and valley has a seeded run in which its twist must happen | The honesty-rule fallback fires in fewer than 5% of 200 seeds per chapter |
| T4 | Science checks (Trust mode) | Known results from *Trust* | Forgiving copycat (copykitten) wins at 1% to 9% noise in at least 70% of 50 seeds. Always-keep wins at 30% and 40% noise in at least 90% of 50 seeds. Always-keep wins with 1 or 2 rounds per match in at least 90% of 50 seeds. The cut points move with the starting population (ADR 0006). |
| T5 | Science checks (Lily Shallows) | Sorting and repair | Pads sort at the one-third threshold. Pads mix again once the 90% variety rule is on. |
| T6 | Myth test | Variety of myths | At least 90% different myths in 1,000 random-play runs |
| T7 | End-to-end (Playwright) | An auto-player finishes Part 1. A keyboard-only run. A phone viewport. Reduced motion. No WebGL. | All runs reach their end screen |
| T8 | Visual | Screenshots of key scenes against approved images | Differences within threshold |
| T9 | Performance | Frame rate with 30 creatures | 60 fps desktop, 30 fps phone |
| T10 | Accessibility | axe-core on every screen, plus a manual screen-reader pass | No serious or critical issues |
| T11 | Playtests | Five people at each milestone | Success criteria S1 to S4 |

## 19. Science limits and ethics

### 19.1 Limits the game shows

- "Copycat wins" holds only under some noise levels and payoffs. The game teaches the conditions, never a champion.
- Gottman's bid figures (86% and 33%) come from observation and show correlation. The game never shows a bid score as a health score for real relationships.
- Schelling-style models predict more sorting than real cities show, and real segregation also has institutional and economic causes. The Lily Shallows margin notes say so.
- The claim that close friendships fell sharply from 1985 to 2004 is contested. The game does not use it.
- A plain "Where this model is wrong" page lists what the model leaves out.

### 19.2 Ethics

- No identity-like trait drives behavior. Songs, dials, and props are chosen or learned, and they can change.
- Bodies change only from history.
- Any rumor puzzle is followed by a beat about who got hurt.
- No dark patterns: no streaks, no guilt for time away. A creature that leaves sends postcards and can return.
- No accounts, and analytics only by opt-in.

## 20. Risks and assumptions

| Risk | Prevention |
| --- | --- |
| Part 2 feels like an anthology of Case pieces | Reputation, postcards, and keepsakes link every valley, and Wisp's search gives one goal. |
| The story feels preachy | One sentence per beat. The myth shows and does not lecture. One beat where the nice lesson fails (thick fog). |
| Story and simulation fight | Anchor beats, the honesty rule, and at most two variants. |
| Total length (about 75 minutes) | Save points at each chapter and valley. Part 2 ships in two stages. |
| The switch from weather to hero confuses players | The bridge scene, a new verb set, and the line "You have no sky now." |
| About 35 verbs | One new verb per chapter or valley. |
| A hero knack makes a valley trivial | Each knack helps in one valley and costs in another. Every hero is playtested in every valley. |
| Cute art hides a thin model | "Peek under the hood" and the "Where this model is wrong" page. |
| Guilt feels cheap | A gentle heat map. Hearsay Hollow lets the player feel that sky from below. |
| The myth feels canned | Enough templates and features to pass T6. |
| Art cost doubles with Part 2 | One model sheet, one ink style, one accent per valley, and villager bodies reused with new props. |

**Assumptions to test in playtests**

- Players care about the named cast within five minutes.
- The weather role reads without a tutorial.
- The myth ending feels personal.
- The switch to a hero feels like a reward.
- Players notice their reputation arriving ahead of them.

## 21. Release scope and milestones

### 21.1 Stage 1 (first release)

1. The full simulation (section 9), Trust mode, and the rule packs for Stage 1 valleys.
2. The model sheet and the designed cast: 6 named creatures, about 24 villagers, 6 heroes, and the Stage 1 guides.
3. Part 1: chapters 0 to 10 and all five interludes.
4. The myth grammar and the *Book of Skies*.
5. The bridge and hero choice.
6. Part 2 valleys: Murmuration Fen, Hearsay Hollow, and Halcyon.
7. Reputation, postcards home, and the travel journal.
8. The homecoming and the sixth myth verse.
9. The three views, with a basic Soul view (diary, dials, constellation).
10. The sandbox: four panels, the timeline, three challenges, and the modes of finished valleys.
11. Seed links, postcard GIFs, and page exports.
12. "Peek under the hood" and the "Where this model is wrong" page.
13. Accessibility settings and save points.

### 21.2 Stage 2

- Foglight Heights, Toadstool Council, and Lily Shallows, placed between the Stage 1 valleys in the final order.
- Rule cards, so players can invent new behaviors.
- Travelers: send a creature with its memories into a friend's valley through a code.
- A remix tree for seed links.

### 21.3 Not planned

- Any shared server, public gallery, account, or leaderboard.
- Any tool that lets players draw a character.

### 21.4 Milestones

| Milestone | Contents | Exit check |
| --- | --- | --- |
| M0: Technical spike | One rigged creature with line boil and shell values. The deterministic sim in a worker. Ink connected to the director. | T2 passes. 30 rigs hold 60 fps on desktop. |
| M1: Vertical slice | Chapters 0 to 3 with final art and sound | First playtest against S3 and S4 |
| M2: Part 1 complete | Chapters 4 to 10, interludes, the myth | T3, T4, and T6 pass |
| M3: Part 2, Stage 1 | Bridge, heroes, three valleys, journal, homecoming | T3 for valleys. Playtest. |
| M4: Launch quality | Sandbox, sharing, accessibility, performance, polish | T7 to T11 pass |
| M5: Stage 2 | Three more valleys and the Stage 2 features | T3 and T5 pass |

## 22. Open questions

- Should the code and art carry an open license, so teachers can remix the game?
- Which device is the reference phone for the performance target?
- Can the user supply the text of Bao To's article, so the creative-autonomy reading can be checked?
- Who writes the Ink script and the margin notes, and who reviews the science notes?

## 23. Sources

- [The Evolution of Trust, full text](https://ncase.me/trust/words.html)
- [The Wisdom and/or Madness of Crowds](https://ncase.me/crowds/)
- [Parable of the Polygons](https://ncase.me/polygons/)
- [Parable of the Hill Climber](https://blog.ncase.me/parable-of-the-hill-climber/)
- [We Become What We Behold, announcement](https://www.patreon.com/ncase/posts/new-game-we-what-7030991)
- [Nicky Case projects, including It's a(door)able and To Build a Better Ballot](https://ncase.me/projects/)
- [Ralph Ammer: No more boring drawings](https://ralphammer.com/no-more-boring-drawings/)
- [Ralph Ammer: The Creative Playground](https://ralphammer.com/how-to-get-started/)
- [Bao To's site](https://www.baothiento.com/) (the article itself could not be read)
- [Gottman Institute on bids](https://www.gottman.com/blog/little-things-make-break-relationship/)
- [Simply Psychology on the limits of the bid research](https://www.simplypsychology.org/bird-test-predict-relationship-satisfaction.html)
- [Brandt et al. on Schelling dynamics](https://arxiv.org/pdf/0907.1777)
- [Fair Weather: Combined Brainstorm](https://claude.ai/artifact/BhqJd5P9R4RtDKZhE9JtEp)
