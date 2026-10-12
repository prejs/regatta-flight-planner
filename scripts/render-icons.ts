// Renders the PNG app icons from public/assets/icons/logo.svg.
//   npm run icons
//
// Two variants come out of the one source:
// - round: the logo as drawn, transparent corners (favicon, manifest "any").
// - square: the gradient fills the whole square and the sails shrink to 80%, so they
//   sit inside the maskable safe zone (manifest "maskable") and iOS has no
//   transparent corners to fill with black (apple-touch-icon).
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

const outputs: { file: string; size: number; svg: string }[] = [
  ...[24, 48, 192, 512].map((size) => ({ file: `${size}x${size}.png`, size, svg: round })),
  ...[192, 512].map((size) => ({ file: `maskable-${size}x${size}.png`, size, svg: square })),
  { file: 'apple-touch-icon.png', size: 180, svg: square },
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const { file, size, svg } of outputs) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`
    );
    await page.locator('svg').screenshot({ path: `${dir}/${file}`, omitBackground: true });
    console.log(`${dir}/${file}`);
  }
  await browser.close();
}

main();
