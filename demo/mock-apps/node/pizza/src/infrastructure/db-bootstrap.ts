import type { Pool } from 'pg';

/**
 * Bootstraps the pizza schema and seed data in the shared World database.
 */
export async function bootstrapDatabase(pool: Pool): Promise<void> {
  // Schema is created by the World DB init script (001_world_schemas.sql).
  // This bootstrap only creates tables and seeds data within the schema.
  await pool.query(`

    CREATE TABLE IF NOT EXISTS pizza.menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      base_price INTEGER NOT NULL,
      image_url TEXT,
      available BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS pizza.toppings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      category TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pizza.orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      items JSONB NOT NULL,
      subtotal INTEGER NOT NULL,
      delivery_fee INTEGER NOT NULL DEFAULT 0,
      tip INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      status TEXT NOT NULL,
      order_mode TEXT NOT NULL DEFAULT 'standard',
      delivery_address JSONB,
      scheduled_for TEXT,
      special_instructions TEXT,
      participation_request_id TEXT,
      participation_status TEXT,
      transaction_id TEXT,
      ohpp_pizza_step INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      estimated_delivery TEXT
    );

    CREATE TABLE IF NOT EXISTS pizza.ohpp_pizza_flows (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      transaction_id TEXT NOT NULL UNIQUE,
      current_step INTEGER NOT NULL DEFAULT 1,
      total_steps INTEGER NOT NULL DEFAULT 7,
      status TEXT NOT NULL DEFAULT 'in_progress',
      active_request_id TEXT,
      selections JSONB NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pizza.registrations (
      registration_id TEXT NOT NULL,
      challenge_id TEXT NOT NULL,
      resolver_base_url TEXT NOT NULL,
      user_id TEXT NOT NULL,
      app_user_id TEXT NOT NULL,
      access_token TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (registration_id)
    );

    CREATE TABLE IF NOT EXISTS pizza.pending_challenges (
      challenge_id TEXT PRIMARY KEY,
      app_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Seed menu items (idempotent via ON CONFLICT DO NOTHING)
  await pool.query(`
    INSERT INTO pizza.menu_items (id, name, description, category, base_price, available) VALUES
      ('margherita', 'Margherita', 'Classic tomato sauce, mozzarella, fresh basil', 'pizza', 999, true),
      ('pepperoni', 'Pepperoni', 'Tomato sauce, mozzarella, spicy pepperoni', 'pizza', 1199, true),
      ('bbq-chicken', 'BBQ Chicken', 'BBQ sauce, chicken, red onion, mozzarella', 'pizza', 1299, true),
      ('veggie-supreme', 'Veggie Supreme', 'Tomato sauce, peppers, mushrooms, olives, sweetcorn', 'pizza', 1149, true),
      ('meat-feast', 'Meat Feast', 'Tomato sauce, pepperoni, ham, bacon, sausage', 'pizza', 1399, true),
      ('garlic-bread', 'Garlic Bread', 'Freshly baked with garlic butter', 'side', 350, true),
      ('chicken-wings', 'Chicken Wings', '8 crispy wings with dipping sauce', 'side', 599, true),
      ('mozzarella-sticks', 'Mozzarella Sticks', '6 golden fried mozzarella sticks', 'side', 499, true),
      ('coleslaw', 'Coleslaw', 'Creamy homemade coleslaw', 'side', 250, true),
      ('cola', 'Cola', '330ml can', 'drink', 179, true),
      ('lemonade', 'Lemonade', '330ml can', 'drink', 179, true),
      ('water', 'Still Water', '500ml bottle', 'drink', 129, true),
      ('beer', 'Craft Beer', '330ml bottle', 'drink', 399, true),
      ('brownie', 'Chocolate Brownie', 'Warm chocolate brownie with ice cream', 'dessert', 449, true),
      ('ice-cream', 'Ice Cream', 'Three scoops, choice of flavour', 'dessert', 349, true),
      ('cookie-dough', 'Cookie Dough', 'Warm cookie dough bites with chocolate sauce', 'dessert', 499, true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO pizza.toppings (id, name, price, category) VALUES
      ('extra-cheese', 'Extra Mozzarella', 150, 'cheese'),
      ('jalapenos', 'Jalapenos', 150, 'vegetable'),
      ('mushrooms', 'Mushrooms', 150, 'vegetable'),
      ('olives', 'Black Olives', 150, 'vegetable'),
      ('bacon', 'Crispy Bacon', 150, 'meat'),
      ('peppers', 'Mixed Peppers', 150, 'vegetable'),
      ('onion', 'Red Onion', 150, 'vegetable'),
      ('ham', 'Sliced Ham', 150, 'meat'),
      ('pineapple', 'Pineapple', 150, 'vegetable'),
      ('sweetcorn', 'Sweetcorn', 150, 'vegetable')
    ON CONFLICT (id) DO NOTHING;
  `);
}
