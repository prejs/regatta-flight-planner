import { DEFAULT_ORDER, type PlanInput } from '../src/solver/model';

// Small iteration counts keep CI quick. The point is to compare engines, not quality.
export const cases: Record<string, PlanInput> = {
  'uneven 17 teams on 7 boats': {
    teams: 17, boats: 7, minFlights: 6, maxFlights: 8,
    order: DEFAULT_ORDER, seed: 'K7QX2M', idleBoatOnWater: true, iterations: 40_000,
  },
  'league 18 teams on 6 boats': {
    teams: 18, boats: 6, minFlights: 8, maxFlights: 10,
    order: ['O', 'B', 'G', 'R', 'K'], seed: 'A1B2C3', idleBoatOnWater: true, iterations: 40_000,
  },
  'idle boat at the dock': {
    teams: 17, boats: 7, minFlights: 5, maxFlights: 6,
    order: ['O', 'G', 'B', 'R'], seed: 'ZZ99ZZ', idleBoatOnWater: false, iterations: 40_000,
  },
  'two races per flight': {
    teams: 11, boats: 6, minFlights: 6, maxFlights: 7,
    order: ['O', 'B', 'R', 'K'], seed: '0000A0', idleBoatOnWater: true, iterations: 40_000,
  },
};
