// Renders the PNG app icons and the GitHub social preview from public/assets/icons/logo.svg.
//   npm run icons
//
// Two variants come out of the one source:
// - round: the logo as drawn, transparent corners (favicon, manifest "any").
// - square: the gradient fills the whole square and the sails shrink to 80%, so they
//   sit inside the maskable safe zone (manifest "maskable") and iOS has no
//   transparent corners to fill with black (apple-touch-icon).
// The social preview (docs/social-preview.png) is uploaded by hand in the repo's
// Settings > General > Social preview; GitHub doesn't read it from the repo.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const dir = 'public/assets/icons';
const round = readFileSync(`${dir}/logo.svg`, 'utf8');

function replaceOnce(svg: string, from: string, to: string): string {
  if (svg.split(from).length !== 2) throw new Error(`logo.svg: expected exactly one ${from}`);
  return svg.replace(from, to);
}

let square = replaceOnce(round, '<circle cx="256" cy="256" r="256"', '<rect width="512" height="512"');
square = replaceOnce(square, '<g fill="#fff">', '<g fill="#fff" transform="translate(256 256) scale(0.8) translate(-256 -256)">');

// 1280x640, GitHub's recommended size: the logo's gradient fills the card, its sails sit
// left of the name. Everything stays well inside the edges, which GitHub may crop.
const defs = round.match(/<defs>[\s\S]*<\/defs>/)![0];
const sails = round.match(/<g fill="#fff">[\s\S]*?<\/g>/)![0];
const social = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640">
  ${defs}
  <rect width="1280" height="640" fill="url(#bg)"/>
  <g transform="translate(110 112) scale(0.85)">${sails}</g>
  <g fill="#fff" font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif">
    <text x="560" y="290" font-size="84" font-weight="700">Regatta</text>
    <text x="560" y="385" font-size="84" font-weight="700">Flight Planner</text>
    <text x="562" y="450" font-size="30" opacity="0.85">Fair flight plans for fleet regattas</text>
  </g>
</svg>`;

const outputs: { file: string; width: number; height: number; svg: string }[] = [
  ...[24, 48, 192, 512].map((size) => ({ file: `${dir}/${size}x${size}.png`, width: size, height: size, svg: round })),
  ...[192, 512].map((size) => ({ file: `${dir}/maskable-${size}x${size}.png`, width: size, height: size, svg: square })),
  { file: `${dir}/apple-touch-icon.png`, width: 180, height: 180, svg: square },
  { file: 'docs/social-preview.png', width: 1280, height: 640, svg: social },
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const { file, width, height, svg } of outputs) {
    await page.setViewportSize({ width, height });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${width}px;height:${height}px}</style>${svg}`
    );
    await page.locator('svg').screenshot({ path: file, omitBackground: true });
    console.log(file);
  }
  await browser.close();
}

main();
