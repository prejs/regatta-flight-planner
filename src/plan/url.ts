// Plan URL codec. The fragment holds the whole plan state:
//
//   #0.t17b7.f9-15.oOGBR.K7QX2M.d7-6.s3-7-9~c0123456~n<deflated names>
//
// The plan layer (before the first ~) is version, sizes, flights, objective
// order, seed, then optional flags and events. Active boats (a6) are written
// only when they differ from the default, the largest race size. Label layers (~c, ~n, ~r) do
// not change the plan; this module keeps them as raw text.
//
// Numbers in the URL are 1-based for people ("team 7"); PlanSpec is 0-based
// like the solver.

import { derive, type ObjectiveCode, type PlanInput } from '../solver/model';

/** Fixed solver parameters per algorithm version. A released version never changes. */
const VERSIONS: Record<string, Pick<PlanInput, 'iterations' | 'startTemp'>> = {
  // Pre-release: may still change until links are shared.
  '0': { iterations: 1_000_000, startTemp: 2 },
};

export const CURRENT_VERSION = '0';

/** `from` is the 0-based index of the first flight the event changes. */
export type PlanEvent =
  /** d7-6: team 7 is out from flight 6. */
  | { type: 'drop'; team: number; from: number }
  /** s3-7-9: spare boat 7 replaces boat 3 from flight 9. */
  | { type: 'substitute'; boat: number; spare: number; from: number }
  /** x3-9: boat 3 is out from flight 9, with no spare. */
  | { type: 'remove'; boat: number; from: number }
  /** a1: one flight beyond the maximum. */
  | { type: 'extra'; count: number };

export interface PlanSpec {
  version: string;
  teams: number;
  boats: number;
  activeBoats: number;
  minFlights: number;
  maxFlights: number;
  order: ObjectiveCode[];
  seed: string;
  idleBoatOnWater: boolean;
  events: PlanEvent[];
}

export interface PlanUrl {
  plan: PlanSpec;
  /** Label layers by letter, raw (c: boat colours, n: names, r: viewer code). */
  labels: Record<string, string>;
}

export const MAX_TEAMS = 64;
/** The colour palette has 16 entries. */
export const MAX_BOATS = 16;
export const MAX_FLIGHTS = 64;
export const PLAN_LAYER_BUDGET = 150;

const OBJECTIVES = 'OGBRK';
const SEED = /^[0-9A-HJKMNP-TV-Z]{6}$/;
const URL_SAFE = /^[A-Za-z0-9\-._~]*$/;
const NUM = '(0|[1-9][0-9]*)';
const TOKENS = {
  sizes: new RegExp(`^t${NUM}b${NUM}(?:a${NUM})?$`),
  flights: new RegExp(`^f${NUM}-${NUM}$`),
  order: /^o([A-Z]+)$/,
  drop: new RegExp(`^d${NUM}-${NUM}$`),
  substitute: new RegExp(`^s${NUM}-${NUM}-${NUM}$`),
  remove: new RegExp(`^x${NUM}-${NUM}$`),
  extra: new RegExp(`^a${NUM}$`),
};
/** Flag: idle boats go to the dock, so no keeper. Default is on the water. */
const DOCK_FLAG = 'i';

export function encodePlanUrl({ plan: p, labels }: PlanUrl): string {
  validate(p);
  const defaultActive = derive({ teams: p.teams, boats: p.boats }).active;
  const tokens = [
    p.version,
    `t${p.teams}b${p.boats}${p.activeBoats === defaultActive ? '' : `a${p.activeBoats}`}`,
    `f${p.minFlights}-${p.maxFlights}`,
    `o${p.order.join('')}`,
    p.seed,
  ];
  if (!p.idleBoatOnWater) tokens.push(DOCK_FLAG);
  for (const e of p.events) tokens.push(encodeEvent(e));
  let out = tokens.join('.');
  for (const [key, body] of Object.entries(labels)) {
    if (!/^[a-z]$/.test(key) || !URL_SAFE.test(body) || body.includes('~')) {
      throw new Error(`Invalid label layer "${key}"`);
    }
    out += `~${key}${body}`;
  }
  return out;
}

/** Accepts the fragment with or without the leading #. Throws on anything invalid. */
export function decodePlanUrl(fragment: string): PlanUrl {
  const text = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (!URL_SAFE.test(text)) throw new Error('The link has characters outside A–Z a–z 0–9 - . _ ~');
  const [planLayer, ...layers] = text.split('~');

  const labels: Record<string, string> = {};
  for (const layer of layers) {
    const key = layer.charAt(0);
    if (!/^[a-z]$/.test(key)) throw new Error(`Invalid label layer "~${layer.slice(0, 8)}"`);
    if (key in labels) throw new Error(`Label layer "~${key}" appears twice`);
    labels[key] = layer.slice(1);
  }

  const [version, sizes, flights, order, seed, ...rest] = planLayer.split('.');
  if (!(version in VERSIONS)) throw new Error(`Unknown algorithm version "${version}"`);

  const s = match(TOKENS.sizes, sizes, 'team and boat counts');
  const teams = Number(s[1]);
  const boats = Number(s[2]);
  const f = match(TOKENS.flights, flights, 'flight counts');
  const o = match(TOKENS.order, order, 'objective order');
  if (seed === undefined || !SEED.test(seed)) throw new Error(`Invalid seed "${seed ?? ''}"`);

  const plan: PlanSpec = {
    version,
    teams,
    boats,
    activeBoats: s[3] === undefined ? derive({ teams, boats }).active : Number(s[3]),
    minFlights: Number(f[1]),
    maxFlights: Number(f[2]),
    order: o[1].split('') as ObjectiveCode[],
    seed,
    idleBoatOnWater: true,
    events: [],
  };
  for (const [i, token] of rest.entries()) {
    if (token === DOCK_FLAG && i === 0) plan.idleBoatOnWater = false;
    else plan.events.push(decodeEvent(token));
  }
  validate(plan);
  return { plan, labels };
}

/** The solver input for a plan, before any events are applied. */
export function toPlanInput(p: PlanSpec): PlanInput {
  return {
    teams: p.teams,
    boats: p.boats,
    activeBoats: p.activeBoats,
    minFlights: p.minFlights,
    maxFlights: p.maxFlights,
    order: p.order,
    seed: p.seed,
    idleBoatOnWater: p.idleBoatOnWater,
    ...VERSIONS[p.version],
  };
}

function encodeEvent(e: PlanEvent): string {
  switch (e.type) {
    case 'drop':
      return `d${e.team + 1}-${e.from + 1}`;
    case 'substitute':
      return `s${e.boat + 1}-${e.spare + 1}-${e.from + 1}`;
    case 'remove':
      return `x${e.boat + 1}-${e.from + 1}`;
    case 'extra':
      return `a${e.count}`;
  }
}

function decodeEvent(token: string): PlanEvent {
  let m: RegExpExecArray | null;
  if ((m = TOKENS.drop.exec(token))) return { type: 'drop', team: Number(m[1]) - 1, from: Number(m[2]) - 1 };
  if ((m = TOKENS.substitute.exec(token))) {
    return { type: 'substitute', boat: Number(m[1]) - 1, spare: Number(m[2]) - 1, from: Number(m[3]) - 1 };
  }
  if ((m = TOKENS.remove.exec(token))) return { type: 'remove', boat: Number(m[1]) - 1, from: Number(m[2]) - 1 };
  if ((m = TOKENS.extra.exec(token))) return { type: 'extra', count: Number(m[1]) };
  throw new Error(`Unknown plan token "${token}"`);
}

function match(re: RegExp, token: string | undefined, what: string): RegExpExecArray {
  const m = token === undefined ? null : re.exec(token);
  if (!m) throw new Error(`Invalid ${what} "${token ?? ''}"`);
  return m;
}

/** Structural checks only. Whether an event makes sense for the plan is the events phase's job. */
function validate(p: PlanSpec): void {
  if (!(p.version in VERSIONS)) throw new Error(`Unknown algorithm version "${p.version}"`);
  if (p.teams < 2 || p.teams > MAX_TEAMS) throw new Error(`Teams must be between 2 and ${MAX_TEAMS}`);
  if (p.boats < 2 || p.boats > MAX_BOATS) throw new Error(`Boats must be between 2 and ${MAX_BOATS}`);
  derive(p);
  const extra = p.events.reduce((n, e) => n + (e.type === 'extra' ? e.count : 0), 0);
  if (p.minFlights < 1 || p.maxFlights < p.minFlights || p.maxFlights + extra > MAX_FLIGHTS) {
    throw new Error(`Flights must satisfy 1 <= minimum <= maximum, with at most ${MAX_FLIGHTS} including extra flights`);
  }
  if (p.order.length === 0 || new Set(p.order).size !== p.order.length || p.order.some((c) => !OBJECTIVES.includes(c))) {
    throw new Error(`Objective order must use each of ${OBJECTIVES} at most once`);
  }
  if (!SEED.test(p.seed)) throw new Error(`Invalid seed "${p.seed}"`);
  const flight = (n: number) => Number.isInteger(n) && n >= 0 && n < MAX_FLIGHTS;
  const boat = (n: number) => Number.isInteger(n) && n >= 0 && n < p.boats;
  for (const e of p.events) {
    const ok =
      e.type === 'drop' ? Number.isInteger(e.team) && e.team >= 0 && e.team < p.teams && flight(e.from)
      : e.type === 'substitute' ? boat(e.boat) && boat(e.spare) && e.boat !== e.spare && flight(e.from)
      : e.type === 'remove' ? boat(e.boat) && flight(e.from)
      : Number.isInteger(e.count) && e.count >= 1 && e.count <= MAX_FLIGHTS;
    if (!ok) throw new Error(`Invalid ${e.type} event`);
  }
}
