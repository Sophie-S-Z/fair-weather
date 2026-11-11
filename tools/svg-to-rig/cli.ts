import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { rigToJson, svgToRig } from './svg-to-rig.ts';

const [input, id] = process.argv.slice(2);
if (input === undefined || id === undefined) {
  console.error('usage: npm run rig -- <input.svg> <rig-id>');
  process.exit(2);
}
const out = `content/rigs/${basename(input, '.svg')}.rig.json`;
try {
  writeFileSync(out, rigToJson(svgToRig(readFileSync(input, 'utf8'), id)));
  console.log(`wrote ${out}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
