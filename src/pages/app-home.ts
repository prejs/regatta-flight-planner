import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import '../components/flight-view';
import '../components/plan-form';
import { PlanSolver, SupersededError, type SolveResult } from '../plan/solver-client';
import { decodePlanUrl, type PlanSpec } from '../plan/url';
import { router } from '../router';
import { idleBoats, type IdleBoat } from '../solver/schedule';
import { styles } from '../styles/shared-styles';

// The plan lives in the URL fragment. The form writes it; a change of the
// fragment (form, link, back button) solves it again.
@customElement('app-home')
export class AppHome extends LitElement {
  static styles = [
    styles,
    css`
      details {
        margin-bottom: 16px;
      }
      summary {
        cursor: pointer;
        font-weight: bold;
        margin-bottom: 12px;
      }
      progress {
        width: 100%;
        max-width: 480px;
      }
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
  @state() private spec?: PlanSpec;
  @state() private result?: SolveResult;
  @state() private idle: IdleBoat[][][] = [];
  @state() private progress = 0;
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
    this.result = undefined;
    if (!fragment) {
      this.solver.terminate();
      this.spec = undefined;
      this.status = 'idle';
      return;
    }
    try {
      this.spec = decodePlanUrl(fragment).plan;
    } catch {
      this.spec = undefined;
    }
    this.status = 'solving';
    this.progress = 0;
    try {
      const result = await this.solver.solve(fragment, (p) => (this.progress = p));
      const { plan, derived } = result.solution;
      this.idle = idleBoats(plan, derived, this.spec?.idleBoatOnWater ?? true);
      this.result = result;
      this.status = 'done';
    } catch (e) {
      if (e instanceof SupersededError) return;
      this.error = (e as Error).message;
      this.status = 'error';
    }
  }

  private onSubmit(e: CustomEvent<string>) {
    if (e.detail === this.fragment) return;
    location.hash = e.detail;
  }

  render() {
    return html`
      <app-header></app-header>

      <main>
        <details ?open=${this.status !== 'done'}>
          <summary>Plan settings</summary>
          <plan-form .value=${this.spec} @plan-submit=${this.onSubmit}></plan-form>
        </details>
        ${this.renderStatus()}
      </main>
    `;
  }

  private renderStatus() {
    switch (this.status) {
      case 'idle':
        return '';
      case 'solving':
        return html`<p>Solving… ${Math.round(this.progress * 100)}%</p>
          <progress max="1" .value=${this.progress}></progress>`;
      case 'error':
        return html`<p>This link has no valid plan: ${this.error}</p>`;
      case 'done': {
        const { solution, ms } = this.result!;
        return html`
          <dl>
            <dt>Checksum</dt><dd>#${solution.checksum}</dd>
            <dt>Solve time</dt><dd>${(ms / 1000).toFixed(1)} s</dd>
            <dt>Score</dt><dd>${Object.entries(solution.metrics).map(([k, v]) => `${k}=${v}`).join(' ')}</dd>
          </dl>
          <flight-view .plan=${solution.plan} .derived=${solution.derived} .idle=${this.idle}></flight-view>
        `;
      }
    }
  }
}
