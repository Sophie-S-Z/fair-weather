import type { PropKind } from '../toy/types.ts';

/** Each prop's name, as the drawer and screen readers say it. */
export const PROP_NAMES: Record<PropKind, string> = {
  cookie: 'Cookie',
  bush: 'Berry bush',
  mirror: 'Mirror',
  signpost: 'Signpost',
  puddle: 'Puddle',
  twins: 'Twin boxes',
  track: 'Track and lever',
  lamp: 'Lamp and wall',
};

/**
 * The part of each prop the player grabs: x, y from the prop's foot, then width and height, in
 * table units. The track is grabbed by its lever and the lamp by its wall and lamp.
 */
export const PROP_BOX: Record<PropKind, readonly [number, number, number, number]> = {
  cookie: [-26, -50, 52, 52],
  bush: [-72, -100, 144, 104],
  mirror: [-34, -130, 68, 132],
  signpost: [-16, -132, 92, 134],
  puddle: [-82, -26, 164, 52],
  twins: [-126, -68, 252, 70],
  track: [-100, 0, 70, 70],
  lamp: [-200, -60, 320, 64],
};
