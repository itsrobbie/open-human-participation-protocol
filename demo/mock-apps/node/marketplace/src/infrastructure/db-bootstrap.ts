import type { Pool } from 'pg';

/**
 * Bootstraps the marketplace schema and seed data in the shared World database.
 */
export async function bootstrapDatabase(pool: Pool): Promise<void> {
  // Schema is created by the World DB init script (001_world_schemas.sql).
  // This bootstrap only creates tables and seeds data within the schema.
  await pool.query(`

    CREATE TABLE IF NOT EXISTS marketplace.products (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      rating NUMERIC(2,1) NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      bundle_eligible BOOLEAN NOT NULL DEFAULT false,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS marketplace.purchases (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      items JSONB NOT NULL,
      subtotal INTEGER NOT NULL,
      shipping_cost INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      status TEXT NOT NULL,
      shipping_address JSONB NOT NULL,
      delivery_slot TEXT,
      participation_request_id TEXT,
      participation_status TEXT,
      signature_attestation_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS marketplace.refund_requests (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      participation_request_id TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS marketplace.registrations (
      registration_id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL,
      resolver_base_url TEXT NOT NULL,
      user_id TEXT NOT NULL,
      app_user_id TEXT NOT NULL,
      access_token TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS marketplace.pending_challenges (
      challenge_id TEXT PRIMARY KEY,
      app_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Seed products (idempotent via ON CONFLICT DO NOTHING)
  await pool.query(`
    INSERT INTO marketplace.products (id, seller_id, name, description, price, category, stock, rating, review_count, bundle_eligible, created_at) VALUES
      ('wireless-headphones', 'seller-01', 'Wireless Noise-Cancelling Headphones', 'Premium over-ear headphones with ANC and 30hr battery', 14999, 'electronics', 25, 4.7, 342, false, '2026-01-15T10:00:00Z'),
      ('smart-watch', 'seller-01', 'Smart Watch Pro', 'Fitness tracker with GPS, heart rate, and sleep monitoring', 19999, 'electronics', 15, 4.5, 218, false, '2026-02-01T10:00:00Z'),
      ('usb-c-hub', 'seller-02', 'USB-C Hub 7-in-1', 'HDMI, USB-A, SD card, ethernet adapter', 3499, 'electronics', 50, 4.3, 89, true, '2026-03-10T10:00:00Z'),
      ('running-shoes', 'seller-03', 'Trail Running Shoes', 'Lightweight trail runners with grip sole', 8999, 'sports', 30, 4.6, 156, false, '2026-01-20T10:00:00Z'),
      ('yoga-mat', 'seller-03', 'Premium Yoga Mat', 'Non-slip 6mm thickness with carry strap', 2999, 'sports', 40, 4.8, 412, true, '2026-02-15T10:00:00Z'),
      ('winter-jacket', 'seller-04', 'Insulated Winter Jacket', 'Waterproof down jacket with hood', 12999, 'clothing', 20, 4.4, 67, false, '2026-03-01T10:00:00Z'),
      ('cotton-tshirt', 'seller-04', 'Organic Cotton T-Shirt Pack (3)', 'Breathable everyday tees in black, white, grey', 2499, 'clothing', 100, 4.2, 523, false, '2026-01-10T10:00:00Z'),
      ('desk-lamp', 'seller-05', 'LED Desk Lamp with Wireless Charger', 'Adjustable colour temperature, built-in Qi pad', 4999, 'home', 35, 4.5, 198, false, '2026-02-20T10:00:00Z'),
      ('plant-pot-set', 'seller-05', 'Ceramic Plant Pot Set (4)', 'Minimalist design with drainage holes', 3299, 'home', 45, 4.6, 87, false, '2026-03-05T10:00:00Z'),
      ('sci-fi-novel', 'seller-06', 'The Quantum Garden', 'Award-winning sci-fi novel by Derek Kunsken', 899, 'books', 200, 4.9, 1024, false, '2026-01-05T10:00:00Z'),
      ('cookbook', 'seller-06', 'Modern Asian Kitchen', 'Over 100 recipes from across East Asia', 2199, 'books', 60, 4.7, 312, false, '2026-02-10T10:00:00Z'),
      ('mechanical-keyboard', 'seller-02', 'Mechanical Keyboard (Out of Stock)', '75% layout with hot-swappable switches', 11999, 'electronics', 0, 4.8, 445, false, '2026-03-15T10:00:00Z')
    ON CONFLICT (id) DO NOTHING;
  `);
}
