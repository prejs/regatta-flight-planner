// Service worker, bundled by vite-plugin-pwa (injectManifest). It precaches
// the build so the app works offline after one visit.

import { cleanupOutdatedCaches, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching';

// The DOM and WebWorker libs clash in one tsconfig, so type only what is used here.
// The build replaces the literal self.__WB_MANIFEST with the precache list.
declare const self: {
  __WB_MANIFEST: (string | PrecacheEntry)[];
  skipWaiting(): Promise<void>;
  addEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
};

// The page asks for this when the user accepts an update (update-banner).
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
