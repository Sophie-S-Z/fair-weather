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
  rain: 'Rain',
  path: 'Paths',
  welcome: 'Gate',
};
