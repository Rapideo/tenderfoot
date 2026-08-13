-- SP1. The eleven objects of design spec §4, in one transaction.
-- FKs are enforced (PRAGMA set in db/index.ts). §2.2: retrofitting them is
-- the expensive mistake, and they are worth nothing unenforced.
--
-- Money is integer cents. Dates are ISO-8601 text. SQLite has neither type,
-- and floats for money are a defect waiting to be found.

-- ---------- BUYER SIDE ----------------------------------------------------
CREATE TABLE organization (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  parent_id    INTEGER REFERENCES organization(id),   -- State → FSSA → Division
  jurisdiction TEXT,                                  -- 'IN', 'US', 'NY'
  kind         TEXT,                                  -- agency | county | school | health | foundation
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  source_note  TEXT
);
CREATE INDEX org_parent ON organization(parent_id);

-- "Indiana Family and Social Services Administration", "FSSA", "IN-FSSA"
-- are ONE row. §4.1 calls this the entity resolution problem in its
-- entirety. A JSON column could not be indexed, joined, or given provenance.
CREATE TABLE organization_alias (
  id          INTEGER PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  alias       TEXT NOT NULL,
  source_note TEXT,
  UNIQUE (alias, org_id)
);

-- ---------- SELLER SIDE ---------------------------------------------------
CREATE TABLE vendor (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  -- KP is an ordinary vendor row with a profile attached. §4.2: this is what
  -- keeps the system portable -- a second customer is a second row.
  is_self     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  source_note TEXT
);
CREATE UNIQUE INDEX vendor_one_self ON vendor(is_self) WHERE is_self = 1;

CREATE TABLE vendor_alias (
  id          INTEGER PRIMARY KEY,
  vendor_id   INTEGER NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
  alias       TEXT NOT NULL,
  source_note TEXT,
  UNIQUE (alias, vendor_id)
);

-- The ONLY place customer-specific facts exist (§4.2, §7.8).
-- No fact about Koehler Partners appears in code.
CREATE TABLE firm_profile (
  id                INTEGER PRIMARY KEY,
  vendor_id         INTEGER NOT NULL UNIQUE REFERENCES vendor(id),
  capabilities      TEXT,   -- free text; carries "Medicaid managed care operations"
  codes             TEXT,   -- JSON: NAICS, PSC, UNSPSC, state commodity
  certifications    TEXT,   -- JSON: WBE, MBE, DBE, 8(a), state equivalents
  geography         TEXT,   -- JSON; §1A scope is a Profile setting, not code
  remote_ok         INTEGER NOT NULL DEFAULT 1,
  -- ELIGIBILITY THRESHOLDS ONLY (§1). These answer "can KP legally bid this",
  -- never "should KP take this on". The system is capacity-agnostic, and that
  -- rule binds the machine rather than the user -- see §1's clarification.
  hard_limits       TEXT,   -- JSON: bonding, insurance, headcount, revenue, registrations
  -- Deferred 2026-08-10: records not accessible. Stays in the model, stays
  -- empty, NOTHING may be designed to depend on it (§7.3).
  past_performance  TEXT,
  -- What will never be bid, and why. Lost its last source when the hand-run
  -- was retired 2026-08-11; fills from real decisions or not at all.
  negative_profile  TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- THE EVENT CHAIN -----------------------------------------------
-- Solicitation → Award → Contract. A GRAPH, not a required sequence:
-- awards and contracts may exist with no solicitation, discovered from
-- spending data (§4.3).
CREATE TABLE solicitation (
  id              INTEGER PRIMARY KEY,
  org_id          INTEGER REFERENCES organization(id),
  external_id     TEXT,                    -- the portal's own id
  title           TEXT NOT NULL,
  kind            TEXT,                    -- RFP | RFI | RFQ | IFB | sources-sought
  status          TEXT,
  posted_at       TEXT,
  -- The highest-consequence extracted field (§8.4). A real bundle in the
  -- corpus ships three PDFs carrying TWO different deadlines, with the
  -- correct one in the least specifically named file. Listing metadata
  -- outranks document text, and a disagreement is DISPLAYED, not resolved.
  closes_at       TEXT,
  qa_closes_at    TEXT,                    -- often earlier and more binding
  prebid_at       TEXT,
  prebid_required INTEGER,
  value_cents     INTEGER,                 -- integer cents; never a float
  codes           TEXT,                    -- JSON
  set_aside       TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  source_note     TEXT
);
CREATE INDEX solicitation_org    ON solicitation(org_id);
CREATE INDEX solicitation_closes ON solicitation(closes_at);

CREATE TABLE award (
  id              INTEGER PRIMARY KEY,
  solicitation_id INTEGER REFERENCES solicitation(id),   -- nullable: see §4.3
  org_id          INTEGER REFERENCES organization(id),
  vendor_id       INTEGER REFERENCES vendor(id),
  value_cents     INTEGER,
  awarded_at      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  source_note     TEXT
);
CREATE INDEX award_solicitation ON award(solicitation_id);

CREATE TABLE contract (
  id              INTEGER PRIMARY KEY,
  award_id        INTEGER REFERENCES award(id),
  org_id          INTEGER REFERENCES organization(id),
  vendor_id       INTEGER REFERENCES vendor(id),
  external_id     TEXT,
  starts_at       TEXT,
  -- "The contract end date is the highest-value field in the system" (§4.3).
  -- It is the entire answer to problem #2, and the expiration radar is a
  -- query over this column.
  ends_at         TEXT,
  value_cents     INTEGER,
  renewal_options TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  source_note     TEXT
);
CREATE INDEX contract_ends   ON contract(ends_at);
CREATE INDEX contract_vendor ON contract(vendor_id);

-- ---------- THE THREE THAT GET SKIPPED ------------------------------------
-- Data, not code (§4.4, §5). Adding a source is a row and a config.
CREATE TABLE source (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE,
  jurisdiction   TEXT,
  platform       TEXT,      -- §5.7: adapters bind to PLATFORM + config, not jurisdiction
  adapter_tier   TEXT,      -- 1 api | 2 email/rss | 3 html | 4 manual
  -- §5.5 and the standing rule at §5.5.1: in | manual-only | out.
  -- Ambiguous or restrictive terms default a source to OUT; documented
  -- permission moves it IN, and the evidence is recorded HERE rather than
  -- remembered.
  legal_posture  TEXT NOT NULL DEFAULT 'out'
                 CHECK (legal_posture IN ('in', 'manual-only', 'out')),
  legal_note     TEXT,
  archive_depth  TEXT,      -- 1C: promoted to a primary selection criterion
  -- §5.4. Four confirmed instances across three platforms of a parameter
  -- accepted and silently ignored. Records which parameters were VERIFIED to
  -- filter, by watching a total move. Where a source withholds totals the
  -- check cannot run -- record that too.
  verified_facets TEXT,
  -- The ingestion window. `since = last successful run`, seeded at a week.
  -- A fixed lookback loses a day permanently when a run fails.
  since_default  TEXT,
  last_run_at    TEXT,
  health         TEXT NOT NULL DEFAULT 'unknown',
  enabled        INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  source_note    TEXT
);

-- "Source X showed us this listing on date Y." Raw, unmerged, immutable.
-- A solicitation is the canonical record produced by MERGING sightings.
-- Deliberately no unique constraint on solicitation_id: many sightings, one
-- canonical row. This separation buys dedup, change detection, and honest
-- per-source yield (§4.4).
CREATE TABLE sighting (
  id              INTEGER PRIMARY KEY,
  source_id       INTEGER NOT NULL REFERENCES source(id),
  solicitation_id INTEGER REFERENCES solicitation(id),
  external_id     TEXT,
  seen_at         TEXT NOT NULL DEFAULT (datetime('now')),
  raw             TEXT,     -- the payload as received, unmodified
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX sighting_solicitation ON sighting(solicitation_id);
CREATE INDEX sighting_source       ON sighting(source_id, seen_at);

CREATE TABLE document (
  id              INTEGER PRIMARY KEY,
  solicitation_id INTEGER REFERENCES solicitation(id),
  contract_id     INTEGER REFERENCES contract(id),
  filename        TEXT NOT NULL,
  media_type      TEXT,     -- pdf | docx | xlsx | pptx | zip -- PDF-only covers ~half
  -- Bytes live on the FILESYSTEM, path here. Bundles reach 21 MB and there
  -- are thousands (workflow spec §9.2).
  path            TEXT,
  bytes           INTEGER,
  extracted_text  TEXT,
  -- Three states, not two: a value with confidence, ABSENT, or not yet
  -- looked for. "We looked and it is not there" is a different fact from
  -- "we are unsure" (SVRC View 2.3).
  extract_status  TEXT NOT NULL DEFAULT 'pending'
                  CHECK (extract_status IN ('pending', 'extracted', 'absent', 'failed')),
  confidence      REAL,
  -- Which mode produced this: mechanical | smart. Recorded IN THE DATA, not
  -- only in config -- without it, mechanical and smart cannot be compared on
  -- the same hand-labelled set and §8.4 is unmeasurable per mode.
  produced_by     TEXT CHECK (produced_by IN ('mechanical', 'smart') OR produced_by IS NULL),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  source_note     TEXT
);
CREATE INDEX document_solicitation ON document(solicitation_id);

-- ---------- JUDGMENT LAYER ------------------------------------------------
-- Created empty and STAYS empty in V1: matching is parked (§1.1). The table
-- costs nothing; adding scorer_version to judgments already recorded would
-- cost what §2.2 warns about.
CREATE TABLE assessment (
  id              INTEGER PRIMARY KEY,
  solicitation_id INTEGER NOT NULL REFERENCES solicitation(id),
  profile_id      INTEGER NOT NULL REFERENCES firm_profile(id),
  scorer_version  TEXT NOT NULL,
  fit             INTEGER,
  winnability     INTEGER,
  value_score     INTEGER,
  timing          INTEGER,
  evidence        TEXT,     -- JSON: quoted text + document pointer per score
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX assessment_solicitation ON assessment(solicitation_id, scorer_version);

-- The system of record -- problem #4. Stubbed lifecycle per component 4B:
-- New → Triaged → Interested / Not Interested. Screen 7's fuller board
-- (Watching → Bid/No-Bid → Drafting → Submitted → Outcome) is deferred (§9).
CREATE TABLE pursuit (
  id              INTEGER PRIMARY KEY,
  solicitation_id INTEGER NOT NULL REFERENCES solicitation(id),
  state           TEXT NOT NULL DEFAULT 'New'
                  CHECK (state IN ('New', 'Triaged', 'Interested', 'Not Interested')),
  -- THE REASON MATTERS MORE THAN THE DECISION (§7.1). Free text in V1: chips
  -- are parked with qualification, and a preset vocabulary would flatten
  -- exactly the signal it exists to capture.
  reason          TEXT,
  -- Who decided. Two people scoring cannot be merged into one ground truth
  -- without knowing whose is whose.
  decided_by      TEXT,
  decided_at      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX pursuit_solicitation ON pursuit(solicitation_id);
CREATE INDEX pursuit_state        ON pursuit(state);
