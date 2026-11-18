# Snippets

Snippets are small looping animations of the toybox creatures. Each snippet shows one idea in one short sentence. The snippets are separate from the game. They use the same creature drawings and the same ink motion.

Each file in `share/` is one self-contained HTML page. It needs no server and no network. You can open it from your disk, send it to a friend, or put it on any web host.

| File                       | Idea                                            | Cast                            |
| -------------------------- | ----------------------------------------------- | ------------------------------- |
| `cookie-standoff.html`     | Game theory: the prisoner's dilemma             | Pim, Krit                       |
| `look-up.html`             | Psychology: conformity                          | Moss, Tove, Bell, Kite          |
| `telephone.html`           | Networks: a rumor changes at each step          | Kite, Echo, Quill, Cap          |
| `a-little-late.html`       | Philosophy: Bergson, we see the past            | Moss and a firefly              |
| `a-look-at-something.html` | Philosophy: Husserl, a look points at something | Quill                           |
| `borrowed-light.html`      | Philosophy: Aquinas, a light you did not make   | Lantern, Glim, Moss, Bell, Kite |
| `new-plan.html`            | Making: the goal can change while you make      | Pim                             |

### Meet the cast

One loop for each of the twelve creatures. Each loop shows the creature's temper with one small joke.

| File              | Creature               | Joke                                                                          |
| ----------------- | ---------------------- | ----------------------------------------------------------------------------- |
| `meet-pim.html`   | Pim, kind              | Pim breaks a cookie and gives you half.                                       |
| `meet-krit.html`  | Krit, grabby           | Krit stacks cookies on its head until the tower falls.                        |
| `meet-echo.html`  | Echo, copycat          | Echo copies each bounce of a ball, a beat late.                               |
| `meet-moss.html`  | Moss, sleepy           | A leaf lands on Moss, Moss sneezes, and goes back to sleep.                   |
| `meet-bell.html`  | Bell, vain             | The reflection in the mirror blinks on its own.                               |
| `meet-quill.html` | Quill, thinks too hard | Questions multiply until one idea clears them, and then a new question comes. |
| `meet-tove.html`  | Tove, nervous          | Tove feels safe next to some rocks, and follows one when it rolls away.       |
| `meet-gulp.html`  | Gulp, always hungry    | Gulp catches a fly, and the next fly comes.                                   |
| `meet-inch.html`  | Inch, slow             | A whole day goes by, and Inch moves a tiny bit.                               |
| `meet-cap.html`   | Cap, loud              | One shout, and a party of little mushrooms grows up.                          |
| `meet-kite.html`  | Kite, gossip           | The news never stops, and each piece floats off.                              |
| `meet-glim.html`  | Glim, honest           | Glim is glass, so you can see each feeling inside.                            |

### Meet the new friends

Six new creatures live only in the snippets. Pim is their style guide: a round body, one ink line, two dot eyes, and soft blushes. Their shapes are plain and round on purpose. Each one is a cloud, a pudding, a mouse, a ghost, a seed, or a hedgehog, so no shape looks like a part of a person.

| Creature | Shape                      | Temper           | Likes                        | Quirk                                              |
| -------- | -------------------------- | ---------------- | ---------------------------- | -------------------------------------------------- |
| Drift    | A small cloud              | Generous, dreamy | Dry buds, slow afternoons    | Each drop it gives away makes it lighter.          |
| Dollop   | A dab of soft pudding      | Jolly, giggly    | Jokes, small visitors        | It laughs so hard that it shakes things off.       |
| Nib      | A round field mouse        | Curious          | Shiny things, bubbles, holes | It must see everything from very near.             |
| Hush     | A small sheet ghost        | Shy, sweet       | Bushes, quiet corners        | It hides when you look, then comes back to wave.   |
| Sprig    | A seed with two new leaves | Eager, hopeful   | Sun, tall things, growing    | It stretches on tiptoe each morning.               |
| Tuck     | A round hedgehog           | Grumpy, but soft | Being alone (it says)        | Its spikes go up when it fusses, and go soft fast. |

| File               | Creature              | Joke                                                                |
| ------------------ | --------------------- | ------------------------------------------------------------------- |
| `meet-drift.html`  | Drift, generous       | Drift rains on a bud until it blooms, and floats off a bit higher.  |
| `meet-dollop.html` | Dollop, jolly         | A ladybug climbs up, and Dollop giggles it right off.               |
| `meet-nib.html`    | Nib, curious          | Nib leans in to see a soap bubble, and the bubble pops on its nose. |
| `meet-hush.html`   | Hush, shy             | Hush ducks behind a bush when you look, then peeks out to say hi.   |
| `meet-sprig.html`  | Sprig, eager          | Sprig cannot reach the flower, so the flower bends down to Sprig.   |
| `meet-tuck.html`   | Tuck, grumpy but soft | Tuck fusses at a butterfly, then keeps very still so it can rest.   |

The body drawings are in `content/creatures/`, and `kit/friends.ts` gives each one its colors and its resting mood.

The style follows the small inline loops in Ralph Ammer's essays and in Bao To's "Creative autonomy": one sentence, one drawing, one surprise. All art and text here are original.

## Save a snippet

Open a file in a browser. Use the buttons under the drawing:

- **Save PNG** saves the frame that shows now, at 960 by 720 pixels.
- **Save GIF** saves one full loop at 480 by 360 pixels and 25 frames per second. The GIF loops forever.
- **Save video** records one loop in real time. Chrome and Safari save MP4. Firefox saves WebM.
- **Pause** stops the loop.

To open a snippet paused at a time, add `?t=` and the seconds to the address, for example `look-up.html?t=4.6`. With reduced motion turned on, a snippet opens paused at its best frame.

## Make a new snippet

1. Add a file to `scenes/`. Copy a scene that is near your idea.
2. Import the rigs that you need from `content/rigs/`.
3. Call `mount()` with a caption, a loop length, and a `draw(ctx, t)` function. The drawing at the loop length must match the drawing at 0.
4. Build the shared files:

   ```sh
   npm run snippets
   ```

5. Commit the scene and its file in `share/`. A unit test fails when `share/` does not match the scenes.

Shared code:

- `kit/draw.ts` draws creatures, bubbles, icons, and yarn, and has the timing curves.
- `kit/stage.ts` draws the frame and the caption, and makes the buttons.
- `kit/gif.ts` encodes the GIF.
- `build.ts` bundles each scene into one HTML file.
