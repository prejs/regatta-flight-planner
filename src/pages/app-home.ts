import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { PlanSolver, SupersededError, type SolveResult } from '../plan/solver-client';
import { router } from '../router';
import { styles } from '../styles/shared-styles';

const EXAMPLE = '0.t17b7.f9-15.oOGBRK.K7QX2M';

// Placeholder until the input form and flight view exist: solves the plan in
// the URL fragment and shows its checksum and solve time.
@customElement('app-home')
export class AppHome extends LitElement {
  static styles = [
    styles,
    css`
      dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 4px 16px;
      }
      dd {
        margin: 0;
        font-family: ui-monospace, monospace;
      }
    `,
  ];

  @state() private status: 'idle' | 'solving' | 'done' | 'error' = 'idle';
  @state() private result?: SolveResult;
  @state() private error = '';

  private solver = new PlanSolver();
  private fragment?: string;
  private onHashChange = () => this.solveFromHash();

  connectedCallback() {
    super.connectedCallback();
    // The router turns link clicks into pushState, which fires no hashchange.
    window.addEventListener('hashchange', this.onHashChange);
    router.addEventListener('route-changed', this.onHashChange);
    this.solveFromHash();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.onHashChange);
    router.removeEventListener('route-changed', this.onHashChange);
    this.solver.terminate();
    this.fragment = undefined;
  }

  private async solveFromHash() {
    const fragment = location.hash.slice(1);
    if (fragment === this.fragment) return;
    this.fragment = fragment;
    if (!fragment) {
      this.solver.terminate();
      this.status = 'idle';
      return;
    }
    this.status = 'solving';
    try {
      this.result = await this.solver.solve(fragment);
      this.status = 'done';
    } catch (e) {
      if (e instanceof SupersededError) return;
      this.error = (e as Error).message;
      this.status = 'error';
    }
  }

  render() {
    return html`
      <app-header></app-header>

      <main>
        <h2>Plan a regatta</h2>
        ${this.renderStatus()}
      </main>
    `;
  }

  private renderStatus() {
    switch (this.status) {
      case 'idle':
        return html`<p>Open a plan link, for example <a href="#${EXAMPLE}">#${EXAMPLE}</a>.</p>`;
      case 'solving':
        return html`<p>Solving…</p>`;
      case 'error':
        return html`<p>This link has no valid plan: ${this.error}</p>`;
      case 'done': {
        const { solution, ms } = this.result!;
        const d = solution.derived;
        return html`
          <dl>
            <dt>Checksum</dt><dd>#${solution.checksum}</dd>
            <dt>Solve time</dt><dd>${ms} ms</dd>
            <dt>Plan</dt><dd>${d.teams} teams, ${d.active} of ${d.boats} boats, ${solution.plan.length} flights of ${d.races} races</dd>
            <dt>Score</dt><dd>${Object.entries(solution.metrics).map(([k, v]) => `${k}=${v}`).join(' ')}</dd>
          </dl>
        `;
      }
    }
  }
}
