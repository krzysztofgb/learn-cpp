import { defineConfig, devices } from '@playwright/test';

// Runs against the production build: the compiler assets are what ship.
export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  expect: { timeout: 120_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  // Set BASE_PATH (e.g. /learn-cpp/) to test the app as it's served from a subpath.
  use: { baseURL: `http://localhost:4173${process.env.BASE_PATH ?? '/'}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: `http://localhost:4173${process.env.BASE_PATH ?? '/'}`,
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
  },
});
