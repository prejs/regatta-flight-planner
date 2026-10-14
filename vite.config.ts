import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * `virtual:solver-id`: a hash of the solver source. Plans saved on the device
 * are dropped when it changes, since algorithm version 0 may still change.
 * Editing the solver in dev reloads the page with a new id.
 */
function solverId(): Plugin {
  const id = 'virtual:solver-id';
  const files = () => [
    ...readdirSync('src/solver')
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map((f) => resolve('src/solver', f)),
    resolve('src/plan/url.ts'),
  ];
  return {
    name: 'solver-id',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load(resolved) {
      if (resolved !== `\0${id}`) return;
      const hash = createHash('sha256');
      for (const file of files().sort()) {
        this.addWatchFile(file);
        hash.update(readFileSync(file));
      }
      return `export default ${JSON.stringify(hash.digest('hex').slice(0, 12))};`;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  build: {
    sourcemap: true,
    assetsDir: "code",
    target: ["esnext"],
    cssMinify: true,
    lib: false,
    // Notices of bundled packages (Lit, Lucide, Workbox), served as /licenses.md.
    license: { fileName: 'licenses.md' }
  },
  plugins: [
    solverId(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        // Only what the page itself loads. The manifest's large icons are fetched
        // by the OS when the app is installed, which needs a connection anyway.
        globPatterns: [
          '**/*.{html,js,css,json,svg}',
          'assets/icons/48x48.png',
          'assets/icons/apple-touch-icon.png',
        ],
      },
      // Registered in src/app-index.ts, which also shows the update prompt.
      injectRegister: false,
      registerType: "prompt",
      manifest: false,
      // No service worker in dev: it would serve stale modules. Offline is tested on the build.
      devOptions: {
        enabled: false
      }
    })
  ]
})
