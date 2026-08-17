import { describe, it, expect, beforeEach } from 'vitest';
import { CallbackHandler } from '../../src/services/callback-handler.js';
import { InMemoryCredentialStore } from '../../src/infrastructure/in-memory-credential-store.js';

describe('CallbackHandler', () => {
  let store: InMemoryCredentialStore;
  let handler: CallbackHandler;

  beforeEach(() => {
    store = new InMemoryCredentialStore();
    handler = new CallbackHandler(store);
  });

  it('handleCallback_validPayload_storesCredentials', async () => {
    const body = JSON.stringify({
      challengeId: 'abc123def456',
      resolverBaseUrl: 'http://resolver:8080',
      userId: 'user-1',
      accessToken: 'token-xyz',
      registrationId: 'reg-1',
      createdAt: '2026-01-01T00:00:00Z',
    });

    const result = await handler.handleCallback(body);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe('user-1');
    expect(result?.accessToken).toBe('token-xyz');

    // Verify it was stored
    const stored = await store.get('user-1', 'http://resolver:8080');
    expect(stored?.accessToken).toBe('token-xyz');
  });

  it('handleCallback_missingChallengeId_returnsNull', async () => {
    const body = JSON.stringify({
      resolverBaseUrl: 'http://resolver:8080',
      userId: 'user-1',
      accessToken: 'token-xyz',
      registrationId: 'reg-1',
    });
    const result = await handler.handleCallback(body);
    expect(result).toBeNull();
  });

  it('handleCallback_missingAccessToken_returnsNull', async () => {
    const body = JSON.stringify({
      challengeId: 'abc123',
      resolverBaseUrl: 'http://resolver:8080',
      userId: 'user-1',
      registrationId: 'reg-1',
    });
    const result = await handler.handleCallback(body);
    expect(result).toBeNull();
  });

  it('handleCallback_missingUserId_returnsNull', async () => {
    const body = JSON.stringify({
      challengeId: 'abc123',
      resolverBaseUrl: 'http://resolver:8080',
      accessToken: 'token-xyz',
      registrationId: 'reg-1',
    });
    const result = await handler.handleCallback(body);
    expect(result).toBeNull();
  });

  it('handleCallback_emptyBody_returnsNull', async () => {
    const result = await handler.handleCallback('');
    expect(result).toBeNull();
  });

  it('handleCallback_malformedJson_returnsNull', async () => {
    const result = await handler.handleCallback('not json {{{');
    expect(result).toBeNull();
  });
});
