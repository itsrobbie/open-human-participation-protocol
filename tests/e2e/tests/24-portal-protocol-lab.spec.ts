import { expect, Page, test } from '@playwright/test'
import { PORTAL_URL } from '../test-urls'

type RequestType = 'Select' | 'Multiselect' | 'Text' | 'Number' | 'Date' | 'DateTime' | 'Signature'

interface AttestationEnvelope {
  innerAttestation: {
    id: string
    requestId: string
    version: string
    decision: { selectedOption?: string; selectedOptions?: string[]; value?: string; timestamp: string }
    resolution: { method: string; endpoint: { type: string; id: string } }
    signature: { algorithm: string; value: string; keyId: string }
    issuedAt: string
  }
  outerSignature: { algorithm: string; value: string; keyId: string }
  issuedAt: string
}

test.describe.serial('Portal Protocol Lab', () => {
  test.describe.configure({ timeout: 180_000 })

  async function login(page: Page) {
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')
  }

  async function openLabAndRegister(page: Page) {
    await page.click('nav >> text=Protocol Lab')
    await expect(page.getByTestId('protocol-lab')).toBeVisible()

    // Enable browser approvals if needed
    const enableDevice = page.getByRole('button', { name: 'Enable browser approvals' })
    if (await enableDevice.isVisible()) {
      await enableDevice.click()
      await expect(enableDevice).not.toBeVisible({ timeout: 10_000 })
    }

    // Register the Protocol Lab as a Requester app (real ceremony)
    const registerButton = page.getByTestId('register-lab')
    if (await registerButton.isVisible()) {
      await registerButton.click()
      await expect(page.getByRole('status')).toContainText('Protocol Lab registered', { timeout: 15_000 })
    }

    // Verify the compose section is visible (means Lab is registered)
    await expect(page.getByTestId('protocol-payload')).toBeVisible()
    await expect(page.getByTestId('protocol-payload')).toHaveValue(/protocol-lab-/)
  }

  async function roundTrip(
    page: Page,
    type: RequestType,
    answer: { selectedOption?: string; selectedOptions?: string[]; value?: string },
  ) {
    const requestIdElement = page.getByTestId('protocol-request-id')
    const priorRequestId = await requestIdElement.count() ? await requestIdElement.textContent() : null
    await page.selectOption('select[aria-label="Request type"]', type)
    await page.getByRole('button', { name: `Load ${type} preset` }).click()
    const request = JSON.parse(await page.getByTestId('protocol-payload').inputValue()) as { createdAt: string; expiry: string }
    await page.getByRole('button', { name: 'Send over protocol' }).click()

    await expect.poll(async () => page.getByTestId('protocol-request-id').textContent(), { timeout: 15_000 })
      .not.toBe(priorRequestId)
    const requestId = (await page.getByTestId('protocol-request-id').textContent())!

    // Navigate to the Pending page to resolve the request (protocol separation)
    await page.click('nav >> text=Pending')
    const card = page.getByTestId(`pending-${type.toLowerCase()}`)
    await expect(card).toBeVisible({ timeout: 15_000 })

    if (answer.selectedOption) {
      await card.getByRole('button', { name: 'Approve', exact: true }).click()
    } else if (answer.selectedOptions) {
      for (const option of answer.selectedOptions) {
        const optionIndex = ['approve', 'decline', 'review'].indexOf(option)
        await card.locator('input[type="checkbox"]').nth(optionIndex).check()
      }
      await card.getByRole('button', { name: 'Submit' }).click()
    } else if (type === 'Signature') {
      await card.getByRole('button', { name: 'I acknowledge' }).click()
    } else {
      await card.getByRole('textbox').or(card.locator('input')).first().fill(answer.value!)
      await card.getByRole('button', { name: 'Submit' }).click()
    }

    // Navigate back to Protocol Lab to check status
    await page.click('nav >> text=Protocol Lab')
    await expect(page.getByTestId('protocol-status')).toContainText('resolved', { timeout: 15_000 })
    await expect(page.getByTestId('protocol-attestation')).toBeVisible({ timeout: 15_000 })
    const envelope = JSON.parse(await page.getByTestId('protocol-attestation').textContent() ?? '') as AttestationEnvelope
    return { envelope, request, requestId }
  }

  function assertProtocolEnvelope(
    envelope: AttestationEnvelope,
    request: { createdAt: string; expiry: string },
    requestId: string,
  ) {
    const inner = envelope.innerAttestation
    expect(inner.id).not.toBe('')
    expect(inner.requestId).toBe(requestId)
    expect(inner.version).toBe('1.0')
    expect(Date.parse(inner.decision.timestamp)).toBeGreaterThanOrEqual(Date.parse(request.createdAt))
    expect(Date.parse(inner.decision.timestamp)).toBeLessThanOrEqual(Date.parse(request.expiry))
    expect(inner.resolution.method).toBe('direct')
    expect(inner.resolution.endpoint.type).toBe('browser')
    expect(inner.resolution.endpoint.id).toMatch(/^web:[0-9a-f-]{36}$/)
    expect(inner.signature.algorithm).toBe('ES256')
    expect(inner.signature.keyId).toBe(inner.resolution.endpoint.id)
    expect(inner.signature.value).toBe('identity-provider-authenticated')
    expect(inner.issuedAt).toBe(inner.decision.timestamp)
    expect(envelope.outerSignature.algorithm).toBe('ES256')
    expect(envelope.outerSignature.keyId).toMatch(/^resolver-/)
    expect(envelope.outerSignature.value.length).toBeGreaterThan(20)
    expect(Date.parse(envelope.issuedAt)).toBeGreaterThanOrEqual(Date.parse(inner.issuedAt))
  }

  test('is available in the web development build with all seven request types', async ({ page }) => {
    await login(page)
    await openLabAndRegister(page)

    await expect(page.locator('select[aria-label="Request type"] option')).toHaveCount(7)
    await expect(page.getByTestId('protocol-payload')).toHaveValue(/Protocol Lab Select request/)
  })

  test('round trips all request types and validates every attestation envelope', async ({ page }) => {
    await login(page)
    await openLabAndRegister(page)

    const cases: { type: RequestType; answer: { selectedOption?: string; selectedOptions?: string[]; value?: string } }[] = [
      { type: 'Select', answer: { selectedOption: 'approve' } },
      { type: 'Multiselect', answer: { selectedOptions: ['approve', 'review'] } },
      { type: 'Text', answer: { value: 'Kia ora cafe' } },
      { type: 'Number', answer: { value: '42.5' } },
      { type: 'Date', answer: { value: '2026-08-15' } },
      { type: 'DateTime', answer: { value: '2026-08-16T10:30' } },
      { type: 'Signature', answer: { value: 'acknowledged' } },
    ]

    for (const item of cases) {
      const result = await roundTrip(page, item.type, item.answer)
      assertProtocolEnvelope(result.envelope, result.request, result.requestId)
      expect(result.envelope.innerAttestation.decision.selectedOption).toBe(item.answer.selectedOption)
      expect(result.envelope.innerAttestation.decision.selectedOptions).toEqual(item.answer.selectedOptions)
      expect(result.envelope.innerAttestation.decision.value).toBe(item.answer.value)
      if (item.answer.selectedOption) await expect(page.getByTestId('protocol-status')).toContainText(`selectedOption: ${item.answer.selectedOption}`)
      if (item.answer.selectedOptions) await expect(page.getByTestId('protocol-status')).toContainText(`selectedOptions: ${item.answer.selectedOptions.join(', ')}`)
      if (item.answer.value) await expect(page.getByTestId('protocol-status')).toContainText(`value: ${item.answer.value}`)
    }
  })

  test('shows invalid JSON and protocol validation failures without sending a request', async ({ page }) => {
    await login(page)
    await openLabAndRegister(page)

    await page.getByTestId('protocol-payload').fill('{ invalid JSON')
    await page.getByRole('button', { name: 'Send over protocol' }).click()
    await expect(page.getByRole('alert')).toBeVisible()

    await page.getByRole('button', { name: 'Load Select preset' }).click()
    const invalidProtocol = JSON.parse(await page.getByTestId('protocol-payload').inputValue())
    invalidProtocol.action.summary = ''
    await page.getByTestId('protocol-payload').fill(JSON.stringify(invalidProtocol, null, 2))
    await page.getByRole('button', { name: 'Send over protocol' }).click()
    await expect(page.getByRole('alert')).toContainText('HTTP 422')
    await expect(page.getByTestId('protocol-request-id')).toHaveCount(0)
  })
})
