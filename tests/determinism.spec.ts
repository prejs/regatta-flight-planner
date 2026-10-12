import { expect, test } from '@playwright/test';

import { solve } from '../src/solver/solve';
import { cases } from './cases';

// The same input has to give the same plan in every browser engine and in Node.
// Node is the reference. The checksum covers the whole plan.
for (const [name, input] of Object.entries(cases)) {
  test(`same checksum in the browser and Node: ${name}`, async ({ page }) => {
    const expected = solve(input);
    await page.goto('/verify/determinism.html');
    await page.waitForFunction(() => (window as any).solverReady === true);
    const actual = await page.evaluate((i) => (window as any).runSolver(i), input);
    expect(actual.checksum).toBe(expected.checksum);
    expect(actual.metrics).toEqual(expected.metrics);
  });
}
