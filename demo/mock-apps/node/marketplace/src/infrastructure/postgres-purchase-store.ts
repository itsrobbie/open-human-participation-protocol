import type { Pool } from 'pg';
import type { IPurchaseStore } from '../domain/interfaces.js';
import type { Purchase, PurchaseItem, PurchaseStatus, ShippingAddress } from '../domain/types.js';

export class PostgresPurchaseStore implements IPurchaseStore {
  constructor(private readonly pool: Pool) {}

  async save(purchase: Purchase): Promise<void> {
    await this.pool.query(
      `INSERT INTO marketplace.purchases
       (id, buyer_id, items, subtotal, shipping_cost, total, status, shipping_address, delivery_slot,
        participation_request_id, participation_status, signature_attestation_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         items = EXCLUDED.items,
         subtotal = EXCLUDED.subtotal,
         shipping_cost = EXCLUDED.shipping_cost,
         total = EXCLUDED.total,
         status = EXCLUDED.status,
         shipping_address = EXCLUDED.shipping_address,
         delivery_slot = EXCLUDED.delivery_slot,
         participation_request_id = EXCLUDED.participation_request_id,
         participation_status = EXCLUDED.participation_status,
         signature_attestation_id = EXCLUDED.signature_attestation_id,
         updated_at = EXCLUDED.updated_at`,
      [
        purchase.id,
        purchase.buyerId,
        JSON.stringify(purchase.items),
        purchase.subtotal,
        purchase.shippingCost,
        purchase.total,
        purchase.status,
        JSON.stringify(purchase.shippingAddress),
        purchase.deliverySlot ?? null,
        purchase.participationRequestId ?? null,
        purchase.participationStatus ?? null,
        purchase.signatureAttestationId ?? null,
        purchase.createdAt,
        purchase.updatedAt,
      ],
    );
  }

  async getById(id: string, buyerId: string): Promise<Purchase | null> {
    const result = await this.pool.query(
      'SELECT * FROM marketplace.purchases WHERE id = $1 AND buyer_id = $2',
      [id, buyerId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async getByBuyerId(buyerId: string): Promise<Purchase[]> {
    const result = await this.pool.query(
      'SELECT * FROM marketplace.purchases WHERE buyer_id = $1 ORDER BY created_at DESC',
      [buyerId],
    );
    return result.rows.map(this.mapRow);
  }

  async getByParticipationRequestId(requestId: string): Promise<Purchase | null> {
    const result = await this.pool.query(
      'SELECT * FROM marketplace.purchases WHERE participation_request_id = $1',
      [requestId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: Record<string, unknown>): Purchase {
    return {
      id: row.id as string,
      buyerId: row.buyer_id as string,
      items: row.items as PurchaseItem[],
      subtotal: row.subtotal as number,
      shippingCost: row.shipping_cost as number,
      total: row.total as number,
      status: row.status as PurchaseStatus,
      shippingAddress: row.shipping_address as ShippingAddress,
      deliverySlot: (row.delivery_slot as string) || undefined,
      participationRequestId: (row.participation_request_id as string) || undefined,
      participationStatus: (row.participation_status as Purchase['participationStatus']) || undefined,
      signatureAttestationId: (row.signature_attestation_id as string) || undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
