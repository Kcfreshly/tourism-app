-- Staff invite a business they've already vetted. The link carries a random
-- token; only its sha256 is stored. Accepting it makes the signed-in account
-- the owner of a partner that is verified straight away. See
-- docs/PARTNER_ONBOARDING.md.
CREATE TABLE IF NOT EXISTS partner_invites (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  business_name text NOT NULL,
  contact_email text NOT NULL,
  phone text NOT NULL,
  offering text NOT NULL,
  created_by text NOT NULL REFERENCES auth_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  accepted_by text REFERENCES auth_user(id),
  accepted_at timestamptz,
  partner_id uuid REFERENCES partners(id)
);
CREATE INDEX IF NOT EXISTS partner_invites_created_idx ON partner_invites (created_at DESC);
