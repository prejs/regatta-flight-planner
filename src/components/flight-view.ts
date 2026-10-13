import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import { Anchor, Flag, Warehouse } from 'lucide';

import { PALETTE } from '../plan/palette';
import type { Derived, Plan, Race } from '../solver/model';
import type { IdleBoat } from '../solver/schedule';
import { icon } from './icon';

const team = (t: number) => `T${t + 1}`;

/** Rows are races, columns are boats in use. Idle boats show their keeper. */
@customElement('flight-view')
export class FlightView extends LitElement {
  static styles = css`
    section {
      margin-bottom: 20px;
    }
    h3 {
      font-size: 16px;
      margin: 0 0 6px;
    }
    .scroll {
      overflow-x: auto;
    }
    /* Fixed layout keeps the boat columns the same width in every flight. */
    table {
      table-layout: fixed;
      width: 100%;
      max-width: 640px;
      min-width: calc(48px * var(--columns));
      border-collapse: collapse;
      font-size: 14px;
      font-variant-numeric: tabular-nums;
    }
    th,
    td {
      border: 1px solid #8884;
      padding: 4px 6px;
      text-align: center;
    }
    th[scope='row'] {
      font-weight: normal;
      opacity: 0.8;
    }
    .swatch {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 2px;
      border: 1px solid #8888;
      vertical-align: -1px;
      margin-right: 4px;
    }
    td.idle {
      font-size: 12px;
      opacity: 0.7;
      font-style: italic;
    }
    .icon {
      vertical-align: -0.15em;
      margin-right: 4px;
    }
    td.idle .icon {
      margin-right: 2px;
    }
    .numbering {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      margin: 0 0 8px;
    }
    .legend {
      font-size: 13px;
      opacity: 0.8;
      margin: 0 0 12px;
    }
    .legend span {
      margin-right: 12px;
      white-space: nowrap;
    }
    .sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `;

  @property({ attribute: false }) plan: Plan = [];
  @property({ attribute: false }) derived?: Derived;
  /** idle[flight][race], from idleBoats(). */
  @property({ attribute: false }) idle: IdleBoat[][][] = [];
  /** Number races within each flight (1..R) instead of across the day. */
  @state() private perFlight = false;

  render() {
    const d = this.derived;
    if (!d) return '';
    const boats = Array.from({ length: d.active }, (_, b) => b);
    const idle = this.idle.flat(2);
    const kept = idle.some((x) => x.keeper >= 0);
    const docked = idle.some((x) => x.keeper < 0);
    return html`<label class="numbering">
        <input type="checkbox" .checked=${this.perFlight}
          @change=${(e: Event) => (this.perFlight = (e.target as HTMLInputElement).checked)} />
        Number races within each flight
      </label>${kept || docked
      ? html`<p class="legend">
          ${kept ? html`<span>${icon(Anchor)}T3: idle, kept by team 3</span>` : ''}
          ${docked ? html`<span>${icon(Warehouse)}dock: idle at the dock</span>` : ''}
        </p>`
      : ''}${repeat(
      this.plan,
      (_, f) => f,
      (flight, f) => html`
        <section>
          <h3>${icon(Flag)}Flight ${f + 1}</h3>
          <div class="scroll">
            <table style="--columns:${d.active + 1}">
              <thead>
                <tr>
                  <th scope="col">Race</th>
                  ${boats.map(
                    (b) => html`<th scope="col" title=${PALETTE[b].name}>
                      <span class="swatch" style="background:${PALETTE[b].hex}"></span>${b + 1}
                    </th>`
                  )}
                </tr>
              </thead>
              <tbody>
                ${flight.map((race, r) => this.renderRace(race, this.perFlight ? r + 1 : f * d.races + r + 1, this.idle[f]?.[r] ?? [], boats))}
              </tbody>
            </table>
          </div>
        </section>
      `
    )}`;
  }

  private renderRace(race: Race, n: number, idle: IdleBoat[], boats: number[]) {
    return html`<tr>
      <th scope="row">${n}</th>
      ${boats.map((b) => {
        const i = race.boats.indexOf(b);
        if (i >= 0) return html`<td>${team(race.teams[i])}</td>`;
        const keeper = idle.find((x) => x.boat === b)?.keeper ?? -1;
        return keeper >= 0
          ? html`<td class="idle" title="Idle, kept by ${team(keeper)}"
              >${icon(Anchor)}<span class="sr">Idle, kept by </span>${team(keeper)}</td>`
          : html`<td class="idle" title="Idle at the dock"
              >${icon(Warehouse)}<span class="sr">Idle at the </span>dock</td>`;
      })}
    </tr>`;
  }
}
