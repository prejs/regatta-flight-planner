import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:5173' },
  webServer: [
    {
      command: 'npx vite --port 5173 --strictPort',
      url: 'http://localhost:5173/verify/determinism.html',
      reuseExistingServer: !process.env.CI,
    },
    {
      // The production build, with its service worker (tests/offline.spec.ts).
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173/',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
});
