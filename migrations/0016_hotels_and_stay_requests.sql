-- Stay preferences when Fastlife books the stay: travellers choose an area
-- and type of stay, then search Fastlife's own hotel list, name a place we
-- don't list, paste a link, or ask us to recommend. See
-- docs/CUSTOMER_ONBOARDING_TODO.md, section 1.

-- Places to stay, entered by staff. Search only works as well as this list.
CREATE TABLE IF NOT EXISTS hotels (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  -- Other names travellers use for it.
  aliases text[] NOT NULL DEFAULT '{}',
  zone_id text NOT NULL CHECK (zone_id IN ('LEKKI', 'VI', 'MAINLAND')),
  type text NOT NULL CHECK (type IN ('HOTEL', 'APARTMENT', 'GUESTHOUSE', 'RESORT')),
  address text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hotels_active_idx ON hotels (active, zone_id);

-- Existing trips where Fastlife books the stay: the free-text preference
-- becomes a named place to check (unverified), or a request to recommend.
UPDATE trips
SET profile = jsonb_set(
      profile,
      '{stay}',
      jsonb_build_object(
        'type', 'HOTEL',
        'choice',
        CASE
          WHEN length(btrim(coalesce(profile->>'accommodation', ''))) >= 2
            THEN jsonb_build_object('kind', 'NAMED', 'name', left(btrim(profile->>'accommodation'), 120))
          ELSE jsonb_build_object('kind', 'RECOMMEND')
        END
      )
    ) || jsonb_build_object('accommodation', '')
WHERE profile->>'accommodationBy' = 'FASTLIFE' AND NOT (profile ? 'stay');
