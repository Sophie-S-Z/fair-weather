import type { Song, VotingRule } from '../sim/types.ts';
import type { WorldVerb } from '../story/verbs.ts';

/** The name of each tool, for the game's tool tray and the sandbox's tool bar. */
export const TOOL_LABELS: Record<WorldVerb, string> = {
  place: 'Place',
  wake: 'Wake',
  respond: 'Respond',
  shine: 'Sunlight',
  whisper: 'Whisper',
  thread: 'Thread',
  fog: 'Fog',
  blow: 'Wind',
  walk: 'Walk',
  manner: 'Manner',
  join: 'Join',
  pose: 'Pose',
  keepsake: 'Keepsake',
  stepDown: 'Step down',
  vote: 'Vote',
  sing: 'Sing',
  rain: 'Rain',
  path: 'Paths',
  welcome: 'Gate',
};

/** A council stake's name from its id: "dry-hollow" is "Dry hollow". */
export function spotLabel(id: string): string {
  const words = id.replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Each voting rule's name in a sentence (ADR 0015 item 4). */
export const RULE_LABELS: Record<VotingRule, string> = {
  plurality: 'plurality',
  approval: 'approval',
  runoff: 'instant runoff',
  score: 'score',
};

/** Each song's name in a sentence (ADR 0015 item 5). */
export const SONG_LABELS: Record<Song, string> = {
  reed: 'the reed song',
  rain: 'the rain song',
  old: 'the old song',
};
