import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetadataDiscovery } from '../../src/infrastructure/metadata-discovery.js';
import { HttpClient } from '../../src/infrastructure/http-client.js';

// Mock the HttpClient
vi.mock('../../src/infrastructure/http-client.js', () => ({
  HttpClient: vi.fn(),
}));

function createMockHttpClient(getResponse?: { ok: boolean; status: number; body: string }) {
  return {
    get: vi.fn().mockResolvedValue(
      getResponse ?? {
        ok: true,
        status: 200,
        body: JSON.stringify({
          name: 'Test Resolver',
          protocolVersion: { min: '1.0', max: '1.0' },
          endpoints: {
            participate: 'http://internal:8080/api/participate',
            participate_status: 'http://internal:8080/api/participate/{requestId}/status',
            keys: 'http://internal:8080/.well-known/jwks',
            federation: null,
          },
        }),
      },
    ),
    post: vi.fn(),
  } as unknown as HttpClient;
}

describe('MetadataDiscovery', () => {
  let mockClient: HttpClient;
  let discovery: MetadataDiscovery;

  beforeEach(() => {
    mockClient = createMockHttpClient();
    discovery = new MetadataDiscovery(mockClient, 5000);
  });

  it('getMetadata_freshFetch_returnsMetadata', async () => {
    const metadata = await discovery.getMetadata('http://localhost:5050');
    expect(metadata).not.toBeNull();
    expect(metadata?.name).toBe('Test Resolver');
    expect(mockClient.get).toHaveBeenCalledWith('http://localhost:5050/.well-known/ohpp/metadata');
  });

  it('getMetadata_cached_returnsWithoutFetch', async () => {
    await discovery.getMetadata('http://localhost:5050');
    await discovery.getMetadata('http://localhost:5050');
    expect(mockClient.get).toHaveBeenCalledTimes(1);
  });

  it('getMetadata_cacheExpired_refetches', async () => {
    // Use a very short TTL
    discovery = new MetadataDiscovery(mockClient, 1); // 1ms TTL
    await discovery.getMetadata('http://localhost:5050');
    // Wait for cache to expire
    await new Promise((r) => setTimeout(r, 5));
    await discovery.getMetadata('http://localhost:5050');
    expect(mockClient.get).toHaveBeenCalledTimes(2);
  });

  it('getMetadata_resolverDown_returnsNull', async () => {
    mockClient = createMockHttpClient({ ok: false, status: 0, body: 'Network error' });
    discovery = new MetadataDiscovery(mockClient, 5000);
    const metadata = await discovery.getMetadata('http://localhost:5050');
    expect(metadata).toBeNull();
  });

  it('getMetadata_malformedJson_returnsNull', async () => {
    mockClient = createMockHttpClient({ ok: true, status: 200, body: 'not json{{{' });
    discovery = new MetadataDiscovery(mockClient, 5000);
    const metadata = await discovery.getMetadata('http://localhost:5050');
    expect(metadata).toBeNull();
  });

  it('getMetadata_rebasesEndpointUrls', async () => {
    const metadata = await discovery.getMetadata('http://localhost:5050');
    // Endpoints should be rebased from http://internal:8080 to http://localhost:5050
    expect(metadata?.endpoints.participate).toBe('http://localhost:5050/api/participate');
    expect(metadata?.endpoints.participate_status).toBe(
      'http://localhost:5050/api/participate/{requestId}/status',
    );
    expect(metadata?.endpoints.keys).toBe('http://localhost:5050/.well-known/jwks');
  });

  it('getMetadata_relativePathsHandled', async () => {
    mockClient = createMockHttpClient({
      ok: true,
      status: 200,
      body: JSON.stringify({
        name: 'Test',
        protocolVersion: { min: '1.0', max: '1.0' },
        endpoints: {
          participate: '/api/participate',
          participate_status: '/api/participate/{requestId}/status',
          keys: '/.well-known/jwks',
        },
      }),
    });
    discovery = new MetadataDiscovery(mockClient, 5000);
    const metadata = await discovery.getMetadata('http://localhost:5050');
    expect(metadata?.endpoints.participate).toBe('http://localhost:5050/api/participate');
  });

  it('invalidateCache_forcesRefetchOnNextCall', async () => {
    await discovery.getMetadata('http://localhost:5050');
    discovery.invalidateCache('http://localhost:5050');
    await discovery.getMetadata('http://localhost:5050');
    expect(mockClient.get).toHaveBeenCalledTimes(2);
  });
});
