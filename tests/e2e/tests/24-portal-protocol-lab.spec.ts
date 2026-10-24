import { expect, test } from '@playwright/test'
import { PortalPage } from '../pages/portal'
import { ProtocolLabPage, type RequestType } from '../pages/protocol-lab'
import type { StepAnswer } from '../pages/portal-attester'

/**
 * Portal Protocol Lab — converted to page objects (Phase 4.1). Login via
 * PortalPage; the Lab compose/send/resolve goes through ProtocolLabPage +
 * PortalAttester. No raw getByRole/selectOption-by-aria test logic; the
 * attestation envelope is read from the keyed protocol-attestation element.
 */

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

  function stepFor(
    type: RequestType,
    answer: { selectedOption?: string; selectedOptions?: string[]; value?: string },
  ): StepAnswer {
    if (answer.selectedOption) return { kind: 'select', option: answer.selectedOption }
    if (answer.selectedOptions) return { kind: 'multiselect', options: answer.selectedOptions }
    if (type === 'Signature') return { kind: 'signature' }
    return { kind: 'input', value: answer.value! }
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
    const portal = new PortalPage(page)
    const lab = new ProtocolLabPage(page)
    await portal.login()
    await lab.openAndRegister()
    expect(await lab.requestTypeOptionCount()).toBe(7)
    expect(await lab.payloadValue()).toMatch(/Protocol Lab Select request/)
  })

  test('round trips all request types and validates every attestation envelope', async ({ page }) => {
    const portal = new PortalPage(page)
    const lab = new ProtocolLabPage(page)
    await portal.login()
    await lab.openAndRegister()

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
      const prior = await lab.currentRequestId()
      await lab.selectType(item.type)
      await lab.loadPreset()
      const request = JSON.parse(await lab.payloadValue()) as { createdAt: string; expiry: string }
      const requestId = await lab.send(prior)
      await lab.resolveViaAttester(requestId, stepFor(item.type, item.answer))
      await lab.assertStatusContains('resolved')
      await lab.assertAttestationVisible()
      const envelope = JSON.parse(await lab.attestationJson()) as AttestationEnvelope
      assertProtocolEnvelope(envelope, request, requestId)
      expect(envelope.innerAttestation.decision.selectedOption).toBe(item.answer.selectedOption)
      expect(envelope.innerAttestation.decision.selectedOptions).toEqual(item.answer.selectedOptions)
      expect(envelope.innerAttestation.decision.value).toBe(item.answer.value)
      if (item.answer.selectedOption) await lab.assertStatusContains(`selectedOption: ${item.answer.selectedOption}`)
      if (item.answer.selectedOptions) await lab.assertStatusContains(`selectedOptions: ${item.answer.selectedOptions.join(', ')}`)
      if (item.answer.value) await lab.assertStatusContains(`value: ${item.answer.value}`)
    }
  })

  test('shows invalid JSON and protocol validation failures without sending a request', async ({ page }) => {
    const portal = new PortalPage(page)
    const lab = new ProtocolLabPage(page)
    await portal.login()
    await lab.openAndRegister()

    await lab.setPayload('{ invalid JSON')
    await lab.clickSend()
    await lab.assertAlertVisible()

    await lab.selectType('Select')
    await lab.loadPreset()
    const invalid = JSON.parse(await lab.payloadValue())
    invalid.action.summary = ''
    await lab.setPayload(JSON.stringify(invalid, null, 2))
    await lab.clickSend()
    await lab.assertAlertContains('HTTP 422')
    await lab.assertNoRequestId()
  })
})
