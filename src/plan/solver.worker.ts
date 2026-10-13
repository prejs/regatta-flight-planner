// Runs the solver off the main thread. One request in, one result out:
// the plan URL fragment goes in, the plan and its checksum come back.

import { solve } from '../solver/solve';
import type { SolveRequest, SolveResponse } from './solver-client';
import { decodePlanUrl, toPlanInput } from './url';

self.onmessage = ({ data }: MessageEvent<SolveRequest>) => {
  let response: SolveResponse;
  try {
    const { plan } = decodePlanUrl(data.fragment);
    // Events change the plan. Until they are applied, solving without them would give a wrong plan.
    if (plan.events.length) throw new Error('Plans with events are not supported yet');
    const started = performance.now();
    const solution = solve(toPlanInput(plan), (done, total) => {
      self.postMessage({ id: data.id, type: 'progress', done, total } satisfies SolveResponse);
    });
    response = { id: data.id, type: 'done', solution, ms: Math.round(performance.now() - started) };
  } catch (e) {
    response = { id: data.id, type: 'error', error: e instanceof Error ? e.message : String(e) };
  }
  self.postMessage(response);
};
