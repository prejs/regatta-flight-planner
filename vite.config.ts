import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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
