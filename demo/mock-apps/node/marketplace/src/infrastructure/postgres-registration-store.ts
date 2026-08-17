import type { Pool } from 'pg';
import type { CredentialStore, RegistrationCredentials } from '@ohpp/sdk';
import type { IRegistrationChecker } from '../domain/interfaces.js';

/**
 * Postgres-backed credential store for the Marketplace app.
 * Links the app's user identity (appUserId from JWT) to the Resolver's
 * user identity (userId from callback) via a pending_challenges table.
 */
export class PostgresRegistrationStore implements CredentialStore, IRegistrationChecker {
  constructor(private readonly pool: Pool) {}

  /** Record that this app user generated a challenge (before callback arrives). */
  async recordPendingChallenge(challengeId: string, appUserId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO marketplace.pending_challenges (challenge_id, app_user_id, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (challenge_id) DO UPDATE SET app_user_id = EXCLUDED.app_user_id, created_at = EXCLUDED.created_at`,
      [challengeId, appUserId, new Date().toISOString()],
    );
  }

  async store(credentials: RegistrationCredentials): Promise<void> {
    const pendingResult = await this.pool.query(
      'SELECT app_user_id FROM marketplace.pending_challenges WHERE challenge_id = $1',
      [credentials.challengeId],
    );
    const appUserId = pendingResult.rows[0]?.app_user_id as string | undefined;

    await this.pool.query(
      `INSERT INTO marketplace.registrations (registration_id, challenge_id, resolver_base_url, user_id, app_user_id, access_token, created_at)
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

  async get(userId: string, _resolverBaseUrl: string): Promise<RegistrationCredentials | null> {
    const result = await this.pool.query(
      'SELECT * FROM marketplace.registrations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async getAll(): Promise<RegistrationCredentials[]> {
    const result = await this.pool.query('SELECT * FROM marketplace.registrations ORDER BY created_at DESC');
    return result.rows.map(this.mapRow);
  }

  async delete(userId: string, resolverBaseUrl: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM marketplace.registrations WHERE user_id = $1 AND resolver_base_url = $2',
      [userId, resolverBaseUrl],
    );
  }

  async getForAppUser(appUserId: string): Promise<RegistrationCredentials | null> {
    const result = await this.pool.query(
      'SELECT * FROM marketplace.registrations WHERE app_user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [appUserId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async hasRegistration(appUserId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM marketplace.registrations WHERE app_user_id = $1 LIMIT 1',
      [appUserId],
    );
    return result.rows.length > 0;
  }

  async deleteForAppUser(appUserId: string): Promise<void> {
    await this.pool.query('DELETE FROM marketplace.registrations WHERE app_user_id = $1', [appUserId]);
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
