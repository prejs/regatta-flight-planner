import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_ORDER, derive, type PlanInput } from './model';
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
