import { expect, test } from '@playwright/test';

import { solve } from '../src/solver/solve';
import { decodePlanUrl, toPlanInput } from '../src/plan/url';

// Small plans: version 0 always runs 1M iterations, so size is what keeps this quick.
const SMALL = '0.t8b4.f3-3.oOGBRK.K7QX2M';
const OTHER = '0.t6b3.f2-2.oOBRK.A1B2C3';

test.beforeEach(async ({ page }) => {
  await page.goto('/verify/worker.html');
  await page.waitForFunction(() => (window as any).solverReady === true);
});

test('the worker gives the same plan as Node', async ({ page }) => {
  const expected = solve(toPlanInput(decodePlanUrl(SMALL).plan));
  const actual = await page.evaluate((f) => (window as any).solveUrl(f), `#${SMALL}`);
  expect(actual.checksum).toBe(expected.checksum);
  expect(actual.metrics).toEqual(expected.metrics);
  expect(actual.ms).toBeGreaterThan(0);
});

test('the worker reports an invalid link', async ({ page }) => {
  const actual = await page.evaluate((f) => (window as any).solveUrl(f), '#9.t8b4.f3-3.oO.K7QX2M');
  expect(actual.error).toBe('Unknown algorithm version "9"');
});

test('the worker refuses plans with events for now', async ({ page }) => {
  const actual = await page.evaluate((f) => (window as any).solveUrl(f), `#${SMALL}.d2-2`);
  expect(actual.error).toBe('Plans with events are not supported yet');
});

test('a newer request replaces a running one', async ({ page }) => {
  const expected = solve(toPlanInput(decodePlanUrl(OTHER).plan));
  const [first, second] = await page.evaluate(([a, b]) => (window as any).solveTwice(a, b), [SMALL, OTHER]);
  expect(first.error).toBe('SupersededError');
  expect(second.checksum).toBe(expected.checksum);
});
