// Main-thread side of the solver worker. The solver cannot be interrupted, so
// a new request terminates the running worker and starts a fresh one.

import type { Solution } from '../solver/solve';

export interface SolveRequest {
  id: number;
  fragment: string;
}

export type SolveResponse =
  | { id: number; ok: true; solution: Solution; ms: number }
  | { id: number; ok: false; error: string };

export interface SolveResult {
  solution: Solution;
  /** Solve time inside the worker, without start-up and messaging. */
  ms: number;
}

/** Rejects a request that a newer one replaced. */
export class SupersededError extends Error {
  constructor() {
    super('Replaced by a newer plan');
    this.name = 'SupersededError';
  }
}

export class PlanSolver {
  private worker?: Worker;
  private nextId = 0;
  private pending?: { id: number; resolve: (r: SolveResult) => void; reject: (e: Error) => void };

  /** Solves the plan in a URL fragment. Rejects with the decode or solve error. */
  solve(fragment: string): Promise<SolveResult> {
    if (this.pending) this.terminate();
    const worker = (this.worker ??= this.start());
    const id = ++this.nextId;
    return new Promise<SolveResult>((resolve, reject) => {
      this.pending = { id, resolve, reject };
      worker.postMessage({ id, fragment } satisfies SolveRequest);
    });
  }

  /** Stops the worker. A running request rejects with SupersededError. */
  terminate(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.pending?.reject(new SupersededError());
    this.pending = undefined;
  }

  private start(): Worker {
    const worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<SolveResponse>) => {
      const job = this.pending;
      if (!job || job.id !== data.id) return;
      this.pending = undefined;
      if (data.ok) job.resolve({ solution: data.solution, ms: data.ms });
      else job.reject(new Error(data.error));
    };
    worker.onerror = (e) => {
      const job = this.pending;
      this.pending = undefined;
      this.terminate();
      job?.reject(new Error(e.message || 'The solver worker failed'));
    };
    return worker;
  }
}
