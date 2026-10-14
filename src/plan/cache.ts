// Plans solved on this device, so a link opened again shows at once. Kept in
// localStorage, most recent first. Anything may fail (private mode, full
// storage, blocked site data): the cache then stays empty and plans solve as
// before.

import solverId from 'virtual:solver-id';

import type { Solution } from '../solver/solve';

export interface CachedPlan {
  /** The full fragment last used to open the plan, labels included. */
  fragment: string;
  solution: Solution;
  /** Solve time when it was solved. */
  ms: number;
  /** When it was last solved or opened, in ms since the epoch. */
  usedAt: number;
}

interface Store {
  /** Plans from another solver may differ, so they are dropped. */
  solver: string;
  plans: CachedPlan[];
}

const KEY = 'rfp.plans';
const LIMIT = 12;

/** Labels (team names, colours) don't change the solve: plans are keyed by the plan layer. */
export const planKey = (fragment: string) => fragment.split('~')[0];

function read(): CachedPlan[] {
  try {
    const store = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Store | null;
    return store?.solver === solverId && Array.isArray(store.plans) ? store.plans : [];
  } catch {
    return [];
  }
}

function write(plans: CachedPlan[]) {
  // A full storage drops the oldest plans until the rest fit.
  for (let n = plans.length; n > 0; n--) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ solver: solverId, plans: plans.slice(0, n) } satisfies Store));
      return;
    } catch {
      // Too big, or no storage at all: try with fewer.
    }
  }
  try {
    localStorage.removeItem(KEY);
  } catch {
    // No storage.
  }
}

/** Saved plans, most recently used first. */
export function cachedPlans(): CachedPlan[] {
  return read();
}

/** The saved plan for this fragment, marked as just used. */
export function findPlan(fragment: string): CachedPlan | undefined {
  const plans = read();
  const i = plans.findIndex((p) => planKey(p.fragment) === planKey(fragment));
  if (i < 0) return undefined;
  const plan = { ...plans[i], fragment, usedAt: Date.now() };
  write([plan, ...plans.slice(0, i), ...plans.slice(i + 1)]);
  return plan;
}

export function savePlan(fragment: string, solution: Solution, ms: number): void {
  const others = read().filter((p) => planKey(p.fragment) !== planKey(fragment));
  write([{ fragment, solution, ms, usedAt: Date.now() }, ...others].slice(0, LIMIT));
}

export function forgetPlans(): void {
  write([]);
}
