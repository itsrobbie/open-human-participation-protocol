import { test, expect } from '@playwright/test'
import { BANK_URL, INSURANCE_URL, PORTAL_URL } from '../test-urls'

test.describe.serial('Insurance Claims — browser journey', () => {
  test('valid login opens the claims workspace', async ({ page }) => {
    await page.goto(INSURANCE_URL)
    await page.fill('#username', 'demo')
    await page.fill('#password', 'demo')
    await page.click('#login-form button[type="submit"]')

    await expect(page.locator('#app')).toBeVisible()
    await expect(page.locator('#app h1').filter({ hasText: 'Insurance Claims' })).toBeVisible()
    await expect(page.locator('#claim-summary')).toContainText('0 total claims')
    await expect(page.locator('#policy-summary')).toContainText('POL-0001')
    await expect(page.locator('#policy-summary')).toContainText('£10,000.00 coverage')
    await expect(page.getByRole('navigation', { name: 'Insurance Claims' })).toContainText('OHPP settings')
  })

  test('invalid login remains on the sign-in surface', async ({ page }) => {
    await page.goto(INSURANCE_URL)
    await page.fill('#username', 'demo')
    await page.fill('#password', 'wrong-password')
    await page.click('#login-form button[type="submit"]')

    await expect(page.locator('#login')).toBeVisible()
    await expect(page.locator('#login-result')).toContainText('Invalid demo credentials')
  })

  test('logout clears the Insurance Claims session', async ({ page }) => {
    await signIn(page)
    await page.click('#logout-button')

    await expect(page.locator('#login')).toBeVisible()
    await expect(page.locator('#app')).toBeHidden()
    await expect(page.evaluate(() => sessionStorage.getItem('ohpp-insurance-token'))).resolves.toBeNull()
  })

  test('expired session returns to sign-in', async ({ page }) => {
    await signIn(page)
    await page.evaluate(() => sessionStorage.setItem('ohpp-insurance-token', 'expired.invalid.token'))
    await page.reload()

    await expect(page.locator('#login')).toBeVisible()
    await expect(page.locator('#login-result')).toContainText('session has expired')
  })

  test('Bank realm token is rejected by Insurance Claims', async ({ page }) => {
    await page.goto(BANK_URL)
    const bankToken = await page.evaluate(() => localStorage.getItem('ohpp-bank-access-token'))
    expect(bankToken).toBeTruthy()

    await page.goto(INSURANCE_URL)
    await page.evaluate((value) => sessionStorage.setItem('ohpp-insurance-token', value!), bankToken)
    await page.reload()

    await expect(page.locator('#login')).toBeVisible()
    await expect(page.locator('#login-result')).toContainText('session has expired')
  })

  test('Insurance Claims realm token is rejected by Bank', async ({ page }) => {
    await signIn(page)
    const insuranceToken = await page.evaluate(() => sessionStorage.getItem('ohpp-insurance-token'))
    expect(insuranceToken).toBeTruthy()

    await page.goto(BANK_URL)
    await page.evaluate((value) => localStorage.setItem('ohpp-bank-access-token', value!), insuranceToken)
    await page.reload()

    await expect(page.locator('#login-card')).toBeVisible()
    await expect(page.locator('#login-result')).toContainText('session has expired')
  })

  test('future incident date is rejected visibly', async ({ page }) => {
    await signIn(page)
    await page.click('[data-testid="nav-new-claim"]')
    await page.fill('#date', '2099-01-01')
    await page.fill('#description', 'Future incident should be rejected')
    await page.fill('#amount', '100')
    await page.click('#claim-form button[type="submit"]')

    await expect(page.locator('#claim-result')).toContainText('future')
  })

  test('valid claim is submitted and survives reload', async ({ page }) => {
    await signIn(page)
    await page.click('[data-testid="nav-new-claim"]')
    await page.fill('#date', '2026-07-30')
    await page.fill('#description', 'Water damage in the kitchen')
    await page.fill('#amount', '1250')
    await page.click('#claim-form button[type="submit"]')

    await expect(page.locator('#claim-result')).toContainText('submitted')
    await page.reload()
    await expect(page.locator('#app')).toBeVisible()
    await page.click('[data-testid="nav-claim-history"]')
    const claim = page.locator('.claim-card', { hasText: 'Water damage in the kitchen' })
    await expect(claim).toContainText('Demo User')
    await expect(claim).toContainText('POL-0001')
    await expect(claim).toContainText('30 July 2026')
    await expect(claim).toContainText('£1,250.00')
    await expect(claim).toContainText('Timeline')
    await page.click('[data-testid="nav-dashboard"]')
    await expect(page.locator('#claim-summary')).toContainText('1 total claim')

    await page.click('[data-testid="nav-claim-history"]')
    await page.locator('#claim-status-filter').selectOption('Submitted')
    await expect(claim).toBeVisible()
    await page.locator('#claim-status-filter').selectOption('Expired')
    await expect(claim).toBeHidden()
    await expect(page.locator('#claims-empty')).toContainText('No claims match this filter')
    await page.locator('#claim-status-filter').selectOption('All')
  })

  test('complete claim entry can be saved as a draft and submitted separately', async ({ page }) => {
    await signIn(page)
    await page.click('[data-testid="nav-new-claim"]')
    await page.locator('[data-testid="claim-policy"]').selectOption('policy-1')
    await page.locator('[data-testid="claim-incident-date"]').fill('2026-07-29')
    await page.locator('[data-testid="claim-incident-at"]').fill('2026-07-29T08:45')
    await page.locator('[data-testid="claim-description"]').fill('Draft kitchen water damage')
    await page.locator('[data-testid="claim-note"]').fill('Stopcock isolated before arrival.')
    await page.locator('[data-testid="claim-affected-building"]').check()
    await page.locator('[data-testid="claim-affected-contents"]').check()
    await page.locator('[data-testid="claim-amount"]').fill('875')
    await page.locator('[data-testid="save-claim-draft"]').click()

    await expect(page.locator('#claim-result')).toContainText('Draft saved')
    await page.click('[data-testid="nav-claim-history"]')
    const draft = page.locator('.claim-card', { hasText: 'Draft kitchen water damage' })
    await expect(draft).toContainText('Status: Draft')
    await expect(draft).toContainText('29 Jul 2026, 08:45')
    await expect(draft).toContainText('Stopcock isolated before arrival.')
    await expect(draft).toContainText('Building, Contents')
    await draft.getByRole('button', { name: 'Submit draft' }).click()
    await expect(draft).toContainText('Status: Submitted')
  })

  test('claim registration and participation complete through the Portal UI', async ({ page, context }) => {
    await signIn(page)
    await page.click('[data-testid="nav-ohpp-settings"]')
    await page.click('#generate-challenge')
    await expect(page.locator('#challenge-uri')).toHaveValue(/ohpp:\/\/register\?challenge=/)
    const challenge = await page.locator('#challenge-uri').inputValue()

    const portal = await context.newPage()
    await portal.goto(`${PORTAL_URL}/login`)
    await portal.fill('input[placeholder="demo"]', 'demo')
    await portal.fill('input[type="password"]', 'demo')
    await portal.click('button[type="submit"]')
    await expect(portal).toHaveURL(PORTAL_URL + '/')

    await portal.click('nav >> text=Devices')
    const enable = portal.getByRole('button', { name: 'Enable web approvals' })
    const activeBrowser = portal.getByRole('button', { name: 'Revoke This browser' })
    await expect(enable.or(activeBrowser)).toBeVisible()
    if (await enable.isVisible()) {
      await enable.click()
      await expect(portal.getByText('Browser registered', { exact: true })).toBeVisible({ timeout: 10000 })
    } else {
      await expect(activeBrowser).toBeVisible()
    }

    await portal.click('nav >> text=Connect App')
    await portal.fill('textarea', challenge)
    await portal.click('button:has-text("Connect app")')
    await expect(portal.locator('.bg-green-50')).toContainText('App registered', { timeout: 15000 })

    await page.click('#refresh-connection')
    await expect(page.locator('#ohpp-status')).toContainText('Connected')

    await page.click('[data-testid="nav-new-claim"]')
    await page.fill('#date', '2026-07-30')
    await page.fill('#description', 'Participation workflow claim')
    await page.fill('#amount', '500')
    await page.click('#claim-form button[type="submit"]')
    await page.click('[data-testid="nav-claim-history"]')
    const claimCard = page.locator('.claim-card', { hasText: 'Participation workflow claim' })
    await expect(claimCard).toBeVisible()
    await claimCard.locator('select').selectOption('SelectDisposition')
    await claimCard.getByRole('button', { name: 'Request human participation' }).click()
    await expect(claimCard).toContainText('AwaitingParticipation')

    await portal.click('nav >> text=Pending')
    await expect(portal.getByText(/^Insurance claim CLM-/)).toBeVisible({ timeout: 15000 })
    await portal.getByRole('button', { name: 'Continue', exact: true }).click()

    const refreshedCard = page.locator('.claim-card', { hasText: 'Participation workflow claim' })
    await refreshedCard.getByRole('button', { name: 'Refresh participation status' }).click()
    await expect(refreshedCard).toContainText('ApprovedForNextStep', { timeout: 15000 })
    await expect(refreshedCard).toContainText('Answer: continue')
    await portal.close()
  })

  test('all remaining protocol types are interpreted by the Insurance Claims app', async ({ page, context }) => {
    test.setTimeout(120_000)
    await signIn(page)

    const portal = await context.newPage()
    await portal.goto(`${PORTAL_URL}/login`)
    await portal.fill('input[placeholder="demo"]', 'demo')
    await portal.fill('input[type="password"]', 'demo')
    await portal.click('button[type="submit"]')
    await ensureCurrentBrowserApprovals(portal)

    const scenarios = [
      { scenario: 'AffectedItems', prompt: 'Select each item involved in the claim.', expectedStatus: 'InReview', kind: 'multiselect', value: 'building, contents' },
      { scenario: 'ClaimantNote', prompt: 'Provide any additional information for the claim reviewer.', expectedStatus: 'MoreInformationRequired', kind: 'value', value: 'Additional claimant detail' },
      { scenario: 'EstimatedAmount', prompt: 'Enter the current estimated amount for the claim.', expectedStatus: 'InReview', kind: 'value', value: '800' },
      { scenario: 'IncidentDate', prompt: 'Enter the date on which the incident occurred.', expectedStatus: 'InReview', kind: 'value', value: '2026-07-29' },
      { scenario: 'AdjusterAppointment', prompt: 'Select a date and time for the adjuster appointment.', expectedStatus: 'InReview', kind: 'value', value: '2026-08-01T10:30' },
      { scenario: 'ClaimantDeclaration', prompt: 'Confirm the claimant declaration for this claim.', expectedStatus: 'ApprovedForNextStep', kind: 'signature', value: 'acknowledged' },
    ] as const

    for (const item of scenarios) {
      const description = `Browser interpretation ${item.scenario}`
      await page.click('[data-testid="nav-new-claim"]')
      await page.fill('#date', '2026-07-30')
      await page.fill('#description', description)
      await page.fill('#amount', '500')
      await page.click('#claim-form button[type="submit"]')
      await page.click('[data-testid="nav-claim-history"]')
      const card = page.locator('.claim-card', { hasText: description })
      await card.locator('select').selectOption(item.scenario)
      await card.getByRole('button', { name: 'Request human participation' }).click()

      await portal.click('nav >> text=Pending')
      const prompt = portal.getByText(item.prompt, { exact: true })
      await expect(prompt).toBeVisible({ timeout: 15_000 })
      const pendingCard = prompt.locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
      if (item.kind === 'multiselect') {
        await pendingCard.locator('input[type="checkbox"]').nth(0).check()
        await pendingCard.locator('input[type="checkbox"]').nth(1).check()
        await pendingCard.getByRole('button', { name: 'Submit', exact: true }).click()
      } else if (item.kind === 'signature') {
        await pendingCard.getByRole('button', { name: 'I acknowledge' }).click()
      } else {
        await pendingCard.locator('input').fill(item.value)
        await pendingCard.getByRole('button', { name: 'Submit', exact: true }).click()
      }
      await expect(prompt).toBeHidden({ timeout: 10_000 })

      await card.getByRole('button', { name: 'Refresh participation status' }).click()
      await expect(card).toContainText(item.expectedStatus, { timeout: 15_000 })
      await expect(card).toContainText(item.value)
    }

    await page.click('[data-testid="nav-ohpp-settings"]')
    await page.getByTestId('disconnect-ohpp').click()
    await expect(page.locator('#ohpp-status')).toContainText('Not connected')
    await expect(page.locator('#ohpp-result')).toContainText('credentials revoked')
    await page.getByTestId('generate-challenge').click()
    await expect(page.getByTestId('challenge-uri')).toHaveValue(/ohpp:\/\/register\?challenge=/)
    const reconnectChallenge = await page.getByTestId('challenge-uri').inputValue()
    await portal.click('nav >> text=Connect App')
    await portal.fill('textarea', reconnectChallenge)
    await portal.click('button:has-text("Connect app")')
    await expect(portal.locator('.bg-green-50')).toContainText('App registered', { timeout: 15_000 })
    await page.getByTestId('refresh-connection').click()
    await expect(page.locator('#ohpp-status')).toContainText('Connected')

    await portal.close()
  })

})

async function signIn(page: import('@playwright/test').Page) {
  await page.goto(INSURANCE_URL)
  await page.fill('#username', 'demo')
  await page.fill('#password', 'demo')
  await page.click('#login-form button[type="submit"]')
  await expect(page.locator('#app')).toBeVisible()
}

async function ensureCurrentBrowserApprovals(page: import('@playwright/test').Page) {
  await page.click('nav >> text=Devices')
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const revoke = page.getByRole('button', { name: /^Revoke/ }).first()
    if (!(await revoke.isVisible())) break
    await revoke.click()
    await page.locator('[role="dialog"]').getByRole('button', { name: 'Revoke' }).click()
    await expect(page.locator('[role="dialog"]')).toBeHidden()
    await page.waitForTimeout(300)
  }
  const enable = page.getByRole('button', { name: 'Enable web approvals' })
  const activeBrowser = page.getByRole('button', { name: 'Revoke This browser' })
  await expect(enable.or(activeBrowser)).toBeVisible()
  if (await enable.isVisible()) {
    await enable.click()
    await expect(page.getByText('Browser registered', { exact: true })).toBeVisible({ timeout: 10_000 })
  }
}
