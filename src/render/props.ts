import type { Graphics } from 'pixi.js';
import { cartAt, trackPaths, twinBoxes, WALL_HALF } from '../toy/geometry.ts';
import type { Prop } from '../toy/types.ts';
import { smoothClosed } from './ink.ts';
import { PALETTE } from './palette.ts';

export interface PropLook {
  width: number;
  time: number;
  calm: boolean;
}

const ink = (look: PropLook, k = 1) =>
  ({ color: PALETTE.ink, width: look.width * k, cap: 'round', join: 'round' }) as const;

/** The lamp's screen, above and behind the wall, in table units from the prop. */
export const SCREEN = { left: -170, right: 170, top: -250, bottom: -120 } as const;

/** Parts that lie on the floor or hang behind everything: the puddle, the rails, the lamp's screen. */
export function drawFlat(g: Graphics, p: Prop, look: PropLook): void {
  switch (p.kind) {
    case 'puddle': {
      const wob = look.calm ? 0 : Math.sin(look.time * 2) * 3;
      g.ellipse(p.x, p.y, 80 + wob, 24)
        .fill(PALETTE.water)
        .stroke(ink(look, 0.8));
      g.moveTo(p.x - 40, p.y - 4)
        .quadraticCurveTo(p.x - 25, p.y - 9, p.x - 10, p.y - 4)
        .stroke({ ...ink(look, 0.6), color: PALETTE.paper });
      break;
    }
    case 'track': {
      const { trunk, far, near } = trackPaths(p);
      for (const [x1, y1, x2, y2] of [trunk, far, near]) {
        const len = Math.hypot(x2 - x1, y2 - y1);
        const [nx, ny] = [-(y2 - y1) / len, (x2 - x1) / len];
        for (let d = 10; d < len; d += 24) {
          const [cx, cy] = [x1 + ((x2 - x1) * d) / len, y1 + ((y2 - y1) * d) / len];
          g.moveTo(cx - nx * 11, cy - ny * 11)
            .lineTo(cx + nx * 11, cy + ny * 11)
            .stroke({ ...ink(look, 1.4), color: PALETTE.wood });
        }
        for (const side of [-7, 7])
          g.moveTo(x1 + nx * side, y1 + ny * side)
            .lineTo(x2 + nx * side, y2 + ny * side)
            .stroke(ink(look, 0.7));
      }
      // The lever by the fork: it leans toward the branch it picks.
      const [lx, ly] = [trunk[2] - 10, trunk[3] + 40];
      const lean = p.on ? 0.5 : -0.5;
      g.roundRect(lx - 12, ly - 4, 24, 8, 3)
        .fill(PALETTE.wood)
        .stroke(ink(look, 0.8));
      g.moveTo(lx, ly)
        .lineTo(lx + Math.sin(lean) * 34, ly - Math.cos(lean) * 34)
        .stroke(ink(look, 1.2));
      g.circle(lx + Math.sin(lean) * 34, ly - Math.cos(lean) * 34, 6)
        .fill(PALETTE.berry)
        .stroke(ink(look, 0.8));
      if (p.since >= 0) {
        const [cx, cy] = cartAt(p, look.time - p.since);
        g.roundRect(cx - 22, cy - 30, 44, 24, 5)
          .fill(PALETTE.accent)
          .stroke(ink(look));
        g.circle(cx - 12, cy - 4, 6)
          .fill(PALETTE.paper)
          .stroke(ink(look, 0.8));
        g.circle(cx + 12, cy - 4, 6)
          .fill(PALETTE.paper)
          .stroke(ink(look, 0.8));
      }
      break;
    }
    case 'lamp': {
      const { left, right, top, bottom } = SCREEN;
      g.moveTo(p.x + left - 6, p.y + top)
        .lineTo(p.x + right + 6, p.y + top)
        .stroke(ink(look, 1.2));
      g.rect(p.x + left, p.y + top, right - left, bottom - top)
        .fill(p.on ? PALETTE.glow : PALETTE.paper)
        .stroke(ink(look, 0.8));
      const [ax, ay] = [p.x - WALL_HALF - 50, p.y - 6];
      if (p.on) {
        g.poly([ax, ay - 40, p.x + left, p.y + top, p.x + right, p.y + bottom]).fill({
          color: PALETTE.glow,
          alpha: 0.35,
        });
      }
      g.moveTo(ax, ay)
        .lineTo(ax, ay - 34)
        .stroke(ink(look));
      g.poly([ax - 16, ay - 34, ax + 16, ay - 34, ax + 9, ay - 52, ax - 9, ay - 52])
        .fill(p.on ? PALETTE.glow : PALETTE.wood)
        .stroke(ink(look, 0.9));
      g.ellipse(ax, ay, 14, 5).fill(PALETTE.wood).stroke(ink(look, 0.8));
      break;
    }
    default:
      break;
  }
}

/** Parts that stand up and sort by depth with the creatures. */
export function drawStanding(g: Graphics, p: Prop, look: PropLook): void {
  switch (p.kind) {
    case 'cookie': {
      const r = 22;
      const y = p.y - r;
      if (p.count === 1) {
        g.circle(p.x, y, r).fill(PALETTE.cookie).stroke(ink(look));
        for (const [dx, dy] of [
          [-8, -7],
          [7, -3],
          [-2, 9],
          [10, 9],
        ] as const) {
          g.circle(p.x + dx, y + dy, 2.8).fill(PALETTE.ink);
        }
      } else if (p.count === 2) {
        for (const side of [-1, 1]) {
          const cx = p.x + side * 16;
          g.arc(cx, y, r, side > 0 ? -Math.PI / 2 : Math.PI / 2, side > 0 ? Math.PI / 2 : (3 * Math.PI) / 2)
            .closePath()
            .fill(PALETTE.cookie)
            .stroke(ink(look));
        }
      } else if (p.count === 0) {
        for (const [dx, dy, cr] of [
          [-18, -4, 4],
          [-6, -2, 3],
          [8, -5, 4],
          [20, -2, 3],
          [0, -8, 2.5],
        ] as const) {
          g.circle(p.x + dx, p.y + dy, cr)
            .fill(PALETTE.cookie)
            .stroke(ink(look, 0.5));
        }
      }
      break;
    }
    case 'bush': {
      const droop = p.on ? 0 : 18;
      const pts = [-62, 0, -70, -40, -45, -78, -5, -92, 38, -80, 66, -46, 60, 0].map((v, i) =>
        i % 2 === 1 && v < 0 ? v + droop : v,
      );
      smoothClosed(
        g,
        pts.map((v, i) => (i % 2 === 0 ? p.x + v : p.y + v)),
      );
      g.fill(p.on ? PALETTE.leaf : 0xc9bfa8).stroke(ink(look));
      g.moveTo(p.x - 6, p.y)
        .lineTo(p.x - 4, p.y + 4)
        .stroke(ink(look));
      const spots = [
        [-34, -40],
        [12, -62],
        [36, -30],
        [-10, -24],
        [-44, -62],
        [24, -48],
      ] as const;
      spots.slice(0, Math.max(0, p.count)).forEach(([dx, dy]) => {
        g.circle(p.x + dx, p.y + dy + droop * 0.5, 7)
          .fill(PALETTE.berry)
          .stroke(ink(look, 0.7));
      });
      break;
    }
    case 'mirror': {
      g.moveTo(p.x, p.y)
        .lineTo(p.x, p.y - 40)
        .stroke(ink(look));
      g.moveTo(p.x - 18, p.y)
        .lineTo(p.x + 18, p.y)
        .stroke(ink(look));
      g.ellipse(p.x, p.y - 82, 30, 44)
        .fill(PALETTE.glass)
        .stroke(ink(look, 1.3));
      g.moveTo(p.x - 12, p.y - 104)
        .lineTo(p.x - 2, p.y - 114)
        .stroke({ ...ink(look, 0.8), color: PALETTE.paper });
      break;
    }
    case 'signpost': {
      g.moveTo(p.x, p.y)
        .lineTo(p.x, p.y - 120)
        .stroke(ink(look, 1.3));
      g.poly([
        p.x - 12,
        p.y - 128,
        p.x + 54,
        p.y - 128,
        p.x + 72,
        p.y - 112,
        p.x + 54,
        p.y - 96,
        p.x - 12,
        p.y - 96,
      ])
        .fill(PALETTE.wood)
        .stroke(ink(look));
      g.moveTo(p.x + 30, p.y - 118)
        .bezierCurveTo(p.x + 30, p.y - 124, p.x + 42, p.y - 124, p.x + 40, p.y - 115)
        .quadraticCurveTo(p.x + 35, p.y - 112, p.x + 35, p.y - 106)
        .stroke(ink(look, 0.8));
      break;
    }
    case 'twins': {
      const { a, b } = twinBoxes(p);
      const shake = p.since >= 0 && look.time - p.since < 1 && !look.calm ? Math.sin(look.time * 60) * 3 : 0;
      for (const [[bx, by], dx, label] of [
        [a, shake, 'A'],
        [b, -shake, 'B'],
      ] as const) {
        g.roundRect(bx - 34 + dx, by - 64, 68, 64, 6)
          .fill(PALETTE.wood)
          .stroke(ink(look));
        g.moveTo(bx - 38 + dx, by - 64)
          .lineTo(bx + 38 + dx, by - 64)
          .stroke(ink(look, 1.4));
        if (label === 'A')
          g.moveTo(bx - 8 + dx, by - 40)
            .lineTo(bx + 8 + dx, by - 40)
            .stroke(ink(look, 0.8));
      }
      g.moveTo(a[0] + 44, a[1] - 34)
        .lineTo(b[0] - 44, b[1] - 34)
        .stroke(ink(look, 0.8));
      g.moveTo(b[0] - 54, b[1] - 42)
        .lineTo(b[0] - 44, b[1] - 34)
        .lineTo(b[0] - 54, b[1] - 26)
        .stroke(ink(look, 0.8));
      break;
    }
    case 'lamp': {
      g.rect(p.x - WALL_HALF, p.y - 46, WALL_HALF * 2, 46)
        .fill(0xe3cfb1)
        .stroke(ink(look));
      for (let row = 1; row < 3; row++) {
        const y = p.y - row * 15.5;
        g.moveTo(p.x - WALL_HALF, y)
          .lineTo(p.x + WALL_HALF, y)
          .stroke(ink(look, 0.4));
        for (let x = p.x - WALL_HALF + (row % 2) * 20 + 20; x < p.x + WALL_HALF; x += 40) {
          g.moveTo(x, y)
            .lineTo(x, y + 15.5)
            .stroke(ink(look, 0.4));
        }
      }
      break;
    }
    default:
      break;
  }
}
