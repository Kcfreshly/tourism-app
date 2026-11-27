-- The audit trail is append-only. The app (and so every admin) can insert and
-- read events, never change or remove them. Only a developer, from a database
-- console, can lift this for one session with: SET app.allow_audit_ddl = 'on';
CREATE OR REPLACE FUNCTION audit_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: events can be added and read, never changed or removed';
END
$$;

DROP TRIGGER IF EXISTS audit_events_no_change ON audit_events;
CREATE TRIGGER audit_events_no_change BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();

DROP TRIGGER IF EXISTS audit_events_no_truncate ON audit_events;
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON audit_events FOR EACH STATEMENT EXECUTE FUNCTION audit_events_append_only();

-- Refuses dropping the table, its triggers or these functions, and altering
-- the table (for example to disable a trigger), unless a developer opted in.
CREATE OR REPLACE FUNCTION audit_events_guard_drop() RETURNS event_trigger LANGUAGE plpgsql AS $$
DECLARE o record;
BEGIN
  IF current_setting('app.allow_audit_ddl', true) = 'on' THEN RETURN; END IF;
  FOR o IN SELECT * FROM pg_event_trigger_dropped_objects() LOOP
    IF o.object_identity LIKE '%audit_events%' THEN
      RAISE EXCEPTION 'audit_events is protected: only a developer can drop it from a database console';
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION audit_events_guard_alter() RETURNS event_trigger LANGUAGE plpgsql AS $$
DECLARE o record;
BEGIN
  IF current_setting('app.allow_audit_ddl', true) = 'on' THEN RETURN; END IF;
  FOR o IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
    IF o.object_identity LIKE '%audit_events%' THEN
      RAISE EXCEPTION 'audit_events is protected: only a developer can alter it from a database console';
    END IF;
  END LOOP;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'audit_events_no_drop') THEN
    CREATE EVENT TRIGGER audit_events_no_drop ON sql_drop EXECUTE FUNCTION audit_events_guard_drop();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'audit_events_no_alter') THEN
    CREATE EVENT TRIGGER audit_events_no_alter ON ddl_command_end WHEN TAG IN ('ALTER TABLE', 'CREATE TRIGGER') EXECUTE FUNCTION audit_events_guard_alter();
  END IF;
END
$$;

-- A starting snapshot of every listing, so each one can be recovered even if
-- it has never been edited. Later saves add their own snapshots.
INSERT INTO audit_events (id, actor_id, action, entity_id, details)
SELECT gen_random_uuid(), 'migration-0008', 'CATALOGUE_SNAPSHOT', id::text,
  jsonb_build_object('snapshot', jsonb_build_object('id', id, 'seedKey', seed_key, 'status', status, 'version', version, 'record', record, 'review', review))
FROM catalogue;

-- Photos staff upload for listings. Rows are never deleted, so a restored
-- listing gets its photos back too.
CREATE TABLE IF NOT EXISTS media (id uuid PRIMARY KEY, content_type text NOT NULL, bytes integer NOT NULL, sha256 text NOT NULL UNIQUE, data bytea NOT NULL, uploaded_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
