import { expect, test } from '@playwright/test';

import { solve } from '../src/solver/solve';
import { decodePlanUrl, toPlanInput } from '../src/plan/url';

const PREVIEW = 'http://localhost:4173';
const PLAN = '0.t8b4.f3-3.oOGBRK.K7QX2M';

test('after one visit, a plan link opens and solves offline', async ({ context, page }) => {
  await page.goto(`${PREVIEW}/`);
  // Resolves once the service worker is active, which is after precaching.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto(`${PREVIEW}/#${PLAN}`);
  const expected = solve(toPlanInput(decodePlanUrl(PLAN).plan));
  await expect(offline.getByText(`#${expected.checksum}`)).toBeVisible({ timeout: 20_000 });
});
