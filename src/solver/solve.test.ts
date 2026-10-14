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

const PINNED_CHECKSUM = '25F5';

// Races start back to back, flights included. An idle boat on the water needs
// the team on it in the race before as keeper, so that team can't race now.
test('no idle boat is left without its keeper', () => {
  const inputs: PlanInput[] = [
    base,
    { ...base, teams: 7, boats: 4, minFlights: 3, maxFlights: 3 },
    { ...base, teams: 9, boats: 5, minFlights: 4, maxFlights: 6 },
    { ...base, activeBoats: 5 },
  ];
  for (const input of inputs) {
    const { plan, derived } = solve(input);
    const idle = idleBoats(plan, derived, true).flat();
    const sailed = new Set<number>();
    plan.flat().forEach((race, n) => {
      for (const { boat, keeper } of idle[n]) {
        assert.ok(keeper >= 0 || !sailed.has(boat), `${input.teams}/${input.boats}: race ${n + 1}, boat ${boat + 1} orphaned`);
      }
      race.boats.forEach((b) => sailed.add(b));
    });
  }
});

test('progress reaches the total and does not change the plan', () => {
  const calls: [number, number][] = [];
  const { checksum } = solve({ ...base, iterations: 200_000 }, (done, total) => calls.push([done, total]));
  assert.equal(checksum, solve({ ...base, iterations: 200_000 }).checksum);
  const [done, total] = calls[calls.length - 1];
  assert.equal(done, total);
  assert.ok(calls.every(([d], i) => i === 0 || d > calls[i - 1][0]));
});

test('idle boats name the team on them in the race before as keeper', () => {
  const { plan, derived } = solve(base);
  const idle = idleBoats(plan, derived, true);
  let keepers = 0;
  const races = plan.flat();
  const idleRaces = idle.flat();
  races.forEach((race, n) => {
    assert.equal(idleRaces[n].length, derived.active - race.teams.length);
    for (const { boat, keeper } of idleRaces[n]) {
      assert.ok(!race.boats.includes(boat));
      if (keeper < 0) continue;
      keepers++;
      // The crew of the race before, or its keeper when the boat was idle then too.
      const prev = races[n - 1];
      const crew = prev.teams[prev.boats.indexOf(boat)];
      const kept = idleRaces[n - 1].find((x) => x.boat === boat)?.keeper;
      assert.equal(crew ?? kept, keeper);
      assert.ok(!race.teams.includes(keeper));
    }
  });
  assert.ok(keepers > 0);
  assert.ok(idleBoats(plan, derived, false).flat(2).every((x) => x.keeper === -1));
});
