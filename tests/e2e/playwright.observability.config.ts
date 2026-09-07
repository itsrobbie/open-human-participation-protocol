import { defineConfig } from '@playwright/test'

/**
 * Dev-stack observability sweep config (U7.1 Phase 10, Step 27a).
 *
 * Deliberately SEPARATE from playwright.config.ts:
 *  - No globalSetup/globalTeardown: this runs against the ALREADY-RUNNING dev
 *    stack (`make dev` + `make dev-analytics`), it does not spin up/tear down the
 *    isolated test stack.
 *  - Points at dev ports (see dev-observability-urls.ts), not the test stack.
 *  - Single worker, generous timeout: it drives real ceremonies then polls the
 *    observability backends (which ingest asynchronously).
 */
export default defineConfig({
  testDir: './observability',
  timeout: 180_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: true,
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'observability', use: { browserName: 'chromium' } }],
})
