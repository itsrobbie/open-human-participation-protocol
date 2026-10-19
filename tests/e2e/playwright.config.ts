import { defineConfig } from '@playwright/test'
import { resolve } from 'path'

// U9: baseURL derives from the worktree's STACK_ID (the Makefile exports
// OHPP_PORT_PORTAL into .stack.env). Stack 0 = today's 3000; ids 1..15 banded.
const portalPort = Number.parseInt(process.env.OHPP_PORT_PORTAL ?? '', 10)
const baseURL = `http://localhost:${Number.isFinite(portalPort) ? portalPort : 3000}`

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  workers: 1, // Sequential — bank uses in-memory state shared across tests
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL,
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
