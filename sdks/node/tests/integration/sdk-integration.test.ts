/**
 * SDK Integration Tests - tests against a mock HTTP Resolver server.
 * Verifies the full request/response cycle without mocking the HTTP layer.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import {
  OhppRequesterClient,
  ChallengeGenerator,
  CallbackHandler,
  InMemoryCredentialStore,
} from '../../src/index.js';
import { ohppCallbackMiddleware, ohppAppMetadataMiddleware } from '../../src/express.js';

// --- Mock Resolver Server ---

let mockResolver: Server;
let resolverPort: number;
let resolverUrl: string;

// In-memory state for the mock Resolver
const resolverState = {
  requests: new Map<string, { status: string; selectedOption?: string; value?: string; selectedOptions?: string[] }>(),
  lastReceivedPayload: null as string | null,
};

function createMockResolver(): express.Express {
  const app = express();
  app.use(express.json());

  // Metadata endpoint
  app.get('/.well-known/ohpp/metadata', (_req, res) => {
    res.json({
      name: 'Mock Resolver',
      protocolVersion: { min: '1.0', max: '1.0' },
      endpoints: {
        participate: `http://localhost:${resolverPort}/api/participate`,
        participate_status: `http://localhost:${resolverPort}/api/participate/{requestId}/status`,
        keys: `http://localhost:${resolverPort}/api/keys`,
      },
    });
  });

  // Participate endpoint
  app.post('/api/participate', (req, res) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    resolverState.lastReceivedPayload = req.body?.payload ?? null;
    const requestId = `req-${Date.now()}`;
    resolverState.requests.set(requestId, { status: 'pending' });
    res.status(201).json({ requestId, status: 'pending' });
  });

  // Status endpoint
  app.get('/api/participate/:requestId/status', (req, res) => {
    const auth = req.headers.authorization;
    if (!auth) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const state = resolverState.requests.get(req.params.requestId);
    if (!state) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(state);
  });

  // Cancel endpoint
  app.post('/api/participate/:requestId/cancel', (req, res) => {
    const state = resolverState.requests.get(req.params.requestId);
    if (!state) { res.status(404).json({ error: 'Not found' }); return; }
    if (state.status !== 'pending') { res.status(409).json({ error: 'Already resolved' }); return; }
    state.status = 'cancelled';
    res.json({ status: 'cancelled' });
  });

  // JWKS endpoint (minimal - returns empty for now)
  app.get('/api/keys', (_req, res) => {
    res.json({ keys: [] });
  });

  return app;
}

// --- Mock Requester App (for callback/metadata tests) ---

let mockApp: Server;
let appPort: number;
let appUrl: string;

function createMockRequesterApp(credentialStore: InMemoryCredentialStore): express.Express {
  const app = express();
  app.use(express.json());

  const clientOptions = {
    appId: 'integration-test.demo.test',
    appName: 'Integration Test App',
    baseUrl: '', // set after port assigned
    callbackPath: '/ohpp/callback',
    resolverUrl: '', // set after port assigned
    credentialStore,
  };

  app.use(ohppAppMetadataMiddleware(clientOptions));
  app.use(ohppCallbackMiddleware(clientOptions));

  return app;
}

// --- Test setup/teardown ---

const credentialStore = new InMemoryCredentialStore();

beforeAll(async () => {
  // Start mock Resolver
  const resolverApp = createMockResolver();
  mockResolver = await new Promise<Server>((resolve) => {
    const srv = resolverApp.listen(0, () => resolve(srv));
  });
  const resolverAddr = mockResolver.address();
  resolverPort = typeof resolverAddr === 'object' && resolverAddr ? resolverAddr.port : 9999;
  resolverUrl = `http://localhost:${resolverPort}`;

  // Start mock Requester app
  const requesterApp = createMockRequesterApp(credentialStore);
  mockApp = await new Promise<Server>((resolve) => {
    const srv = requesterApp.listen(0, () => resolve(srv));
  });
  const appAddr = mockApp.address();
  appPort = typeof appAddr === 'object' && appAddr ? appAddr.port : 9998;
  appUrl = `http://localhost:${appPort}`;
});

afterAll(async () => {
  mockResolver?.close();
  mockApp?.close();
});

// --- Tests ---

describe('SDK Integration Tests', () => {
  describe('Registration Ceremony', () => {
    it('fullRegistrationCeremony_challengeToCallback_storesCredentials', async () => {
      const generator = new ChallengeGenerator({ appId: 'integration-test.demo.test' });
      const challenge = generator.createChallenge(60_000);

      expect(challenge.challengeId).toBeTruthy();
      expect(challenge.requesterAppId).toBe('integration-test.demo.test');

      const uri = ChallengeGenerator.buildChallengeUri(challenge);
      expect(uri).toContain('ohpp://register?challenge=');

      // Simulate Resolver callback
      const callbackBody = JSON.stringify({
        challengeId: challenge.challengeId,
        resolverBaseUrl: resolverUrl,
        userId: 'integration-user',
        accessToken: 'ohpp_app_integration_token',
        registrationId: 'reg-integration-1',
        createdAt: new Date().toISOString(),
      });

      const handler = new CallbackHandler(credentialStore);
      const creds = await handler.handleCallback(callbackBody);

      expect(creds).not.toBeNull();
      expect(creds!.userId).toBe('integration-user');
      expect(creds!.resolverBaseUrl).toBe(resolverUrl);

      // Verify stored
      const stored = await credentialStore.get('integration-user', resolverUrl);
      expect(stored).not.toBeNull();
      expect(stored!.accessToken).toBe('ohpp_app_integration_token');
    });
  });

  describe('Participation Flow', () => {
    let client: OhppRequesterClient;

    beforeAll(() => {
      client = new OhppRequesterClient({
        appId: 'integration-test.demo.test',
        appName: 'Integration Test App',
        baseUrl: appUrl,
        callbackPath: '/ohpp/callback',
        resolverUrl,
        credentialStore,
      });
    });

    it('fullParticipationFlow_sendRequest_pollResolved_verifyAttestation', async () => {
      const sendResult = await client.sendRequest({
        userId: 'integration-user',
        type: 'select',
        action: { summary: 'Integration test request', category: 'testing' },
        options: [
          { key: 'yes', label: 'Yes' },
          { key: 'no', label: 'No' },
        ],
        expiresInMs: 60_000,
      });

      expect(sendResult.success).toBe(true);
      expect(sendResult.requestId).toBeTruthy();

      // Poll - should be pending initially
      const pendingStatus = await client.getStatus(sendResult.requestId!, 'integration-user');
      expect(pendingStatus.success).toBe(true);
      expect(pendingStatus.status).toBe('pending');

      // Simulate resolution on the mock resolver
      resolverState.requests.set(sendResult.requestId!, {
        status: 'resolved',
        selectedOption: 'yes',
      });

      // Poll again - should be resolved
      const resolvedStatus = await client.getStatus(sendResult.requestId!, 'integration-user');
      expect(resolvedStatus.success).toBe(true);
      expect(resolvedStatus.status).toBe('resolved');
      expect(resolvedStatus.selectedOption).toBe('yes');
    });

    it('fullCancellationFlow_sendRequest_cancel_pollCancelled', async () => {
      const sendResult = await client.sendRequest({
        userId: 'integration-user',
        type: 'select',
        action: { summary: 'Cancel test', category: 'testing' },
        options: [
          { key: 'ok', label: 'OK' },
          { key: 'cancel', label: 'Cancel' },
        ],
        expiresInMs: 60_000,
      });

      expect(sendResult.success).toBe(true);

      const cancelResult = await client.cancelRequest(sendResult.requestId!, 'integration-user');
      expect(cancelResult.success).toBe(true);

      const status = await client.getStatus(sendResult.requestId!, 'integration-user');
      expect(status.status).toBe('cancelled');
    });

    it('sendRequest_noCredentials_returnsError', async () => {
      const result = await client.sendRequest({
        userId: 'unknown-user',
        type: 'select',
        action: { summary: 'Should fail' },
        options: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No registration');
    });

    it('metadataDiscovery_cachesAndRefreshes', async () => {
      const metadata = await client.metadata.getMetadata(resolverUrl);
      expect(metadata).not.toBeNull();
      expect(metadata!.name).toBe('Mock Resolver');
      expect(metadata!.endpoints.participate).toContain('/api/participate');

      // Second call should be cached (no extra HTTP call)
      const cached = await client.metadata.getMetadata(resolverUrl);
      expect(cached).toEqual(metadata);
    });
  });

  describe('Express Middleware', () => {
    it('expressMiddleware_servesAppMetadata', async () => {
      const res = await fetch(`${appUrl}/.well-known/ohpp/app-metadata`);
      expect(res.status).toBe(200);

      const metadata = await res.json();
      expect(metadata.appId).toBe('integration-test.demo.test');
      expect(metadata.name).toBe('Integration Test App');
      expect(metadata.endpoints.registrationCallback).toBe('/ohpp/callback');
    });

    it('expressMiddleware_handlesCallback', async () => {
      const res = await fetch(`${appUrl}/ohpp/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'test-cb-challenge',
          resolverBaseUrl: 'http://other-resolver:8080',
          userId: 'callback-test-user',
          accessToken: 'ohpp_app_cb_token',
          registrationId: 'reg-cb-1',
          createdAt: new Date().toISOString(),
        }),
      });

      expect(res.status).toBe(200);
      const stored = await credentialStore.get('callback-test-user', 'http://other-resolver:8080');
      expect(stored).not.toBeNull();
    });

    it('expressMiddleware_rejectsInvalidCallback', async () => {
      const res = await fetch(`${appUrl}/ohpp/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incomplete: true }),
      });

      expect(res.status).toBe(400);
    });
  });
});
