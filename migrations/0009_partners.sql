-- Partner portal: partner businesses, who can act for them, the listings and
-- ready-made trips they submit for approval, and listing views for their
-- dashboard. See docs/PARTNER_PORTAL.md.
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY,
  business_name text NOT NULL,
  contact_email text NOT NULL,
  phone text NOT NULL,
  offering text NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING', 'VERIFIED', 'DECLINED', 'SUSPENDED')),
  decision_reason text,
  decided_by text,
  decided_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partners_status_idx ON partners (status);

-- Membership, not an account role: a partner can also travel, and a business
-- can add staff later. One business per account for now.
CREATE TABLE IF NOT EXISTS partner_members (
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER', 'STAFF')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (partner_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS partner_members_user_idx ON partner_members (user_id);

-- Who runs a live listing or trip; null for ones Fastlife runs itself.
ALTER TABLE catalogue ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES partners(id);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES partners(id);
CREATE INDEX IF NOT EXISTS catalogue_partner_idx ON catalogue (partner_id);
CREATE INDEX IF NOT EXISTS packages_partner_idx ON packages (partner_id);

-- A partner's proposed listing or trip. The catalogue only ever holds what
-- staff approved: a new listing is created when its first submission is
-- approved, and an edit to a live one waits here while the live version keeps
-- selling. `proposed` is the whole record as the partner last saved it.
CREATE TABLE IF NOT EXISTS listing_submissions (
  id uuid PRIMARY KEY,
  partner_id uuid NOT NULL REFERENCES partners(id),
  product_type text NOT NULL CHECK (product_type IN ('EXPERIENCE', 'PACKAGE')),
  product_id uuid,
  base_version integer,
  name text NOT NULL,
  proposed jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN')),
  reason text,
  version integer NOT NULL DEFAULT 1,
  created_by text NOT NULL,
  submitted_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS listing_submissions_partner_idx ON listing_submissions (partner_id);
CREATE INDEX IF NOT EXISTS listing_submissions_status_idx ON listing_submissions (status);
-- At most one open change per live listing.
CREATE UNIQUE INDEX IF NOT EXISTS listing_submissions_open_idx ON listing_submissions (product_id) WHERE product_id IS NOT NULL AND status IN ('DRAFT', 'PENDING', 'DECLINED');

-- Listing views per day and visitor (a hashed browser id). Views add up;
-- visitors are the rows. Experiences use their catalogue id, trips their slug.
CREATE TABLE IF NOT EXISTS listing_visits (
  product_type text NOT NULL CHECK (product_type IN ('EXPERIENCE', 'PACKAGE')),
  product_id text NOT NULL,
  day date NOT NULL,
  visitor text NOT NULL,
  views integer NOT NULL DEFAULT 1,
  PRIMARY KEY (product_type, product_id, day, visitor)
);
CREATE INDEX IF NOT EXISTS listing_visits_day_idx ON listing_visits (day);
