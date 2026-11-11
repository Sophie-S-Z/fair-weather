// A thin wrapper over the inkjs runtime: write variables, play a knot to its end.
import { Story } from 'inkjs';

export interface InkRunner {
  setVar(name: string, value: number | string | boolean): void;
  /** The Ink state as JSON, and its restore (spec 15.1). */
  state(): string;
  load(state: string): void;
  play(knot: string): { lines: string[]; tags: string[] };
}

export function createInk(json: string): InkRunner {
  const story = new Story(json);
  return {
    setVar(name, value) {
      story.variablesState[name] = value;
    },
    state: () => story.state.toJson(),
    load(state) {
      story.state.LoadJson(state);
    },
    play(knot) {
      story.ChoosePathString(knot);
      const lines: string[] = [];
      const tags: string[] = [];
      while (story.canContinue) {
        const text = story.Continue();
        const line = text?.trim();
        if (line) lines.push(line);
        tags.push(...(story.currentTags ?? []));
      }
      return { lines, tags };
    },
  };
}
