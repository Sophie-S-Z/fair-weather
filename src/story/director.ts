// The story director (spec 10.2, 10.3): writes sim values into Ink, plays a knot, and acts on
// its beat tags. It sends only the commands the tags name; it never overwrites a sim result.
import type { SimPort, WorldLite } from '../sim-host/protocol.ts';
import { parseBeatTag } from './beat-tags.ts';
import type { InkRunner } from './ink.ts';

export interface Beat {
  knot: string;
  vars: Record<string, (lite: WorldLite) => number>;
}

export function createDirector(
  port: SimPort,
  ink: InkRunner,
): { runBeat(beat: Beat): Promise<{ lines: string[] }> } {
  // Create the director before the first snapshot: it learns the world only from snapshots.
  let latest: WorldLite | null = null;
  const waiting: ((lite: WorldLite) => void)[] = [];
  port.onMessage((m) => {
    if (m.t !== 'snapshot') return;
    latest = m.lite;
    for (const resolve of waiting.splice(0)) resolve(m.lite);
  });

  function snapshot(): Promise<WorldLite> {
    if (latest) return Promise.resolve(latest);
    return new Promise((resolve) => waiting.push(resolve));
  }

  return {
    async runBeat(beat) {
      const lite = await snapshot();
      for (const [name, read] of Object.entries(beat.vars)) ink.setVar(name, read(lite));
      const { lines, tags } = ink.play(beat.knot);
      const actions = [];
      for (const tag of tags) {
        if (tag === 'placeholder' || !tag.startsWith('beat:')) continue;
        const action = parseBeatTag(tag);
        if (!action) throw new Error(`Unknown Ink tag "${tag}" in knot ${beat.knot}`);
        actions.push(action);
      }
      for (const action of actions) port.send([{ t: 'arrangeMeeting', a: action.a, b: action.b }]);
      return { lines };
    },
  };
}
