CREATE TABLE IF NOT EXISTS sessions (
 id uuid PRIMARY KEY, token_hash text NOT NULL UNIQUE, role text NOT NULL DEFAULT 'GUEST', expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS trips (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES sessions(id), version integer NOT NULL DEFAULT 1,
 profile jsonb NOT NULL, items jsonb NOT NULL DEFAULT '[]', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trips_owner ON trips(owner_id);
CREATE TABLE IF NOT EXISTS catalogue (
 id uuid PRIMARY KEY, seed_key text NOT NULL UNIQUE, status text NOT NULL, version integer NOT NULL DEFAULT 1, record jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS migration_history (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
