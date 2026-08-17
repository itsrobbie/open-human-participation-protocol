import { describe, it, expect } from 'vitest';
import { OhppRequesterClient } from '../../src/services/ohpp-requester-client.js';
import { InMemoryCredentialStore } from '../../src/infrastructure/in-memory-credential-store.js';
import type { OhppClientOptions } from '../../src/domain/config.js';

function validOptions(): OhppClientOptions {
  return {
    appId: 'pizza.demo.test',
    appName: 'Demo Pizza',
    baseUrl: 'http://localhost:5030',
    callbackPath: '/ohpp/callback',
    resolverUrl: 'http://localhost:5050',
    credentialStore: new InMemoryCredentialStore(),
  };
}

describe('Client Configuration Validation', () => {
  it('constructor_missingAppId_throws', () => {
    const opts = validOptions();
    opts.appId = '';
    expect(() => new OhppRequesterClient(opts)).toThrow('appId');
  });

  it('constructor_missingAppName_throws', () => {
    const opts = validOptions();
    opts.appName = '';
    expect(() => new OhppRequesterClient(opts)).toThrow('appName');
  });

  it('constructor_invalidBaseUrl_throws', () => {
    const opts = validOptions();
    opts.baseUrl = 'not-a-url';
    expect(() => new OhppRequesterClient(opts)).toThrow('baseUrl');
  });

  it('constructor_callbackPathWithoutSlash_throws', () => {
    const opts = validOptions();
    opts.callbackPath = 'ohpp/callback';
    expect(() => new OhppRequesterClient(opts)).toThrow('callbackPath');
  });

  it('constructor_invalidResolverUrl_throws', () => {
    const opts = validOptions();
    opts.resolverUrl = 'not-a-url';
    expect(() => new OhppRequesterClient(opts)).toThrow('resolverUrl');
  });

  it('constructor_missingCredentialStore_throws', () => {
    const opts = validOptions();
    (opts as any).credentialStore = null;
    expect(() => new OhppRequesterClient(opts)).toThrow('credentialStore');
  });

  it('constructor_negativeTimeout_throws', () => {
    const opts = validOptions();
    opts.timeoutMs = -1;
    expect(() => new OhppRequesterClient(opts)).toThrow('Timeout');
  });

  it('constructor_validConfig_createsClient', () => {
    const client = new OhppRequesterClient(validOptions());
    expect(client).toBeDefined();
    expect(client.config.appId).toBe('pizza.demo.test');
  });
});
