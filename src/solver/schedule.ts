import type { Derived, Plan } from './model';

export interface IdleBoat {
  boat: number;
  /** The team on this boat in the race before, which stays on it, or -1 (boat at the dock). */
  keeper: number;
}

/**
 * Idle boats per race, in plan order (plan[flight][race]). The keeper is the
 * team on the boat in the race before, when it does not race now: the team
 * that sailed it, or the keeper who stayed on it. The same rule as PlanState,
 * whose plans have no orphaned boats, so an idle boat at the dock (keeper -1)
 * is one nobody has sailed yet.
 */
export function idleBoats(plan: Plan, d: Derived, idleOnWater: boolean): IdleBoat[][][] {
  let onBoard = new Int32Array(d.boats).fill(-1);
  return plan.map((flight) =>
    flight.map((race) => {
      const now = new Int32Array(d.boats).fill(-1);
      race.boats.forEach((b, i) => (now[b] = race.teams[i]));
      const idle: IdleBoat[] = [];
      for (let b = 0; b < d.active; b++) {
        if (now[b] >= 0) continue;
        const u = onBoard[b];
        const keeper = idleOnWater && u >= 0 && !race.teams.includes(u) ? u : -1;
        idle.push({ boat: b, keeper });
        now[b] = keeper;
      }
      onBoard = now;
      return idle;
    })
  );
}
