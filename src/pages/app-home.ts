import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { ChevronDown, Flag, Settings2, Timer, TriangleAlert, Users } from 'lucide';

import '../components/flight-view';
import { icon } from '../components/icon';
import '../components/plan-form';
import '../components/tip';
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
      main {
        max-width: 720px;
        margin: 0 auto;
        padding: var(--gutter);
        padding-left: max(var(--gutter), env(safe-area-inset-left, 0px));
        padding-right: max(var(--gutter), env(safe-area-inset-right, 0px));
        display: grid;
        gap: var(--gutter);
      }
      details {
        overflow: hidden;
      }
      summary {
        display: flex;
        align-items: center;
        padding: 14px var(--gutter);
        cursor: pointer;
        font-size: var(--fs-lg);
        font-weight: 600;
        list-style: none;
      }
      summary::-webkit-details-marker {
        display: none;
      }
      summary .chevron {
        margin: 0 0 0 auto;
        color: var(--muted);
        transition: transform 0.2s;
      }
      details[open] summary .chevron {
        transform: rotate(180deg);
      }
      details[open] summary {
        border-bottom: 1px solid var(--border);
      }
      .badge {
        margin-left: 12px;
        padding: 2px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: var(--fs-sm);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      plan-form {
        display: block;
        padding: var(--gutter);
      }
      .facts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 999px;
        background: var(--surface);
        border: 1px solid var(--border);
        font-size: var(--fs-sm);
        font-weight: 500;
        font-variant-numeric: tabular-nums;
      }
      .chip .icon {
        color: var(--muted);
      }
      .checksum {
        font-family: var(--font-mono);
        letter-spacing: 0.04em;
      }
      .error {
        display: flex;
        align-items: center;
        padding: 12px var(--gutter);
        color: var(--danger);
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
        <details class="card" ?open=${this.status !== 'done'}>
          <summary>
            ${icon(Settings2)}Plan settings
            ${this.status === 'solving' ? html`<span class="badge" aria-hidden="true">${Math.round(this.progress * 100)}%</span>` : ''}
            ${icon(ChevronDown, 'icon chevron')}
          </summary>
          <plan-form .value=${this.spec} .current=${this.fragment}
            .progress=${this.status === 'solving' ? this.progress : undefined}
            @plan-submit=${this.onSubmit}></plan-form>
        </details>
        ${this.renderStatus()}
      </main>
    `;
  }

  private renderStatus() {
    switch (this.status) {
      case 'idle':
      case 'solving':
        // Make plan shows the progress.
        return '';
      case 'error':
        return html`<p class="card error" role="alert">${icon(TriangleAlert)}This link has no valid plan: ${this.error}</p>`;
      case 'done': {
        const { solution, ms } = this.result!;
        const spec = this.spec;
        return html`
          <ul class="facts">
            <li><app-tip text="Checksum: the same plan shows the same checksum on every device">
              <span class="chip checksum"><span class="sr">Checksum </span>#${solution.checksum}</span>
            </app-tip></li>
            ${spec ? html`<li><span class="chip">${icon(Users)}${spec.teams} teams</span></li>` : ''}
            <li><span class="chip">${icon(Flag)}${solution.plan.length} flights</span></li>
            <li><app-tip text="Time it took to solve on this device">
              <span class="chip">${icon(Timer)}<span class="sr">Solved in </span>${(ms / 1000).toFixed(1)} s</span>
            </app-tip></li>
          </ul>
          <flight-view .plan=${solution.plan} .derived=${solution.derived} .idle=${this.idle}></flight-view>
        `;
      }
    }
  }
}
