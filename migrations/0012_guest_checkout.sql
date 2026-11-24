-- Guest checkout for events whose partner allows it (see
-- docs/GUEST_CHECKOUT.md). A guest checkout, its order and bookings have no
-- account; the buyer's browser proves ownership with a random key, stored
-- here only as a SHA-256 hash.
ALTER TABLE checkouts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS guest_key_hash text;
ALTER TABLE checkouts DROP CONSTRAINT IF EXISTS checkouts_owner_check;
ALTER TABLE checkouts ADD CONSTRAINT checkouts_owner_check
  CHECK (user_id IS NOT NULL OR guest_key_hash IS NOT NULL);
CREATE INDEX IF NOT EXISTS checkouts_guest_idx ON checkouts (guest_key_hash)
  WHERE guest_key_hash IS NOT NULL;
