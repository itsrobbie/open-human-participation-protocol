import { expect, test } from '@playwright/test'
import { BANK_URL } from '../test-urls'
import { InsuranceUiPage } from '../pages/insurance-ui'
import { PortalPage } from '../pages/portal'
import { PortalAttester, type StepAnswer } from '../pages/portal-attester'
import { BankUiPage } from '../pages/bank-ui'

/**
 * Insurance Claims browser journey — converted to page objects (Phase 4.1).
 * Insurance UI via InsuranceUiPage (keyed testids + stable #id state
 * containers); portal setup + participation via PortalPage / PortalAttester.
 * Cross-realm token checks keep their sessionStorage/localStorage evals (test
 * infra, not UI logic).
 */
test.describe.serial('Insurance Claims — browser journey', () => {
  test('valid login opens the claims workspace', async ({ page }) => {
    const ins = new InsuranceUiPage(page)
    await ins.login()

    await expect(ins.appShell()).toBeVisible()
    await expect(ins.claimSummary()).toContainText('0 total claims')
    await expect(ins.policySummary()).toContainText('POL-0001')
    await expect(ins.policySummary()).toContainText('£10,000.00 coverage')
  })

  test('invalid login remains on the sign-in surface', async ({ page }) => {
    const ins = new InsuranceUiPage(page)
    await ins.submitLogin('demo', 'wrong-password')

    await expect(ins.loginScreen()).toBeVisible()
    await expect(ins.loginResult()).toContainText('Invalid demo credentials')
  })

  test('logout clears the Insurance Claims session', async ({ page }) => {
    const ins = new InsuranceUiPage(page)
    await ins.login()
    await ins.logout()

    await expect(ins.loginScreen()).toBeVisible()
    await expect(ins.appShell()).toBeHidden()
    await expect(ins.getToken()).resolves.toBeNull()
  })

  test('expired session returns to sign-in', async ({ page }) => {
    const ins = new InsuranceUiPage(page)
    await ins.login()
    await ins.setToken('expired.invalid.token')
    await page.reload()

    await expect(ins.loginScreen()).toBeVisible()
    await expect(ins.loginResult()).toContainText('session has expired')
  })

  test('Bank realm token is rejected by Insurance Claims', async ({ page }) => {
    const bank = new BankUiPage(page)
    await bank.gotoAndWaitLoaded()
    const bankToken = await page.evaluate(() => localStorage.getItem('ohpp-bank-access-token'))
    expect(bankToken).toBeTruthy()

    const ins = new InsuranceUiPage(page)
    await ins.goto()
    await ins.setToken(bankToken!)
    await page.reload()

    await expect(ins.loginScreen()).toBeVisible()
    await expect(ins.loginResult()).toContainText('session has expired')
  })

  test('Insurance Claims realm token is rejected by Bank', async ({ page }) => {
    const ins = new InsuranceUiPage(page)
    await ins.login()
    const insuranceToken = await ins.getToken()
    expect(insuranceToken).toBeTruthy()

    await page.goto(BANK_URL)
    await page.evaluate((value) => localStorage.setItem('ohpp-bank-access-token', value!), insuranceToken)
    await page.reload()

    await expect(page.locator('#login-card')).toBeVisible()
    await expect(page.locator('#login-result')).toContainText('session has expired')
  })

  test('future incident date is rejected visibly', async ({ page }) => {
    const ins = new InsuranceUiPage(page)
    await ins.login()
    await ins.createClaim({
      incidentDate: '2099-01-01',
      description: 'Future incident should be rejected',
      amount: '100',
    })
    await expect(ins.claimResult()).toContainText('future')
  })

  test('valid claim is submitted and survives reload', async ({ page }) => {
    const ins = new InsuranceUiPage(page)
    await ins.login()
    await ins.createClaim({
      incidentDate: '2026-07-30',
      description: 'Water damage in the kitchen',
      amount: '1250',
    })

    await expect(ins.claimResult()).toContainText('submitted')
    await page.reload()
    await expect(ins.appShell()).toBeVisible()
    await ins.nav('claim-history')
    const { card } = await ins.cardByReference('Water damage in the kitchen')
    await expect(card).toContainText('Demo User')
    await expect(card).toContainText('POL-0001')
    await expect(card).toContainText('30 July 2026')
    await expect(card).toContainText('£1,250.00')
    await expect(card).toContainText('Timeline')
    await ins.nav('dashboard')
    await expect(ins.claimSummary()).toContainText('1 total claim')

    await ins.nav('claim-history')
    await ins.filterBy('Submitted')
    await expect(card).toBeVisible()
    await ins.filterBy('Expired')
    await expect(card).toBeHidden()
    await expect(ins.claimsEmpty()).toContainText('No claims match this filter')
    await ins.filterBy('All')
  })

  test('complete claim entry can be saved as a draft and submitted separately', async ({ page }) => {
    const ins = new InsuranceUiPage(page)
    await ins.login()
    await ins.nav('new-claim')
    await ins.fillClaim({
      policy: 'policy-1',
      incidentDate: '2026-07-29',
      incidentAt: '2026-07-29T08:45',
      description: 'Draft kitchen water damage',
      note: 'Stopcock isolated before arrival.',
      affected: ['building', 'contents'],
      amount: '875',
    })
    await ins.saveDraft()

    await expect(ins.claimResult()).toContainText('Draft saved')
    await ins.nav('claim-history')
    const draft = await ins.cardByReference('Draft kitchen water damage')
    await expect(draft.card).toContainText('Status: Draft')
    await expect(draft.card).toContainText('29 Jul 2026, 08:45')
    await expect(draft.card).toContainText('Stopcock isolated before arrival.')
    await expect(draft.card).toContainText('Building, Contents')
    await draft.submitDraft()
    await expect(draft.card).toContainText('Status: Submitted')
  })

  test('claim registration and participation complete through the Portal UI', async ({ page, context }) => {
    const ins = new InsuranceUiPage(page)
    await ins.login()
    const challenge = await ins.generateChallenge()

    const portalPage = await context.newPage()
    const portal = new PortalPage(portalPage)
    const attester = new PortalAttester(portalPage)
    await portal.login()
    await portal.enableWebApprovals()
    await portal.connectApp(challenge)

    await ins.assertConnected()

    await attester.openPending()
    const preExisting = await attester.pendingCardIds()

    await ins.createClaim({
      incidentDate: '2026-07-30',
      description: 'Participation workflow claim',
      amount: '500',
    })
    await ins.nav('claim-history')
    const claim = await ins.cardByReference('Participation workflow claim')
    await claim.selectScenario('SelectDisposition')
    await claim.requestParticipation()
    await expect(claim.card).toContainText('AwaitingParticipation')

    await attester.openPending()
    await expect
      .poll(async () => (await attester.pendingCardIds()).filter((id) => !preExisting.includes(id)).length, {
        timeout: 20_000,
        intervals: [500, 1_000, 2_000],
      })
      .toBeGreaterThanOrEqual(1)
    const myId = (await attester.pendingCardIds()).filter((id) => !preExisting.includes(id))[0]
    await attester.answerCard(myId, { kind: 'select', option: 'continue' })

    const resolved = await ins.assertCardStatus('Participation workflow claim', 'ApprovedForNextStep')
    await expect(resolved).toContainText('Answer: continue')
    await portalPage.close()
  })

  test('all remaining protocol types are interpreted by the Insurance Claims app', async ({ page, context }) => {
    test.setTimeout(120_000)
    const ins = new InsuranceUiPage(page)
    await ins.login()

    const portalPage = await context.newPage()
    const portal = new PortalPage(portalPage)
    const attester = new PortalAttester(portalPage)
    await portal.login()
    await portal.enableWebApprovals()

    const scenarios: {
      scenario: string
      expectedStatus: string
      answer: StepAnswer
      interpreted: string
    }[] = [
      { scenario: 'AffectedItems', expectedStatus: 'InReview', answer: { kind: 'multiselect', options: ['building', 'contents'] }, interpreted: 'building, contents' },
      { scenario: 'ClaimantNote', expectedStatus: 'MoreInformationRequired', answer: { kind: 'input', value: 'Additional claimant detail' }, interpreted: 'Additional claimant detail' },
      { scenario: 'EstimatedAmount', expectedStatus: 'InReview', answer: { kind: 'input', value: '800' }, interpreted: '800' },
      { scenario: 'IncidentDate', expectedStatus: 'InReview', answer: { kind: 'input', value: '2026-07-29' }, interpreted: '2026-07-29' },
      { scenario: 'AdjusterAppointment', expectedStatus: 'InReview', answer: { kind: 'input', value: '2026-08-01T10:30' }, interpreted: '2026-08-01T10:30' },
      { scenario: 'ClaimantDeclaration', expectedStatus: 'ApprovedForNextStep', answer: { kind: 'signature' }, interpreted: 'acknowledged' },
    ]

    for (const item of scenarios) {
      const description = `Browser interpretation ${item.scenario}`
      await attester.openPending()
      const preExisting = await attester.pendingCardIds()

      await ins.createClaim({ incidentDate: '2026-07-30', description, amount: '500' })
      await ins.nav('claim-history')
      const card = await ins.cardByReference(description)
      await card.selectScenario(item.scenario)
      await card.requestParticipation()

      await attester.openPending()
      await expect
        .poll(async () => (await attester.pendingCardIds()).filter((id) => !preExisting.includes(id)).length, {
          timeout: 20_000,
          intervals: [500, 1_000, 2_000],
        })
        .toBeGreaterThanOrEqual(1)
      const myId = (await attester.pendingCardIds()).filter((id) => !preExisting.includes(id))[0]
      await attester.answerCard(myId, item.answer)

      const resolved = await ins.assertCardStatus(description, item.expectedStatus)
      await expect(resolved).toContainText(item.interpreted)
    }

    // Disconnect then reconnect through the UI to prove the OHPP settings panel.
    await ins.nav('ohpp-settings')
    await ins.disconnectOhpp()
    await expect(ins.ohppStatus()).toContainText('Not connected')
    await expect(ins.ohppResult()).toContainText('credentials revoked')
    const reconnectChallenge = await ins.generateChallenge()
    await portal.connectApp(reconnectChallenge)
    await ins.assertConnected()

    await portalPage.close()
  })
})
