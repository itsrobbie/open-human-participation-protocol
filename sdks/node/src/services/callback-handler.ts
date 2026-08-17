import type { CredentialStore } from '../domain/interfaces.js';
import type { RegistrationCredentials } from '../domain/types.js';

/**
 * Handles inbound registration callbacks from Resolvers.
 * Validates the payload and stores credentials via the provided store.
 */
export class CallbackHandler {
  private readonly credentialStore: CredentialStore;

  constructor(credentialStore: CredentialStore) {
    this.credentialStore = credentialStore;
  }

  /**
   * Processes an inbound registration callback body.
   * Returns the parsed credentials on success, or null if invalid.
   */
  async handleCallback(requestBody: string): Promise<RegistrationCredentials | null> {
    if (!requestBody || requestBody.trim().length === 0) {
      return null;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(requestBody);
    } catch {
      return null;
    }

    const challengeId = this.extractString(parsed, 'challengeId');
    const resolverBaseUrl = this.extractString(parsed, 'resolverBaseUrl');
    const userId = this.extractString(parsed, 'userId');
    const accessToken = this.extractString(parsed, 'accessToken');
    const registrationId = this.extractString(parsed, 'registrationId');
    const createdAt = this.extractString(parsed, 'createdAt');

    if (!challengeId || !resolverBaseUrl || !userId || !accessToken || !registrationId) {
      return null;
    }

    const credentials: RegistrationCredentials = {
      challengeId,
      resolverBaseUrl,
      userId,
      accessToken,
      registrationId,
      createdAt: createdAt || new Date().toISOString(),
    };

    await this.credentialStore.store(credentials);
    return credentials;
  }

  private extractString(obj: Record<string, unknown>, key: string): string | null {
    const value = obj[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return null;
  }
}
