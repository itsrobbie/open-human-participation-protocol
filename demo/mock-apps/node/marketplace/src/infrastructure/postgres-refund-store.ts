import type { Pool } from 'pg';
import type { IRefundStore } from '../domain/interfaces.js';
import type { RefundRequest, RefundStatus } from '../domain/types.js';

export class PostgresRefundStore implements IRefundStore {
  constructor(private readonly pool: Pool) {}

  async save(refund: RefundRequest): Promise<void> {
    await this.pool.query(
      `INSERT INTO marketplace.refund_requests
       (id, purchase_id, buyer_id, reason, amount, status, participation_request_id, created_at, resolved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         reason = EXCLUDED.reason,
         status = EXCLUDED.status,
         participation_request_id = EXCLUDED.participation_request_id,
         resolved_at = EXCLUDED.resolved_at`,
      [
        refund.id,
        refund.purchaseId,
        refund.buyerId,
        refund.reason,
        refund.amount,
        refund.status,
        refund.participationRequestId ?? null,
        refund.createdAt,
        refund.resolvedAt ?? null,
      ],
    );
  }

  async getById(id: string, buyerId: string): Promise<RefundRequest | null> {
    const result = await this.pool.query(
      'SELECT * FROM marketplace.refund_requests WHERE id = $1 AND buyer_id = $2',
      [id, buyerId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async getByPurchaseId(purchaseId: string): Promise<RefundRequest | null> {
    const result = await this.pool.query(
      'SELECT * FROM marketplace.refund_requests WHERE purchase_id = $1 ORDER BY created_at DESC LIMIT 1',
      [purchaseId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async getActiveByPurchaseId(purchaseId: string): Promise<RefundRequest | null> {
    const result = await this.pool.query(
      `SELECT * FROM marketplace.refund_requests
       WHERE purchase_id = $1 AND status IN ('pending_confirmation', 'submitted')
       ORDER BY created_at DESC LIMIT 1`,
      [purchaseId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async getByBuyerId(buyerId: string): Promise<RefundRequest[]> {
    const result = await this.pool.query(
      'SELECT * FROM marketplace.refund_requests WHERE buyer_id = $1 ORDER BY created_at DESC',
      [buyerId],
    );
    return result.rows.map(this.mapRow);
  }

  private mapRow(row: Record<string, unknown>): RefundRequest {
    return {
      id: row.id as string,
      purchaseId: row.purchase_id as string,
      buyerId: row.buyer_id as string,
      reason: row.reason as string,
      amount: row.amount as number,
      status: row.status as RefundStatus,
      participationRequestId: (row.participation_request_id as string) || undefined,
      createdAt: row.created_at as string,
      resolvedAt: (row.resolved_at as string) || undefined,
    };
  }
}
