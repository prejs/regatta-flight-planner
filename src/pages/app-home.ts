import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { styles } from '../styles/shared-styles';

@customElement('app-home')
export class AppHome extends LitElement {
  static styles = [styles];

  render() {
    return html`
      <app-header></app-header>

      <main>
        <h2>Plan a regatta</h2>
        <p>Fair flight plans for league-style fleet racing. Coming soon.</p>
      </main>
    `;
  }
}
