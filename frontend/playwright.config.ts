import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        "cd ../backend && rm -f data/playwright-editor.db data/playwright-yupdates.db && JWT_SECRET='playwright-secret-key-with-safe-length-123456' DB_PATH=./data/playwright-editor.db YSTORE_PATH=./data/playwright-yupdates.db CORS_ORIGIN='http://127.0.0.1:5173,http://localhost:5173' WS_BASE_URL='ws://127.0.0.1:3001/ws/collab' .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 3001",
      port: 3001,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      port: 5173,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
  ],
});
