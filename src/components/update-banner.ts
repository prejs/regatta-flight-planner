import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { RefreshCw } from 'lucide';
import { registerSW } from 'virtual:pwa-register';

import { icon } from './icon';

/**
 * Registers the service worker. When a new version is installed and waiting,
 * offers a reload instead of switching under the user's feet.
 */
@customElement('update-banner')
export class UpdateBanner extends LitElement {
  static styles = css`
    div {
      position: fixed;
      left: 16px;
      right: 16px;
      bottom: 16px;
      max-width: 480px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 8px;
      background: #2b2e89;
      color: white;
      box-shadow: 0 2px 8px #0006;
    }
    span {
      flex: 1;
    }
    button {
      font: inherit;
      padding: 6px 12px;
    }
    .icon {
      vertical-align: -0.15em;
      margin-right: 4px;
    }
  `;

  @state() private waiting = false;

  private updateSW?: (reload?: boolean) => Promise<void>;

  connectedCallback() {
    super.connectedCallback();
    if (!('serviceWorker' in navigator) || this.updateSW) return;
    this.updateSW = registerSW({ onNeedRefresh: () => (this.waiting = true) });
  }

  render() {
    if (!this.waiting) return '';
    return html`<div role="status">
      <span>A new version is available.</span>
      <button @click=${() => this.updateSW?.(true)}>${icon(RefreshCw)}Reload</button>
      <button aria-label="Later" @click=${() => (this.waiting = false)}>Later</button>
    </div>`;
  }
}
