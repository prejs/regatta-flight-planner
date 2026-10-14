import { derive, type Derived, type Plan, type PlanInput, type Race } from './model';
import { Rng, seedToInt } from './prng';
import { PlanState, compareTuples, tuple, type Metrics } from './state';

export interface Solution {
  plan: Plan;
  metrics: Metrics;
  derived: Derived;
  /** Short checksum of the plan, such as "A3F9". */
  checksum: string;
}

/** Called now and then with the iterations done so far. It never changes the plan. */
export type Progress = (done: number, total: number) => void;

/** Iterations between progress calls. */
const PROGRESS_STEP = 1 << 16;

/**
 * Phase A: simulated annealing over flights 1..minFlights jointly.
 * Phase B: each later flight is optimised alone against the frozen history.
 * Same input, same plan: integer scores, a fixed iteration count, a seeded PRNG.
 */
export function solve(input: PlanInput, onProgress?: Progress): Solution {
  const d = derive(input);
  if (input.minFlights < 1 || input.maxFlights < input.minFlights) {
    throw new Error('Need 1 <= minFlights <= maxFlights');
  }
  const rng = new Rng(seedToInt(input.seed));
  const plan: Plan = [];
  const state = new PlanState(d, plan, d.races >= 3, input.idleBoatOnWater);

  const extension = Math.max(2000, Math.floor(input.iterations / input.minFlights));
  const total = input.iterations + extension * (input.maxFlights - input.minFlights);
  let done = 0;
  const tick = onProgress && ((n: number) => onProgress((done += n), total));

  for (let f = 0; f < input.minFlights; f++) addFlight(state, rng);
  repair(state);
  anneal(state, input, 0, input.minFlights, input.iterations, rng, tick);

  for (let f = input.minFlights; f < input.maxFlights; f++) {
    addFlight(state, rng);
    repair(state);
    anneal(state, input, f, f + 1, extension, rng, tick);
  }

  return {
    plan,
    metrics: state.metrics(),
    derived: d,
    checksum: checksum(plan),
  };
}

function addFlight(state: PlanState, rng: Rng): void {
  const { d } = state;
  const teams = rng.shuffle(Array.from({ length: d.teams }, (_, i) => i));
  const flight: Race[] = [];
  let at = 0;
  for (const size of d.sizes) {
    const boats = rng.shuffle(Array.from({ length: d.active }, (_, i) => i)).slice(0, size);
    flight.push({ teams: teams.slice(at, at + size), boats });
    at += size;
  }
  state.plan.push(flight);
  for (const race of flight) state.addRace(race, 1);
}

function swapTeams(state: PlanState, a: Race, i: number, b: Race, j: number): void {
  state.addRace(a, -1);
  state.addRace(b, -1);
  [a.teams[i], b.teams[j]] = [b.teams[j], a.teams[i]];
  state.addRace(a, 1);
  state.addRace(b, 1);
}

function setBoat(state: PlanState, race: Race, i: number, boat: number): number {
  const old = race.boats[i];
  state.addRace(race, -1);
  race.boats[i] = boat;
  state.addRace(race, 1);
  return old;
}

function swapBoats(state: PlanState, race: Race, i: number, j: number): void {
  state.addRace(race, -1);
  [race.boats[i], race.boats[j]] = [race.boats[j], race.boats[i]];
  state.addRace(race, 1);
}

/**
 * Gives every orphaned boat back to the team on it in the race before, which
 * idles the boat that team was given instead (and so on, if that one is
 * orphaned too). Only boats change, never who races whom. Run on new flights,
 * which start out random, so the search starts without orphans.
 */
function repair(state: PlanState): void {
  const { boats, active, teams } = state.d;
  if (!state.idleOnWater) return;
  const onBoard = new Int32Array(boats).fill(-1);
  const now = new Int32Array(boats);
  const seat = new Int32Array(teams);
  for (const flight of state.plan) {
    for (const race of flight) {
      seat.fill(-1);
      race.teams.forEach((t, i) => (seat[t] = i));
      for (let fixed = true; fixed; ) {
        fixed = false;
        now.fill(-1);
        race.teams.forEach((t, i) => (now[race.boats[i]] = t));
        for (let b = 0; b < active; b++) {
          const u = onBoard[b];
          if (now[b] >= 0 || u < 0 || seat[u] < 0) continue;
          setBoat(state, race, seat[u], b);
          fixed = true;
          break;
        }
      }
      for (let b = 0; b < active; b++) if (now[b] < 0 && onBoard[b] >= 0) now[b] = onBoard[b];
      onBoard.set(now);
    }
  }
}

/** Boats of the active set that this race does not use, or -1 when there is none. */
function pickIdleBoat(state: PlanState, race: Race, rng: Rng): number {
  const idle: number[] = [];
  for (let b = 0; b < state.d.active; b++) if (!race.boats.includes(b)) idle.push(b);
  return idle.length ? idle[rng.int(idle.length)] : -1;
}

// round(65536 * 2^(-k/16)) for k = 0..15. Integer table instead of Math.exp,
// whose last digits differ between engines.
const POW2_NEG = [65536, 62757, 60097, 57549, 55109, 52773, 50535, 48393, 46341, 44376, 42495, 40693, 38968, 37316, 35734, 34219];

/** 1024 * 2^(-delta / temp), with temp in 1/16 units, using integers only. */
function acceptance(delta: number, temp: number): number {
  const x = Math.floor((256 * delta) / temp);
  if (x >= 160) return 0;
  return ((1024 * POW2_NEG[x & 15]) >>> 16) >> (x >> 4);
}

function anneal(
  state: PlanState,
  input: PlanInput,
  lo: number,
  hi: number,
  iterations: number,
  rng: Rng,
  tick?: (n: number) => void
): void {
  const { races } = state.d;
  const order = input.order;
  // Temperature in 1/16 units of a score step.
  const T0 = (input.startTemp ?? 2) * 16;
  let cur = tuple(state.metrics(), order);
  let reported = 0;

  for (let it = 0; it < iterations; it++) {
    if (tick && it - reported === PROGRESS_STEP) {
      tick(PROGRESS_STEP);
      reported = it;
    }
    const temp = Math.floor((T0 * (iterations - it)) / iterations);
    const flight = state.plan[lo + rng.int(hi - lo)];
    const kind = rng.int(100);
    let undo: (() => void) | null = null;

    if (kind < 60 && races >= 2) {
      const ai = rng.int(races);
      const bi = (ai + 1 + rng.int(races - 1)) % races;
      const a = flight[ai];
      const b = flight[bi];
      const i = rng.int(a.teams.length);
      const j = rng.int(b.teams.length);
      swapTeams(state, a, i, b, j);
      undo = () => swapTeams(state, a, i, b, j);
    } else if (kind < 80 && races >= 2) {
      const ai = rng.int(races);
      const bi = (ai + 1 + rng.int(races - 1)) % races;
      [flight[ai], flight[bi]] = [flight[bi], flight[ai]];
      undo = () => ([flight[ai], flight[bi]] = [flight[bi], flight[ai]]);
    } else {
      const race = flight[rng.int(races)];
      const i = rng.int(race.boats.length);
      const idle = rng.int(2) === 0 ? pickIdleBoat(state, race, rng) : -1;
      if (idle >= 0) {
        const old = setBoat(state, race, i, idle);
        undo = () => setBoat(state, race, i, old);
      } else if (race.boats.length >= 2) {
        const j = (i + 1 + rng.int(race.boats.length - 1)) % race.boats.length;
        swapBoats(state, race, i, j);
        undo = () => swapBoats(state, race, i, j);
      }
    }
    if (!undo) continue;

    const next = tuple(state.metrics(), order);
    if (state.orphans > 0) {
      // A hard constraint: the search only moves between plans without orphaned boats.
      undo();
      continue;
    }
    const cmp = compareTuples(next, cur);
    let accept = cmp <= 0;
    if (!accept && temp > 0) {
      // Integer-only acceptance: no Math.exp, which differs between engines.
      let tier = 0;
      while (next[tier] === cur[tier]) tier++;
      const d = next[tier] - cur[tier];
      accept = rng.int(1024) < acceptance(d, temp);
    }
    if (accept) cur = next;
    else undo();
  }
  tick?.(iterations - reported);
}

/** FNV-1a over the plan, folded to 16 bits. */
export function checksum(plan: Plan): string {
  let h = 0x811c9dc5;
  const feed = (n: number) => {
    h = Math.imul(h ^ (n & 0xff), 0x01000193);
    h = Math.imul(h ^ ((n >>> 8) & 0xff), 0x01000193);
  };
  for (const flight of plan) {
    for (const race of flight) {
      feed(0xffff);
      race.teams.forEach((t, i) => {
        feed(t);
        feed(race.boats[i]);
      });
    }
  }
  return (((h >>> 16) ^ h) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}
