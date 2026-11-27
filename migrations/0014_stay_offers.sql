-- Stay offers: after a trip is paid, Fastlife staff send one or more places
-- to stay; the traveller approves one and pays for it as a second payment on
-- the same order. The price includes Fastlife's markup, so it carries no
-- separate service fee. See docs/CUSTOMER_ONBOARDING_TODO.md, section 1.

CREATE TABLE IF NOT EXISTS stay_offers (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  property_name text NOT NULL,
  area text NOT NULL,
  address text NOT NULL,
  room text NOT NULL,
  check_in date NOT NULL,
  check_out date NOT NULL CHECK (check_out > check_in),
  note text NOT NULL DEFAULT '',
  price_minor bigint NOT NULL CHECK (price_minor > 0),
  -- The hotel holds the room until then; the traveller must start paying
  -- before it.
  available_until timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('OFFERED', 'BOOKED', 'DECLINED', 'WITHDRAWN')),
  -- The checkout that paid for it, once booked.
  checkout_id uuid REFERENCES checkouts(id),
  created_by text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stay_offers_order_idx ON stay_offers (order_id);
-- At most one booked stay per order.
CREATE UNIQUE INDEX IF NOT EXISTS stay_offers_booked_idx ON stay_offers (order_id) WHERE status = 'BOOKED';

-- A checkout that pays into an existing order (a stay) instead of making one.
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id);

-- Stay lines take no places from a slot, like services.
ALTER TABLE checkout_lines DROP CONSTRAINT IF EXISTS checkout_lines_product_type_check;
ALTER TABLE checkout_lines ADD CONSTRAINT checkout_lines_product_type_check CHECK (product_type IN ('EXPERIENCE', 'PACKAGE', 'SERVICE', 'STAY'));
ALTER TABLE checkout_lines DROP CONSTRAINT IF EXISTS checkout_lines_slot_check;
ALTER TABLE checkout_lines ADD CONSTRAINT checkout_lines_slot_check CHECK ((product_type IN ('SERVICE', 'STAY')) = (slot_id IS NULL));
