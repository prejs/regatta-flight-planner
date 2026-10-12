import type { Derived, ObjectiveCode, Plan, Race } from './model';

export type Metrics = Record<ObjectiveCode, number>;

/**
 * A plan plus the running counts needed to score it. All metrics are integers,
 * so the result is identical on every device.
 *
 * O and B are kept incrementally through addRace. G, R and K depend on the race
 * sequence, so scan() recomputes them in one pass.
 */
export class PlanState {
  /** Pair meeting counts, indexed low * teams + high. */
  readonly meet: Int32Array;
  /** Team-boat counts, indexed team * boats + boat. */
  readonly boatCount: Int32Array;
  /** Sum of squared pair-meeting counts. */
  O = 0;
  /** Sum of squared team-boat counts. */
  B = 0;

  constructor(
    readonly d: Derived,
    readonly plan: Plan,
    readonly gapActive: boolean,
    readonly idleOnWater: boolean
  ) {
    this.meet = new Int32Array(d.teams * d.teams);
    this.boatCount = new Int32Array(d.teams * d.boats);
    for (const flight of plan) for (const race of flight) this.addRace(race, 1);
  }

  addRace(race: Race, sign: 1 | -1): void {
    const { teams, boats } = this.d;
    const t = race.teams;
    for (let i = 0; i < t.length; i++) {
      const bi = t[i] * boats + race.boats[i];
      if (sign > 0) {
        this.B += 2 * this.boatCount[bi] + 1;
        this.boatCount[bi]++;
      } else {
        this.boatCount[bi]--;
        this.B -= 2 * this.boatCount[bi] + 1;
      }
      for (let j = i + 1; j < t.length; j++) {
        const lo = t[i] < t[j] ? t[i] : t[j];
        const hi = t[i] < t[j] ? t[j] : t[i];
        const idx = lo * teams + hi;
        if (sign > 0) {
          this.O += 2 * this.meet[idx] + 1;
          this.meet[idx]++;
        } else {
          this.meet[idx]--;
          this.O -= 2 * this.meet[idx] + 1;
        }
      }
    }
  }

  /** G (gap penalty), R (boat reuse) and K (keeper balance) over the current plan. */
  private scan(): { G: number; R: number; K: number } {
    const { teams, boats, active } = this.d;
    const lastRace = new Int32Array(teams).fill(-1000);
    const lastBoat = new Int32Array(teams).fill(-1);
    const lastUse = new Int32Array(boats).fill(-1000);
    const prevUser = new Int32Array(boats).fill(-1);
    const nowUser = new Int32Array(boats);
    const inRace = new Int32Array(teams).fill(-1);
    const duty = new Int32Array(teams);
    let G = 0;
    let R = 0;
    let n = 0;

    for (const flight of this.plan) {
      for (const race of flight) {
        nowUser.fill(-1);
        for (let i = 0; i < race.teams.length; i++) {
          const t = race.teams[i];
          const b = race.boats[i];
          inRace[t] = n;
          nowUser[b] = t;
          const gap = n - lastRace[t] - 1;
          if (gap === 0 && lastBoat[t] !== b) R++;
          if (gap === 1 && this.gapActive) {
            // A keeper who stays on the boat and sails it next hardly loses time.
            const kept =
              this.idleOnWater && lastBoat[t] === b && lastUse[b] === n - 2;
            G += kept ? 1 : 2;
          }
        }
        if (this.idleOnWater && n > 0) {
          for (let b = 0; b < active; b++) {
            if (nowUser[b] >= 0) continue;
            const u = prevUser[b];
            if (u >= 0 && inRace[u] !== n) duty[u]++;
          }
        }
        for (let i = 0; i < race.teams.length; i++) {
          const t = race.teams[i];
          lastRace[t] = n;
          lastBoat[t] = race.boats[i];
          lastUse[race.boats[i]] = n;
        }
        prevUser.set(nowUser);
        n++;
      }
    }

    let K = 0;
    for (let t = 0; t < teams; t++) K += duty[t] * duty[t];
    return { G, R, K };
  }

  metrics(): Metrics {
    return { O: this.O, B: this.B, ...this.scan() };
  }
}

/** Score tuple in the chosen objective order. Compare with compareTuples. */
export function tuple(m: Metrics, order: ObjectiveCode[]): number[] {
  return order.map((code) => m[code]);
}

/** Lexicographic comparison: negative when a is better than b. */
export function compareTuples(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}
