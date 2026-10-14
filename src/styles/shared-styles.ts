import { css } from 'lit';

// Styles shared by the components: icons next to text, cards, screen-reader text.
export const styles = css`
  .icon {
    vertical-align: -0.15em;
    margin-right: 6px;
    flex: none;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
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
