import { expect, test } from '@playwright/test';
import golden from '../golden/m0-hash.json' with { type: 'json' };

test('the golden scenario in the real worker gives the Node golden hash', async ({ page }) => {
  await page.goto('/dev/worker.html?golden');
  await expect(page.locator('#hash')).toHaveText(golden.hash, { timeout: 30_000 });
});
