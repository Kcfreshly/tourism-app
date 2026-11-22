CREATE TABLE IF NOT EXISTS packages (id uuid PRIMARY KEY, slug text NOT NULL UNIQUE, status text NOT NULL, version integer NOT NULL DEFAULT 1, record jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS packages_status_idx ON packages (status);
