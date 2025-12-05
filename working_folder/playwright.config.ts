import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run dev -- --host --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_E2E: 'true'
    }
  }
})
