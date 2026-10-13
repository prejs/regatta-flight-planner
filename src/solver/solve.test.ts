import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_ORDER, derive, type PlanInput } from './model';
import { idleBoats } from './schedule';
import { solve } from './solve';

const base: PlanInput = {
  teams: 17,
  boats: 7,
  minFlights: 6,
  maxFlights: 8,
  order: DEFAULT_ORDER,
  seed: 'K7QX2M',
  idleBoatOnWater: true,
  iterations: 20_000,
};

test('derives race sizes for 17 teams on 7 boats', () => {
  const d = derive(base);
  assert.deepEqual(d.sizes, [6, 6, 5]);
  assert.equal(d.races, 3);
  assert.equal(d.active, 6);
});

test('fewer boats in use mean more races per flight', () => {
  assert.deepEqual(derive({ ...base, activeBoats: 5 }).sizes, [5, 4, 4, 4]);
  assert.deepEqual(derive({ ...base, activeBoats: 7 }).sizes, [6, 6, 5]);
  assert.throws(() => derive({ ...base, activeBoats: 1 }));
  assert.throws(() => derive({ ...base, activeBoats: 8 }));
});

test('plan satisfies the hard constraints', () => {
  const { plan, derived } = solve(base);
  assert.equal(plan.length, base.maxFlights);
  for (const flight of plan) {
    const teams = flight.flatMap((r) => r.teams).sort((a, b) => a - b);
    assert.deepEqual(teams, Array.from({ length: derived.teams }, (_, i) => i));
    for (const race of flight) {
      assert.equal(new Set(race.boats).size, race.boats.length);
      assert.ok(race.boats.every((b) => b < derived.active));
    }
    const sizes = flight.map((r) => r.teams.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
  }
});

test('same input gives the same plan', () => {
  assert.equal(solve(base).checksum, solve(base).checksum);
});

test('a different seed gives a different plan', () => {
  assert.notEqual(solve(base).checksum, solve({ ...base, seed: 'A1B2C3' }).checksum);
});

test('a pinned checksum catches accidental algorithm changes', () => {
  // A released algorithm version never changes. Update this only with a new version.
  assert.equal(solve(base).checksum, PINNED_CHECKSUM);
});

const PINNED_CHECKSUM = '843F';

test('progress reaches the total and does not change the plan', () => {
  const calls: [number, number][] = [];
  const { checksum } = solve({ ...base, iterations: 200_000 }, (done, total) => calls.push([done, total]));
  assert.equal(checksum, solve({ ...base, iterations: 200_000 }).checksum);
  const [done, total] = calls[calls.length - 1];
  assert.equal(done, total);
  assert.ok(calls.every(([d], i) => i === 0 || d > calls[i - 1][0]));
});

test('idle boats name the previous crew as keeper', () => {
  const { plan, derived } = solve(base);
  const idle = idleBoats(plan, derived, true);
  let keepers = 0;
  plan.forEach((flight, f) =>
    flight.forEach((race, r) => {
      assert.equal(idle[f][r].length, derived.active - race.teams.length);
      for (const { boat, keeper } of idle[f][r]) {
        assert.ok(!race.boats.includes(boat));
        if (keeper < 0) continue;
        keepers++;
        const prev = r > 0 ? flight[r - 1] : plan[f - 1]?.at(-1);
        assert.equal(prev?.teams[prev.boats.indexOf(boat)], keeper);
        assert.ok(!race.teams.includes(keeper));
      }
    })
  );
  assert.ok(keepers > 0);
  assert.ok(idleBoats(plan, derived, false).flat(2).every((x) => x.keeper === -1));
});
