import type { Graphics } from 'pixi.js';
import type { Icon } from '../toy/types.ts';
import { smoothClosed } from './ink.ts';
import { PALETTE } from './palette.ts';

const W = 2.4;
const ink = { color: PALETTE.ink, width: W, cap: 'round', join: 'round' } as const;

function cookie(g: Graphics, x: number, y: number, r: number): void {
  g.circle(x, y, r).fill(PALETTE.cookie).stroke(ink);
  for (const [dx, dy] of [
    [-0.4, -0.3],
    [0.35, -0.1],
    [-0.1, 0.4],
  ] as const) {
    g.circle(x + dx * r, y + dy * r, r * 0.13).fill(PALETTE.ink);
  }
}

function heart(g: Graphics, color: number = PALETTE.berry): void {
  g.moveTo(0, 12)
    .bezierCurveTo(-18, 0, -12, -16, 0, -6)
    .bezierCurveTo(12, -16, 18, 0, 0, 12)
    .closePath()
    .fill(color)
    .stroke(ink);
}

/** One icon, about 32 units across, centered on (0, 0). */
const DRAW: Record<Exclude<Icon, 'count'>, (g: Graphics) => void> = {
  cookie: (g) => {
    cookie(g, 0, 0, 13);
  },
  crumbs: (g) => {
    for (const [x, y, r] of [
      [-9, 4, 3.5],
      [2, 7, 2.5],
      [9, 2, 3],
      [-2, -3, 2],
      [6, -6, 1.8],
    ] as const) {
      g.circle(x, y, r)
        .fill(PALETTE.cookie)
        .stroke({ ...ink, width: 1.4 });
    }
  },
  berry: (g) => {
    g.circle(-5, 3, 7).fill(PALETTE.berry).stroke(ink);
    g.circle(6, 4, 6).fill(PALETTE.berry).stroke(ink);
    g.moveTo(-3, -4).quadraticCurveTo(0, -12, 6, -12).stroke(ink);
  },
  heart: (g) => {
    heart(g);
  },
  question: (g) => {
    g.moveTo(-7, -7)
      .bezierCurveTo(-7, -16, 8, -16, 8, -7)
      .bezierCurveTo(8, -1, 0, -1, 0, 5)
      .stroke({ ...ink, width: 3.2 });
    g.circle(0, 12, 2.2).fill(PALETTE.ink);
  },
  storm: (g) => {
    smoothClosed(g, [-14, 0, -12, -9, -3, -12, 5, -11, 12, -6, 14, 1, 6, 4, -6, 4])
      .fill(0x8e8a94)
      .stroke(ink);
    g.moveTo(-2, 5)
      .lineTo(-6, 12)
      .lineTo(-1, 11)
      .lineTo(-4, 17)
      .stroke({ ...ink, color: PALETTE.accent });
  },
  bang: (g) => {
    g.moveTo(0, -13)
      .lineTo(0, 5)
      .stroke({ ...ink, width: 4 });
    g.circle(0, 12, 2.6).fill(PALETTE.ink);
  },
  eye: (g) => {
    g.moveTo(-15, 0)
      .quadraticCurveTo(0, -14, 15, 0)
      .quadraticCurveTo(0, 14, -15, 0)
      .closePath()
      .fill(PALETTE.paper)
      .stroke(ink);
    g.circle(0, 0, 4.5).fill(PALETTE.ink);
  },
  help: (g) => {
    g.circle(0, 0, 13).fill(PALETTE.paper).stroke(ink);
    g.circle(0, 0, 6).fill(PALETTE.page).stroke(ink);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      g.moveTo(Math.cos(a) * 6, Math.sin(a) * 6)
        .lineTo(Math.cos(a) * 13, Math.sin(a) * 13)
        .stroke({ ...ink, color: PALETTE.berry, width: 4 });
    }
  },
  zzz: (g) => {
    g.moveTo(-12, -2).lineTo(-3, -2).lineTo(-12, 8).lineTo(-3, 8).stroke(ink);
    g.moveTo(2, -12).lineTo(12, -12).lineTo(2, -1).lineTo(12, -1).stroke(ink);
  },
  crown: (g) => {
    g.moveTo(-13, 8)
      .lineTo(-14, -8)
      .lineTo(-6, -1)
      .lineTo(0, -11)
      .lineTo(6, -1)
      .lineTo(14, -8)
      .lineTo(13, 8)
      .closePath()
      .fill(0xf2c84b)
      .stroke(ink);
  },
  star: (g) => {
    const pts: number[] = [];
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? 14 : 6;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      pts.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.poly(pts, true).fill(0xf2c84b).stroke(ink);
  },
  monster: (g) => {
    smoothClosed(g, [-13, 12, -14, -4, -9, -13, -3, -9, 3, -13, 9, -9, 14, -4, 13, 12, 6, 8, 0, 12, -6, 8])
      .fill(0x9c86c9)
      .stroke(ink);
    g.circle(-5, -2, 2.6)
      .fill(PALETTE.paper)
      .stroke({ ...ink, width: 1.4 });
    g.circle(5, -2, 2.6)
      .fill(PALETTE.paper)
      .stroke({ ...ink, width: 1.4 });
    g.moveTo(-6, 5)
      .lineTo(-3, 3)
      .lineTo(0, 5)
      .lineTo(3, 3)
      .lineTo(6, 5)
      .stroke({ ...ink, width: 1.6 });
  },
};

/** Draws `icon` centered on (0, 0). A `count` bubble has no picture: its view shows the number. */
export function drawIcon(g: Graphics, icon: Icon): void {
  if (icon !== 'count') DRAW[icon](g);
}

/** The bubble shape around an icon: a rounded box with a tail down to (0, 0). */
export function drawBubble(g: Graphics, highContrast: boolean): void {
  const w = highContrast ? W * 1.5 : W;
  g.roundRect(-27, -66, 54, 48, 16)
    .fill(PALETTE.bubble)
    .stroke({ ...ink, width: w });
  g.moveTo(-8, -19).lineTo(0, -4).lineTo(6, -19).fill(PALETTE.bubble);
  g.moveTo(-8, -18)
    .lineTo(0, -4)
    .lineTo(6, -18)
    .stroke({ ...ink, width: w });
}

/** The bubble's icon center, over its tail tip at (0, 0). */
export const ICON_Y = -42;
