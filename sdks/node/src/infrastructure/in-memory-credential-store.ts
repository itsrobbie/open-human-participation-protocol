import type { CredentialStore } from '../domain/interfaces.js';
import type { RegistrationCredentials } from '../domain/types.js';

/**
 * In-memory credential store for testing and development.
 * Not suitable for production - credentials are lost on restart.
 */
export class InMemoryCredentialStore implements CredentialStore {
  private readonly entries = new Map<string, RegistrationCredentials>();

  private key(userId: string, resolverBaseUrl: string): string {
    return `${userId}::${resolverBaseUrl.replace(/\/+$/, '')}`;
  }

  async store(credentials: RegistrationCredentials): Promise<void> {
    this.entries.set(this.key(credentials.userId, credentials.resolverBaseUrl), credentials);
  }

  async get(userId: string, resolverBaseUrl: string): Promise<RegistrationCredentials | null> {
    return this.entries.get(this.key(userId, resolverBaseUrl)) ?? null;
  }

  async getAll(): Promise<RegistrationCredentials[]> {
    return Array.from(this.entries.values());
  }

  async delete(userId: string, resolverBaseUrl: string): Promise<void> {
    this.entries.delete(this.key(userId, resolverBaseUrl));
  }
}
