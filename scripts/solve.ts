// Solver prototype CLI.
//   npx tsx scripts/solve.ts --teams 18 --boats 6 --flights 16 --iterations 2000000
import { DEFAULT_ORDER, type ObjectiveCode, type PlanInput } from '../src/solver/model';
import { solve, type Solution } from '../src/solver/solve';

function args(): Record<string, string> {
  const out: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[argv[i].slice(2)] = 'true';
    else out[argv[i].slice(2)] = argv[++i];
  }
  return out;
}

const a = args();
const flights = Number(a.flights ?? 15);
const input: PlanInput = {
  teams: Number(a.teams ?? 17),
  boats: Number(a.boats ?? 7),
  minFlights: Number(a['min-flights'] ?? flights),
  maxFlights: flights,
  order: (a.order ?? DEFAULT_ORDER.join('')).toUpperCase().split('') as ObjectiveCode[],
  seed: a.seed ?? 'K7QX2M',
  idleBoatOnWater: a.dock === undefined,
  iterations: Number(a.iterations ?? 1_000_000),
  startTemp: a.temp === undefined ? undefined : Number(a.temp),
};

const started = performance.now();
const solution = solve(input);
const ms = Math.round(performance.now() - started);

/** Throws when a hard constraint is broken. */
function validate({ plan, derived: d }: Solution): void {
  for (const [f, flight] of plan.entries()) {
    const seen = new Set<number>();
    for (const race of flight) {
      if (new Set(race.boats).size !== race.boats.length) throw new Error(`Flight ${f + 1}: boat used twice in a race`);
      for (const t of race.teams) {
        if (seen.has(t)) throw new Error(`Flight ${f + 1}: team ${t + 1} races twice`);
        seen.add(t);
      }
    }
    if (seen.size !== d.teams) throw new Error(`Flight ${f + 1}: not every team races`);
    const sizes = flight.map((r) => r.teams.length);
    if (Math.max(...sizes) - Math.min(...sizes) > 1) throw new Error(`Flight ${f + 1}: uneven race sizes`);
  }
}

function spread(counts: number[]): string {
  return `${Math.min(...counts)}..${Math.max(...counts)} (spread ${Math.max(...counts) - Math.min(...counts)})`;
}

validate(solution);
const { plan, derived: d, metrics } = solution;

const meet = new Map<string, number>();
const boatUse = Array.from({ length: d.teams }, () => new Array<number>(d.boats).fill(0));
for (const flight of plan) {
  for (const race of flight) {
    race.teams.forEach((t, i) => {
      boatUse[t][race.boats[i]]++;
      for (const u of race.teams) if (u > t) meet.set(`${t}-${u}`, (meet.get(`${t}-${u}`) ?? 0) + 1);
    });
  }
}
const pairCounts: number[] = [];
for (let t = 0; t < d.teams; t++) for (let u = t + 1; u < d.teams; u++) pairCounts.push(meet.get(`${t}-${u}`) ?? 0);
const boatCounts = boatUse.flatMap((row) => row.slice(0, d.active));

if (a.quiet === undefined) {
  const name = (t: number) => `T${t + 1}`;
  let n = 0;
  const prevUser = new Array<number>(d.boats).fill(-1);
  for (const [f, flight] of plan.entries()) {
    console.log(`Flight ${f + 1}`);
    for (const [r, race] of flight.entries()) {
      const used = new Map(race.boats.map((b, i) => [b, race.teams[i]]));
      const sailing = race.teams.map((t, i) => `${name(t)}→B${race.boats[i] + 1}`).join('  ');
      const idle: string[] = [];
      for (let b = 0; b < d.active; b++) {
        if (used.has(b)) continue;
        const k = prevUser[b];
        idle.push(input.idleBoatOnWater && k >= 0 && !race.teams.includes(k) ? `B${b + 1} idle, kept by ${name(k)}` : `B${b + 1} idle`);
      }
      console.log(`  Race ${r + 1} (#${++n})  ${sailing}${idle.length ? `   [${idle.join('; ')}]` : ''}`);
      prevUser.fill(-1);
      used.forEach((t, b) => (prevUser[b] = t));
    }
  }
  console.log();
}

console.log(`input      ${d.teams} teams, ${d.boats} boats (${d.active} active), ${d.races} races/flight, ${plan.length} flights, order ${input.order.join('')}`);
console.log(`seed       ${input.seed}, ${input.iterations} iterations`);
console.log(`score      ${input.order.map((c) => `${c}=${metrics[c]}`).join(' ')}`);
console.log(`meetings   ${spread(pairCounts)}`);
console.log(`boat use   ${spread(boatCounts)}`);
console.log(`checksum   #${solution.checksum}`);
console.log(`time       ${ms} ms`);

// Cross-check: recompute O and B from scratch and compare with the incremental score.
const recountO = pairCounts.reduce((s, c) => s + c * c, 0);
const recountB = boatUse.reduce((s, row) => s + row.slice(0, d.active).reduce((x, c) => x + c * c, 0), 0);
if (recountO !== metrics.O || recountB !== metrics.B) {
  throw new Error(`Score drift: O ${metrics.O} vs ${recountO}, B ${metrics.B} vs ${recountB}`);
}
