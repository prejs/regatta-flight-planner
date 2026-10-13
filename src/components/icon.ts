import { html } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import type { IconNode } from 'lucide';

// Lucide icons as inline SVG. Import only the icons you use from 'lucide' so
// the build keeps just those. Icons are decoration: give the control or text
// next to them its own accessible name.

const escape = (v: string | number) =>
  String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const markup = new WeakMap<IconNode, string>();

function toMarkup(node: IconNode): string {
  let s = markup.get(node);
  if (s === undefined) {
    s = node
      .map(([tag, attrs]) => {
        const a = Object.entries(attrs)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => ` ${k}="${escape(v!)}"`)
          .join('');
        return `<${tag}${a}/>`;
      })
      .join('');
    markup.set(node, s);
  }
  return s;
}

/** An icon at the current font size, in the current text colour. */
export function icon(node: IconNode, className = 'icon') {
  return html`<svg class=${className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${unsafeSVG(toMarkup(node))}</svg>`;
}
