-- ============================================================================
-- E-COMMERCE TABLES FOR DJI AGRAS
-- ============================================================================

-- Shopping Carts
CREATE TABLE IF NOT EXISTS shopping_carts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraints for carts
ALTER TABLE shopping_carts ADD CONSTRAINT shopping_carts_user_org_unique UNIQUE (user_id, org_id);
ALTER TABLE shopping_carts ADD CONSTRAINT shopping_carts_session_unique UNIQUE (session_id);

-- Cart Items
CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cart_id TEXT REFERENCES shopping_carts(id) ON DELETE CASCADE,
  sku_id TEXT REFERENCES skus(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint for cart items
ALTER TABLE cart_items ADD CONSTRAINT cart_items_cart_sku_unique UNIQUE (cart_id, sku_id);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_number TEXT UNIQUE NOT NULL,
  buyer_org_id TEXT REFERENCES organizations(id),
  seller_org_id TEXT REFERENCES organizations(id),

  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED')),
  payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED')),

  -- Totali
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',

  -- Indirizzi
  shipping_address JSONB,
  billing_address JSONB,

  -- Note e tracking
  customer_notes TEXT,
  internal_notes TEXT,
  tracking_number TEXT,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Lines
CREATE TABLE IF NOT EXISTS order_lines (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  sku_id TEXT REFERENCES skus(id),
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  line_total_cents INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT REFERENCES orders(id),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  external_id TEXT, -- ID Stripe, PayPal, etc.
  payment_data JSONB, -- Dati aggiuntivi del pagamento
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Address Types Enum
DO $$ BEGIN
  CREATE TYPE address_type AS ENUM ('SHIPPING', 'BILLING');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Addresses
CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  type address_type NOT NULL,
  name TEXT NOT NULL, -- Nome contatto
  company TEXT,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'IT',
  phone TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Messages
CREATE TABLE IF NOT EXISTS order_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  sender_org_id TEXT NOT NULL REFERENCES organizations(id),
  sender_user_id TEXT,
  message_text TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shopping_carts_org_id ON shopping_carts(org_id);
CREATE INDEX IF NOT EXISTS idx_shopping_carts_user_id ON shopping_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_org_id ON orders(buyer_org_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_org_id ON orders(seller_org_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_lines_order_id ON order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_addresses_org_id ON addresses(org_id);
CREATE INDEX IF NOT EXISTS idx_addresses_type ON addresses(type);
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_sender_org_id ON order_messages(sender_org_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_created_at ON order_messages(created_at);

-- Insert some test data if tables are empty
-- Check if we have test data already
DO $$
DECLARE
  cart_count INTEGER;
  order_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cart_count FROM shopping_carts;
  SELECT COUNT(*) INTO order_count FROM orders;

  -- Only insert test data if tables are empty
  IF cart_count = 0 AND order_count = 0 THEN
    RAISE NOTICE 'Inserting test e-commerce data...';

    -- Insert test cart for buyer-org-1
    INSERT INTO shopping_carts (id, org_id, session_id)
    VALUES ('test-cart-1', 'buyer-org-1', 'test-session-123')
    ON CONFLICT DO NOTHING;

    -- Insert test cart item
    INSERT INTO cart_items (cart_id, sku_id, quantity, unit_price_cents)
    VALUES ('test-cart-1', 'sku_t30', 1, 1500000)
    ON CONFLICT DO NOTHING;

    -- Insert test addresses for buyer-org-1
    INSERT INTO addresses (id, org_id, type, name, company, address_line, city, province, postal_code, country, phone, is_default)
    VALUES
      ('test-shipping-1', 'buyer-org-1', 'SHIPPING', 'Mario Rossi', 'Azienda Agricola Rossi S.r.l.', 'Via Roma 123', 'Milano', 'MI', '20100', 'IT', '+39 123 456 7890', true),
      ('test-billing-1', 'buyer-org-1', 'BILLING', 'Mario Rossi', 'Azienda Agricola Rossi S.r.l.', 'Via Roma 123', 'Milano', 'MI', '20100', 'IT', '+39 123 456 7890', true)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Test data inserted successfully!';
  ELSE
    RAISE NOTICE 'Tables already contain data, skipping test data insertion.';
  END IF;
END $$;
