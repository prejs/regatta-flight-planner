import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { ChevronDown, ChevronRight, Flag, History, Sailboat, Settings2, Timer, Trash2, TriangleAlert, Users } from 'lucide';

import '../components/flight-view';
import { icon } from '../components/icon';
import '../components/plan-form';
import '../components/tip';
import { cachedPlans, findPlan, forgetPlans, planKey, savePlan, type CachedPlan } from '../plan/cache';
import { PlanSolver, SupersededError, type SolveResult } from '../plan/solver-client';
import { decodePlanUrl, type PlanSpec } from '../plan/url';
import { router } from '../router';
import { idleBoats, type IdleBoat } from '../solver/schedule';
import { styles } from '../styles/shared-styles';

// The plan lives in the URL fragment. The form writes it; a change of the
// fragment (form, link, back button) solves it again, or opens it from the
// plans saved on this device.
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
      summary {
        position: relative;
      }
      /* Progress while the settings are closed. */
      .bar {
        position: absolute;
        left: 0;
        bottom: 0;
        height: 3px;
        width: calc(var(--progress) * 100%);
        background: var(--accent);
        transition: width 0.2s;
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
      .saved h2 {
        display: flex;
        align-items: center;
        margin: 0;
        padding: 14px var(--gutter);
        font-size: var(--fs-lg);
        font-weight: 600;
        border-bottom: 1px solid var(--border);
      }
      .saved ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .saved li + li {
        border-top: 1px solid var(--border);
      }
      .saved a {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 2px 8px;
        padding: 10px var(--gutter);
        color: inherit;
        text-decoration: none;
      }
      .saved a:hover {
        background: var(--surface-2);
      }
      .saved a:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: -2px;
      }
      .what {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 14px;
        font-weight: 500;
      }
      .what .icon {
        color: var(--muted);
      }
      .when {
        grid-row: 2;
        font-size: var(--fs-sm);
        color: var(--muted);
      }
      .go {
        grid-row: 1 / span 2;
        grid-column: 2;
        align-self: center;
        margin: 0;
        color: var(--muted);
      }
      .saved button {
        display: flex;
        align-items: center;
        margin: 0;
        padding: 12px var(--gutter);
        width: 100%;
        font: inherit;
        font-size: var(--fs-sm);
        color: var(--muted);
        background: none;
        border: none;
        border-top: 1px solid var(--border);
        cursor: pointer;
      }
      .saved button.forget:hover {
        color: var(--danger);
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
  /** The result came from the saved plans. */
  @state() private cached = false;
  @state() private saved: CachedPlan[] = cachedPlans();
  /** Recent plans beyond the first few are shown on request. */
  @state() private allSaved = false;
  /** Open on the start screen and while editing; a link opens with them closed. */
  @state() private settingsOpen = !location.hash.slice(1);

  private solver = new PlanSolver();
  private fragment?: string;
  /** The next fragment comes from the form, which stays open to show the progress. */
  private submitted = false;
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
    const submitted = this.submitted;
    this.submitted = false;
    if (!fragment) {
      this.solver.terminate();
      this.spec = undefined;
      this.status = 'idle';
      this.settingsOpen = true;
      this.saved = cachedPlans();
      return;
    }
    if (!submitted) this.settingsOpen = false;
    try {
      this.spec = decodePlanUrl(fragment).plan;
    } catch {
      this.spec = undefined;
    }
    const hit = findPlan(fragment);
    if (hit) {
      this.solver.terminate();
      this.show({ solution: hit.solution, ms: hit.ms }, true);
      return;
    }
    this.status = 'solving';
    this.progress = 0;
    try {
      const result = await this.solver.solve(fragment, (p) => (this.progress = p));
      savePlan(fragment, result.solution, result.ms);
      this.show(result, false);
    } catch (e) {
      if (e instanceof SupersededError) return;
      this.error = (e as Error).message;
      this.status = 'error';
    }
  }

  private show(result: SolveResult, cached: boolean) {
    const { plan, derived } = result.solution;
    this.idle = idleBoats(plan, derived, this.spec?.idleBoatOnWater ?? true);
    this.result = result;
    this.cached = cached;
    this.status = 'done';
    this.settingsOpen = false;
    this.saved = cachedPlans();
  }

  private onSubmit(e: CustomEvent<string>) {
    if (e.detail === this.fragment) return;
    this.submitted = true;
    location.hash = e.detail;
  }

  private forget() {
    forgetPlans();
    this.saved = [];
  }

  render() {
    return html`
      <app-header></app-header>

      <main>
        ${this.status === 'idle' ? this.renderSaved() : ''}
        <details class="card" .open=${this.settingsOpen}
          @toggle=${(e: Event) => (this.settingsOpen = (e.target as HTMLDetailsElement).open)}>
          <summary>
            ${icon(Settings2)}Plan settings
            ${this.status === 'solving'
              ? html`<span class="badge" aria-hidden="true">${Math.round(this.progress * 100)}%</span>
                  <span class="bar" style="--progress:${this.progress}"></span>`
              : ''}
            ${icon(ChevronDown, 'icon chevron')}
          </summary>
          <plan-form .value=${this.spec} .current=${this.fragment}
            .progress=${this.status === 'solving' ? this.progress : undefined}
            .saved=${new Set(this.saved.map((p) => planKey(p.fragment)))}
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
        // Recent plans sit above the settings; Make plan shows the progress.
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
            ${this.cached
              ? html`<li><app-tip text="Opened from the plans saved on this device. Solving took ${(ms / 1000).toFixed(1)} s.">
                  <span class="chip">${icon(History)}Saved</span>
                </app-tip></li>`
              : html`<li><app-tip text="Time it took to solve on this device">
                  <span class="chip">${icon(Timer)}<span class="sr">Solved in </span>${(ms / 1000).toFixed(1)} s</span>
                </app-tip></li>`}
          </ul>
          <flight-view .plan=${solution.plan} .derived=${solution.derived} .idle=${this.idle}></flight-view>
        `;
      }
    }
  }

  private renderSaved() {
    if (!this.saved.length) return '';
    return html`<section class="card saved">
      <h2>${icon(History)}Recent plans</h2>
      <ul>
        ${(this.allSaved ? this.saved : this.saved.slice(0, RECENT)).map((p) => {
          const d = p.solution.derived;
          return html`<li><a href="#${p.fragment}">
            <span class="what">
              <span>${icon(Users)}${d.teams} teams</span>
              <span>${icon(Sailboat)}${d.boats} boats</span>
              <span>${icon(Flag)}${p.solution.plan.length} flights</span>
            </span>
            <span class="when"><span class="checksum">#${p.solution.checksum}</span> · ${ago(p.usedAt)}</span>
            ${icon(ChevronRight, 'icon go')}
          </a></li>`;
        })}
      </ul>
      ${this.saved.length > RECENT && !this.allSaved
        ? html`<button type="button" @click=${() => (this.allSaved = true)}>${icon(ChevronDown)}Show ${this.saved.length - RECENT} more</button>`
        : html`<button type="button" class="forget" @click=${this.forget}>${icon(Trash2)}Forget saved plans</button>`}
    </section>`;
  }
}

/** Recent plans shown before Show more. */
const RECENT = 3;

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "5 minutes ago", "yesterday", in the viewer's language. */
function ago(at: number): string {
  const s = (at - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of units) {
    if (Math.abs(s) >= size) return relative.format(Math.round(s / size), unit);
  }
  return relative.format(0, 'minute');
}
