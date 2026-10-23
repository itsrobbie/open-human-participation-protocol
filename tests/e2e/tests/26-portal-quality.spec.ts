import AxeBuilder from '@axe-core/playwright'
import { BrowserContext, expect, Page, test } from '@playwright/test'
import { PORTAL_URL } from '../test-urls'

async function login(page: Page) {
  await page.goto(`${PORTAL_URL}/login`)
  await page.fill('input[placeholder="demo"]', 'demo')
  await page.fill('input[type="password"]', 'demo')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(PORTAL_URL + '/')
}

async function ensureLabReady(page: Page, _context: BrowserContext) {
  await page.click('nav >> text=Devices')
  await expect(page.locator('h1')).toHaveText('Devices')
  const enable = page.getByRole('button', { name: 'Enable web approvals' })
  if (await enable.count()) {
    await enable.click()
    await expect(page.getByText('Browser registered', { exact: true })).toBeVisible({ timeout: 15_000 })
  }

  await page.click('nav >> text=Protocol Lab')
  await expect(page.getByTestId('protocol-lab')).toBeVisible()
  const enableForLab = page.getByRole('button', { name: 'Enable browser approvals' })
  if (await enableForLab.count()) {
    await enableForLab.click()
    await expect(page.getByRole('status')).toContainText('Browser approvals enabled', { timeout: 15_000 })
  }
  const registerLab = page.getByTestId('register-lab')
  if (await registerLab.count()) {
    await registerLab.click()
    await expect(page.getByRole('status')).toContainText('Protocol Lab registered', { timeout: 15_000 })
  }
  await expect(page.getByTestId('protocol-payload')).toBeVisible()
}

test.describe.serial('Portal quality evidence', () => {
  test.describe.configure({ timeout: 180_000 })

  test('Portal_Accessibility_AllProductionPagesHaveNoSeriousOrCriticalAxeViolations', async ({ page }) => {
    await login(page)
    for (const route of ['/', '/pending', '/history', '/devices', '/apps', '/register-app']) {
      await page.goto(`${PORTAL_URL}${route}`)
      await expect(page.locator('h1')).toBeVisible()
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      const blocking = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')
      expect(blocking, `${route}: ${blocking.map(({ id }) => id).join(', ')}`).toEqual([])
    }
  })

  test('Portal_ActiveSession_RefreshesBeforeAccessTokenExpiry', async ({ page }) => {
    await login(page)
    const refreshResponse = page.waitForResponse(response =>
      response.url().includes('/protocol/openid-connect/token') && response.request().postData()?.includes('grant_type=refresh_token') === true,
    )
    await page.evaluate(() => {
      const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 30 }))
        .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
      localStorage.setItem('ohpp_device_token', `header.${payload}.signature`)
    })
    await page.reload()

    expect((await refreshResponse).ok()).toBe(true)
    await expect(page).toHaveURL(PORTAL_URL + '/')
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('Portal_DeviceRegistration_DoubleActivationCreatesOneDevice', async ({ page }) => {
    await login(page)
    await page.click('nav >> text=Devices')
    // Wait for the devices list to be fully loaded before starting revocation loop
    await expect(page.locator('h1:has-text("Devices")')).toBeVisible()
    await page.waitForTimeout(500)

    let revokeButton = page.locator('button:has-text("Revoke")').first()
    while (await revokeButton.isVisible()) {
      await revokeButton.click()
      await page.locator('[role="dialog"] button:has-text("Revoke")').click()
      await expect(page.locator('[role="dialog"]')).toBeHidden()
      // Wait for the mutation to complete and the list to re-render
      await page.waitForTimeout(1000)
      revokeButton = page.locator('button:has-text("Revoke")').first()
    }

    const enable = page.getByRole('button', { name: 'Enable web approvals' })
    await enable.dblclick()
    await expect(page.getByText('Browser registered', { exact: true })).toBeVisible()
    await page.click('nav >> text=Devices')
    await expect(page.locator('button:has-text("Revoke")')).toHaveCount(1)
  })

  test('Portal_ApiUnavailable_ShowsRetryableErrorState', async ({ page }) => {
    await page.route('**/api/users/me/summary', route => route.abort('connectionrefused'))
    await login(page)
    await expect(page.getByText('Failed to load dashboard.')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('Portal_HistoryPagination_NextAndPreviousChangeVisibleRecords', async ({ page, context }) => {
    test.setTimeout(300_000)
    await login(page)
    await ensureLabReady(page, context)

    let priorRequestId: string | null = null
    for (let index = 0; index < 21; index++) {
      await page.getByRole('button', { name: 'Load Select preset' }).click()
      const payload = JSON.parse(await page.getByTestId('protocol-payload').inputValue())
      payload.action.summary = `Pagination request ${index.toString().padStart(2, '0')}`
      await page.getByTestId('protocol-payload').fill(JSON.stringify(payload, null, 2))
      await page.getByRole('button', { name: 'Send over protocol' }).click()
      await expect.poll(async () => page.getByTestId('protocol-request-id').textContent(), { timeout: 15_000 })
        .not.toBe(priorRequestId)
      priorRequestId = await page.getByTestId('protocol-request-id').textContent()
      await expect(page.getByTestId('protocol-status')).toContainText('pending')

      // Navigate to Pending page to resolve (protocol separation).
      // One request is pending per iteration, so the scheme option control is
      // unique; the stale non-scheme 'pending-select' testid never existed in
      // the portal source (pre-Phase-1.1 leftover) and strict-mode-violated.
      await page.click('nav >> text=Pending')
      const approve = page.getByTestId('ohpp.pending.option.approve')
      await approve.click()
      await approve.waitFor({ state: 'detached', timeout: 15_000 })

      // Navigate back to Lab to verify resolution and continue
      await page.click('nav >> text=Protocol Lab')
      await expect(page.getByTestId('protocol-status')).toContainText('resolved', { timeout: 15_000 })
    }

    await page.click('nav >> text=History')
    const firstPageText = await page.locator('main').textContent()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible()
    expect(await page.locator('main').textContent()).not.toBe(firstPageText)
    await page.getByRole('button', { name: 'Previous' }).click()
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible()
  })
})
