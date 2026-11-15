# Screen-reader kit

This kit is for the screen-reader pass (T10, ADR 0014 item 17). The automatic axe checks find missing names and bad contrast. They cannot tell what a screen reader says. A person must listen.

Do the pass two times:

- **Pass 1:** NVDA with Firefox, on Windows.
- **Pass 2:** VoiceOver with Safari, on macOS.

One person can do both passes. That person needs to know how to use the screen reader. Write "Tester A" on the results. Write no real name.

## 1. Before the pass

1. Install the project. Run `npm ci`.
2. Start the game. Run `npm run dev`. Open the address that Vite shows. The production build does not run while placeholder content is in the game (ADR 0010).
3. Open the browser tools. Delete the site data for the address. Close the browser tools.
4. Turn on the screen reader. Close other apps that make sound.
5. Keep the game window in front. Do not use a mouse. Use the keyboard and the screen reader keys only.
6. In Settings, leave the defaults. Do not change text size, contrast, or motion for this pass.
7. Print the results table (section 5), one copy for each pass.

Some screens need a special address or a saved game. Section 3 says how to reach each one.

## 2. The five checks

Do these five checks on every screen in section 3. Use the same words in the results table.

1. **Heading.** When the screen opens, the screen reader reads the screen heading, or the dialog name and its heading. Write what it says.
2. **Names and states.** Move through the screen with Tab. For each control, the screen reader says its name and its state (for example "pressed", "expanded", "dimmed", "checked"). A control with no name, or with a wrong name, fails.
3. **Live lines.** When the game changes a status or story line, the screen reader reads the line one time. It does not read the line two times, and it does not stay silent. Wait for a line to change, or press a key that makes one change (for example, pick a creature with Tab on the scene).
4. **Focus.** On a screen that opens as a dialog, focus moves into the dialog when it opens. Tab stays inside the dialog. Escape or Close closes it. Focus then goes back to the control that opened it, and the screen reader says that control.
5. **The canvas.** Nothing that carries meaning is only in the canvas. Find each fact that you see in the picture (who is near whom, who holds what, the time of day, the weather). Find it as text. If you can see a fact that you cannot hear, it fails.

If a check does not apply to a screen, write "n/a" and the reason.

## 3. The screens

Do the screens in this order.

### 3.1 Title

Open the address of the game with no save. Tab through the menu. Check that Continue and Book of Skies are dimmed (not available) when there is no save. Check the order: Begin, Continue, Book of Skies, Sandbox, Where this model is wrong, Settings.

### 3.2 Settings

Select Settings on the title. Check each setting: its name, its state, and the line that says that the question mark key shows the keys. Select Back. Focus goes back to the Settings button.

### 3.3 Game

Select Begin. Chapter 0 opens. Listen to the chapter heading, the story lines, and the status line. Pick a creature with Tab on the scene. Listen to the status line. Check the tools (name and state), and the speed buttons (Pause, 1x, 2x).

### 3.4 Bet card

Open `?chapter=2` at the end of the address. Select Begin. A bet card opens after a short time. Check the dialog name, the question, and each option. Check that Escape does nothing before an answer. Answer the bet. Focus goes back to the scene.

### 3.5 Drawer

In the game, select "Diary and notes". Check the button state (expanded). Check the diary lines, the numbers under the hood (press P on a picked creature), and the other buttons in the drawer. Close the drawer and check where focus goes.

### 3.6 Journal

Open `?chapter=16` at the end of the address. Select Begin. Select "Wake as" on the hero choice. In the Fen, press J. The journal opens as a dialog. Listen to the pages and the heading of each page. Check the field "Your line". Press Escape and check the focus.

The journal has no page until a valley is finished. If it is empty, write what the screen reader says.

### 3.7 Book of Skies

Play or skip to the end of chapter 10 (the fire), and select Listen five times. Press B, or select Book of Skies in the drawer. The Book of Skies opens as a dialog. Listen to the year, the narrator, and each verse heading. Close it. Then go to the title and select Book of Skies. Check the screen heading and the Back button.

### 3.8 Sandbox and each panel

On the title, select Sandbox. Or open `?sandbox=new` at the end of the address. Check the heading "Sandbox: A new valley". Check these parts one by one:

- The tools (keys 1 to 8): the name and state of each tool.
- The panels Population, Rules, Weather, and Network. Each panel is a fold. Check that the fold says "expanded" or "collapsed". Open each one. Check each knob: its name, its value, and its limits. Change a knob with the arrow keys and check that the screen reader says the new value.
- The Challenges card: each challenge button, the status line, Start the dance, Try again, and Stop the challenge.
- The Timeline strip: the Rewind range, Back to now, Pin a note, and the notes.
- The valley line and the status line.

### 3.9 Share panel

In the sandbox, select "Share this valley". The Share panel opens as a dialog. Check the heading, the link field, the Copy the link button, and the line "The link is copied." (it must be read one time). Check the Open a valley file field. Select Close. Focus goes back to the Share button.

### 3.10 Postcard dialog

In the sandbox, select "Make a postcard". The "Make a postcard" dialog opens. Check the heading, the line that the postcard will say, the save button, the status line while the file is made, and Close.

### 3.11 Help sheet

Press the question mark key in the game, and then in the sandbox. The "Keys" dialog opens. Check the heading, the table (each row is read as a key and what it does), and Close. Check that the sim pauses and that focus goes back to the scene.

### 3.12 Model-limits page and dialog

On the title, select "Where this model is wrong". Check the page heading and each section heading. Check the links in each Sources list. Select Back. Focus goes back to the button on the title. Then open the same page from the drawer in the game. It opens as a dialog. Check the dialog name, and check that Escape closes it.

### 3.13 Still pages

The still version is for a browser with no WebGL. To see it:

- In Firefox: open `about:config`, find `webgl.disabled`, and set it to `true`. Reload the game. Select Begin. Set it back to `false` after the pass.
- In Safari: if you cannot turn WebGL off, write "not tested in Safari" in the results table.

Check the notice at the top of the page, the page heading, the count ("Page 1 of ..."), the picture and its text alternative, every story line, the margin notes, and the Back and Next buttons. Page to the end ("The End"). Check that the heading takes focus on each page and that the screen reader reads it.

### 3.14 Other screens

Do these if you have time. Write "not done" if you do not.

- The lost-valley page: open `/#v1.broken` as the address. Check the heading "This valley could not be found" and the Start fresh button.
- The interludes (`?chapter=4`, `?chapter=6`, `?chapter=8`, `?chapter=11`, `?chapter=13`): each has an activity. Check that the activity is playable and named.
- The hero choice (`?chapter=16`): check the six hero choices, the name field, and the Wake button.
- The fire (`?chapter=15`): check the Listen button and each verse.
- The Cosmos and Soul views (key Z and key X): check the panel "Who is friends with whom".
- "The End": check that its heading takes focus.

## 4. How to write what you hear

- Write the words that the screen reader says. Do not write what you think it should say.
- If the screen reader says nothing, write "silent".
- If it says a line two times, write "twice".
- Write the key that you pressed before each problem.
- A pass means: the screen reader says the right words, one time, in the right order. A fail means: it is silent, wrong, or repeated, or focus goes to the wrong place.

## 5. Results table

Make one copy for each pass. Write "pass", "fail", or "n/a" in each cell. Write each fail in the notes with the key you pressed and the words you heard.

Pass: ______ (NVDA with Firefox, or VoiceOver with Safari). Date: ______. Tester A.

| Screen | Heading read | Names and states | Live lines read once | Focus in and back out | Nothing only in the canvas | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Title | | | | n/a | n/a | |
| Settings | | | | n/a | n/a | |
| Game | | | | n/a | | |
| Bet card | | | | | n/a | |
| Drawer | | | | | | |
| Journal | | | | | | |
| Book of Skies (dialog and page) | | | | | n/a | |
| Sandbox | | | | n/a | | |
| Sandbox panel: Population | | | | n/a | n/a | |
| Sandbox panel: Rules | | | | n/a | n/a | |
| Sandbox panel: Weather | | | | n/a | n/a | |
| Sandbox panel: Network | | | | n/a | n/a | |
| Challenges card | | | | n/a | n/a | |
| Timeline strip | | | | n/a | n/a | |
| Share panel | | | | | n/a | |
| Postcard dialog | | | | | n/a | |
| Still pages | | | | n/a | | |
| Model-limits page | | | | | n/a | |
| Model-limits dialog | | | | | n/a | |
| Help sheet | | | | | n/a | |
| Lost-valley page | | | | n/a | n/a | |
| Interludes | | | | n/a | | |
| Hero choice | | | | n/a | n/a | |
| The fire | | | | n/a | n/a | |
| The End | | | | n/a | n/a | |

## 6. After the pass

1. Count the fails for each check and for each screen.
2. For each fail, write one line: the screen, the key, what you heard, and what you expected.
3. Put the results in `docs/playtest/screen-reader-results.md`.
4. Tell the project owner. Each fail is a bug to fix before the launch. The launch needs no fail on the Title, Game, Bet card, Sandbox, Share panel, Postcard dialog, Help sheet, and Still pages.
