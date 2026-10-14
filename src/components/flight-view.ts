import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import { Anchor, Flag, Warehouse } from 'lucide';

import { PALETTE } from '../plan/palette';
import type { Derived, Plan, Race } from '../solver/model';
import type { IdleBoat } from '../solver/schedule';
import { styles } from '../styles/shared-styles';
import { icon } from './icon';
import './tip';

const team = (t: number) => `T${t + 1}`;

/** Rows are races, columns are boats in use. Idle boats show their keeper. */
@customElement('flight-view')
export class FlightView extends LitElement {
  static styles = [
    styles,
    css`
      :host {
        display: grid;
        gap: var(--gutter);
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 20px;
        padding: 10px var(--gutter);
        font-size: var(--fs-sm);
      }
      .toolbar label {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
      }
      /* A switch: the setting changes the view at once. */
      input[role='switch'] {
        appearance: none;
        position: relative;
        flex: none;
        width: 36px;
        height: 20px;
        margin: 0;
        border-radius: 999px;
        background: var(--border);
        cursor: pointer;
        transition: background 0.15s;
      }
      input[role='switch']::before {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 2px #0004;
        transition: transform 0.15s;
      }
      input[role='switch']:checked {
        background: var(--accent);
      }
      input[role='switch']:checked::before {
        transform: translateX(16px);
      }
      input[role='switch']:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .key {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 16px;
        margin: 0;
        padding: 0;
        list-style: none;
        color: var(--muted);
      }
      .key li {
        display: flex;
        align-items: center;
        white-space: nowrap;
      }
      .key .icon {
        margin-right: 4px;
      }
      section {
        overflow: hidden;
      }
      h3 {
        display: flex;
        align-items: center;
        font-size: var(--fs-base);
        font-weight: 600;
        margin: 0;
        padding: 10px var(--gutter);
        border-bottom: 1px solid var(--border);
      }
      h3 .icon {
        color: var(--muted);
      }
      .scroll {
        overflow-x: auto;
      }
      /* Fixed layout keeps the boat columns the same width in every flight. */
      table {
        table-layout: fixed;
        width: 100%;
        min-width: calc(52px * var(--columns));
        border-collapse: collapse;
        font-size: var(--fs-sm);
        font-variant-numeric: tabular-nums;
      }
      th,
      td {
        padding: 8px 4px;
        text-align: center;
        border-top: 1px solid var(--border);
      }
      thead th {
        border-top: none;
        background: var(--surface-2);
        font-weight: 600;
      }
      th[scope='row'] {
        font-weight: 500;
        color: var(--muted);
      }
      .swatch {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 3px;
        box-shadow: inset 0 0 0 1px var(--swatch-ring);
        vertical-align: -1px;
        margin-right: 4px;
      }
      td.idle {
        color: var(--muted);
        font-style: italic;
      }
      td.idle .icon {
        margin-right: 2px;
      }
    `,
  ];

  @property({ attribute: false }) plan: Plan = [];
  @property({ attribute: false }) derived?: Derived;
  /** idle[flight][race], from idleBoats(). */
  @property({ attribute: false }) idle: IdleBoat[][][] = [];
  /** Number races within each flight (flight.race, such as 2.1) instead of across the day. */
  @state() private perFlight = false;

  render() {
    const d = this.derived;
    if (!d) return '';
    const boats = Array.from({ length: d.active }, (_, b) => b);
    const idle = this.idle.flat(2);
    const kept = idle.some((x) => x.keeper >= 0);
    const docked = idle.some((x) => x.keeper < 0);
    return html`<div class="card toolbar">
        <label>
          <input type="checkbox" role="switch" .checked=${this.perFlight}
            @change=${(e: Event) => (this.perFlight = (e.target as HTMLInputElement).checked)} />
          Number races within each flight
        </label>
        ${kept || docked
          ? html`<ul class="key" aria-label="Key">
              ${kept ? html`<li>${icon(Anchor)}T3: idle, kept by team 3</li>` : ''}
              ${docked ? html`<li>${icon(Warehouse)}dock: idle at the dock</li>` : ''}
            </ul>`
          : ''}
      </div>
      ${repeat(
        this.plan,
        (_, f) => f,
        (flight, f) => html`
          <section class="card">
            <h3>${icon(Flag)}Flight ${f + 1}</h3>
            <div class="scroll">
              <table style="--columns:${d.active + 1}">
                <thead>
                  <tr>
                    <th scope="col">Race</th>
                    ${boats.map(
                      (b) => html`<th scope="col">
                        <app-tip text="Boat ${b + 1}: ${PALETTE[b].name}"
                          ><span class="swatch" style="background:${PALETTE[b].hex}"></span>${b + 1}</app-tip
                        >
                      </th>`
                    )}
                  </tr>
                </thead>
                <tbody>
                  ${flight.map((race, r) =>
                    this.renderRace(race, this.perFlight ? `${f + 1}.${r + 1}` : String(f * d.races + r + 1), this.idle[f]?.[r] ?? [], boats)
                  )}
                </tbody>
              </table>
            </div>
          </section>
        `
      )}`;
  }

  private renderRace(race: Race, n: string, idle: IdleBoat[], boats: number[]) {
    return html`<tr>
      <th scope="row">${n}</th>
      ${boats.map((b) => {
        const i = race.boats.indexOf(b);
        if (i >= 0) return html`<td>${team(race.teams[i])}</td>`;
        const keeper = idle.find((x) => x.boat === b)?.keeper ?? -1;
        return keeper >= 0
          ? html`<td class="idle"><app-tip text="Idle, kept by team ${keeper + 1}"
              >${icon(Anchor)}<span class="sr">Idle, kept by </span>${team(keeper)}</app-tip></td>`
          : html`<td class="idle"><app-tip text="Idle at the dock"
              >${icon(Warehouse)}<span class="sr">Idle at the </span>dock</app-tip></td>`;
      })}
    </tr>`;
  }
}
