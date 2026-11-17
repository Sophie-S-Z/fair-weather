# Fair Weather Toybox: design

Date: 2026-11-17. Status: draft for review. This design replaces the weather-year game in the spec of 2026-11-11.

## 1. Intent

The owner found the weather-year game dull. They liked four parts of it:

1. the one-line ink creatures,
2. their small motions (wobble, squash, hunch),
3. the friendship map,
4. the ability to touch and steer a creature.

The new game keeps those four parts and drops the rest. It is a toybox: one table with a cast of very different creatures and a drawer of silly props. The player plays freely. Some actions cause a known effect from game theory, psychology, philosophy, or network science. Then a short funny scene plays, and the player gets a sticker that names the idea in plain words. A sticker book shows riddle hints for the stickers that the player has not found.

Inspiration: the explorable explanations of Nicky Case, the drawn ideas of Ralph Ammer, and the playful diagrams of Bao To. All scenes, jokes, characters, and text are original.

## 2. Decisions from the owner

- Shape: a toybox with hidden lessons (not a list of episodes, not one long story).
- Guidance: a sticker book with a riddle hint on each empty slot.
- Build: rebuild inside this repo. Keep the rigs, the ink renderer, sound, and the test setup. Delete the weather game.
- Variety: one creature of each look on the table. No crowds of clones.

## 3. Goals, non-goals, anti-goals

Goals:

- Each of the 12 discoveries is funny on its own, in under 10 seconds of scene.
- A new player finds a first sticker within about one minute.
- Each sticker teaches one idea correctly, in 2 to 4 short sentences, with one "try this" follow-up.
- The table is fun with no goal: creatures idle, react, bump, and complain.
- Desktop first. Touch works. Keyboard play works. Reduced motion and high contrast work.

Non-goals:

- No campaign, chapters, days, seasons, or scores.
- No accounts, no network calls, no analytics.
- No full simulation of trust. Each creature has a small fixed temper, and scenes are short scripts.

Anti-goals (a failure even if the code works):

- Text walls. A sticker that needs more than 4 sentences is a design bug.
- A lesson that is wrong or preachy. The joke carries the idea; the text only names it.
- A crowd of look-alike creatures.
- A table that sits still. Something small moves at all times, unless reduced motion is on.

## 4. Approaches considered

| Approach | Trade-off | Result |
| --- | --- | --- |
| Rebuild inside this repo | Keeps the working ink renderer, rigs, sound, and tests. Needs a large delete. | Chosen by the owner |
| Fresh small app with SVG and CSS | Simpler code. The ink boil and squash must be built again. | Rejected |

Shape options (episodes, one long story, toybox): the owner picked the toybox.

## 5. The cast

Twelve creatures. Each uses a different drawing that already has a rig. Each has one temper that drives its idle motion and its choice in scenes.

| Name | Drawing | Temper | Scene role |
| --- | --- | --- | --- |
| Pim | pim | Kind. Shares first. | Shares the cookie |
| Krit | krit | Grabby and bold. | Grabs the cookie |
| Echo | echo | Copycat. Does what was last done to it. | Repeated cookie game |
| Moss | moss | Sleepy. Watches, rarely acts. | Bystander |
| Bell | bell | Vain. | Mirror |
| Quill | quill | Thinks too hard. Asks questions. | Philosophy commentator |
| Tove | tove | Nervous. Joins any crowd. | Conformity |
| Gulp | frog | Always hungry. | Berry bush |
| Inch | snail | Slow. Holds grudges. | Grudge in the cookie game |
| Cap | toadstool | Loud and popular. | Network hub |
| Kite | kite | Gossip. | Whisper chain |
| Glim | glassling | Honest and fragile. | Twin box |

The other 16 drawings stay in `content/creatures` for later use.

Creatures do not speak words. They speak in picture bubbles (a cookie, a heart, a question mark, a storm cloud) and in short synth chirps from `src/audio`. Only the sticker card has text.

## 6. The table

One screen. A wooden-ish paper table seen from the front, with a low horizon, like the current Meadow but smaller and closer. The friendship map is drawn on the table: each tie is an ink string between two creatures, sagging with distance.

Player actions:

| Action | Mouse and touch | Keyboard |
| --- | --- | --- |
| Pick up and move a creature | Drag | Tab to a creature, Enter, arrows, Enter |
| Poke | Tap or click | Space on the focused creature |
| Tie two creatures | Drag from the yarn tool to one creature, then to another | Yarn tool, then pick two creatures |
| Snip a tie | Scissors tool over the string | Scissors tool, then pick the tie from a list |
| Place a prop | Drag from the drawer to the table | Drawer button, then arrows and Enter |
| Remove a prop | Drag it back to the drawer | Delete on the focused prop |

Creature motion uses the existing deform: hunch (tightness) when scared, bristle when angry, softness when happy, and the 12 fps boil at all times. Squash and stretch on pick up, drop, and poke comes from a new scale wobble on the container (a damped spring).

Idle life: creatures wander in short hops, look at near creatures, yawn, and bump. A creature that the player drops on another one complains with a storm-cloud bubble.

## 7. The drawer of props

Eight props. The drawer also holds two tools: yarn (tie) and scissors (snip). Each prop is a small ink drawing made in code with the existing ink helpers.

| Prop | What it does |
| --- | --- |
| Cookie | Two near creatures each choose to share or grab |
| Berry bush | Grows berries slowly. Creatures near it eat. |
| Mirror | A creature in front of it looks at itself |
| Signpost | Points at nothing. Creatures near it look where it points. |
| Puddle | A creature dropped in it gets stuck and calls for help |
| Twin boxes | A creature that goes in box A comes out of box B, and also stays in A |
| Rail track with lever | A toy cart rolls along it. The lever switches the branch. |
| Lamp and wall | Casts the shadows of creatures behind the wall onto a screen |

## 8. The twelve discoveries

Each discovery has a trigger (a check on the table state), a scene (a short script), and a sticker (title, riddle, 2 to 4 sentences, and one "try this").

### Game theory

1. **The Cookie Standoff** (prisoner's dilemma). Trigger: a cookie placed between two creatures. Each one shares or grabs by temper. Both share: the cookie splits and both blush. One grabs: the grabber gets it all and the other glares. Both grab: the cookie crumbles to dust and both stare at the crumbs. The sticker unlocks on the first both-grab result, or on the third cookie of any result. Riddle: "Two hungry friends, one cookie." Lesson: each one does better alone by grabbing, but when both grab, both lose.
2. **Copy That** (repeated game, tit for tat). Trigger: Echo plays the cookie game three times with the same partner. Echo shares first, then copies the partner's last move. With Krit, the result goes sour. With Pim, it stays sweet. With Inch, one mistake starts a grudge that never ends. Riddle: "Feed the copycat three times." Lesson: in a game that repeats, kindness that copies back can win, and one grudge can lock a pair in a feud.
3. **The Last Berry** (tragedy of the commons). Trigger: four or more creatures near the berry bush. Each takes "just one more". Gulp takes two. The bush goes bare and wilts. With a tie between all eaters, they take turns, and the bush lives. Riddle: "One bush, many mouths." Lesson: a shared thing can vanish when each takes a little more, and trust between the takers can save it.

### Psychology

4. **Look Up** (conformity). Trigger: three creatures stand near the signpost. They stare where it points. Each creature that walks near joins the stare, Tove first. Nothing is there. Riddle: "Three stare at nothing." Lesson: we copy a crowd, even when the crowd copies nothing.
5. **Somebody Should** (bystander effect). Trigger: a creature in the puddle with two or more onlookers. Each onlooker looks at the others and waits. With one onlooker, it helps at once. Riddle: "Everyone saw. Nobody moved." Lesson: the more people who see a problem, the less each one feels it is theirs to fix.
6. **Nobody Noticed** (spotlight effect). Trigger: Bell in front of the mirror, with a smudge of ink on its face (Bell gets one after any poke). Bell panics and hides. The other creatures do not look up. Riddle: "A smudge, a mirror, and a panic." Lesson: we think others notice our flaws much more than they do.

### Philosophy

7. **Which One Is Me?** (personal identity). Trigger: a creature goes through the twin boxes. Two copies argue with question-mark bubbles. Quill walks over and joins the argument. Riddle: "Two boxes, one friend, two friends." Lesson: if a perfect copy has all your memories, it is not clear which one is you, or if the question has an answer.
8. **The Lever** (trolley problem, kept silly and safe). Trigger: the cart rolls with creatures on both branches, and the player pulls or does not pull the lever. Before the cart arrives, every creature hops off in a huff. Quill stays and asks the player, with a bubble, why they chose. Riddle: "A lever, a cart, and a choice." Lesson: doing harm and allowing harm can feel very different, even when the results match.
9. **Shadow Show** (Plato's cave). Trigger: two creatures behind the wall while the lamp is on, and one creature in front. The front creature cheers the shadows as if they are real. Then one shadow maker walks around the wall to the front. The fan looks from the real one to its shadow, and it cheers the shadow again. Riddle: "What do they see behind the wall?" Lesson: we can take a shadow for the world, and we can like the shadow better than the real thing.

### Networks and relationships

10. **Telephone** (rumor spread). Trigger: the player pokes Kite twice fast (a whisper) while Kite has a chain of ties four long. The bubble moves along each string and changes at each step: a cookie becomes a crown, then a storm, then a monster. Riddle: "Whisper to one, ask the last." Lesson: a message that passes through many people changes at each step.
11. **The Only Bridge** (weak ties). Trigger: two groups of three or more creatures linked by one tie, and the player snips it. The bubbles that flowed across stop, and each group drifts and grows bored. Riddle: "Snip the one string that holds two." Lesson: thin links between groups carry news that close friends cannot.
12. **Your Friends Have More Friends** (friendship paradox). Trigger: Cap has four or more ties, and the player picks a creature with one tie to Cap. A count bubble over each friend shows that the friend has more ties. The picked creature droops. Riddle: "Count your friend's friends." Lesson: most people's friends have more friends than they do, because popular people show up in many friend lists.

## 9. The sticker book

A book button sits in a corner. The book shows 12 slots in four pages, one per theme. An empty slot shows the riddle and a faint outline of the prop. A found slot shows a drawn sticker of the scene, the title, the lesson, and the "try this". Progress saves in `localStorage` (a list of found ids). A "start over" button clears it.

### Lesson pages with small loops

The owner pointed to the small inline animations in Ralph Ammer's essays (Bergson, Husserl, Aquinas, and his guide to animation) and in Bao To's "Creative autonomy". Their shared feel: one short sentence, then one small looping drawing that shows exactly that sentence, then the next sentence. The drawings are minimal ink lines with one accent color, and the motion carries the idea.

Each found sticker opens a lesson page in that rhythm:

- 3 or 4 beats. Each beat is one sentence and one small loop (about 240 by 160 pixels) of the real cast acting it out.
- One beat per page is a toy: a single slider or toggle that changes the loop. Examples: the share chance of each cookie player, the number of onlookers at the puddle, the number of steps in the whisper chain.
- Loops follow the animation guide: few keyframes, exaggerated timing, one surprise, a 2 to 4 second cycle.
- Each loop is a small fixed table setup (cast, props, ties, seed). The same director finds the same discovery in it and plays its scene, then the loop starts again. A knob changes the setup. With reduced motion, each loop shows its end pose and a replay button.

The page ends with the "try this" line, which sends the player back to the table.

When a discovery fires, the scene plays first. Then a sticker slides from the scene to the book button, and a small card shows the title and one line, with a button that opens the lesson page. The card closes with a click, Escape, or after the player moves anything.

## 10. Architecture

Main thread only. No worker. One Pixi `Application` for the table and one Svelte 5 shell for the drawer, the book, the card, and settings.

New and kept modules:

| Module | Role |
| --- | --- |
| `src/render/line/*` | Kept. `Shell` moves from `src/sim/types.ts` into `src/render/line/shell.ts`. |
| `src/render/ink.ts`, `palette.ts` | Kept. One palette for the table (`content/palettes/table.json`). |
| `src/audio/*` | Kept. New cue list for chirps, pops, and sticker sound. |
| `src/toy/state.ts` | Plain table state: creatures, ties, props, time. A seeded RNG from the kept `src/sim/rng.ts`, moved here. |
| `src/toy/step.ts` | Fixed 30 Hz step: idle wander, springs, tie sag, prop timers. Pure function of state and input. |
| `src/toy/cast.ts` | The 12 creatures and their tempers, from `content/toy/cast.json` (zod checked). |
| `src/toy/discoveries/*.ts` | One file per discovery: `detect(state)` and `scene(state)`. A scene is a list of timed beats (move, bubble, deform, sound, wait). |
| `src/toy/director.ts` | Runs at most one scene at a time. Locks the actors of the scene against player drags while it plays. |
| `src/render/table-view.ts` | Draws the table, ties, props, creatures, and bubbles from state. |
| `src/ui/*` | `App.svelte`, `Drawer.svelte`, `StickerBook.svelte`, `StickerCard.svelte`, `LessonPage.svelte`, `Settings.svelte`. |
| `src/ui/loop-view.ts` | Plays one lesson loop in its own small Pixi view, and stops it when the page closes. |
| `src/persist/stickers.ts` | Load and save the found list. |

Everything else in `src/sim`, `src/sim-host`, `src/story`, `src/myth`, most of `src/ui`, most of `src/persist`, and the chapter, valley, ink, and myth content goes. Tests that cover deleted code go with it.

## 11. Testing

- Unit (Vitest): each `detect` on hand-built states (fires and does not fire), the scene beat lists, the step function (determinism with one seed), the sticker store.
- End to end (Playwright): one test per discovery, driving real pointer input to trigger it and checking the book. One keyboard-only run. An axe check on the shell.
- Visual: one snapshot of the table at rest, one of the open book.
- Lint, typecheck, and format must pass before each commit.

## 12. Accessibility

- Every creature and prop is reachable by keyboard and has a name for screen readers.
- Reduced motion: no boil, no wander, scenes cut to their end pose with the bubbles.
- High contrast: thicker ink, no faint washes.
- Each scene sends a short line to a live region ("Krit grabs the cookie. Pim glares.").

## 13. Calls made in the design (open to correction)

- **Content rules.** ADR 0016 stays in force: Claude writes and draws the final content, and the placeholder build guard stays.
- **Math.** The strict math rule of ADR 0001 applied to the old simulation, which needed the same result in every browser. The toybox saves only the sticker list, so `src/toy` may use `Math.sin` and `Math.exp` for springs and wobble. It still uses one seeded RNG and no clock reads inside `step`, so tests can replay a table. A new ADR records this.
- **Cookie choices.** Each temper gives a share chance (Pim 0.95, Echo copies, Krit 0.1, others between). The seeded RNG rolls it. A poke on a creature during a cookie scene makes it grab by accident. This is how the player can cause Inch's grudge.
- **Twin box copy.** The copy lives only for the scene. At the end, the two copies hug and merge back into one. It never joins the ties or the keyboard order.
- **Offline.** The service worker and the offline test stay. They are small and they work.

## 14. Left to the builder

- Exact timings, spring constants, and bubble art.
- Exact table layout and prop drawings.
- The text of each sticker, inside the limits in section 3. In-game text is playful and short; the owner's plain English rules apply, and it uses no em dashes.
