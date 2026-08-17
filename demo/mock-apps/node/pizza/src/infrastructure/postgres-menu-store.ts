import type { Pool } from 'pg';
import type { IMenuStore } from '../domain/interfaces.js';
import type { MenuItem, Topping } from '../domain/types.js';

export class PostgresMenuStore implements IMenuStore {
  constructor(private readonly pool: Pool) {}

  async getAll(): Promise<MenuItem[]> {
    const result = await this.pool.query(
      'SELECT id, name, description, category, base_price, image_url, available FROM pizza.menu_items ORDER BY category, name',
    );
    return result.rows.map(this.mapRow);
  }

  async getById(id: string): Promise<MenuItem | null> {
    const result = await this.pool.query(
      'SELECT id, name, description, category, base_price, image_url, available FROM pizza.menu_items WHERE id = $1',
      [id],
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async getByCategory(category: string): Promise<MenuItem[]> {
    const result = await this.pool.query(
      'SELECT id, name, description, category, base_price, image_url, available FROM pizza.menu_items WHERE category = $1 ORDER BY name',
      [category],
    );
    return result.rows.map(this.mapRow);
  }

  async getToppings(): Promise<Topping[]> {
    const result = await this.pool.query(
      'SELECT id, name, price, category FROM pizza.toppings ORDER BY category, name',
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      price: row.price,
      category: row.category,
    }));
  }

  private mapRow(row: Record<string, unknown>): MenuItem {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      category: row.category as MenuItem['category'],
      basePrice: row.base_price as number,
      imageUrl: (row.image_url as string) ?? undefined,
      available: row.available as boolean,
    };
  }
}
