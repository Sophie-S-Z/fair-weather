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
