import { expect, test } from '@playwright/test';

import { solve } from '../src/solver/solve';
import { decodePlanUrl, toPlanInput } from '../src/plan/url';

// 7 teams on 4 boats: two races of 4 and 3, so one boat is idle with a keeper.
test('the form makes a plan link and the flight view shows it', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Teams').fill('7');
  await page.getByLabel('Boats', { exact: true }).fill('4');
  await page.getByLabel('Minimum flights').fill('3');
  await page.getByLabel('Maximum flights').fill('3');
  await expect(page.getByText('2 races per flight (4, 3)')).toBeVisible();
  await expect(page.getByText('Gaps between races (not used for these sizes)')).toBeVisible();
  await page.getByRole('button', { name: 'Make plan' }).click();

  await expect(page).toHaveURL(/#0\.t7b4\.f3-3\.oOBRK\.[0-9A-Z]{6}$/);
  const fragment = new URL(page.url()).hash.slice(1);
  const expected = solve(toPlanInput(decodePlanUrl(fragment).plan));
  await expect(page.getByText(`#${expected.checksum}`)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /^Flight \d$/ })).toHaveCount(3);
  await expect(page.getByText(/^kept T\d$/).first()).toBeVisible();

  // The link alone restores the plan and the form.
  await page.reload();
  await expect(page.getByText(`#${expected.checksum}`)).toBeVisible({ timeout: 20_000 });
  await page.getByText('Plan settings').click();
  await expect(page.getByLabel('Teams')).toHaveValue('7');
});

test('an invalid link shows the reason', async ({ page }) => {
  await page.goto('/#0.t7b4.f3-3.oOBRK.K7QX2');
  await expect(page.getByText('This link has no valid plan: Invalid seed "K7QX2"')).toBeVisible();
});
