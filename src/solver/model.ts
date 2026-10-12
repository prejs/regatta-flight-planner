export type ObjectiveCode = 'O' | 'G' | 'B' | 'R' | 'K';

export interface PlanInput {
  teams: number;
  boats: number;
  /** Defaults to the largest race size. Other boats are spares. */
  activeBoats?: number;
  minFlights: number;
  maxFlights: number;
  /** Objective tiers, most important first. */
  order: ObjectiveCode[];
  /** 6 characters, Crockford base32. */
  seed: string;
  /** Idle boat stays on the water (a keeper is needed) or goes to the dock. */
  idleBoatOnWater: boolean;
  /** Annealing iterations for the joint block (flights 1..minFlights). */
  iterations: number;
  /** Annealing start temperature (integer). */
  startTemp?: number;
}

export const DEFAULT_ORDER: ObjectiveCode[] = ['O', 'G', 'B', 'R', 'K'];

/** One race: teams[i] sails boats[i]. */
export interface Race {
  teams: number[];
  boats: number[];
}

/** plan[flight][race], races in start order. */
export type Plan = Race[][];

export interface Derived {
  teams: number;
  boats: number;
  /** Races per flight. */
  races: number;
  /** Active boats. */
  active: number;
  /** Race sizes in a flight, balanced to differ by at most 1. */
  sizes: number[];
}

export function derive(input: Pick<PlanInput, 'teams' | 'boats' | 'activeBoats'>): Derived {
  const { teams, boats } = input;
  if (teams < 2 || boats < 2) throw new Error('Need at least 2 teams and 2 boats');
  const races = Math.ceil(teams / boats);
  const base = Math.floor(teams / races);
  const extra = teams % races;
  const sizes = Array.from({ length: races }, (_, i) => base + (i < extra ? 1 : 0));
  const active = input.activeBoats ?? sizes[0];
  if (active < sizes[0] || active > boats) {
    throw new Error(`Active boats must be between ${sizes[0]} and ${boats}`);
  }
  return { teams, boats, races, active, sizes };
}
