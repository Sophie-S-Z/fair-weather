// State hash (ADR 0001 item 6): two FNV-1a 32-bit lanes with different offset bases.
// Every value reachable from the world goes in with a tag byte: numbers as their 8 float64
// bytes, strings as UTF-16 code units, records and maps sorted by key. A structured clone
// (ADR 0009) keeps Maps and Float32Arrays, so it hashes the same.
import type { World } from './types.ts';

const FNV_PRIME = 0x01000193;
const LANE_A = 0x811c9dc5; // the FNV-1a 32-bit offset basis
const LANE_B = 0xcbf29ce4; // the high half of the FNV-1a 64-bit offset basis

// Tag bytes, one per kind of value, so null, undefined, false, 0, and '' all differ.
const UNDEFINED = 1;
const NULL = 2;
const FALSE = 3;
const TRUE = 4;
const NUMBER = 5;
const STRING = 6;
const ARRAY = 7;
const RECORD = 8;
const MAP = 9;
const FLOAT32_ARRAY = 10;

function byCodeUnit(x: string, y: string): number {
  return x < y ? -1 : x > y ? 1 : 0;
}

function isPlainRecord(v: object): boolean {
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === null || proto === Object.prototype;
}

function createHasher() {
  let a = LANE_A;
  let b = LANE_B;
  const buf = new DataView(new ArrayBuffer(8));
  const byte = (v: number): void => {
    a = Math.imul(a ^ v, FNV_PRIME) >>> 0;
    b = Math.imul(b ^ v, FNV_PRIME) >>> 0;
  };
  const u32 = (v: number): void => {
    byte(v & 0xff);
    byte((v >>> 8) & 0xff);
    byte((v >>> 16) & 0xff);
    byte(v >>> 24);
  };
  const num = (v: number): void => {
    buf.setFloat64(0, v, true);
    for (let i = 0; i < 8; i++) byte(buf.getUint8(i));
  };
  const str = (s: string): void => {
    u32(s.length);
    for (let i = 0; i < s.length; i++) {
      const u = s.charCodeAt(i);
      byte(u & 0xff);
      byte(u >>> 8);
    }
  };
  const value = (v: unknown): void => {
    if (v === undefined) byte(UNDEFINED);
    else if (v === null) byte(NULL);
    else if (v === false) byte(FALSE);
    else if (v === true) byte(TRUE);
    else if (typeof v === 'number') {
      byte(NUMBER);
      num(v);
    } else if (typeof v === 'string') {
      byte(STRING);
      str(v);
    } else if (Array.isArray(v)) {
      byte(ARRAY);
      u32(v.length);
      for (const x of v) value(x);
    } else if (v instanceof Float32Array) {
      byte(FLOAT32_ARRAY);
      u32(v.length);
      for (const x of v) num(x);
    } else if (v instanceof Map) {
      byte(MAP);
      const keys = [...(v as Map<unknown, unknown>).keys()];
      if (!keys.every((k) => typeof k === 'string')) throw new Error('hashWorld: Map keys must be strings');
      keys.sort(byCodeUnit);
      u32(keys.length);
      for (const k of keys) {
        str(k);
        value(v.get(k));
      }
    } else if (typeof v === 'object' && isPlainRecord(v)) {
      byte(RECORD);
      const rec = v as Record<string, unknown>;
      const keys = Object.keys(rec).sort(byCodeUnit);
      u32(keys.length);
      for (const k of keys) {
        str(k);
        value(rec[k]);
      }
    } else {
      throw new Error(`hashWorld: cannot hash a ${typeof v}`);
    }
  };
  const hex = (h: number): string => h.toString(16).padStart(8, '0');
  return { value, digest: () => hex(a) + hex(b) };
}

/** 16 hex characters over every field of the world. */
export function hashWorld(world: World): string {
  const h = createHasher();
  h.value(world);
  return h.digest();
}
