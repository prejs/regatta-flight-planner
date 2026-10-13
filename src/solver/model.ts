export type ObjectiveCode = 'O' | 'G' | 'B' | 'R' | 'K';

export interface PlanInput {
  teams: number;
  boats: number;
  /**
   * Boats in use; other boats are spares. When set, races per flight follow it
   * (17 teams on 5 boats: 4 races). Defaults to the largest race size on all boats.
   */
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
  const { teams, boats, activeBoats } = input;
  if (teams < 2 || boats < 2) throw new Error('Need at least 2 teams and 2 boats');
  if (activeBoats !== undefined && (activeBoats < 2 || activeBoats > boats)) {
    throw new Error(`Boats in use must be between 2 and ${boats}`);
  }
  // Races per flight follow the boats that can sail. The largest race then fits.
  const races = Math.ceil(teams / (activeBoats ?? boats));
  const base = Math.floor(teams / races);
  const extra = teams % races;
  const sizes = Array.from({ length: races }, (_, i) => base + (i < extra ? 1 : 0));
  return { teams, boats, races, active: activeBoats ?? sizes[0], sizes };
}
