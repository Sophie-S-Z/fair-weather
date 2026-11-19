// Saves the PNG, the GIF, and the video of snippets in a headless browser, with the page's own buttons.
// Run: npm run snippets:export -- <out folder> <scene id>...
// The PNG is the still frame (the page opens on it with reduced motion). Videos record in real time,
// with sound when the snippet has it. When ffmpeg is on the path, a WebM video becomes an MP4.
// Set PW_CHROMIUM_PATH to use a browser other than the one that Playwright installed.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Page } from '@playwright/test';

const [out, ...ids] = process.argv.slice(2);
if (!out || ids.length === 0) throw new Error('Usage: npm run snippets:export -- <out folder> <scene id>...');
mkdirSync(out, { recursive: true });
const share = join(import.meta.dirname, 'share');

async function download(page: Page, button: string, timeout: number): Promise<string> {
  const [file] = await Promise.all([
    page.waitForEvent('download', { timeout }),
    page.getByRole('button', { name: button }).click(),
  ]);
  const path = join(out ?? '.', file.suggestedFilename());
  await file.saveAs(path);
  return path;
}

const path = process.env['PW_CHROMIUM_PATH'];
const browser = await chromium.launch({
  ...(path ? { executablePath: path } : {}),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
for (const id of ids) {
  const url = pathToFileURL(join(share, `${id}.html`)).href;

  const still = await browser.newPage({ reducedMotion: 'reduce' });
  await still.goto(url);
  console.log(await download(still, 'Save PNG', 30_000));
  await still.close();

  const page = await browser.newPage();
  await page.goto(url);
  console.log(await download(page, 'Save GIF', 600_000));
  const sound = page.getByRole('button', { name: 'Sound on' });
  if ((await sound.count()) > 0) await sound.click();
  const video = await download(page, 'Save video', 600_000);
  if (video.endsWith('.webm') && spawnSync('ffmpeg', ['-version']).status === 0) {
    const mp4 = video.replace(/\.webm$/, '.mp4');
    const args = ['-y', '-loglevel', 'error', '-i', video, '-c:v', 'libx264', '-pix_fmt', 'yuv420p'];
    spawnSync('ffmpeg', [...args, '-c:a', 'aac', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
    console.log(mp4);
  } else console.log(video);
  await page.close();
}
await browser.close();
