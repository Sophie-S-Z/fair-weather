// Parses `beat:` tags from Ink (spec 10.3). Ink returns tags; the director acts on them.
export type BeatAction = { kind: 'arrange_meeting'; a: string; b: string };

const ARRANGE_MEETING = /^beat:arrange_meeting\(([a-z0-9_-]+),([a-z0-9_-]+)\)$/;

/** Returns the action a tag names, or null when the tag is not a known beat tag. */
export function parseBeatTag(tag: string): BeatAction | null {
  const m = ARRANGE_MEETING.exec(tag);
  if (!m) return null;
  return { kind: 'arrange_meeting', a: m[1] ?? '', b: m[2] ?? '' };
}
