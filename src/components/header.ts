import { LitElement, css, html } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import { resolveRouterPath } from '../router';

/**
 * The app bar: logo and title, later the views. Fills the title bar area when
 * installed with window controls overlay, and clears the notch on phones.
 */
@customElement('app-header')
export class AppHeader extends LitElement {
  @property({ type: String }) title = 'Regatta Flight Planner';

  static styles = css`
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: max(56px, env(titlebar-area-height, 0px));
      box-sizing: border-box;
      padding: env(safe-area-inset-top, 0px) var(--gutter) 0;
      padding-left: max(var(--gutter), env(titlebar-area-x, 0px) + var(--gutter), env(safe-area-inset-left, 0px));
      /* Leave the window controls to the right of the title bar area free. */
      padding-right: calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + var(--gutter));
      background: color-mix(in srgb, var(--surface) 85%, transparent);
      backdrop-filter: saturate(1.8) blur(12px);
      -webkit-backdrop-filter: saturate(1.8) blur(12px);
      border-bottom: 1px solid var(--border);
      -webkit-app-region: drag;
    }
    a {
      display: flex;
      align-items: center;
      gap: 10px;
      color: inherit;
      text-decoration: none;
      -webkit-app-region: no-drag;
    }
    img {
      width: 32px;
      height: 32px;
    }
    h1 {
      margin: 0;
      font-size: var(--fs-lg);
      font-weight: 650;
      letter-spacing: -0.01em;
    }
  `;

  render() {
    return html`
      <header>
        <a href=${resolveRouterPath()}>
          <img src=${resolveRouterPath('assets/icons/logo.svg')} alt="" />
          <h1>${this.title}</h1>
        </a>
      </header>
    `;
  }
}
