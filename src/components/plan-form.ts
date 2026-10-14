import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { Anchor, ChevronDown, ChevronUp, Cog, History, Dices, Flag, KeyRound, ListOrdered, Sailboat, Ship, Users } from 'lucide';

import { newSeed } from '../plan/seed';
import { planKey } from '../plan/cache';
import { CURRENT_VERSION, encodePlanUrl, MAX_BOATS, MAX_FLIGHTS, MAX_TEAMS, type PlanSpec } from '../plan/url';
import { DEFAULT_ORDER, derive, type Derived, type ObjectiveCode } from '../solver/model';
import { styles } from '../styles/shared-styles';
import { icon } from './icon';

const OBJECTIVE_NAMES: Record<ObjectiveCode, string> = {
  O: 'Opponent balance',
  G: 'Gaps between races',
  B: 'Boat balance',
  R: 'Boat reuse',
  K: 'Keeper duty balance',
};

/** Objectives that can change the plan for these sizes. The others are left out of the URL. */
function activeObjectives(d: Derived, idleOnWater: boolean): Set<ObjectiveCode> {
  const active = new Set<ObjectiveCode>(['O', 'B']);
  if (d.races >= 3) active.add('G');
  if (d.races >= 2) active.add('R');
  if (idleOnWater && d.sizes.some((s) => s < d.active)) active.add('K');
  return active;
}

/**
 * Plan inputs. Fires `plan-submit` with the plan-layer URL fragment as
 * `detail`. Set `value` to edit an existing plan.
 */
@customElement('plan-form')
export class PlanForm extends LitElement {
  static styles = [
    styles,
    css`
      form {
        display: grid;
        gap: 16px;
      }
      .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      label {
        display: grid;
        gap: 6px;
        font-size: var(--fs-sm);
        font-weight: 500;
        color: var(--muted);
      }
      label > span:first-child {
        display: flex;
        align-items: center;
      }
      .icon.solo {
        margin-right: 0;
      }
      input[type='number'],
      input[type='text'] {
        font: inherit;
        /* 16px or more keeps iOS from zooming into the field. */
        font-size: var(--fs-base);
        font-weight: 400;
        color: var(--text);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 10px 12px;
        min-width: 0;
      }
      input:focus-visible,
      button:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }
      input:user-invalid {
        border-color: var(--danger);
      }
      /* Boats in use while they follow the default. */
      input.default {
        color: var(--muted);
      }
      fieldset {
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        margin: 0;
        padding: 8px 12px 12px;
        display: grid;
        gap: 8px;
      }
      legend {
        display: flex;
        align-items: center;
        padding: 0 4px;
        font-size: var(--fs-sm);
        font-weight: 500;
        color: var(--muted);
      }
      fieldset label {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: var(--fs-base);
        font-weight: 400;
        color: var(--text);
      }
      input[type='radio'] {
        accent-color: var(--accent);
        width: 18px;
        height: 18px;
        margin: 0;
      }
      ol {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 6px;
        counter-reset: objective;
      }
      li::before {
        counter-increment: objective;
        content: counter(objective);
        min-width: 1.25em;
        color: var(--muted);
        font-variant-numeric: tabular-nums;
      }
      li {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      li span {
        flex: 1;
      }
      li.inactive span {
        color: var(--muted);
      }
      button {
        font: inherit;
        font-weight: 500;
        color: var(--text);
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 10px 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      button:hover:not(:disabled) {
        border-color: var(--muted);
      }
      button:disabled {
        opacity: 0.4;
        cursor: default;
      }
      li button {
        padding: 6px;
        background: none;
      }
      .seed {
        display: flex;
        gap: 8px;
      }
      .seed input {
        flex: 1;
        font-family: var(--font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .hint {
        font-size: var(--fs-sm);
        color: var(--muted);
        margin: -4px 0 0;
      }
      .error {
        color: var(--danger);
      }
      .hint.saved {
        margin: -8px 0 0;
        text-align: center;
      }
      /* Make plan fills with the progress of the plan being solved. */
      button[type='submit'] {
        position: relative;
        overflow: hidden;
        isolation: isolate;
        padding: 14px;
        border: none;
        background: var(--accent);
        color: var(--on-accent);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      button[type='submit'].solving {
        background: var(--accent-track);
      }
      .fill {
        position: absolute;
        inset: 0 auto 0 0;
        z-index: -1;
        width: calc(var(--progress) * 100%);
        background: repeating-linear-gradient(-45deg, #fff2 0 10px, transparent 10px 20px) 0 0 / 28.28px 28.28px,
          var(--accent);
        transition: width 0.2s;
        animation: stripes 0.8s linear infinite;
      }
      @keyframes stripes {
        to {
          background-position: 28.28px 0, 0 0;
        }
      }
      .spin {
        animation: spin 2s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .spin,
        .fill {
          animation: none;
        }
      }
    `,
  ];

  @property({ attribute: false }) value?: PlanSpec;
  /** Progress of the plan being solved, 0..1, or undefined when none is. */
  @property({ type: Number }) progress?: number;
  /** The fragment being solved or shown. Make plan says Solving while the inputs match it. */
  @property() current?: string;
  /** Plan keys of the plans saved on this device: they open without solving. */
  @property({ attribute: false }) saved = new Set<string>();

  @state() private teams = 17;
  @state() private boats = 7;
  /** Undefined follows the default, the largest race size on all boats. */
  @state() private activeBoats?: number;
  @state() private minFlights = 9;
  @state() private maxFlights = 15;
  @state() private idleBoatOnWater = true;
  @state() private order: ObjectiveCode[] = [...DEFAULT_ORDER];
  @state() private seed = newSeed();

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('value') && this.value) {
      const v = this.value;
      this.teams = v.teams;
      this.boats = v.boats;
      this.activeBoats = v.activeBoats === this.defaultActive(v.teams, v.boats) ? undefined : v.activeBoats;
      this.minFlights = v.minFlights;
      this.maxFlights = v.maxFlights;
      this.idleBoatOnWater = v.idleBoatOnWater;
      this.order = [...v.order, ...DEFAULT_ORDER.filter((c) => !v.order.includes(c))];
      this.seed = v.seed;
    }
  }

  /** The fragment for the current inputs, or the reason there is none. */
  private build(): { fragment: string; derived: Derived; active: Set<ObjectiveCode> } | { error: string } {
    try {
      const derived = derive({
        teams: this.teams,
        boats: this.boats,
        activeBoats: this.activeBoats,
      });
      const active = activeObjectives(derived, this.idleBoatOnWater);
      const plan: PlanSpec = {
        version: CURRENT_VERSION,
        teams: this.teams,
        boats: this.boats,
        activeBoats: derived.active,
        minFlights: this.minFlights,
        maxFlights: this.maxFlights,
        order: this.order.filter((c) => active.has(c)),
        seed: this.seed.toUpperCase(),
        idleBoatOnWater: this.idleBoatOnWater,
        events: [],
      };
      return { fragment: encodePlanUrl({ plan, labels: {} }), derived, active };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  /** Boats in use by default: the largest race on all boats. Undefined while teams or boats are invalid. */
  private defaultActive(teams = this.teams, boats = this.boats): number | undefined {
    try {
      return derive({ teams, boats }).active;
    } catch {
      return undefined;
    }
  }

  private setActive(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    const n = v === '' ? undefined : Number(v);
    // Back at the default: follow it again when teams or boats change.
    this.activeBoats = n === this.defaultActive() ? undefined : n;
  }

  private move(i: number, by: -1 | 1) {
    const order = [...this.order];
    [order[i], order[i + by]] = [order[i + by], order[i]];
    this.order = order;
  }

  private submit(e: Event) {
    e.preventDefault();
    const built = this.build();
    if ('fragment' in built) {
      this.dispatchEvent(new CustomEvent('plan-submit', { detail: built.fragment, bubbles: true, composed: true }));
    }
  }

  render() {
    const built = this.build();
    const num = (set: (n: number) => void) => (e: Event) => set(Number((e.target as HTMLInputElement).value));
    return html`
      <form @submit=${this.submit}>
        <div class="row">
          <label><span>${icon(Users)}Teams</span>
            <input type="number" min="2" max=${MAX_TEAMS} required .value=${String(this.teams)}
              @input=${num((n) => (this.teams = n))} />
          </label>
        </div>
        <div class="row">
          <label><span>${icon(Sailboat)}Boats</span>
            <input type="number" min="2" max=${MAX_BOATS} required .value=${String(this.boats)}
              @input=${num((n) => (this.boats = n))} />
          </label>
          <label><span>${icon(Ship)}Boats in use</span>
            <input type="number" min="2" max=${Math.min(this.boats, MAX_BOATS)}
              class=${this.activeBoats === undefined ? 'default' : ''}
              .value=${String(this.activeBoats ?? this.defaultActive() ?? '')} @input=${this.setActive} />
          </label>
        </div>
        <div class="row">
          <label><span>${icon(Flag)}Maximum flights</span>
            <input type="number" min="1" max=${MAX_FLIGHTS} required .value=${String(this.maxFlights)}
              @input=${num((n) => (this.maxFlights = n))} />
          </label>
          <label><span>${icon(Flag)}Minimum flights</span>
            <input type="number" min="1" max=${MAX_FLIGHTS} required .value=${String(this.minFlights)}
              @input=${num((n) => (this.minFlights = n))} />
          </label>
        </div>
        ${'derived' in built ? html`<p class="hint">${this.hint(built.derived)}</p>` : ''}

        <fieldset>
          <legend>${icon(Anchor)}Idle boat</legend>
          <label><input type="radio" name="idle" .checked=${this.idleBoatOnWater}
            @change=${() => (this.idleBoatOnWater = true)} /> Stays on the water with a keeper</label>
          <label><input type="radio" name="idle" .checked=${!this.idleBoatOnWater}
            @change=${() => (this.idleBoatOnWater = false)} /> Goes to the dock</label>
        </fieldset>

        <fieldset>
          <legend>${icon(ListOrdered)}Objectives, most important first</legend>
          <ol>
            ${this.order.map((code, i) => {
              const used = !('active' in built) || built.active.has(code);
              return html`<li class=${used ? '' : 'inactive'}>
                <span>${OBJECTIVE_NAMES[code]}${used ? '' : ' (not used for these sizes)'}</span>
                <button type="button" aria-label="Move up" ?disabled=${i === 0} @click=${() => this.move(i, -1)}>${icon(ChevronUp, 'icon solo')}</button>
                <button type="button" aria-label="Move down" ?disabled=${i === this.order.length - 1}
                  @click=${() => this.move(i, 1)}>${icon(ChevronDown, 'icon solo')}</button>
              </li>`;
            })}
          </ol>
        </fieldset>

        <label><span>${icon(KeyRound)}Seed</span>
          <div class="seed">
            <input type="text" maxlength="6" spellcheck="false" autocomplete="off" .value=${this.seed}
              @input=${(e: Event) => (this.seed = (e.target as HTMLInputElement).value)} />
            <button type="button" @click=${() => (this.seed = newSeed())}>${icon(Dices)}New seed</button>
          </div>
        </label>

        ${'error' in built ? html`<p class="hint error">${built.error}</p>` : ''}
        ${this.renderSubmit(built)}
      </form>
    `;
  }

  private renderSubmit(built: ReturnType<PlanForm['build']>) {
    const solving = this.progress !== undefined;
    // Changed inputs make a new plan, which replaces the one being solved.
    const same = solving && 'fragment' in built && built.fragment === this.current;
    const percent = Math.round((this.progress ?? 0) * 100);
    const saved = !solving && 'fragment' in built && this.saved.has(planKey(built.fragment));
    return html`<button type="submit" class=${solving ? 'solving' : ''} ?disabled=${'error' in built}
      style=${solving ? `--progress:${this.progress}` : ''}>
      ${solving ? html`<span class="fill"></span>` : ''}
      ${icon(saved ? History : Cog, solving ? 'icon spin' : 'icon')}${same ? `Solving… ${percent}%` : 'Make plan'}
    </button>
    ${saved ? html`<p class="hint saved">Solved before on this device: the plan opens at once.</p>` : ''}
    ${solving ? html`<progress class="sr" aria-label="Solving" max="100" .value=${percent}></progress>` : ''}`;
  }

  private hint(d: Derived) {
    const spares = this.boats - d.active;
    const opponents = d.sizes[0] - 1;
    const flights = Math.ceil((this.teams - 1) / opponents);
    return `${d.races} ${d.races === 1 ? 'race' : 'races'} per flight (${d.sizes.join(', ')}), ` +
      `${d.active} boats in use${spares ? `, ${spares} spare` : ''}. ` +
      `Each flight gives up to ${opponents} opponents; a team needs at least ${flights} ` +
      `${flights === 1 ? 'flight' : 'flights'} to meet all ${this.teams - 1} others.`;
  }
}
