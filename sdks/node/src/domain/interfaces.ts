import type { RegistrationCredentials } from './types.js';

/**
 * Storage abstraction for registration credentials.
 * Apps implement this to persist credentials (Postgres, file, etc.).
 * The SDK ships only InMemoryCredentialStore for testing.
 */
export interface CredentialStore {
  store(credentials: RegistrationCredentials): Promise<void>;
  get(userId: string, resolverBaseUrl: string): Promise<RegistrationCredentials | null>;
  getAll(): Promise<RegistrationCredentials[]>;
  delete(userId: string, resolverBaseUrl: string): Promise<void>;
}
