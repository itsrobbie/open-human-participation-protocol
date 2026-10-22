import type { Page, Locator } from '@playwright/test'

/**
 * Page-object + determinism base for the validation framework (P1-P3).
 *
 * - P1 addressability: every lookup is by `data-testid`, never text/order.
 * - P2 determinism: `waitForTestId` waits UNTIL a keyed element is attached &
 *   visible, with a bounded timeout and a descriptive failure - never a sleep.
 * - P3 one driver per role: page objects extend BasePage; tests call intent
 *   methods on them, not raw selectors.
 *
 * data-testid scheme: `ohpp.<area>.<element>.<id>` (see tests/VALIDATION-FRAMEWORK.md).
 * A few pre-existing surfaces use bare testids (e.g. bank `confirm-transfer`);
 * page objects for those pass the bare id explicitly - still stable, not text.
 */

export const DEFAULT_TIMEOUT = 15_000

/** Locate by data-testid (exact). */
export function byTestId(page: Page, testid: string): Locator {
  return page.locator(`[data-testid="${testid}"]`)
}

/**
 * Wait until a keyed element exists and is visible. Deterministic replacement
 * for any fixed sleep. Throws a descriptive error on timeout.
 */
export async function waitForTestId(
  page: Page,
  testid: string,
  opts: { timeout?: number } = {},
): Promise<Locator> {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT
  const loc = byTestId(page, testid)
  try {
    await loc.first().waitFor({ state: 'visible', timeout })
  } catch {
    throw new Error(
      `waitForTestId timed out after ${timeout}ms waiting for data-testid="${testid}". ` +
        `The element never became visible. Check the testid (P1 scheme ` +
        `ohpp.<area>.<element>.<id>) or whether the surface rendered.`,
    )
  }
  return loc.first()
}

export class BasePage {
  constructor(
    protected readonly page: Page,
    protected readonly baseUrl: string,
  ) {}

  /** data-testid locator on this page. */
  testid(id: string): Locator {
    return byTestId(this.page, id)
  }

  /** Wait-until a keyed element is visible (P2). */
  waitFor(id: string, opts?: { timeout?: number }): Promise<Locator> {
    return waitForTestId(this.page, id, opts)
  }

  /** Click a keyed element after waiting for it (P2+P3). */
  async clickTestId(id: string, opts?: { timeout?: number }): Promise<void> {
    const el = await this.waitFor(id, opts)
    await el.click()
  }

  /** Fill a keyed input after waiting for it. */
  async fillTestId(id: string, value: string, opts?: { timeout?: number }): Promise<void> {
    const el = await this.waitFor(id, opts)
    await el.fill(value)
  }

  async goto(path = '/'): Promise<void> {
    await this.page.goto(new URL(path, this.baseUrl).toString())
  }
}
