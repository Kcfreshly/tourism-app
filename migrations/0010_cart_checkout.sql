-- Cart on the server, holds on capacity, payment and bookings. See
-- docs/CART_END_TO_END.md and docs/PAYMENT_INTEGRATION_PLAN.md. Money is kobo.

-- One cart document per account (C1), like account_buckets.
CREATE TABLE IF NOT EXISTS account_carts (
  user_id text PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  lines jsonb NOT NULL DEFAULT '[]',
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per sellable start: what checkouts lock. Created on first use;
-- capacity is refreshed from the listing or departure on every checkout.
-- start_time is 'HH:MM' for fixed sessions, 'DAY' for drop-in listings and
-- ready-made trips (D3).
CREATE TABLE IF NOT EXISTS inventory_slots (
  id uuid PRIMARY KEY,
  product_type text NOT NULL CHECK (product_type IN ('EXPERIENCE', 'PACKAGE')),
  product_id text NOT NULL,
  partner_id uuid REFERENCES partners(id),
  local_date date NOT NULL,
  start_time text NOT NULL,
  capacity integer NOT NULL CHECK (capacity >= 0),
  capacity_unit text NOT NULL CHECK (capacity_unit IN ('PERSON', 'GROUP', 'SEAT')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_type, product_id, local_date, start_time)
);

-- A priced cart with places held until expires_at. Becomes an order once
-- payment is verified.
CREATE TABLE IF NOT EXISTS checkouts (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_user(id),
  status text NOT NULL CHECK (status IN ('HELD', 'PAYMENT_PENDING', 'PAID', 'EXPIRED', 'FAILED', 'REQUIRES_REVIEW')),
  subtotal_minor bigint NOT NULL,
  fee_minor bigint NOT NULL,
  total_minor bigint NOT NULL CHECK (total_minor > 0),
  currency char(3) NOT NULL DEFAULT 'NGN',
  price_version text NOT NULL,
  expires_at timestamptz NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  review_reason text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkouts_user_idx ON checkouts (user_id, created_at);
CREATE INDEX IF NOT EXISTS checkouts_open_idx ON checkouts (status, expires_at);

CREATE TABLE IF NOT EXISTS checkout_lines (
  id uuid PRIMARY KEY,
  checkout_id uuid NOT NULL REFERENCES checkouts(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  cart_line_id text NOT NULL,
  product_type text NOT NULL CHECK (product_type IN ('EXPERIENCE', 'PACKAGE')),
  product_id text NOT NULL,
  partner_id uuid REFERENCES partners(id),
  slot_id uuid NOT NULL REFERENCES inventory_slots(id),
  local_date date NOT NULL,
  start_time text NOT NULL,
  units integer NOT NULL CHECK (units > 0),
  title text NOT NULL,
  cart_line jsonb NOT NULL,
  price_rows jsonb NOT NULL,
  subtotal_minor bigint NOT NULL,
  fee_minor bigint NOT NULL,
  total_minor bigint NOT NULL,
  terms jsonb NOT NULL,
  UNIQUE (checkout_id, line_no)
);
CREATE INDEX IF NOT EXISTS checkout_lines_slot_idx ON checkout_lines (slot_id);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY,
  checkout_id uuid NOT NULL UNIQUE REFERENCES checkouts(id),
  user_id text NOT NULL REFERENCES auth_user(id),
  reference text NOT NULL UNIQUE,
  total_minor bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id, created_at);

-- One per checkout line, created when payment succeeds.
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  checkout_line_id uuid NOT NULL UNIQUE REFERENCES checkout_lines(id),
  user_id text NOT NULL REFERENCES auth_user(id),
  slot_id uuid NOT NULL REFERENCES inventory_slots(id),
  product_type text NOT NULL CHECK (product_type IN ('EXPERIENCE', 'PACKAGE')),
  product_id text NOT NULL,
  local_date date NOT NULL,
  start_time text NOT NULL,
  units integer NOT NULL CHECK (units > 0),
  partner_id uuid REFERENCES partners(id),
  -- Copied at payment so later rate changes don't rewrite history (D10).
  commission_bps integer,
  status text NOT NULL CHECK (status IN ('AWAITING_PARTNER', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED', 'NO_SHOW')),
  partner_deadline timestamptz,
  total_minor bigint NOT NULL,
  fee_minor bigint NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_slot_idx ON bookings (slot_id);
CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings (user_id, created_at);
CREATE INDEX IF NOT EXISTS bookings_partner_date_idx ON bookings (partner_id, local_date);
CREATE INDEX IF NOT EXISTS bookings_partner_created_idx ON bookings (partner_id, created_at);

CREATE TABLE IF NOT EXISTS booking_status_history (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES bookings(id),
  from_status text,
  to_status text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('USER', 'STAFF', 'PARTNER', 'SYSTEM')),
  actor_id text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_status_history_booking_idx ON booking_status_history (booking_id);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY,
  checkout_id uuid NOT NULL REFERENCES checkouts(id),
  provider text NOT NULL,
  reference text NOT NULL UNIQUE,
  access_code text,
  authorization_url text,
  amount_minor bigint NOT NULL,
  currency char(3) NOT NULL,
  status text NOT NULL CHECK (status IN ('INITIALISED', 'SUCCESS', 'FAILED', 'ABANDONED', 'REVERSED')),
  channel text,
  paid_at timestamptz,
  provider_payload jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_checkout_idx ON payments (checkout_id);

-- Every webhook, stored before it is acted on. A repeat delivery has the same
-- body hash and is ignored.
CREATE TABLE IF NOT EXISTS payment_events (
  id uuid PRIMARY KEY,
  provider text NOT NULL,
  event text NOT NULL,
  reference text,
  payload_sha256 text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text
);
