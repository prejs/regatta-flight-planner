import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

/**
 * A tooltip for the slotted content: shown on hover, on keyboard focus of
 * something inside, and on tap. The bubble is visual only (aria-hidden), so
 * put the same information in the content for screen readers, for example
 * as screen-reader text. It sits in the top layer, so scrolling containers
 * don't clip it.
 */
@customElement('app-tip')
export class AppTip extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
    }
    [popover] {
      position: fixed;
      inset: auto;
      margin: 0;
      max-width: min(280px, calc(100vw - 16px));
      padding: 6px 10px;
      border: none;
      border-radius: 6px;
      background: var(--tip-bg);
      color: var(--tip-text);
      font: 500 var(--fs-sm) / 1.3 var(--font-family);
      text-align: left;
      white-space: normal;
      box-shadow: 0 4px 16px #0003;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.12s;
    }
    [popover]:popover-open {
      opacity: 1;
    }
    @starting-style {
      [popover]:popover-open {
        opacity: 0;
      }
    }
  `;

  @property() text = '';

  @query('[popover]') private bubble!: HTMLElement;

  private timer = 0;
  private open = false;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('pointerenter', this.onEnter);
    this.addEventListener('pointerleave', this.hide);
    this.addEventListener('pointerup', this.onTap);
    this.addEventListener('focusin', this.onFocus);
    this.addEventListener('focusout', this.hide);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.hide();
  }

  render() {
    return html`<slot></slot><div popover="manual" aria-hidden="true">${this.text}</div>`;
  }

  private onEnter = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(this.show, 300);
  };

  private onTap = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    if (this.open) return this.hide();
    this.show();
    clearTimeout(this.timer);
    this.timer = window.setTimeout(this.hide, 3000);
  };

  private onFocus = () => {
    if (this.matches(':has(:focus-visible)')) this.show();
  };

  private show = () => {
    if (!this.text || this.open || !this.bubble?.showPopover) return;
    this.bubble.showPopover();
    this.open = true;
    this.place();
    // A stale position is worse than none.
    window.addEventListener('scroll', this.hide, { capture: true, passive: true });
    document.addEventListener('pointerdown', this.onOutside, { capture: true });
    document.addEventListener('keydown', this.onKey);
  };

  private hide = () => {
    clearTimeout(this.timer);
    if (!this.open) return;
    this.open = false;
    this.bubble.hidePopover();
    window.removeEventListener('scroll', this.hide, { capture: true });
    document.removeEventListener('pointerdown', this.onOutside, { capture: true });
    document.removeEventListener('keydown', this.onKey);
  };

  private onOutside = (e: PointerEvent) => {
    if (!e.composedPath().includes(this)) this.hide();
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.hide();
  };

  /** Above the content, centred, kept inside the viewport; below when there is no room above. */
  private place() {
    const gap = 6;
    const margin = 8;
    const a = this.getBoundingClientRect();
    const b = this.bubble.getBoundingClientRect();
    let top = a.top - b.height - gap;
    if (top < margin) top = a.bottom + gap;
    const left = Math.min(Math.max(a.left + a.width / 2 - b.width / 2, margin), window.innerWidth - b.width - margin);
    this.bubble.style.top = `${top}px`;
    this.bubble.style.left = `${left}px`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-tip': AppTip;
  }
}
