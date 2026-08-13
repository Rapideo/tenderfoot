# SP1 — The entity graph

**Plan date:** 2026-08-12 · **Slice:** SP1, after SP0 · **Standard:** `Proto2PRD.md` §5.4
**Components:** 0A schema · 0B Firm Profile · 0C Source Registry · 1A scoping · 1C scrapability · 1E legal posture · 1F whitelist/blacklist · 4J *(minimal)*
**Status:** ◐ **T1–T11 executed 2026-08-12** on branch `sp1-entity-graph`, 33 tests green. **T12–T15 outstanding** — the mock-layer re-extraction and the minimal admin UI, both deliberately not pre-written. See the execution record at the foot.

> **Demo criterion** (plan of action §6): *the prototype's real solicitations load into the real schema; profile and source registry editable.*

---

## Why this slice is the expensive one

**SP1 writes the migration that everything else assumes.** Design spec §2.2 names it directly: *entity foreign keys present from the first migration — retrofitting them is the expensive mistake.* SP0 deliberately created one throwaway-shaped table so that this slice could create the real ones with nothing already sitting on top of them.

**Three things are effectively irreversible after this slice**, and each gets a decision below rather than a default:

1. **Whether entity FKs exist and are enforced** (§2.2)
2. **Whether Sightings are stored separately from canonical Solicitations** (§4.4)
3. **Whether Assessment carries a scorer-version column** even though nothing writes a score in V1

---

## Scope and honesty

**This plan specifies the schema fully.** The schema is the part that is expensive to get wrong and cheap to get right now.

**Two things in this slice are deliberately left as task stubs rather than paste-able code**, because writing them before their inputs exist would be inventing:

- **The mock-layer re-extraction (T12).** `prototype/PROTOTYPE/src/app.js` was extracted from **V1** and V1.1 moved underneath it. Proto2PRD §4.1.1 makes the production model *this dataset normalised*, so the re-extraction has to happen before the seed can be written — **and its rule-bearing comments move to `app/shared/` here**, which is the transfer point named in the workflow spec §2 and `ClaudeDesign_Proto_Cleanup.md`. That is hand work on a moved target; it cannot be pre-written.
- **The Admin UI (T14–T15).** `4J` is *minimal* in this slice — enough to prove the Profile and Registry are editable. The screens proper are SP2 work, behind the design-system sign-off gate, and building them here would pre-empt it.

**If either grows beyond a stub, stop and re-plan.** SP1's job is the graph, not the application.

---

## Decisions taken in this plan

**1. One migration, not eleven.** `002_entity_graph.sql` creates all eleven objects in one transaction. Partial graphs are not meaningfully testable, and the migration runner already wraps each file in a transaction.

**2. `PRAGMA foreign_keys = ON` is already set** (SP0, `app/server/src/db/index.ts`) and every relationship below is a real `REFERENCES` clause. §2.2's warning is only worth anything enforced.

**3. Aliases are their own tables**, not a JSON column. `organization_alias` and `vendor_alias`. Design spec §4.1 calls aliases *"the entity resolution problem in its entirety"*, and the corpus already proves the need: **1,293 distinct vendor names in the Indiana pull, certainly an overcount.** A JSON blob cannot be indexed, joined, or given provenance.

**4. `sighting` is a separate table with no unique constraint on the solicitation.** Many sightings, one canonical row. §4.4: *"nearly free now and expensive later."*

**5. `assessment` is created with `scorer_version`, and nothing writes to it in V1.** Matching is parked (§1.1). The table costs nothing empty, and adding a version column to judgments already recorded is the same class of mistake as retrofitting FKs.

**6. `pursuit` uses the stubbed lifecycle** from component `4B` — `New → Triaged → Interested / Not Interested` — not Screen 7's full board, which is deferred (§9) and whose state machine was only revised on 2026-08-12.

**7. Money is stored in integer cents, dates as ISO-8601 text.** SQLite has no decimal or date type. Floats for money are a defect waiting to be found; ISO text sorts correctly and compares lexically.

**8. Every table carries `created_at` and `source_note`.** The second is a free-text provenance field — *which pull, which run, which document*. The corpus work established repeatedly that a fact without provenance is unusable, and this is cheaper than reconstructing it.

---

## Preconditions

- [x] **P1.** SP0 merged to `main` and `npm run check` green. *Verify:* `git log --oneline -1 && npm run check`
- [x] **P2.** On a branch. *Verify:* `git checkout -b sp1-entity-graph`
- [x] **P3.** Read design spec §4 before starting. The eleven objects and their relationships are specified there; this plan implements that section and does not redefine it.

---

## Tasks

### 1. The migration

- [x] **T1.** Create `app/server/migrations/002_entity_graph.sql` — all eleven objects.

```sql
-- SP1. The eleven objects of design spec §4, in one transaction.
-- FKs are enforced (PRAGMA set in db/index.ts). §2.2: retrofitting them is
-- the expensive mistake, and they are worth nothing unenforced.

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
  legal_posture  TEXT NOT NULL DEFAULT 'out',
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
  extract_status  TEXT NOT NULL DEFAULT 'pending',
  confidence      REAL,
  -- Which mode produced this: mechanical | smart. Recorded IN THE DATA, not
  -- only in config -- without it, mechanical and smart cannot be compared on
  -- the same hand-labelled set and §8.4 is unmeasurable per mode.
  produced_by     TEXT,
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
  state           TEXT NOT NULL DEFAULT 'New',
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
```

*Verify:* `npm run migrate --workspace app/server` then
`sqlite3 tenderfoot.db ".tables"` — expect 13 names (11 objects + 2 alias tables) plus `app_meta` and `schema_migrations`.

- [x] **T2.** Add `app/server/src/db/schema.test.ts` — assert the graph, not just the tables.

Tests to write: every expected table exists; a `solicitation` row cannot reference a non-existent `organization` (FK enforced); two `sighting` rows may point at one `solicitation`; `vendor_one_self` rejects a second self row; deleting an `organization` cascades its aliases.

*Verify:* `npx vitest run app/server` — all green.

### 2. Seed the two configuration objects

- [x] **T3.** Create `app/server/migrations/003_seed_source_registry.sql`.

**Seed from what the source research actually established** — this is the first time those findings become executable rather than prose. Illinois `in` with archive depth to 2018-02; Indiana `in`, contracts deep and solicitations absent; SAM.gov `in`; Michigan and Kentucky `in` with the account reading recorded in `legal_note`; Ohio `manual-only` with the CAPTCHA recorded; GovWin/BidNet/BidPrime `out` by their terms. `enabled = 0` on all of them — SP3 turns the first one on.

- [x] **T4.** Create `app/server/migrations/004_seed_firm_profile.sql` — KP's Vendor row with `is_self = 1`, and the Profile attached.

Values are already known from the prototype's Admin screen and are real: service lines, `WBE (Indiana, expires 2027-04) · MBE pending`, `Indiana primary · Illinois, Ohio, Kentucky secondary`, `Headcount 14 · Trailing revenue $2.8M · No bonding capacity on file`. `past_performance` stays **NULL**.

*Verify:* `sqlite3 tenderfoot.db "SELECT name, is_self FROM vendor WHERE is_self=1"` returns Koehler Partners.

### 3. The API

- [x] **T5.** `app/server/src/routes/profile.ts` — `GET` and `PATCH` the Firm Profile.
- [x] **T6.** `app/server/src/routes/sources.ts` — `GET` list, `PATCH` one row. **`legal_posture` changes require `legal_note` to be non-empty**; reject otherwise. §5.5.1 says the evidence is recorded on the row, and an API that lets it be blank makes the rule unenforceable.
- [x] **T7.** `app/server/src/routes/solicitations.ts` — `GET` list and `GET` one, with sightings joined.
- [x] **T8.** Mount all three in `app/server/src/index.ts`.
- [x] **T9.** Route tests for each, including the `legal_note` rejection.

### 4. Load real solicitations

- [x] **T10.** `app/server/src/ingest/corpus.ts` — a loader reading `corpus/manifest.md` and `corpus/*.json` into `organization`, `solicitation`, `sighting`, and `document` rows.

**One `source` row, `Corpus import (2026-08-04)`, tier 4 manual.** Every loaded row gets a real sighting pointing at it, so the merge path is exercised from the first data rather than bolted on in SP3.

- [x] **T11.** Verify org aliasing on real data: the corpus contains *New York State OGS* listed on Indiana's portal. **The loader must not create an Indiana organization for it.**

*Verify:* `sqlite3 tenderfoot.db "SELECT o.name, count(*) FROM solicitation s JOIN organization o ON o.id=s.org_id GROUP BY 1 ORDER BY 2 DESC"`

### 5. The mock layer moves

- [x] **T12.** ⚠️ **Re-extract `prototype/PROTOTYPE/src/app.js` against V1.1 and move its rule-bearing comments to `app/shared/`.**

Not pre-writable — the data moved between V1 and V1.1 and the comments must be carried forward by hand onto shapes that changed (`ClaudeDesign_Proto_Cleanup.md`, *Re-extraction*). **This is the transfer point** named in workflow spec §2: after this, `app/shared/` is the authority and the prototype's copy is a historical artifact.

- [x] **T13.** Reconcile the schema above against the re-extracted dataset. **Proto2PRD §4.1.1 makes the production model this dataset normalised**, so any field present there and absent here is a finding — either a missing column or a deliberate exclusion that gets written down.

### 6. Minimal admin

- [x] **T14.** A dev-only route rendering the Firm Profile as an editable form.
- [x] **T15.** A dev-only route listing sources with `enabled` and `legal_posture` editable.

**Unstyled. No tokens, no primitives.** SP2 owns the design system and carries the sign-off gate; styling here would pre-empt it. These exist to satisfy *"profile and source registry editable"* and nothing more.

---

## Exit criteria

- [ ] `npm run check` green
- [ ] Eleven objects plus two alias tables exist; FKs enforced and tested
- [ ] Real corpus solicitations loaded, each with a sighting
- [ ] NY OGS resolves to a New York organization, not an Indiana one
- [ ] Profile and Source Registry readable and editable through the API
- [ ] `legal_posture` cannot be changed without a `legal_note`
- [ ] `assessment` exists and is **empty**
- [ ] Rule-bearing comments live in `app/shared/`

---

## What to watch

**Does `source_note` on every table earn its place, or is it noise?** It is cheap to add now and impossible to backfill. Judge after the corpus load.

**Is `codes`/`certifications`/`geography` as JSON a mistake?** It is right for V1 — no queries need them yet. **The moment something filters on NAICS, they become real tables.** Note it rather than pre-building it.

**Does the schema survive the re-extraction (T13), or does V1.1's dataset contain fields this plan missed?** That is the real test of whether §4 and the prototype agree, and it has never been checked.


---

## Execution record — T1 to T11

**Executed 2026-08-12.** Schema, seeds, API and corpus load complete. 33 tests green.

**Five defects surfaced, every one by a verification step rather than by review.**

**1. `TS4023` on the exported database handle** — inherited from SP0's pattern, fixed there.

**2. The NASPO row was silently dropped by the corpus parser.** Its external id is `*(NASPO)*` rather than an event number, and a `\d{6,}` pattern excluded it. **That is the single row the alias table exists for** — a New York award listed on Indiana's portal — removed by a regex, with no error and a plausible-looking 60-row import.

**3. `NY OGS` still resolved to an Indiana organization after the parser was fixed.** `KNOWN_ORGS` was looked up by the incoming string while the aliases sat *inside* the canonical entry, so the lookup only matched when the source already used the canonical spelling — precisely when it is not needed. The reverse index that performs the actual resolution was missing.

**4. Every federal agency was tagged jurisdiction `IN`**, because the default was hard-coded rather than passed per corpus. Sixty-two organizations mislabelled, and nothing downstream would have contradicted it.

**5. A red gate was committed.** `vitest` does not typecheck, so 25 passing tests masked a `tsc` failure in the test file. Caught on the next run and fixed, but the commit stands as a reminder that *tests passing* and *the gate passing* are different claims.

> **Defect 2 is the one worth remembering.** The import reported "loaded 60 Indiana" and looked entirely healthy. The only reason it was caught is that a verification step named a *specific expected row* rather than a count — the same lesson SP0 produced, arriving in a different costume: **a plausible number is not evidence.**

## Outstanding

- [ ] **T12.** Re-extract the mock layer against V1.1; move its rule-bearing comments to `app/shared/`.
- [ ] **T13.** Reconcile the schema against that dataset. **Still the most interesting task in SP1** — nobody has checked whether §4 and the prototype's data model actually agree.
- [ ] **T14–T15.** Minimal admin UI. The API enforces the rules; these are the screens that exercise them.
