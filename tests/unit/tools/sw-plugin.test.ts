import { describe, expect, test } from 'vitest';
import { precacheList, precacheVersion } from '../../../tools/sw-plugin.ts';

describe('service worker precache list', () => {
  const emitted = [
    'index.html',
    'assets/index-abc.js',
    'assets/sim-worker-def.js',
    'assets/index-abc.css',
    'assets/index-abc.js.map',
    'assets/still-xyz.svg',
    'sw.js',
  ];

  test('has the page first, then every emitted file in order, but not the worker script or maps', () => {
    expect(precacheList(emitted, '/')).toEqual([
      '/',
      '/assets/index-abc.css',
      '/assets/index-abc.js',
      '/assets/sim-worker-def.js',
      '/assets/still-xyz.svg',
      '/index.html',
    ]);
  });

  test('keeps the page and the sim worker chunk, and drops sw.js and maps', () => {
    const list = precacheList(emitted, '/');
    expect(list).toContain('/');
    expect(list).toContain('/assets/sim-worker-def.js');
    expect(list).not.toContain('/sw.js');
    expect(list.some((f) => f.endsWith('.map'))).toBe(false);
  });

  test('honors a base path', () => {
    expect(precacheList(['index.html', 'a.js'], '/fair/')).toEqual([
      '/fair/',
      '/fair/a.js',
      '/fair/index.html',
    ]);
  });

  test('the version is 8 hex digits of the names and contents, not of their order', () => {
    const a = precacheVersion({ '/': 'page', '/a.js': 'one' });
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(precacheVersion({ '/a.js': 'one', '/': 'page' })).toBe(a);
    expect(precacheVersion({ '/': 'page', '/b.js': 'one' })).not.toBe(a);
    expect(precacheVersion({ '/': 'page2', '/a.js': 'one' })).not.toBe(a);
    expect(precacheVersion({ '/': 'page', '/a.js': 'two' })).not.toBe(a);
  });
});
