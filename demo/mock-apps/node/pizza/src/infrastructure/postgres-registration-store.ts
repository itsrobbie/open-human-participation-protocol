import type { Pool } from 'pg';
import type { CredentialStore, RegistrationCredentials } from '@ohpp/sdk';

/**
 * Postgres-backed credential store for the Pizza app.
 * Implements the SDK's CredentialStore interface and links registrations
 * to the app's own user identity via a pending_challenges table.
 *
 * Flow:
 * 1. App generates challenge, records (challengeId, appUserId) in pending_challenges
 * 2. Resolver callback arrives with (challengeId, userId, accessToken, ...)
 * 3. Store looks up appUserId from pending_challenges using challengeId
 * 4. Stores registration with both userId (Resolver's) and appUserId (app's)
 * 5. Lookups by appUserId find the Resolver's credentials for OHPP requests
 */
export class PostgresRegistrationStore implements CredentialStore {
  constructor(private readonly pool: Pool) {}

  /** Record that this app user generated a challenge (before callback arrives). */
  async recordPendingChallenge(challengeId: string, appUserId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO pizza.pending_challenges (challenge_id, app_user_id, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (challenge_id) DO UPDATE SET app_user_id = EXCLUDED.app_user_id, created_at = EXCLUDED.created_at`,
      [challengeId, appUserId, new Date().toISOString()],
    );
  }

  /** SDK CredentialStore.store - called by the callback handler when registration completes. */
  async store(credentials: RegistrationCredentials): Promise<void> {
    // Look up which app user generated this challenge
    const pendingResult = await this.pool.query(
      'SELECT app_user_id FROM pizza.pending_challenges WHERE challenge_id = $1',
      [credentials.challengeId],
    );
    const appUserId = pendingResult.rows[0]?.app_user_id as string | undefined;
    if (!appUserId) {
      // Challenge not found - store with the Resolver's userId as fallback
      console.warn(`No pending challenge found for ${credentials.challengeId}, using Resolver userId`);
    }

    await this.pool.query(
      `INSERT INTO pizza.registrations (registration_id, challenge_id, resolver_base_url, user_id, app_user_id, access_token, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (registration_id) DO UPDATE SET
         app_user_id = EXCLUDED.app_user_id,
         access_token = EXCLUDED.access_token,
         created_at = EXCLUDED.created_at`,
      [
        credentials.registrationId,
        credentials.challengeId,
        credentials.resolverBaseUrl,
        credentials.userId,
        appUserId ?? credentials.userId,
        credentials.accessToken,
        credentials.createdAt,
      ],
    );
  }

  /** SDK CredentialStore.get - used by OhppRequesterClient for sending requests. */
  async get(userId: string, _resolverBaseUrl: string): Promise<RegistrationCredentials | null> {
    // Look up by user_id only (this app talks to a single Resolver)
    const result = await this.pool.query(
      'SELECT * FROM pizza.registrations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async getAll(): Promise<RegistrationCredentials[]> {
    const result = await this.pool.query('SELECT * FROM pizza.registrations ORDER BY created_at DESC');
    return result.rows.map(this.mapRow);
  }

  async delete(userId: string, resolverBaseUrl: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM pizza.registrations WHERE user_id = $1 AND resolver_base_url = $2',
      [userId, resolverBaseUrl],
    );
  }

  /** Get registration for an app user (looks up by app_user_id, not Resolver userId). */
  async getForAppUser(appUserId: string): Promise<RegistrationCredentials | null> {
    const result = await this.pool.query(
      'SELECT * FROM pizza.registrations WHERE app_user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [appUserId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  /** Check if an app user has an active OHPP registration. */
  async hasRegistration(appUserId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM pizza.registrations WHERE app_user_id = $1 LIMIT 1',
      [appUserId],
    );
    return result.rows.length > 0;
  }

  /** Delete all registrations for an app user (disconnect). */
  async deleteForAppUser(appUserId: string): Promise<void> {
    await this.pool.query('DELETE FROM pizza.registrations WHERE app_user_id = $1', [appUserId]);
  }

  private mapRow(row: Record<string, unknown>): RegistrationCredentials {
    return {
      challengeId: row.challenge_id as string,
      resolverBaseUrl: row.resolver_base_url as string,
      userId: row.user_id as string,
      accessToken: row.access_token as string,
      registrationId: row.registration_id as string,
      createdAt: row.created_at as string,
    };
  }
}
