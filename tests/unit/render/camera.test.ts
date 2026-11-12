import { expect, test } from 'vitest';
import { lerpTransform, toScene, toScreen, viewTransform } from '../../../src/render/camera.ts';

test('fits the whole scene into the screen and centers it', () => {
  // 1600 x 900 into 800 x 600: width limits, scale 0.5, scene height 450 centered in 600.
  expect(viewTransform(1600, 900, 800, 600)).toEqual({ scale: 0.5, x: 0, y: 75 });
});

test('a shot zooms in and centers its point', () => {
  const t = viewTransform(1600, 900, 800, 450, { x: 800, y: 450, zoom: 2 });
  expect(t).toEqual({ scale: 1, x: -400, y: -225 });
});

test('a shot near the edge stops at the scene border', () => {
  const t = viewTransform(1600, 900, 800, 450, { x: 0, y: 900, zoom: 2 });
  // The view's left edge is scene x 0 and its bottom edge is scene y 900.
  expect(toScene(t, 0, 450)).toEqual([0, 900]);
});

test('toScene inverts the transform', () => {
  const t = viewTransform(1600, 900, 1280, 720, { x: 500, y: 400, zoom: 1.5 });
  const [x, y] = toScene(t, 500 * t.scale + t.x, 400 * t.scale + t.y);
  expect(x).toBeCloseTo(500, 9);
  expect(y).toBeCloseTo(400, 9);
});

test('toScreen is the inverse of toScene', () => {
  const t = viewTransform(1600, 900, 1280, 720, { x: 500, y: 400, zoom: 1.5 });
  const [x, y] = toScene(t, ...toScreen(t, 500, 400));
  expect(x).toBeCloseTo(500, 9);
  expect(y).toBeCloseTo(400, 9);
});

test('lerpTransform moves part of the way and k = 1 arrives', () => {
  const a = { scale: 1, x: 0, y: 0 };
  const b = { scale: 2, x: 10, y: -10 };
  expect(lerpTransform(a, b, 0.5)).toEqual({ scale: 1.5, x: 5, y: -5 });
  expect(lerpTransform(a, b, 1)).toEqual(b);
});
