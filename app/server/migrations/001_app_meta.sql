-- SP0. Infrastructure only -- NOT domain schema.
-- The eleven objects of design spec §4 arrive in SP1 and belong in their
-- own migration. This table exists so SP0 has something real to read and
-- write, and it earns its place later as the home for last-run timestamps
-- and schema version.
CREATE TABLE app_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO app_meta (key, value, updated_at)
VALUES ('schema_owner', 'sp0', datetime('now'));
