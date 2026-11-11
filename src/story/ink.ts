// A thin wrapper over the inkjs runtime: write variables, play a knot to its end.
import { Story } from 'inkjs';

export interface InkRunner {
  setVar(name: string, value: number | string | boolean): void;
  play(knot: string): { lines: string[]; tags: string[] };
}

export function createInk(json: string): InkRunner {
  const story = new Story(json);
  return {
    setVar(name, value) {
      story.variablesState[name] = value;
    },
    play(knot) {
      story.ChoosePathString(knot);
      const lines: string[] = [];
      const tags: string[] = [];
      while (story.canContinue) {
        const text = story.Continue();
        if (text !== null) lines.push(text.trim());
        tags.push(...(story.currentTags ?? []));
      }
      return { lines, tags };
    },
  };
}
