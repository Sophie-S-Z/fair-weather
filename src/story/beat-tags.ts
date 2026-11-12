// Parses `beat:` tags from Ink (spec 10.3). Ink returns tags; the chapter runner acts on them.
// A tag names an action a chapter beat can list (spec 10.2).
export type BeatAction =
  { arrange: [string, string] } | { camera: string } | { pause: true } | { openBet: true };

const ARRANGE_MEETING = /^beat:arrange_meeting\(([a-z0-9_-]+),([a-z0-9_-]+)\)$/;
const CAMERA = /^beat:camera\(([a-z0-9_-]+)\)$/;

/** Returns the action a tag names, or null when the tag is not a known beat tag. */
export function parseBeatTag(tag: string): BeatAction | null {
  if (tag === 'beat:pause') return { pause: true };
  if (tag === 'beat:open_bet') return { openBet: true };
  let m = ARRANGE_MEETING.exec(tag);
  if (m) return { arrange: [m[1] ?? '', m[2] ?? ''] };
  m = CAMERA.exec(tag);
  if (m) return { camera: m[1] ?? '' };
  return null;
}
