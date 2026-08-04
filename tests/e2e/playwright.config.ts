import { defineConfig } from '@playwright/test'
import { resolve } from 'path'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  workers: 1, // Sequential — bank uses in-memory state shared across tests
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: 'http://localhost:3100',
    storageState: resolve(__dirname, '.auth-state.json'),
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/27-portal-mobile.spec.ts',
      use: { browserName: 'chromium' },
    },
    {
      name: 'mobile-chromium',
      testMatch: '**/27-portal-mobile.spec.ts',
      use: { browserName: 'chromium', viewport: { width: 375, height: 812 } },
    },
  ],
})
