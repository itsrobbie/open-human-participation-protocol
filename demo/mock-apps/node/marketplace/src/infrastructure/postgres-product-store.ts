import type { Pool } from 'pg';
import type { IProductStore } from '../domain/interfaces.js';
import type { Product, ProductCategory } from '../domain/types.js';

export class PostgresProductStore implements IProductStore {
  constructor(private readonly pool: Pool) {}

  async getAll(): Promise<Product[]> {
    const result = await this.pool.query(
      'SELECT * FROM marketplace.products ORDER BY created_at DESC',
    );
    return result.rows.map(this.mapRow);
  }

  async getById(id: string): Promise<Product | null> {
    const result = await this.pool.query(
      'SELECT * FROM marketplace.products WHERE id = $1',
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async getByCategory(category: ProductCategory): Promise<Product[]> {
    const result = await this.pool.query(
      'SELECT * FROM marketplace.products WHERE category = $1 ORDER BY created_at DESC',
      [category],
    );
    return result.rows.map(this.mapRow);
  }

  async decrementStock(productId: string, quantity: number): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE marketplace.products
       SET stock = stock - $2
       WHERE id = $1 AND stock >= $2
       RETURNING id`,
      [productId, quantity],
    );
    return result.rows.length > 0;
  }

  private mapRow(row: Record<string, unknown>): Product {
    return {
      id: row.id as string,
      sellerId: row.seller_id as string,
      name: row.name as string,
      description: row.description as string,
      price: row.price as number,
      category: row.category as ProductCategory,
      imageUrl: (row.image_url as string) || undefined,
      stock: row.stock as number,
      rating: parseFloat(row.rating as string),
      reviewCount: row.review_count as number,
      bundleEligible: row.bundle_eligible as boolean,
      createdAt: row.created_at as string,
    };
  }
}
