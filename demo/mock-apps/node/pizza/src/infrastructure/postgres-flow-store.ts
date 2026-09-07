import type { Pool } from 'pg';
import type { IOhppPizzaFlowStore } from '../domain/interfaces.js';
import type { OhppPizzaFlow } from '../domain/types.js';

export class PostgresFlowStore implements IOhppPizzaFlowStore {
  constructor(private readonly pool: Pool) {}

  async save(flow: OhppPizzaFlow): Promise<void> {
    await this.pool.query(
      `INSERT INTO pizza.ohpp_pizza_flows (id, user_id, transaction_id, current_step, total_steps, status, active_request_id, selections, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         current_step = EXCLUDED.current_step,
         status = EXCLUDED.status,
         active_request_id = EXCLUDED.active_request_id,
         selections = EXCLUDED.selections,
         updated_at = EXCLUDED.updated_at`,
      [
        flow.id,
        flow.userId,
        flow.transactionId,
        flow.currentStep,
        flow.totalSteps,
        flow.status,
        flow.activeRequestId ?? null,
        JSON.stringify(flow.selections),
        flow.createdAt,
        flow.updatedAt,
      ],
    );
  }

  async getById(id: string, userId: string): Promise<OhppPizzaFlow | null> {
    const result = await this.pool.query(
      'SELECT * FROM pizza.ohpp_pizza_flows WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async getActiveByUserId(userId: string): Promise<OhppPizzaFlow | null> {
    const result = await this.pool.query(
      `SELECT * FROM pizza.ohpp_pizza_flows WHERE user_id = $1 AND status = 'in_progress' ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async getByTransactionId(transactionId: string): Promise<OhppPizzaFlow | null> {
    const result = await this.pool.query(
      'SELECT * FROM pizza.ohpp_pizza_flows WHERE transaction_id = $1',
      [transactionId],
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async getAllActive(): Promise<OhppPizzaFlow[]> {
    const result = await this.pool.query(
      `SELECT * FROM pizza.ohpp_pizza_flows WHERE status = 'in_progress' ORDER BY created_at ASC`,
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: Record<string, unknown>): OhppPizzaFlow {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      transactionId: row.transaction_id as string,
      currentStep: row.current_step as number,
      totalSteps: row.total_steps as number,
      status: row.status as OhppPizzaFlow['status'],
      activeRequestId: (row.active_request_id as string) ?? undefined,
      selections:
        typeof row.selections === 'string'
          ? JSON.parse(row.selections as string)
          : (row.selections as OhppPizzaFlow['selections']),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
