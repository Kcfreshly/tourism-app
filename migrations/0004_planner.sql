ALTER TABLE trips ADD COLUMN IF NOT EXISTS services jsonb NOT NULL DEFAULT '{"assistance":"DRIVER_ONLY","vehicleWindows":{},"guideItemIds":[],"guideDays":[]}';
CREATE TABLE IF NOT EXISTS planner_proposals (id uuid PRIMARY KEY, trip_id uuid NOT NULL REFERENCES trips(id), trip_version integer NOT NULL, payload jsonb NOT NULL, expires_at timestamptz NOT NULL, applied_at timestamptz);
