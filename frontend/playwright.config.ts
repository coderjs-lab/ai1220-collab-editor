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
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: [
    {
      command:
        "cd ../backend && rm -f data/playwright-editor.db data/playwright-yupdates.db && JWT_SECRET='playwright-secret-key-with-safe-length-123456' DB_PATH=./data/playwright-editor.db YSTORE_PATH=./data/playwright-yupdates.db CORS_ORIGIN='http://127.0.0.1:4173,http://localhost:4173' WS_BASE_URL='ws://127.0.0.1:4001/ws/collab' AI_PROVIDER='stub' AI_MODEL='draftboard-stub-v1' .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 4001",
      port: 4001,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "VITE_API_BASE_URL='http://127.0.0.1:4001/api' npm run dev -- --host 127.0.0.1 --port 4173",
      port: 4173,
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
