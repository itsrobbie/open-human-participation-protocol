import type { CredentialStore } from './interfaces.js';

/**
 * Configuration options for the OhppRequesterClient.
 */
export interface OhppClientOptions {
  /** Domain-based app identifier (e.g., "pizza.demo.test") */
  appId: string;
  /** Human-readable app name shown in Resolver/Client UIs */
  appName: string;
  /** Public base URL of this application (e.g., "http://localhost:5030") */
  baseUrl: string;
  /** Relative path for the registration callback endpoint (must start with "/") */
  callbackPath: string;
  /** URL of the Resolver this app communicates with */
  resolverUrl: string;
  /** Credential store for persisting registration tokens */
  credentialStore: CredentialStore;
  /** Optional icon URL for display in Client UIs */
  iconUrl?: string;
  /** Protocol version (defaults to "1.0") */
  protocolVersion?: string;
  /** Metadata cache duration in ms (defaults to 300_000) */
  metadataCacheTtlMs?: number;
  /** HTTP request timeout in ms (defaults to 30_000) */
  timeoutMs?: number;
}
