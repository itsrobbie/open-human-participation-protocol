import { expect, type Page } from '@playwright/test'
import { PortalAttester, type StepAnswer } from './portal-attester'

export type RequestType = 'Select' | 'Multiselect' | 'Text' | 'Number' | 'Date' | 'DateTime' | 'Signature'

/**
 * ProtocolLabPage — page object for the portal's Protocol Lab (Phase 4.1).
 *
 * The Lab is a self-hosted requester app: it registers through the real
 * ceremony, composes a protocol request of any of the 7 types, sends it, and
 * the attester resolves it on the Pending page. All controls are keyed
 * (ohpp.protocollab.*, protocol-*), so tests express intent, not selectors.
 */
export class ProtocolLabPage {
  constructor(private readonly page: Page) {}

  private testid(id: string) {
    return this.page.locator(`[data-testid="${id}"]`)
  }

  /** Open the Lab (via keyed nav) and ensure it is registered + approvals enabled. */
  async openAndRegister(): Promise<void> {
    await this.page.locator('[data-testid="ohpp.nav.link./protocol-lab"]').first().click()
    await expect(this.testid('protocol-lab')).toBeVisible({ timeout: 10_000 })

    const enableApprovals = this.testid('ohpp.protocollab.enable-approvals')
    if (await enableApprovals.count()) {
      await enableApprovals.click()
      await expect(this.testid('ohpp.protocollab.status-message')).toBeVisible({ timeout: 15_000 })
    }

    const registerLab = this.testid('register-lab')
    if (await registerLab.count()) {
      await registerLab.click()
      await expect(this.testid('ohpp.protocollab.status-message')).toContainText('Protocol Lab registered', {
        timeout: 15_000,
      })
    }

    await expect(this.testid('protocol-payload')).toBeVisible({ timeout: 10_000 })
  }

  async requestTypeOptionCount(): Promise<number> {
    return this.testid('ohpp.protocollab.request-type').locator('option').count()
  }

  async selectType(type: RequestType): Promise<void> {
    await this.testid('ohpp.protocollab.request-type').selectOption(type)
  }

  async loadPreset(): Promise<void> {
    await this.testid('ohpp.protocollab.load-preset').click()
  }

  async payloadValue(): Promise<string> {
    return this.testid('protocol-payload').inputValue()
  }

  async setPayload(value: string): Promise<void> {
    await this.testid('protocol-payload').fill(value)
  }

  async currentRequestId(): Promise<string | null> {
    const el = this.testid('protocol-request-id')
    return (await el.count()) ? el.textContent() : null
  }

  /** Send the composed request; returns the NEW request id once it changes. */
  async send(priorRequestId: string | null): Promise<string> {
    await this.testid('ohpp.protocollab.send').click()
    await expect
      .poll(async () => this.testid('protocol-request-id').textContent(), { timeout: 15_000 })
      .not.toBe(priorRequestId)
    return (await this.testid('protocol-request-id').textContent())!
  }

  /** Click Send without expecting a request id (error/validation cases). */
  async clickSend(): Promise<void> {
    await this.testid('ohpp.protocollab.send').click()
  }

  /** Resolve the given request on the Pending page via the shared attester, then return to the Lab. */
  async resolveViaAttester(requestId: string, step: StepAnswer): Promise<void> {
    await this.page.locator('[data-testid="ohpp.nav.link./pending"]').first().click()
    const attester = new PortalAttester(this.page)
    await attester.answerCard(requestId, step)
    await this.page.locator('[data-testid="ohpp.nav.link./protocol-lab"]').first().click()
  }

  async assertStatusContains(text: string | RegExp): Promise<void> {
    await expect(this.testid('protocol-status')).toContainText(text, { timeout: 15_000 })
  }

  async attestationJson(): Promise<string> {
    return (await this.testid('protocol-attestation').textContent()) ?? ''
  }

  async assertAttestationVisible(): Promise<void> {
    await expect(this.testid('protocol-attestation')).toBeVisible({ timeout: 15_000 })
  }

  /** Assert the keyed error alert is shown (invalid JSON / protocol validation). */
  async assertAlertVisible(): Promise<void> {
    await expect(this.testid('ohpp.protocollab.alert')).toBeVisible({ timeout: 10_000 })
  }

  async assertAlertContains(text: string): Promise<void> {
    await expect(this.testid('ohpp.protocollab.alert')).toContainText(text, { timeout: 10_000 })
  }

  async assertNoRequestId(): Promise<void> {
    await expect(this.testid('protocol-request-id')).toHaveCount(0)
  }
}
