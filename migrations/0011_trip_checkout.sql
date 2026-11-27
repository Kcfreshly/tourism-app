-- Trip checkout: a planned trip paid in one payment. Activities hold places
-- like cart lines; cars, night cars and guides become service requests that
-- staff match after payment. See docs/PAYMENT_INTEGRATION_PLAN.md (phase 2).

-- The trip and version a checkout was priced from. A logical link: deleting
-- a trip draft must not be blocked by its payment records.
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS trip_id uuid;
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS trip_version integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS trip_id uuid;
CREATE INDEX IF NOT EXISTS orders_trip_idx ON orders (trip_id);

-- Service lines take no places from a slot.
ALTER TABLE checkout_lines ALTER COLUMN slot_id DROP NOT NULL;
ALTER TABLE checkout_lines DROP CONSTRAINT IF EXISTS checkout_lines_product_type_check;
ALTER TABLE checkout_lines ADD CONSTRAINT checkout_lines_product_type_check CHECK (product_type IN ('EXPERIENCE', 'PACKAGE', 'SERVICE'));
ALTER TABLE checkout_lines ADD CONSTRAINT checkout_lines_slot_check CHECK ((product_type = 'SERVICE') = (slot_id IS NULL));

-- A paid car, night car or guide waiting to be matched. One per service line.
CREATE TABLE IF NOT EXISTS service_requests (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  checkout_line_id uuid NOT NULL UNIQUE REFERENCES checkout_lines(id),
  user_id text NOT NULL REFERENCES auth_user(id),
  trip_id uuid,
  service text NOT NULL CHECK (service IN ('CAR', 'NIGHT_CAR', 'FULL_DAY_GUIDE', 'ACTIVITY_GUIDE')),
  local_date date NOT NULL,
  start_time text NOT NULL,
  status text NOT NULL CHECK (status IN ('REQUESTED', 'MATCHED', 'COMPLETED', 'UNMATCHED', 'CANCELLED')),
  -- Matched by this time, or a refund is due (48 h before the service).
  match_by timestamptz NOT NULL,
  -- Who was matched: name, phone, vehicle. Null until matched.
  assignee jsonb,
  total_minor bigint NOT NULL,
  fee_minor bigint NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_requests_status_idx ON service_requests (status, match_by);
CREATE INDEX IF NOT EXISTS service_requests_order_idx ON service_requests (order_id);

CREATE TABLE IF NOT EXISTS service_request_history (
  id uuid PRIMARY KEY,
  service_request_id uuid NOT NULL REFERENCES service_requests(id),
  from_status text,
  to_status text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('USER', 'STAFF', 'PARTNER', 'SYSTEM')),
  actor_id text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_request_history_request_idx ON service_request_history (service_request_id);
