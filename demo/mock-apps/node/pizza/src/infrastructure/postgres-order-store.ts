import type { Pool } from 'pg';
import type { IOrderStore } from '../domain/interfaces.js';
import type { Order } from '../domain/types.js';

export class PostgresOrderStore implements IOrderStore {
  constructor(private readonly pool: Pool) {}

  async save(order: Order): Promise<void> {
    await this.pool.query(
      `INSERT INTO pizza.orders (id, user_id, items, subtotal, delivery_fee, tip, total, status, order_mode, delivery_address, scheduled_for, special_instructions, participation_request_id, participation_status, transaction_id, ohpp_pizza_step, created_at, updated_at, estimated_delivery)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       ON CONFLICT (id) DO UPDATE SET
         items = EXCLUDED.items,
         subtotal = EXCLUDED.subtotal,
         delivery_fee = EXCLUDED.delivery_fee,
         tip = EXCLUDED.tip,
         total = EXCLUDED.total,
         status = EXCLUDED.status,
         participation_request_id = EXCLUDED.participation_request_id,
         participation_status = EXCLUDED.participation_status,
         ohpp_pizza_step = EXCLUDED.ohpp_pizza_step,
         updated_at = EXCLUDED.updated_at,
         estimated_delivery = EXCLUDED.estimated_delivery`,
      [
        order.id,
        order.userId,
        JSON.stringify(order.items),
        order.subtotal,
        order.deliveryFee,
        order.tip,
        order.total,
        order.status,
        order.orderMode,
        order.deliveryAddress ? JSON.stringify(order.deliveryAddress) : null,
        order.scheduledFor ?? null,
        order.specialInstructions ?? null,
        order.participationRequestId ?? null,
        order.participationStatus ?? null,
        order.transactionId ?? null,
        order.ohppPizzaStep ?? null,
        order.createdAt,
        order.updatedAt,
        order.estimatedDelivery ?? null,
      ],
    );
  }

  async getById(id: string, userId: string): Promise<Order | null> {
    const result = await this.pool.query(
      'SELECT * FROM pizza.orders WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async getByUserId(userId: string): Promise<Order[]> {
    const result = await this.pool.query(
      'SELECT * FROM pizza.orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows.map(this.mapRow);
  }

  async getByParticipationRequestId(requestId: string): Promise<Order | null> {
    const result = await this.pool.query(
      'SELECT * FROM pizza.orders WHERE participation_request_id = $1',
      [requestId],
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async updateStatus(id: string, status: Order['status'], updatedAt: string): Promise<void> {
    await this.pool.query(
      'UPDATE pizza.orders SET status = $1, updated_at = $2 WHERE id = $3',
      [status, updatedAt, id],
    );
  }

  private mapRow(row: Record<string, unknown>): Order {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      items: typeof row.items === 'string' ? JSON.parse(row.items as string) : row.items as Order['items'],
      subtotal: row.subtotal as number,
      deliveryFee: row.delivery_fee as number,
      tip: row.tip as number,
      total: row.total as number,
      status: row.status as Order['status'],
      orderMode: row.order_mode as Order['orderMode'],
      deliveryAddress: row.delivery_address
        ? typeof row.delivery_address === 'string'
          ? JSON.parse(row.delivery_address as string)
          : row.delivery_address as Order['deliveryAddress']
        : undefined,
      scheduledFor: (row.scheduled_for as string) ?? undefined,
      specialInstructions: (row.special_instructions as string) ?? undefined,
      participationRequestId: (row.participation_request_id as string) ?? undefined,
      participationStatus: (row.participation_status as Order['participationStatus']) ?? undefined,
      transactionId: (row.transaction_id as string) ?? undefined,
      ohppPizzaStep: (row.ohpp_pizza_step as number) ?? undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      estimatedDelivery: (row.estimated_delivery as string) ?? undefined,
    };
  }
}
