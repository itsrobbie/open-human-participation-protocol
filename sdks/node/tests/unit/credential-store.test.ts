import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCredentialStore } from '../../src/infrastructure/in-memory-credential-store.js';
import type { RegistrationCredentials } from '../../src/domain/types.js';

function makeCredentials(overrides?: Partial<RegistrationCredentials>): RegistrationCredentials {
  return {
    challengeId: 'abc123',
    resolverBaseUrl: 'http://resolver:8080',
    userId: 'user-1',
    accessToken: 'token-xyz',
    registrationId: 'reg-1',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('InMemoryCredentialStore', () => {
  let store: InMemoryCredentialStore;

  beforeEach(() => {
    store = new InMemoryCredentialStore();
  });

  it('store_newCredentials_canBeRetrieved', async () => {
    const creds = makeCredentials();
    await store.store(creds);
    const result = await store.get('user-1', 'http://resolver:8080');
    expect(result).toEqual(creds);
  });

  it('store_duplicateKey_overwrites', async () => {
    await store.store(makeCredentials({ accessToken: 'old-token' }));
    await store.store(makeCredentials({ accessToken: 'new-token' }));
    const result = await store.get('user-1', 'http://resolver:8080');
    expect(result?.accessToken).toBe('new-token');
  });

  it('get_existingCredentials_returnsMatch', async () => {
    await store.store(makeCredentials());
    const result = await store.get('user-1', 'http://resolver:8080');
    expect(result).not.toBeNull();
    expect(result?.userId).toBe('user-1');
  });

  it('get_unknownUser_returnsNull', async () => {
    await store.store(makeCredentials());
    const result = await store.get('unknown-user', 'http://resolver:8080');
    expect(result).toBeNull();
  });

  it('get_wrongResolver_returnsNull', async () => {
    await store.store(makeCredentials());
    const result = await store.get('user-1', 'http://other-resolver:9090');
    expect(result).toBeNull();
  });

  it('getAll_multipleCredentials_returnsAll', async () => {
    await store.store(makeCredentials({ userId: 'user-1' }));
    await store.store(makeCredentials({ userId: 'user-2' }));
    const all = await store.getAll();
    expect(all).toHaveLength(2);
  });

  it('getAll_empty_returnsEmptyArray', async () => {
    const all = await store.getAll();
    expect(all).toEqual([]);
  });

  it('delete_existingCredentials_removesEntry', async () => {
    await store.store(makeCredentials());
    await store.delete('user-1', 'http://resolver:8080');
    const result = await store.get('user-1', 'http://resolver:8080');
    expect(result).toBeNull();
  });

  it('delete_unknownCredentials_noError', async () => {
    // Should not throw
    await store.delete('nonexistent', 'http://resolver:8080');
  });
});
