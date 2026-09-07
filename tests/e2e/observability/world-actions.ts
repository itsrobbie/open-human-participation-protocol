import type { APIRequestContext } from '@playwright/test'
import { createHash, generateKeyPairSync, randomUUID, sign as cryptoSign } from 'crypto'
import {
  DEV_KEYCLOAK_URL,
  DEV_RESOLVER_URL,
  DEV_UMAMI_URL,
  UMAMI_WEBSITE_ID,
} from '../dev-observability-urls'

/**
 * Drives REAL OHPP world-actions against the dev stack via HTTP, so the
 * observability sweep asserts telemetry from genuine ceremonies (not synthetic
 * pings). The wire protocol mirrors the CLI attester + the resolver integration
 * tests exactly (three token types: Keycloak identity, device token, app token).
 */

const BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

/** Password-grant a Keycloak identity token for the demo user in a realm. */
export async function getKeycloakToken(
  request: APIRequestContext,
  { realm = 'ohpp', clientId = 'ohpp-portal', username = 'demo', password = 'demo' } = {},
): Promise<string> {
  const res = await request.post(
    `${DEV_KEYCLOAK_URL}/realms/${realm}/protocol/openid-connect/token`,
    { form: { client_id: clientId, grant_type: 'password', username, password } },
  )
  if (!res.ok()) {
    throw new Error(`Keycloak token failed (${res.status()}): ${await res.text()}`)
  }
  return (await res.json()).access_token as string
}

export interface RegisteredDevice {
  deviceToken: string
  privateKeyPem: string
  publicKeyPem: string
}

/**
 * Full device onboarding: ensure the user profile, create a device (mints the
 * device token), and register an ES256 public key. Mirrors the CLI RunSetup.
 */
export async function registerDeviceWithKey(
  request: APIRequestContext,
  identityToken: string,
  deviceName = 'Observability Sweep Device',
): Promise<RegisteredDevice> {
  const idAuth = { Authorization: `Bearer ${identityToken}` }

  // Ensure user profile (idempotent).
  await request.post(`${DEV_RESOLVER_URL}/api/users/me`, { headers: idAuth })

  // Create the device -> device token.
  const devRes = await request.post(`${DEV_RESOLVER_URL}/api/devices`, {
    headers: idAuth,
    data: { name: deviceName, deviceType: 'observability-sweep' },
  })
  if (devRes.status() !== 201) {
    throw new Error(`Create device failed (${devRes.status()}): ${await devRes.text()}`)
  }
  const deviceToken = (await devRes.json()).deviceToken as string

  // Generate an ES256 (P-256) key pair; export SPKI public PEM + PKCS8 private PEM.
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

  // Register the key against the device.
  const keyRes = await request.post(`${DEV_RESOLVER_URL}/api/devices/me/keys`, {
    headers: { Authorization: `Bearer ${deviceToken}` },
    data: { publicKey: publicKeyPem, algorithm: 'ES256' },
  })
  if (!keyRes.ok()) {
    throw new Error(`Register key failed (${keyRes.status()}): ${await keyRes.text()}`)
  }

  return { deviceToken, privateKeyPem, publicKeyPem }
}

/** Create a participation rule (the "add a rule to the phone app" action). */
export async function addRule(
  request: APIRequestContext,
  identityToken: string,
  name = 'Observability sweep rule',
): Promise<void> {
  const res = await request.post(`${DEV_RESOLVER_URL}/api/rules`, {
    headers: { Authorization: `Bearer ${identityToken}` },
    data: { name, authLevel: 'none', autoRespondEnabled: false },
  })
  if (res.status() !== 201) {
    throw new Error(`Add rule failed (${res.status()}): ${await res.text()}`)
  }
}

// NOTE: obtaining an app access token requires the full registration ceremony
// (the app generates a challenge, e.g. pizza's POST /ohpp/generate-challenge, and
// the user completes it via the resolver's POST /api/registrations/process-challenge).
// That ceremony is covered end to end by the resolver integration + pizza E2E
// specs; the observability sweep does not re-implement it. createParticipationRequest
// below is kept for callers that already hold a valid app token.

/** Submit a select participation request as an app; returns the requestId. */
export async function createParticipationRequest(
  request: APIRequestContext,
  appToken: string,
  appId: string,
  userId: string,
  summary = 'Observability sweep request',
): Promise<string> {
  const payload = JSON.stringify({
    id: randomUUID().replace(/-/g, ''),
    version: '1.0',
    requester: { appId },
    validation: { userId },
    action: { summary, description: 'Cross-service trace for the observability sweep' },
    type: 'select',
    options: [
      { key: 'approve', label: 'Approve' },
      { key: 'deny', label: 'Deny' },
    ],
    createdAt: new Date().toISOString(),
  })
  const res = await request.post(`${DEV_RESOLVER_URL}/api/participate`, {
    headers: { Authorization: `Bearer ${appToken}` },
    data: { payload },
  })
  if (res.status() !== 201) {
    throw new Error(`Create participation failed (${res.status()}): ${await res.text()}`)
  }
  return (await res.json()).requestId as string
}

/** Fetch the device's pending requests (device token). */
export async function getPending(
  request: APIRequestContext,
  deviceToken: string,
): Promise<Array<{ requestId: string; options?: Array<{ key: string }> }>> {
  const res = await request.get(`${DEV_RESOLVER_URL}/api/devices/me/pending`, {
    headers: { Authorization: `Bearer ${deviceToken}` },
  })
  if (!res.ok()) throw new Error(`Get pending failed (${res.status()}): ${await res.text()}`)
  return res.json()
}

/**
 * Approve a request from the "phone": build the attestation payload, sign it with
 * the device ES256 key (IEEE-P1363 raw r||s, base64url - matching .NET), and POST
 * it to the device attestations endpoint.
 */
export async function approveFromDevice(
  request: APIRequestContext,
  device: RegisteredDevice,
  requestId: string,
  decision = 'approve',
): Promise<void> {
  const attestationPayload = JSON.stringify({
    requestId,
    decision,
    type: 'select',
    method: 'Direct',
    decisionTimestamp: new Date().toISOString(),
  })
  // .NET verifies a raw ECDSA (r||s) signature, base64url-encoded.
  const der = cryptoSign('sha256', Buffer.from(attestationPayload, 'utf8'), {
    key: device.privateKeyPem,
    dsaEncoding: 'ieee-p1363',
  })
  const deviceSignature = der
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  const res = await request.post(`${DEV_RESOLVER_URL}/api/devices/me/attestations`, {
    headers: { Authorization: `Bearer ${device.deviceToken}` },
    data: { requestId, attestationPayload, deviceSignature },
  })
  if (!res.ok()) {
    throw new Error(`Submit attestation failed (${res.status()}): ${await res.text()}`)
  }
}

/** Trigger the deliberate backend crash (handled 500 -> error span in Tempo). */
export async function triggerBackendCrash(request: APIRequestContext): Promise<void> {
  await request.get(`${DEV_RESOLVER_URL}/api/diagnostics/throw`)
}

/** Emit a product-analytics event to Umami (browser-UA + url so it records). */
export async function emitAnalyticsEvent(
  request: APIRequestContext,
  eventName: string,
): Promise<void> {
  await request.post(`${DEV_UMAMI_URL}/api/send`, {
    headers: { 'User-Agent': BROWSER_UA, 'Content-Type': 'application/json' },
    data: {
      type: 'event',
      payload: {
        website: UMAMI_WEBSITE_ID,
        name: eventName,
        hostname: 'ohpp.local',
        url: '/observability-sweep',
      },
    },
  })
}

/** Extract the ohpp user id (sub) from a Keycloak access token (unverified decode). */
export function userIdFromToken(token: string): string {
  const [, payload] = token.split('.')
  const json = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
  return json.sub as string
}

/** Small helper: sha256 hex, used only for stable unique names if needed. */
export function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 8)
}
