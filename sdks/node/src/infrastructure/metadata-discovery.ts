import type { ServiceMetadata, ServiceEndpoints } from '../domain/types.js';
import { WELL_KNOWN_METADATA_PATH } from '../domain/constants.js';
import type { HttpClient } from './http-client.js';

interface CachedMetadata {
  metadata: ServiceMetadata;
  expiresAt: number;
}

/**
 * Fetches and caches Resolver service metadata from /.well-known/ohpp/metadata.
 * Rebases endpoint URLs to use the caller's resolver URL as origin.
 */
export class MetadataDiscovery {
  private readonly httpClient: HttpClient;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, CachedMetadata>();

  constructor(httpClient: HttpClient, cacheTtlMs: number) {
    this.httpClient = httpClient;
    this.cacheTtlMs = cacheTtlMs;
  }

  async getMetadata(resolverBaseUrl: string): Promise<ServiceMetadata | null> {
    const key = resolverBaseUrl.replace(/\/+$/, '');

    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.metadata;
    }

    const metadata = await this.fetchMetadata(key);
    if (metadata) {
      this.cache.set(key, {
        metadata,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
    }

    return metadata;
  }

  invalidateCache(resolverBaseUrl: string): void {
    const key = resolverBaseUrl.replace(/\/+$/, '');
    this.cache.delete(key);
  }

  private async fetchMetadata(baseUrl: string): Promise<ServiceMetadata | null> {
    const url = `${baseUrl}${WELL_KNOWN_METADATA_PATH}`;
    const response = await this.httpClient.get(url);

    if (!response.ok) return null;

    let metadata: ServiceMetadata;
    try {
      metadata = JSON.parse(response.body) as ServiceMetadata;
    } catch {
      return null;
    }

    if (!metadata?.endpoints) return null;

    // Rebase endpoint URLs to use the caller's baseUrl as origin.
    // The metadata may advertise URLs using the Resolver's internal hostname.
    return {
      ...metadata,
      endpoints: this.rebaseEndpoints(metadata.endpoints, baseUrl),
    };
  }

  private rebaseEndpoints(endpoints: ServiceEndpoints, targetBaseUrl: string): ServiceEndpoints {
    return {
      participate: this.rebaseUrl(endpoints.participate, targetBaseUrl),
      participate_status: this.rebaseUrl(endpoints.participate_status, targetBaseUrl),
      keys: this.rebaseUrl(endpoints.keys, targetBaseUrl),
      federation: endpoints.federation
        ? this.rebaseUrl(endpoints.federation, targetBaseUrl)
        : undefined,
    };
  }

  private rebaseUrl(originalUrl: string, targetBaseUrl: string): string {
    if (!originalUrl) return originalUrl;

    // If it starts with http:// or https://, extract the path
    if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
      const schemeEnd = originalUrl.indexOf('://') + 3;
      const pathStart = originalUrl.indexOf('/', schemeEnd);
      if (pathStart < 0) return targetBaseUrl;
      const path = originalUrl.slice(pathStart);
      return `${targetBaseUrl.replace(/\/+$/, '')}${path}`;
    }

    // Already a relative path
    return `${targetBaseUrl.replace(/\/+$/, '')}/${originalUrl.replace(/^\/+/, '')}`;
  }
}
