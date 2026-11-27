CREATE TABLE IF NOT EXISTS transport_settings (id text PRIMARY KEY, settings jsonb NOT NULL, version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now());
