// Bundles each scene in snippets/scenes into one self-contained HTML file in snippets/share.
// Run: npm run snippets, or npm run snippets -- the-picnic look-up to build only those scenes.
import { readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = import.meta.dirname;
const sceneDir = join(root, 'scenes');
const shareDir = join(root, 'share');

const STYLE = `body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;box-sizing:border-box;background:#e4edf0;color:#2b2a28;font:16px "Atkinson Hyperlegible",system-ui,sans-serif}canvas{width:min(100%,720px);height:auto;border-radius:12px;box-shadow:0 2px 12px #2b2a2826}div{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}button{font:inherit;padding:8px 14px;border:2px solid #2b2a28;border-radius:999px;background:#fffdf8;color:inherit;cursor:pointer}button:focus-visible{outline:3px solid #f08a3c;outline-offset:2px}button:disabled{opacity:.5;cursor:wait}p{margin:0;min-height:1.4em;font-size:14px}`;

const escape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** The bundled script of one scene file, as an IIFE. */
async function bundle(entry: string): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: true,
      lib: { entry, formats: ['iife'], name: 'snippet' },
      // Only the scene has side effects, so unused shared code (such as the zod rig schema) drops out.
      rolldownOptions: { treeshake: { moduleSideEffects: false } },
    },
  });
  const output = Array.isArray(result) ? result[0] : result;
  if (!output || !('output' in output)) throw new Error(`No bundle for ${entry}.`);
  return output.output[0].code.replace(/<\/script/gi, '<\\/script');
}

/** Each scene's HTML, by file name. `only` limits the build to those scene ids. */
export async function buildSnippets(only: readonly string[] = []): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const entries = readdirSync(sceneDir)
    .filter((f) => f.endsWith('.ts') && (only.length === 0 || only.includes(basename(f, '.ts'))))
    .sort();
  for (const file of entries) {
    const id = basename(file, '.ts');
    const code = await bundle(join(sceneDir, file));
    const title = id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
    files.set(
      `${id}.html`,
      `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${escape(title)} · Fair Weather</title>\n<style>${STYLE}</style>\n</head>\n<body>\n<script>${code}</script>\n</body>\n</html>\n`,
    );
  }
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [name, html] of await buildSnippets(process.argv.slice(2)))
    writeFileSync(join(shareDir, name), html);
}
