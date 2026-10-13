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
  await expect(page.getByRole('cell', { name: /^Idle, kept by T\d$/ }).first()).toBeVisible();

  // Two races per flight: flight 2 starts with race 3, or race 1 within the flight.
  const flight2 = page.locator('flight-view section').nth(1);
  await expect(flight2.getByRole('rowheader').first()).toHaveText('3');
  await page.getByLabel('Number races within each flight').check();
  await expect(flight2.getByRole('rowheader').first()).toHaveText('1');

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

test('boats in use step from the default and change the races per flight', async ({ page }) => {
  await page.goto('/');
  const field = page.getByLabel('Boats in use');
  await expect(field).toHaveValue('6');
  await field.focus();
  await page.keyboard.press('ArrowDown');
  await expect(field).toHaveValue('5');
  await expect(page.getByText('4 races per flight (5, 4, 4, 4)')).toBeVisible();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp');
  await expect(field).toHaveValue('7');
  await expect(page.getByText('3 races per flight (6, 6, 5)')).toBeVisible();
});

test('a link with custom boats in use fills the form with them', async ({ page }) => {
  // The settings stay open while the plan solves.
  await page.goto('/#0.t17b7a5.f2-2.oOBGRK.K7QX2M');
  await expect(page.getByLabel('Boats in use')).toHaveValue('5');
});
