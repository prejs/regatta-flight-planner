import type { Derived, Plan } from './model';

export interface IdleBoat {
  boat: number;
  /** The team that sailed this boat in the race before and stays on it, or -1 (boat at the dock). */
  keeper: number;
}

/**
 * Idle boats per race, in plan order (plan[flight][race]). The keeper is the
 * team that sailed the boat in the previous race, when it does not race now.
 * The same rule as the K metric in PlanState.
 */
export function idleBoats(plan: Plan, d: Derived, idleOnWater: boolean): IdleBoat[][][] {
  let prevUser = new Int32Array(d.boats).fill(-1);
  return plan.map((flight) =>
    flight.map((race) => {
      const nowUser = new Int32Array(d.boats).fill(-1);
      race.boats.forEach((b, i) => (nowUser[b] = race.teams[i]));
      const idle: IdleBoat[] = [];
      for (let b = 0; b < d.active; b++) {
        if (nowUser[b] >= 0) continue;
        const u = prevUser[b];
        idle.push({ boat: b, keeper: idleOnWater && u >= 0 && !race.teams.includes(u) ? u : -1 });
      }
      prevUser = nowUser;
      return idle;
    })
  );
}
