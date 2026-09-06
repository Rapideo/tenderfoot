# HigherGov Coverage Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `npm run recall` — an operator command that measures whether HigherGov keeps finding Indiana notices, so the shelved adapter backlog can be adjudicated on a distribution rather than on one observation.

**Architecture:** A new `app/server/src/coverage/` module in the `npm run fitness` family. Free sources (IDOA, hand-built sub-state pages) supply a frozen census; a minimal HigherGov client supplies the comparison cohort; a pure comparator produces per-notice verdicts; four predicates (C1–C4) grade them, taking the weaker segment. **HigherGov's rows are measured and never written into holdings** — see spec §5.1, the decision the whole design turns on.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Node 24, Postgres via `pg` on Neon, Vitest, raw SQL migrations.

**Spec:** [`docs/superpowers/specs/2026-09-06-highergov-coverage-reliability-design.md`](../specs/2026-09-06-highergov-coverage-reliability-design.md)

---

## Global Constraints

These bind every task. Copied verbatim from the spec and from CLAUDE.md.

- **🛑 NO LIVE HIGHERGOV CALLS. Not once, in any task.** CLAUDE.md §5.1 covers *"testing, verification, a 'quick check', re-running something that already worked."* Every test in this plan uses a recorded fixture or an injected `fetchImpl`. **The first live call is an operator act after this plan is merged, proposed to Matt with a record count.**
- **`document_path` is a CREDENTIAL, not a URL** (CLAUDE.md §5.3). It embeds the api_key in every response. Never printed, logged, or written to the database.
- **Scrub at the boundary, never at the call site.** One recursive redactor walks every value before anything is printed. The 2026-09-03 leak happened because a `scrub()` helper covered every *error* path while field *values* printed raw.
- **Never build the URL inline in a shell command.** Built inside the module from `process.env.HIGHERGOV_API_KEY`.
- **`npm run check` must exit 0** before every commit. It is the gate (CLAUDE.md §4).
- **The fidelity mandate (CLAUDE.md §1) does not apply** — this slice builds no UI. Named here because CLAUDE.md §3 records that SP6 went wrong by not naming it.
- **Numbers live in `coverage/thresholds.ts` and nowhere else.** No threshold is hard-coded at a call site (the stated purpose of `fitness/thresholds.ts`).
- **ESM import specifiers end in `.js`**, even for TypeScript sources.
- **Test files use `useTestSchema("...")` + `await resetSchema()` at module top level, then dynamic `await import()`** for anything touching the database. `migrate(false)` in `beforeAll` with a `120000` timeout; `close()` in `afterAll`.

### Interfaces defined across tasks

Reference list so a task implementer who sees only their own task knows the exact names and types their neighbours use.

```ts
// Task 2 — coverage/thresholds.ts
export const COVERAGE_RATIFIED: boolean;
export const COVERAGE: {
  readonly minCoverageRecall: number;  // C1
  readonly minTimelyRecall: number;    // C2
  readonly minLeadDays: number;        // definition of "timely"
  readonly minCohortSize: number;      // C4
  readonly maxRecordsPerRun: number;   // the hard stop
};

// Task 3 — coverage/highergov-client.ts
export interface FeedNotice {
  externalId: string;            // their `source_id`; for Indiana this IS IDOA's Event ID
  capturedDate: string | null;   // YYYY-MM-DD
  versionKey: string | null;
  title: string | null;
}
export interface FeedResult {
  notices: FeedNotice[];
  records: number;               // what the VENDOR billed = raw row count
  feedCount: number | null;      // meta.pagination.count
  pages: number | null;          // meta.pagination.pages -- >1 means truncated
}
export interface HigherGovClient {
  fetchDay(capturedDate: string, fetchImpl?: typeof fetch): Promise<FeedResult>;
  fetchBySourceId(sourceId: string, fetchImpl?: typeof fetch): Promise<FeedResult>;
}
export function redact<T>(value: T): T;
export const higherGovClient: HigherGovClient;
export const HIGHERGOV_SOURCE_NAME: string;

// Task 4 — coverage/answer-key.ts
export type Segment = "state_agency" | "sub_state";
export interface KeyEntry {
  externalId: string;
  segment: Segment;
  keyOrigin: string;             // e.g. "Indiana IDOA solicitations"
  deadline: string | null;       // YYYY-MM-DD, from merge/closes-at.ts
}
export const IDOA_SOURCE_NAME: string;
export function idoaKeyFrom(html: string): KeyEntry[];

// Task 5 — coverage/compare.ts
export type Carried = "carried" | "missing" | "unchecked";
export interface Observation {
  externalId: string;
  segment: Segment;
  carried: Carried;
  capturedDate: string | null;
  leadDays: number | null;
}
export function dedupBySourceId(notices: FeedNotice[]): { notices: FeedNotice[]; collapsed: number };
export function leadDays(deadline: string | null, capturedDate: string | null): number | null;
export function observe(key: KeyEntry[], feed: FeedNotice[], checked: Set<string>): Observation[];

// Task 6 — coverage/measure.ts
export interface GradedItem {
  externalId: string;
  segment: Segment;
  carried: Carried;
  leadDays: number | null;
}
export function measureCoverage(items: GradedItem[]): PredicateResult[];  // C1..C4

// Task 7 — coverage/run.ts
export interface RunOutcome {
  runId: number;
  recordsSpent: number;
  itemsObserved: number;
  aborted: boolean;
  abortReason?: string;
}
export async function runCoverage(opts: {
  from: string;
  to: string;
  client?: HigherGovClient;
  fetchImpl?: typeof fetch;
}): Promise<RunOutcome>;
```

---

## File Structure

| File | Responsibility |
|---|---|
| `app/server/migrations/031_coverage_run.sql` | The two measurement tables |
| `app/server/src/coverage/thresholds.ts` | Every number, plus `COVERAGE_RATIFIED` |
| `app/server/src/coverage/highergov-client.ts` | HTTP + parse + the redactor. No database access |
| `app/server/src/coverage/answer-key.ts` | Turn a free source's page into a frozen census |
| `app/server/src/coverage/compare.ts` | Pure: dedup, lead time, per-notice verdict |
| `app/server/src/coverage/measure.ts` | Pure: C1–C4 over graded items, weakest segment wins |
| `app/server/src/coverage/run.ts` | The orchestrator: spend guard, writes, abort |
| `app/server/src/coverage/coverage-cli.ts` | `npm run recall`. No logic |

Tasks 3–6 are all pure or injectable, so each is independently testable without a network. Only Tasks 1 and 7 touch the database.

---

### Task 1: Migration 031 — the two measurement tables

**Files:**
- Create: `app/server/migrations/031_coverage_run.sql`
- Create: `app/server/src/coverage/schema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `coverage_run` and `coverage_item`, used by Task 7.

- [ ] **Step 1: Write the failing test**

Create `app/server/src/coverage/schema.test.ts`:

```ts
/* The tables exist so that a MISS -- a notice we do not hold -- can be
 * recorded at all. triage_sample_item and assessment both FK to
 * solicitation_id NOT NULL and structurally cannot (spec §5.3). */
import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_coverage_schema");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, close, insert, run } = await import("../db/index.js");

beforeAll(async () => {
  await migrate(false);
}, 120000);

afterAll(async () => {
  await close();
});

test("coverage_item can record a notice we do not hold", async () => {
  const sourceId = await insert(
    `INSERT INTO source (name) VALUES ('coverage fixture') RETURNING id`,
  );
  const runId = await insert(
    `INSERT INTO coverage_run (source_id, cohort_from, cohort_to)
     VALUES ($1, '2026-09-02', '2026-09-06') RETURNING id`,
    [sourceId],
  );
  /* No solicitation_id anywhere. That is the point. */
  await run(
    `INSERT INTO coverage_item
       (run_id, external_id, segment, key_origin, key_seen_at, deadline, carried)
     VALUES ($1, '003000000088067', 'state_agency', 'Indiana IDOA solicitations',
             now(), '2026-09-03', 'missing')`,
    [runId],
  );
  const rows = await all(`SELECT carried FROM coverage_item WHERE run_id = $1`, [runId]);
  expect(rows).toHaveLength(1);
  expect(rows[0].carried).toBe("missing");
});

test("key_source_id is nullable, because a sub-state buyer has no registry row", async () => {
  const sourceId = await insert(
    `INSERT INTO source (name) VALUES ('coverage fixture 2') RETURNING id`,
  );
  const runId = await insert(
    `INSERT INTO coverage_run (source_id, cohort_from, cohort_to)
     VALUES ($1, '2026-09-02', '2026-09-06') RETURNING id`,
    [sourceId],
  );
  await run(
    `INSERT INTO coverage_item
       (run_id, external_id, segment, key_origin, key_seen_at, carried)
     VALUES ($1, '132', 'sub_state', 'fortwayne.gov/bids', now(), 'missing')`,
    [runId],
  );
  const rows = await all(
    `SELECT key_source_id, key_origin FROM coverage_item WHERE run_id = $1`,
    [runId],
  );
  expect(rows[0].key_source_id).toBeNull();
  expect(rows[0].key_origin).toBe("fortwayne.gov/bids");
});

test("carried is constrained to the three states, so a typo cannot become a fourth", async () => {
  const sourceId = await insert(
    `INSERT INTO source (name) VALUES ('coverage fixture 3') RETURNING id`,
  );
  const runId = await insert(
    `INSERT INTO coverage_run (source_id, cohort_from, cohort_to)
     VALUES ($1, '2026-09-02', '2026-09-06') RETURNING id`,
    [sourceId],
  );
  await expect(
    run(
      `INSERT INTO coverage_item
         (run_id, external_id, segment, key_origin, key_seen_at, carried)
       VALUES ($1, 'x', 'state_agency', 'k', now(), 'carrried')`,
      [runId],
    ),
  ).rejects.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/server/src/coverage/schema.test.ts`
Expected: FAIL — `relation "coverage_run" does not exist`.

- [ ] **Step 3: Write the migration**

Create `app/server/migrations/031_coverage_run.sql`:

```sql
-- COVERAGE DECAY: DOES HIGHERGOV KEEP FINDING THINGS?
--
-- Step (3) of the sequence Matt set 2026-09-03, and the gate holding the
-- adapter backlog (Illinois, Michigan, Kentucky, Ohio, the OpenGov
-- municipalities). Spec: 2026-09-06-highergov-coverage-reliability-design.md.
--
-- WHY NEW TABLES, HAVING LOOKED FOR AN EXISTING HOME. Two candidates were
-- checked. `triage_sample`/`triage_sample_item` is a frozen, dated, sized
-- cohort -- structurally the right idea -- but triage_sample_item.
-- solicitation_id is NOT NULL REFERENCES solicitation(id). `assessment` is
-- the same. BOTH FORBID THE ONE ROW THIS TEST EXISTS TO RECORD: a miss is a
-- notice we do NOT hold. `sighting` can hold an unlinked observation, but a
-- miss is the ABSENCE of a sighting, and an absence is not a row in a table
-- of presences. The obstruction is structural, not stylistic.
CREATE TABLE coverage_run (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_at        timestamptz NOT NULL DEFAULT now(),
  source_id     integer NOT NULL REFERENCES source(id),
  -- The window the NEW-NOTICE cohort was drawn from. Re-observations of
  -- earlier, unsettled notices also ride on this run (see coverage_item).
  cohort_from   date NOT NULL,
  cohort_to     date NOT NULL,
  -- 🔴 HAZARD: THE INDIANA FILTER LIVES IN HIGHERGOV'S ACCOUNT, NOT OUR CODE.
  -- R1 (docs/2026-09-03-platform-comparison.md) established that
  -- /opportunity/ takes exactly twelve parameters and NONE is a location:
  -- three state parameters were accepted and SILENTLY IGNORED. State
  -- filtering exists only through a saved search. That is an external
  -- dependency on a mutable object we do not version -- if somebody edits or
  -- deletes the saved search the cohort changes and nothing errors. These two
  -- columns are the detector: a step change in feed_count with no change in
  -- our source is the signal.
  search_id     text,
  feed_count    integer,
  records_spent integer NOT NULL DEFAULT 0,
  -- R6: "several source_id lookups returned count=2" -- versioning, via
  -- version_key. A rising duplicate rate is itself a finding, so it is
  -- recorded rather than merely handled.
  duplicates_collapsed integer NOT NULL DEFAULT 0,
  aborted       boolean NOT NULL DEFAULT false,
  note          text
);

CREATE TABLE coverage_item (
  run_id        integer NOT NULL REFERENCES coverage_run(id),
  -- The answer key's identity for this notice. NOT a solicitation_id, for
  -- the reason in this file's header.
  external_id   text NOT NULL,
  segment       text NOT NULL CHECK (segment IN ('state_agency', 'sub_state')),
  -- WHERE THE KEY CAME FROM. Two columns, because only one of the two answer
  -- keys has a registry row: IDOA is seeded as 'Indiana IDOA solicitations',
  -- while the sub-state buyers are pages we read and never ingest. Seeding a
  -- `source` row per municipality would give each one a legal posture, an
  -- adapter tier and a rubric grade it has no business carrying, and would
  -- put buyers we never ingest into the rubric matrix.
  key_source_id integer REFERENCES source(id),
  key_origin    text NOT NULL,
  key_seen_at   timestamptz NOT NULL,
  -- `date`, not timestamptz: merge/closes-at.ts's closesAt() returns a bare
  -- YYYY-MM-DD and its own header explains why -- IDOA states the deadline in
  -- its own civil time, so the date component IS the answer. A timestamptz
  -- here would invent precision the parser does not produce.
  deadline      date,
  -- Three states, not two, and for the reason document.extract_status gives:
  -- "we looked and it is not there" is a different fact from "we have not
  -- looked yet". `unchecked` is written when a run aborts at
  -- maxRecordsPerRun with cohort left unqueried -- those notices are NOT
  -- misses and must never be counted as any.
  carried       text NOT NULL CHECK (carried IN ('carried', 'missing', 'unchecked')),
  captured_date date,
  lead_days     integer,
  PRIMARY KEY (run_id, external_id)
);

-- The query the re-observation rule needs: every unsettled notice, cheapest
-- first. Spec §5.5 -- a notice enters the cohort once and is re-queried until
-- it settles, because a notice carried LATE is exactly what C2 exists to catch.
CREATE INDEX coverage_item_unsettled ON coverage_item(carried, external_id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/server/src/coverage/schema.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/server/migrations/031_coverage_run.sql app/server/src/coverage/schema.test.ts
git commit -m "Coverage: two tables, because a miss has nowhere else to live"
```

---

### Task 2: The thresholds, and a ratification flag that actually pins something

**Files:**
- Create: `app/server/src/coverage/thresholds.ts`
- Create: `app/server/src/coverage/thresholds.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `COVERAGE`, `COVERAGE_RATIFIED` — used by Tasks 6 and 7.

- [ ] **Step 1: Write the failing test**

Create `app/server/src/coverage/thresholds.test.ts`:

```ts
/* api-spend.ts's own final review found that the word "UNRATIFIED" in a
 * comment pinned NOTHING -- deleting it left the test green. The flag below
 * is the real mechanism, in the same style rubric.test.ts pins R7_RATIFIED
 * and THRESHOLDS_RATIFIED. */
import { expect, test } from "vitest";
import { COVERAGE, COVERAGE_RATIFIED } from "./thresholds.js";

test("the coverage thresholds ship UNRATIFIED, and a flag says so", () => {
  expect(COVERAGE_RATIFIED).toBe(false);
});

test("every threshold is a usable number", () => {
  expect(COVERAGE.minCoverageRecall).toBeGreaterThan(0);
  expect(COVERAGE.minCoverageRecall).toBeLessThanOrEqual(1);
  expect(COVERAGE.minTimelyRecall).toBeGreaterThan(0);
  expect(COVERAGE.minTimelyRecall).toBeLessThanOrEqual(1);
  expect(COVERAGE.minLeadDays).toBeGreaterThan(0);
  expect(COVERAGE.minCohortSize).toBeGreaterThan(0);
  expect(COVERAGE.maxRecordsPerRun).toBeGreaterThan(0);
});

/* C2 is a SUBSET of C1 -- a notice carried in time is also a notice carried.
 * A timely floor above the coverage floor is therefore unsatisfiable, and the
 * report would be permanently, silently wrong rather than failing loudly. */
test("the timely floor cannot exceed the coverage floor", () => {
  expect(COVERAGE.minTimelyRecall).toBeLessThanOrEqual(COVERAGE.minCoverageRecall);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/server/src/coverage/thresholds.test.ts`
Expected: FAIL — cannot resolve `./thresholds.js`.

- [ ] **Step 3: Write the implementation**

Create `app/server/src/coverage/thresholds.ts`:

```ts
/* THE COVERAGE TEST'S NUMBERS LIVE HERE AND NOWHERE ELSE.
 *
 * Same argument as fitness/thresholds.ts: collected in one file so that
 * ratifying them is a single visible edit rather than a hunt through the
 * module -- and so nobody can quietly introduce another number by
 * hard-coding it at a call site.
 *
 * ⚖️ ALL UNRATIFIED. These are PROPOSALS awaiting Matt's ruling, in the
 * shape D4/D5 established: an exported boolean that changes runtime output
 * and is pinned by a test, never merely the word UNRATIFIED in a comment.
 * api-spend.ts's final review found that a comment pins nothing -- delete
 * the word and the test stayed green. */
export const COVERAGE_RATIFIED = false;

export const COVERAGE = {
  /** C1 — share of answer-key notices HigherGov carried AT ALL. The
   * 2026-09-03 measurement was 69/70 = 0.986, from one observation. */
  minCoverageRecall: 0.95,

  /** C2 — share carried with at least `minLeadDays` left to bid. THE GATE.
   * Below minCoverageRecall by construction: C2's numerator is a subset of
   * C1's, and thresholds.test.ts pins that relationship. */
  minTimelyRecall: 0.9,

  /** Days remaining at `captured_date` for a notice to count as timely.
   * Measured against the DEADLINE, never against when IDOA published --
   * HigherGov scrapes more sources than IDOA and can legitimately carry a
   * notice first, which would make an IDOA-relative lead time negative and
   * meaningless (spec §3.5). */
  minLeadDays: 7,

  /** C4 — below this the verdict is `unknown`, NEVER `pass`.
   *
   * ⚠️ THIS IS THE ONE TO LOOK AT HARDEST. It is BELOW R7's population floor
   * of 100, traded down to keep the test bounded as Matt asked. A 100-notice
   * cohort of genuinely NEW Indiana notices needs roughly three weeks of
   * forward running at observed volumes. The trade is his to accept or
   * reject (spec §8). */
  minCohortSize: 30,

  /** The hard stop. A run that would spend more than this aborts and reports
   * rather than continuing.
   *
   * It lives here rather than in run.ts because this file's whole purpose is
   * that no number is hard-coded at a call site -- and because the cost model
   * it derives from (R5: 5 records for one filtered Indiana day) is ITSELF
   * ONE OBSERVATION AT ONE MOMENT, which is the exact error
   * Proto2PRD-Lessons §2.15 exists for. A run that hits this cap is a
   * finding about volume, not a failure. */
  maxRecordsPerRun: 40,
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/server/src/coverage/thresholds.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Prove the ratification flag by mutation**

Edit `thresholds.ts`, set `COVERAGE_RATIFIED = true`, and run the whole file:
Run: `npx vitest run app/server/src/coverage/thresholds.test.ts`
Expected: FAIL on "ships UNRATIFIED". **Revert to `false`.** This is the check CLAUDE.md §4 requires: *would this still pass if I deleted the thing it tests?*

- [ ] **Step 6: Commit**

```bash
git add app/server/src/coverage/thresholds.ts app/server/src/coverage/thresholds.test.ts
git commit -m "Coverage: five numbers, all unratified, and a flag that fails when they are not"
```

---

### Task 3: The HigherGov client, and the redactor that has to work

**Files:**
- Create: `app/server/src/coverage/highergov-client.ts`
- Create: `app/server/src/coverage/highergov-client.test.ts`
- Create: `app/server/src/coverage/fixtures/highergov-opportunity.json`

**Interfaces:**
- Consumes: `ADAPTERS` from `../scrape/adapters/registry.js` is NOT used here — HigherGov has no adapter by design. The source name is derived from migration 019's seeded row instead (see below).
- Produces: `FeedNotice`, `FeedResult`, `HigherGovClient`, `higherGovClient`, `redact`, `HIGHERGOV_SOURCE_NAME` — used by Tasks 5 and 7.

- [ ] **Step 1: Write the fixture**

Create `app/server/src/coverage/fixtures/highergov-opportunity.json`. **The `document_path` value below is a SYNTHETIC key-shaped string, never a real one** — it exists so the redactor test has something to catch:

```json
{
  "meta": { "pagination": { "page": 1, "pages": 1, "count": 3 } },
  "results": [
    {
      "source_id": "003000000088067",
      "captured_date": "2026-09-03",
      "version_key": "v1",
      "title": "300 SP Salamonie Sludge and WW RemovalBid Documents",
      "document_path": "https://www.highergov.com/api-external/document/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001"
    },
    {
      "source_id": "003000000088067",
      "captured_date": "2026-09-03",
      "version_key": "v2",
      "title": "300 SP Salamonie Sludge and WW Removal",
      "document_path": "https://www.highergov.com/api-external/document/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001"
    },
    {
      "source_id": "003000000088191",
      "captured_date": "2026-09-04",
      "version_key": "v1",
      "title": "300 FW Fingerling Walleye Lake Stock Purchase",
      "document_path": "https://www.highergov.com/api-external/document/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001"
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

Create `app/server/src/coverage/highergov-client.test.ts`:

```ts
/* 🛑 NO LIVE CALLS. CLAUDE.md §5.1 covers testing explicitly. Every case here
 * injects fetchImpl and returns the committed fixture. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

/* fetchDay builds its URL BEFORE it calls the injected fetchImpl, so apiKey()
 * runs even here -- without this the suite fails wherever the key is absent,
 * and CI has no .env at all. HARD-SET rather than `??=`: if .env carries a
 * real key, defaulting would interpolate the real credential into a URL
 * string. It is never sent anywhere, but CLAUDE.md §5.3's posture is that
 * this value is not handled casually. */
process.env.HIGHERGOV_API_KEY = "TESTKEYTESTKEYTESTKEYTESTKEY0000";

import { higherGovClient, redact } from "./highergov-client.js";

const FIXTURE = readFileSync(
  fileURLToPath(new URL("./fixtures/highergov-opportunity.json", import.meta.url)),
  "utf8",
);

function fakeFetch(body: string, status = 200): typeof fetch {
  return (async () =>
    new Response(body, { status, headers: { "content-type": "application/json" } })) as any;
}

test("a day pull returns one notice per result row", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  expect(out.notices).toHaveLength(3);
  expect(out.notices[0]!.externalId).toBe("003000000088067");
  expect(out.notices[0]!.capturedDate).toBe("2026-09-03");
});

/* 🔴 THE METER COUNTS RECORDS RETURNED, not rows we keep. Verified
 * 2026-09-03: 478 -> 489 on one call returning 1 opportunity + 10 documents.
 * The duplicate pair in the fixture is still TWO billed records even though
 * dedup will later collapse them to one notice. */
test("records billed is the row count, before any dedup", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  expect(out.records).toBe(3);
});

test("the feed count is read from meta.pagination, for the saved-search detector", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  expect(out.feedCount).toBe(3);
});

test("a non-OK response throws rather than reporting an empty feed", async () => {
  await expect(higherGovClient.fetchDay("2026-09-03", fakeFetch("nope", 500))).rejects.toThrow();
});

/* 🔴 THE LEAK TEST. A live key was leaked on 2026-09-03 and rotated the same
 * hour, because a scrub() helper covered every ERROR path while field VALUES
 * printed raw. document_path embeds the api_key in EVERY response. */
test("the redactor removes an api_key nested anywhere in a response", () => {
  const raw = {
    results: [
      { document_path: "https://x/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001" },
      { nested: { deeper: ["https://y/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001"] } },
    ],
  };
  const printed = JSON.stringify(redact(raw));
  expect(printed).not.toContain("FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001");
  expect(printed).toContain("REDACTED");
});

test("the redactor leaves harmless values alone", () => {
  expect(redact({ title: "Walleye", count: 3 })).toEqual({ title: "Walleye", count: 3 });
});

/* document_path is a CREDENTIAL, not a URL (CLAUDE.md §5.3). It must not
 * survive into anything a caller could persist or print. */
test("a parsed notice carries no document_path at all", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  expect(JSON.stringify(out)).not.toContain("api_key");
  expect(JSON.stringify(out)).not.toContain("document_path");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run app/server/src/coverage/highergov-client.test.ts`
Expected: FAIL — cannot resolve `./highergov-client.js`.

- [ ] **Step 4: Write the implementation**

Create `app/server/src/coverage/highergov-client.ts`:

```ts
/* ASKING HIGHERGOV WHAT IT CARRIED, AND NOTHING ELSE.
 *
 * ⚠️ NO DATABASE ACCESS HERE, DELIBERATELY -- same posture as
 * extract/document-clients.ts. A client fetches and parses; the caller
 * decides what to write and what it cost. That is what lets run.ts own the
 * spend guard, the tally and the abort in one place.
 *
 * 🛑 THIS IS THE FIRST COMMITTED CODE IN THIS PROJECT TO CALL THIS API. The
 * 2026-09-03 work ran in throwaway scripts, and it leaked a live key. All
 * three CLAUDE.md §5.3 rules are structural here rather than remembered:
 *
 *   1. document_path is a CREDENTIAL. It is dropped at parse time -- it
 *      never enters a FeedNotice, so no caller can persist or print it.
 *   2. Scrubbing happens at the BOUNDARY. redact() walks every value, and it
 *      is what any diagnostic path must pass through. The leak happened
 *      because a scrub() helper covered every ERROR path while field VALUES
 *      printed raw -- the key was thought of as something in the REQUEST,
 *      not something that comes BACK.
 *   3. The URL is built HERE, from the environment. Never in a shell
 *      command, where it would land in history and process listings.
 *
 * ⚠️ NOT REGISTERED IN scrape/adapters/registry.ts, AND THAT IS DELIBERATE
 * (spec §7.1). Registering it would make a source still under test reachable
 * by the real ingest path, which is the whole argument of spec §5.1. */

const HOST = "https://www.highergov.com/api-external";

/* Seeded by migration 019 as the first source in this project that costs
 * money. Hand-typed here because HigherGov has no ADAPTERS entry to derive
 * it from -- see the header. run.ts asserts this row exists before spending,
 * which is what turns a rename into a loud failure rather than a silent
 * miscount against the wrong source_id. */
export const HIGHERGOV_SOURCE_NAME = "HigherGov";

export interface FeedNotice {
  /** Their `source_id`. For Indiana this IS IDOA's own 15-digit Event ID,
   * which is what makes exact-match comparison possible at all. */
  externalId: string;
  capturedDate: string | null;
  versionKey: string | null;
  title: string | null;
}

export interface FeedResult {
  notices: FeedNotice[];
  /** What the VENDOR billed: the row count, BEFORE dedup. */
  records: number;
  /** meta.pagination.count -- the saved-search change detector. */
  feedCount: number | null;
}

export interface HigherGovClient {
  fetchDay(capturedDate: string, fetchImpl?: typeof fetch): Promise<FeedResult>;
  fetchBySourceId(sourceId: string, fetchImpl?: typeof fetch): Promise<FeedResult>;
}

/* Matches an api_key wherever it appears in a string, in any nesting. Broad
 * on purpose: the failure mode of over-redacting is an unreadable diagnostic,
 * and the failure mode of under-redacting is a rotated credential and an
 * incident. */
const KEY_IN_STRING = /api_key=[^&\s"']+/gi;

export function redact<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(KEY_IN_STRING, "api_key=REDACTED") as unknown as T;
  }
  if (Array.isArray(value)) return value.map(redact) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redact(v);
    }
    return out as unknown as T;
  }
  return value;
}

interface RawResult {
  source_id?: unknown;
  captured_date?: unknown;
  version_key?: unknown;
  title?: unknown;
}

interface RawBody {
  meta?: { pagination?: { count?: unknown } };
  results?: RawResult[];
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/* document_path is READ BY NOBODY. Dropping it here, at parse, is rule 1
 * made structural: there is no later point at which a caller could leak
 * what it never received. */
function toNotice(r: RawResult): FeedNotice | null {
  const externalId = str(r.source_id);
  if (!externalId) return null;
  return {
    externalId,
    capturedDate: str(r.captured_date),
    versionKey: str(r.version_key),
    title: str(r.title),
  };
}

function apiKey(): string {
  const key = process.env.HIGHERGOV_API_KEY;
  if (!key) {
    throw new Error(
      "HIGHERGOV_API_KEY is not set. It is a URL parameter for this API -- " +
        "build the URL in this module, never in a shell command (CLAUDE.md §5.3).",
    );
  }
  return key;
}

async function get(url: URL, fetchImpl: typeof fetch): Promise<FeedResult> {
  const res = await fetchImpl(url.toString(), {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    /* The URL is NOT in this message: it carries the api_key. */
    throw new Error(`HigherGov answered ${res.status}`);
  }
  const body = (await res.json()) as RawBody;
  const notices = (body.results ?? []).map(toNotice).filter((n): n is FeedNotice => n !== null);
  const count = body.meta?.pagination?.count;
  return {
    notices,
    /* The row count, not notices.length: a row we could not parse was still
     * billed. Under-reporting is the dangerous direction against a ceiling
     * that cannot be read back (api-spend.ts). */
    records: (body.results ?? []).length,
    feedCount: typeof count === "number" ? count : null,
  };
}

export const higherGovClient: HigherGovClient = {
  async fetchDay(capturedDate, fetchImpl = fetch) {
    const url = new URL(`${HOST}/opportunity/`);
    url.searchParams.set("api_key", apiKey());
    url.searchParams.set("captured_date", capturedDate);
    /* 🔴 R1: /opportunity/ takes twelve parameters and NONE is a location.
     * pop_state, state and place_of_performance_state were all accepted and
     * SILENTLY IGNORED. State filtering exists only through a saved search,
     * so HIGHERGOV_SEARCH_ID is the Indiana filter -- and it lives in their
     * account, not in our code. run.ts records it per run for exactly that
     * reason. */
    const searchId = process.env.HIGHERGOV_SEARCH_ID;
    if (searchId) url.searchParams.set("search_id", searchId);
    return get(url, fetchImpl);
  },

  async fetchBySourceId(sourceId, fetchImpl = fetch) {
    const url = new URL(`${HOST}/opportunity/`);
    url.searchParams.set("api_key", apiKey());
    url.searchParams.set("source_id", sourceId);
    /* No search_id: an exact-id lookup must not be narrowed by a saved
     * search, or a notice outside the search would read as a MISS when it
     * was merely out of scope -- a false miss is the one error that would
     * un-shelve the adapter backlog for no reason. */
    return get(url, fetchImpl);
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run app/server/src/coverage/highergov-client.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Prove the redactor by mutation**

Comment out the `value.replace(...)` line in `redact` so it returns the string unchanged, and run the whole file:
Run: `npx vitest run app/server/src/coverage/highergov-client.test.ts`
Expected: FAIL on "removes an api_key nested anywhere". **Restore the line.**

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add app/server/src/coverage/highergov-client.ts app/server/src/coverage/highergov-client.test.ts app/server/src/coverage/fixtures/highergov-opportunity.json
git commit -m "Coverage: the first committed code to call the API that leaked a key"
```

---

### Task 4: The answer key — a free census, with a deadline parser we already own

**Files:**
- Create: `app/server/src/coverage/answer-key.ts`
- Create: `app/server/src/coverage/answer-key.test.ts`

**Interfaces:**
- Consumes: `parseIdoaPage` from `../scrape/adapters/idoa.js`; `closesAt` from `../merge/closes-at.js`.
- Produces: `Segment`, `KeyEntry`, `IDOA_SOURCE_NAME`, `idoaKeyFrom` — used by Tasks 5, 6 and 7.

- [ ] **Step 1: Write the failing test**

Create `app/server/src/coverage/answer-key.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { idoaKeyFrom } from "./answer-key.js";

/* The committed IDOA fixture the adapter's own tests already use. Reused
 * rather than copied: a second copy would drift from the first. */
const FIXTURE = readFileSync(
  fileURLToPath(new URL("../scrape/adapters/fixtures/idoa-listing.html", import.meta.url)),
  "utf8",
);

test("every row on the page becomes a key entry", () => {
  const key = idoaKeyFrom(FIXTURE);
  expect(key.length).toBeGreaterThan(0);
});

test("IDOA rows are the state-agency segment and carry the page as their origin", () => {
  const key = idoaKeyFrom(FIXTURE);
  for (const entry of key) {
    expect(entry.segment).toBe("state_agency");
    expect(entry.keyOrigin).toBe("Indiana IDOA solicitations");
  }
});

/* The deadline is parsed by merge/closes-at.ts, which already handles IDOA's
 * "09/03/2026 10:00:00AM EST" shape and returns a bare YYYY-MM-DD. Writing a
 * second date parser here is how two implementations of one question start
 * to drift. */
test("deadlines are parsed to bare ISO dates, not invented timestamps", () => {
  const key = idoaKeyFrom(FIXTURE);
  const withDeadline = key.filter((e) => e.deadline !== null);
  expect(withDeadline.length).toBeGreaterThan(0);
  for (const entry of withDeadline) {
    expect(entry.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }
});

/* A row whose due-date cell is unparseable must yield a NULL deadline, never
 * a guess. closes-at.ts's own header: "a wrong deadline sorts and filters the
 * queue on a lie, where a null deadline just sorts last and says nothing." */
test("an unparseable due date yields null rather than a guess", () => {
  const key = idoaKeyFrom(
    `<table><thead><tr><th>Event Name</th><th>Agency</th><th>Event ID</th>` +
      `<th>Event Description</th><th>Response Due By</th><th>Contact</th></tr></thead>` +
      `<tbody><tr><td>Thing</td><td>DNR</td><td>003000000099999</td>` +
      `<td>d</td><td>TBD</td><td>c</td></tr></tbody></table>`,
  );
  expect(key).toHaveLength(1);
  expect(key[0]!.deadline).toBeNull();
});

test("external ids come from the Event ID column", () => {
  const key = idoaKeyFrom(FIXTURE);
  expect(key.some((e) => /^\d{15}$/.test(e.externalId))).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/server/src/coverage/answer-key.test.ts`
Expected: FAIL — cannot resolve `./answer-key.js`.

- [ ] **Step 3: Write the implementation**

Create `app/server/src/coverage/answer-key.ts`:

```ts
/* A FROZEN CENSUS FROM A FREE SOURCE.
 *
 * The asymmetry this whole design rests on (spec §3.1): everything needed to
 * know WHAT SHOULD HAVE BEEN FOUND is published free. Only the comparison
 * costs records.
 *
 * A census, not a sample: idoaKeyFrom enumerates every row on the page. That
 * is what makes a later diff valid -- an Event ID absent from an earlier
 * census is genuinely new, rather than merely unsampled.
 *
 * ⚠️ ONE BLIND SPOT, DISCLOSED RATHER THAN DISCOVERED LATER. The page lists
 * OPEN notices. A notice posted AND closed between two censuses appears in
 * neither and is invisible to the test. That biases the measurement TOWARD
 * FLATTERING HIGHERGOV -- such a notice could have been missed entirely and
 * would never be counted as a miss. Short-fuse notices are exactly the ones a
 * bidder most needs carried promptly, so the bias runs against the property
 * that matters most. Observing more often reduces it; nothing removes it. */
import { parseIdoaPage } from "../scrape/adapters/idoa.js";
import { closesAt } from "../merge/closes-at.js";

export type Segment = "state_agency" | "sub_state";

export interface KeyEntry {
  externalId: string;
  segment: Segment;
  /** Where the key came from. For IDOA this is its registry name; for a
   * sub-state buyer it is the page, because those have no registry row
   * (migration 031's own comment explains why they must not get one). */
  keyOrigin: string;
  /** YYYY-MM-DD, or null when the source published nothing parseable. */
  deadline: string | null;
}

/* The canonical registry name, matching scrape/adapters/registry.ts's `idoa`
 * entry and migration 003's seeded row. closesAt() DISPATCHES ON THIS STRING
 * -- pass anything else and it silently returns null for every row, which
 * would read as "IDOA publishes no deadlines" rather than as an error. */
export const IDOA_SOURCE_NAME = "Indiana IDOA solicitations";

export function idoaKeyFrom(html: string): KeyEntry[] {
  return parseIdoaPage(html).items.map((item) => ({
    externalId: item.externalId,
    segment: "state_agency" as const,
    keyOrigin: IDOA_SOURCE_NAME,
    /* Reused, not reimplemented. closes-at.ts already knows IDOA's
     * "10/05/2026 3:00:00PM EST" shape, already refuses to guess at a
     * partial match, and already explains why the bare date is the right
     * answer for this source. */
    deadline: closesAt(IDOA_SOURCE_NAME, item.raw),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/server/src/coverage/answer-key.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add app/server/src/coverage/answer-key.ts app/server/src/coverage/answer-key.test.ts
git commit -m "Coverage: the answer key is free, and its date parser already existed"
```

---

### Task 5: The comparator — dedup, lead time, and three states

**Files:**
- Create: `app/server/src/coverage/compare.ts`
- Create: `app/server/src/coverage/compare.test.ts`

**Interfaces:**
- Consumes: `FeedNotice` (Task 3), `KeyEntry`/`Segment` (Task 4).
- Produces: `Carried`, `Observation`, `dedupBySourceId`, `leadDays`, `observe` — used by Tasks 6 and 7.

- [ ] **Step 1: Write the failing test**

Create `app/server/src/coverage/compare.test.ts`:

```ts
import { expect, test } from "vitest";
import { dedupBySourceId, leadDays, observe } from "./compare.js";
import type { KeyEntry } from "./answer-key.js";
import type { FeedNotice } from "./highergov-client.js";

const key = (externalId: string, deadline: string | null = "2026-09-30"): KeyEntry => ({
  externalId,
  segment: "state_agency",
  keyOrigin: "Indiana IDOA solicitations",
  deadline,
});

const notice = (externalId: string, capturedDate: string | null = "2026-09-03"): FeedNotice => ({
  externalId,
  capturedDate,
  versionKey: "v1",
  title: "t",
});

/* 🔴 R6: "several source_id lookups returned count=2" -- versioning, via
 * version_key. Without this, one carried notice counts twice and inflates
 * recall. */
test("two versions of one notice collapse to one, and the collapse is counted", () => {
  const out = dedupBySourceId([
    { ...notice("003000000088067"), versionKey: "v1" },
    { ...notice("003000000088067"), versionKey: "v2" },
    notice("003000000088191"),
  ]);
  expect(out.notices).toHaveLength(2);
  expect(out.collapsed).toBe(1);
});

test("dedup keeps the EARLIEST capture, because that is when they first carried it", () => {
  const out = dedupBySourceId([
    notice("003000000088067", "2026-09-05"),
    notice("003000000088067", "2026-09-01"),
  ]);
  expect(out.notices[0]!.capturedDate).toBe("2026-09-01");
});

test("lead time is days from capture to deadline", () => {
  expect(leadDays("2026-09-30", "2026-09-03")).toBe(27);
});

test("lead time is null when either side is missing, never zero", () => {
  expect(leadDays(null, "2026-09-03")).toBeNull();
  expect(leadDays("2026-09-30", null)).toBeNull();
});

/* A notice carried AFTER its deadline is a negative lead time, and that is a
 * real reading rather than an error: it says they carried it too late to bid. */
test("a notice carried after its deadline gives a negative lead time", () => {
  expect(leadDays("2026-09-01", "2026-09-03")).toBe(-2);
});

test("a notice in the key and in the feed is carried", () => {
  const out = observe([key("A")], [notice("A")], new Set(["A"]));
  expect(out[0]!.carried).toBe("carried");
  expect(out[0]!.leadDays).toBe(27);
});

test("a notice in the key, checked, and absent from the feed is missing", () => {
  const out = observe([key("A")], [], new Set(["A"]));
  expect(out[0]!.carried).toBe("missing");
  expect(out[0]!.leadDays).toBeNull();
});

/* 🔴 THE ASSERTION THAT KEEPS AN ABORTED RUN HONEST. A notice we never
 * queried is NOT a miss. Counting it as one would manufacture coverage decay
 * out of our own budget cap and un-shelve the adapter backlog for no reason. */
test("a notice never queried is unchecked, not missing", () => {
  const out = observe([key("A")], [], new Set());
  expect(out[0]!.carried).toBe("unchecked");
});

test("feed rows with no matching key entry are ignored, not invented as extras", () => {
  const out = observe([key("A")], [notice("A"), notice("ZZZ")], new Set(["A"]));
  expect(out).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/server/src/coverage/compare.test.ts`
Expected: FAIL — cannot resolve `./compare.js`.

- [ ] **Step 3: Write the implementation**

Create `app/server/src/coverage/compare.ts`:

```ts
/* THE COMPARISON, AND IT IS PURE.
 *
 * No network, no database, no clock. Everything this module needs is passed
 * in, which is what lets the whole verdict be tested against fixtures -- and
 * what keeps CLAUDE.md §5.1 satisfiable: none of these tests can reach the
 * metered API even by accident. */
import type { FeedNotice } from "./highergov-client.js";
import type { KeyEntry, Segment } from "./answer-key.js";

export type Carried = "carried" | "missing" | "unchecked";

export interface Observation {
  externalId: string;
  segment: Segment;
  carried: Carried;
  capturedDate: string | null;
  leadDays: number | null;
}

const DAY_MS = 86_400_000;

/* 🔴 R6, THE DUPLICATE PROBLEM. HigherGov versions notices (version_key), and
 * several source_id lookups returned count=2. Counting both would inflate
 * recall -- one carried notice appearing twice reads as two successes.
 *
 * The EARLIEST capture wins, not the latest: the question C2 asks is when
 * they FIRST carried it, because that is the moment a bidder could first have
 * seen it. Keeping the latest would penalise a source for re-publishing. */
export function dedupBySourceId(notices: FeedNotice[]): {
  notices: FeedNotice[];
  collapsed: number;
} {
  const best = new Map<string, FeedNotice>();
  let collapsed = 0;
  for (const n of notices) {
    const seen = best.get(n.externalId);
    if (!seen) {
      best.set(n.externalId, n);
      continue;
    }
    collapsed += 1;
    const a = seen.capturedDate;
    const b = n.capturedDate;
    if (a === null || (b !== null && b < a)) best.set(n.externalId, n);
  }
  return { notices: [...best.values()], collapsed };
}

/* Days remaining to bid at the moment HigherGov first carried it.
 *
 * MEASURED AGAINST THE DEADLINE, NEVER AGAINST WHEN IDOA PUBLISHED. HigherGov
 * scrapes more sources than IDOA and can legitimately carry a notice before
 * IDOA's own page shows it, which would make an IDOA-relative lead time
 * negative and meaningless. Deadline-relative is well-defined regardless of
 * who published first, and it is what a bidder actually experiences.
 *
 * Both inputs are bare YYYY-MM-DD (closes-at.ts and captured_date), so UTC
 * midnight on both sides cancels: no timezone can shift this by a day. */
export function leadDays(deadline: string | null, capturedDate: string | null): number | null {
  if (!deadline || !capturedDate) return null;
  const end = Date.parse(`${deadline}T00:00:00Z`);
  const start = Date.parse(`${capturedDate}T00:00:00Z`);
  if (Number.isNaN(end) || Number.isNaN(start)) return null;
  return Math.round((end - start) / DAY_MS);
}

/* `checked` is the set of external ids this run actually asked about. It is a
 * parameter rather than something inferred from the feed, because "absent
 * from the feed" and "never queried" are the SAME observable and DIFFERENT
 * facts -- exactly the distinction document.extract_status exists for. Infer
 * it and an aborted run manufactures misses out of its own budget cap. */
export function observe(
  key: KeyEntry[],
  feed: FeedNotice[],
  checked: Set<string>,
): Observation[] {
  const byId = new Map(feed.map((n) => [n.externalId, n]));
  return key.map((entry) => {
    const hit = byId.get(entry.externalId);
    if (hit) {
      return {
        externalId: entry.externalId,
        segment: entry.segment,
        carried: "carried" as const,
        capturedDate: hit.capturedDate,
        leadDays: leadDays(entry.deadline, hit.capturedDate),
      };
    }
    return {
      externalId: entry.externalId,
      segment: entry.segment,
      carried: checked.has(entry.externalId) ? ("missing" as const) : ("unchecked" as const),
      capturedDate: null,
      leadDays: null,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/server/src/coverage/compare.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Prove the unchecked/missing distinction by mutation**

In `observe`, replace `checked.has(entry.externalId) ? "missing" : "unchecked"` with a bare `"missing"`, and run the whole file:
Run: `npx vitest run app/server/src/coverage/compare.test.ts`
Expected: FAIL on "a notice never queried is unchecked, not missing". **Restore.**

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add app/server/src/coverage/compare.ts app/server/src/coverage/compare.test.ts
git commit -m "Coverage: the comparator, and an unqueried notice is not a miss"
```

---

### Task 6: C1–C4, and the weaker segment wins

**Files:**
- Create: `app/server/src/coverage/measure.ts`
- Create: `app/server/src/coverage/measure.test.ts`

**Interfaces:**
- Consumes: `COVERAGE`, `COVERAGE_RATIFIED` (Task 2); `Carried`/`Segment` (Tasks 4–5); `PredicateResult` from `../fitness/floor.js`.
- Produces: `GradedItem`, `measureCoverage` — used by Tasks 7 and 8.

- [ ] **Step 1: Write the failing test**

Create `app/server/src/coverage/measure.test.ts`:

```ts
import { expect, test } from "vitest";
import { measureCoverage } from "./measure.js";
import { COVERAGE } from "./thresholds.js";
import type { GradedItem } from "./measure.js";

function items(spec: {
  segment: "state_agency" | "sub_state";
  carried: number;
  timely: number;
  missing: number;
}): GradedItem[] {
  const out: GradedItem[] = [];
  let i = 0;
  for (let n = 0; n < spec.timely; n++)
    out.push({ externalId: `t${i++}`, segment: spec.segment, carried: "carried", leadDays: 30 });
  for (let n = 0; n < spec.carried; n++)
    out.push({ externalId: `c${i++}`, segment: spec.segment, carried: "carried", leadDays: 1 });
  for (let n = 0; n < spec.missing; n++)
    out.push({ externalId: `m${i++}`, segment: spec.segment, carried: "missing", leadDays: null });
  return out;
}

function find(rs: ReturnType<typeof measureCoverage>, id: string) {
  const r = rs.find((x) => x.id === id);
  if (!r) throw new Error(`no ${id}`);
  return r;
}

test("a healthy cohort passes C1 and C2", () => {
  const rs = measureCoverage(items({ segment: "state_agency", carried: 0, timely: 40, missing: 0 }));
  expect(find(rs, "C1").verdict).toBe("pass");
  expect(find(rs, "C2").verdict).toBe("pass");
});

/* 🔴 THE WHOLE POINT OF RULING ④. A source that carries everything, always,
 * but too late to bid, passes C1 and must FAIL C2. */
test("carried but always too late passes C1 and fails C2", () => {
  const rs = measureCoverage(items({ segment: "state_agency", carried: 40, timely: 0, missing: 0 }));
  expect(find(rs, "C1").verdict).toBe("pass");
  expect(find(rs, "C2").verdict).toBe("fail");
});

/* 🔴 THE WHOLE POINT OF RULING ③. Strong state-agency coverage must not
 * conceal weak sub-state coverage. Mirrors R7's weakest-property rule: a
 * minimum, unlike an average, cannot be talked up by adding strengths. */
test("a strong segment cannot rescue a weak one", () => {
  const rs = measureCoverage([
    ...items({ segment: "state_agency", carried: 0, timely: 40, missing: 0 }),
    ...items({ segment: "sub_state", carried: 0, timely: 10, missing: 30 }),
  ]);
  expect(find(rs, "C1").verdict).toBe("fail");
  expect(find(rs, "C1").detail).toContain("sub_state");
});

/* Established practice: R7 recorded "61 rows -- below the population floor of
 * 100, measured and recorded as such". Below the floor grades UNKNOWN, never
 * pass -- a 100% recall over four notices is not evidence. */
test("a cohort below the floor is unknown, never pass", () => {
  const rs = measureCoverage(items({ segment: "state_agency", carried: 0, timely: 4, missing: 0 }));
  expect(find(rs, "C4").verdict).toBe("fail");
  expect(find(rs, "C1").verdict).toBe("unknown");
  expect(find(rs, "C2").verdict).toBe("unknown");
});

/* `unchecked` is not a miss and not a find. It must not enter either
 * numerator OR denominator, or a run that aborted at its budget cap changes
 * the score. */
test("unchecked notices are excluded from the cohort entirely", () => {
  const base = items({ segment: "state_agency", carried: 0, timely: 40, missing: 0 });
  const withUnchecked: GradedItem[] = [
    ...base,
    ...Array.from({ length: 50 }, (_, n) => ({
      externalId: `u${n}`,
      segment: "state_agency" as const,
      carried: "unchecked" as const,
      leadDays: null,
    })),
  ];
  expect(find(measureCoverage(withUnchecked), "C1").measured).toBe(
    find(measureCoverage(base), "C1").measured,
  );
});

test("every predicate says its thresholds are unratified", () => {
  const rs = measureCoverage(items({ segment: "state_agency", carried: 0, timely: 40, missing: 0 }));
  for (const r of rs) expect(r.detail ?? "").toContain("not approved");
});

test("C3 reports median lead time without gating", () => {
  const rs = measureCoverage(items({ segment: "state_agency", carried: 0, timely: 40, missing: 0 }));
  expect(find(rs, "C3").verdict).toBe("unknown");
  expect(find(rs, "C3").measured).toBe(30);
});

test("the minLeadDays boundary is inclusive", () => {
  const rs = measureCoverage([
    { externalId: "a", segment: "state_agency", carried: "carried", leadDays: COVERAGE.minLeadDays },
  ]);
  expect(find(rs, "C2").measured).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/server/src/coverage/measure.test.ts`
Expected: FAIL — cannot resolve `./measure.js`.

- [ ] **Step 3: Write the implementation**

Create `app/server/src/coverage/measure.ts`:

```ts
/* C1--C4. PURE: takes graded items, returns predicates.
 *
 * Reuses fitness/floor.ts's PredicateResult rather than declaring a parallel
 * shape, because a reader of `npm run fitness` should not have to learn a
 * second vocabulary for the same idea. */
import type { PredicateResult } from "../fitness/floor.js";
import type { Carried } from "./compare.js";
import type { Segment } from "./answer-key.js";
import { COVERAGE, COVERAGE_RATIFIED } from "./thresholds.js";

export interface GradedItem {
  externalId: string;
  segment: Segment;
  carried: Carried;
  leadDays: number | null;
}

/* D5's stated consequence, applied here: while the numbers are unratified,
 * EVERY verdict carries the caveat -- exactly as gradeCompleteness appends it
 * to every R7 note. A provisional verdict a reader could mistake for the real
 * one is the failure this prevents. */
const CAVEAT = "Thresholds are not approved (COVERAGE_RATIFIED = false).";
const note = (s?: string) => (s ? `${s} ${CAVEAT}` : CAVEAT);

const SEGMENTS: Segment[] = ["state_agency", "sub_state"];

/* `unchecked` is excluded from the cohort ENTIRELY -- not counted as a find,
 * not counted as a miss. A run that stopped at its budget cap must not move
 * the score in either direction. */
const settled = (items: GradedItem[]) => items.filter((i) => i.carried !== "unchecked");

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

interface SegmentScore {
  segment: Segment;
  n: number;
  recall: number;
  timely: number;
}

function scoreSegment(items: GradedItem[], segment: Segment): SegmentScore | null {
  const rows = settled(items).filter((i) => i.segment === segment);
  if (rows.length === 0) return null;
  const carried = rows.filter((r) => r.carried === "carried");
  const timely = carried.filter(
    (r) => r.leadDays !== null && r.leadDays >= COVERAGE.minLeadDays,
  );
  return {
    segment,
    n: rows.length,
    recall: carried.length / rows.length,
    timely: timely.length / rows.length,
  };
}

/* WEAKEST SEGMENT WINS. Mirrors R7, rebuilt 2026-09-04 to "grade the
 * measurement and take the WEAKEST property", on the reasoning that a
 * minimum, unlike an average, cannot be talked up by adding strengths. The
 * argument is stronger here: a blended recall would let strong state-agency
 * coverage conceal weak sub-state coverage, which is the exact failure
 * ruling ③ exists to prevent. */
function weakest(scores: SegmentScore[], by: (s: SegmentScore) => number): SegmentScore | null {
  let worst: SegmentScore | null = null;
  for (const s of scores) if (!worst || by(s) < by(worst)) worst = s;
  return worst;
}

export function measureCoverage(items: GradedItem[]): PredicateResult[] {
  const cohort = settled(items);
  const scores = SEGMENTS.map((s) => scoreSegment(items, s)).filter(
    (s): s is SegmentScore => s !== null,
  );

  const bigEnough = cohort.length >= COVERAGE.minCohortSize;

  const c4: PredicateResult = {
    id: "C4",
    property: "cohort",
    statement: "The settled cohort is large enough to grade",
    threshold: COVERAGE.minCohortSize,
    measured: cohort.length,
    verdict: bigEnough ? "pass" : "fail",
    detail: note(
      bigEnough
        ? undefined
        : `Below the floor, so C1 and C2 report unknown rather than pass. ` +
          `Keep running: the cohort accumulates across runs (spec §5.5).`,
    ),
  };

  const worstRecall = weakest(scores, (s) => s.recall);
  const worstTimely = weakest(scores, (s) => s.timely);

  const c1: PredicateResult = {
    id: "C1",
    property: "coverage recall",
    statement: "The weaker segment's share of key notices HigherGov carried at all",
    threshold: COVERAGE.minCoverageRecall,
    measured: worstRecall ? Number(worstRecall.recall.toFixed(3)) : "n/a",
    verdict: !bigEnough || !worstRecall
      ? "unknown"
      : worstRecall.recall >= COVERAGE.minCoverageRecall
        ? "pass"
        : "fail",
    detail: note(
      worstRecall
        ? `Weakest segment: ${worstRecall.segment} (n=${worstRecall.n}). ` +
          scores.map((s) => `${s.segment} ${s.recall.toFixed(3)}`).join(" · ")
        : "No settled items in any segment.",
    ),
  };

  const c2: PredicateResult = {
    id: "C2",
    property: "timely recall",
    statement: `Share carried with at least ${COVERAGE.minLeadDays} days left to bid — THE GATE`,
    threshold: COVERAGE.minTimelyRecall,
    measured: worstTimely ? Number(worstTimely.timely.toFixed(3)) : "n/a",
    verdict: !bigEnough || !worstTimely
      ? "unknown"
      : worstTimely.timely >= COVERAGE.minTimelyRecall
        ? "pass"
        : "fail",
    detail: note(
      worstTimely
        ? `Weakest segment: ${worstTimely.segment} (n=${worstTimely.n}). ` +
          `A notice carried too late to bid is a miss with a tick beside it.`
        : "No settled items in any segment.",
    ),
  };

  const leads = cohort
    .filter((i) => i.carried === "carried" && i.leadDays !== null)
    .map((i) => i.leadDays!);

  const c3: PredicateResult = {
    id: "C3",
    property: "capture latency",
    statement: "Median days of bidding time remaining when HigherGov first carried it",
    threshold: "reported, not gating",
    measured: median(leads) ?? "n/a",
    /* Deliberately never pass/fail: ruling ④ made lead time gating THROUGH
     * C2. C3 is the distribution behind that gate, reported so the number can
     * be ratified later against real data rather than guessed at now. */
    verdict: "unknown",
    detail: note(`n=${leads.length} carried notices with a computable lead time.`),
  };

  return [c1, c2, c3, c4];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/server/src/coverage/measure.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Prove the weakest-segment rule by mutation**

In `weakest`, change `by(s) < by(worst)` to `by(s) > by(worst)` (making it *best*-segment-wins), and run the whole file:
Run: `npx vitest run app/server/src/coverage/measure.test.ts`
Expected: FAIL on "a strong segment cannot rescue a weak one". **Restore.**

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add app/server/src/coverage/measure.ts app/server/src/coverage/measure.test.ts
git commit -m "Coverage: C1-C4, and the weaker segment is the one that counts"
```

---

### Task 7: The run — the spend guard, the tally, and the abort

**Files:**
- Create: `app/server/src/coverage/run.ts`
- Create: `app/server/src/coverage/run.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–6; `recordSpend`/`spentThisMonth`/`MONTHLY_RECORD_CEILING` from `../extract/api-spend.js`; `all`/`one`/`insert`/`run` from `../db/index.js`.
- Produces: `RunOutcome`, `runCoverage` — used by Task 8.

- [ ] **Step 1: Write the failing test**

Create `app/server/src/coverage/run.test.ts`:

```ts
/* 🛑 NO LIVE CALLS ANYWHERE IN THIS FILE. Every case injects a fake client. */
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";
import type { HigherGovClient, FeedResult } from "./highergov-client.js";
import type { KeyEntry } from "./answer-key.js";

useTestSchema("test_coverage_run");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, close, one, run } = await import("../db/index.js");
const { runCoverage } = await import("./run.js");
const { COVERAGE } = await import("./thresholds.js");

function fakeClient(byDay: Record<string, FeedResult>): HigherGovClient {
  return {
    async fetchDay(capturedDate) {
      return byDay[capturedDate] ?? { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
  };
}

beforeAll(async () => {
  await migrate(false);
}, 120000);

beforeEach(async () => {
  await run(`DELETE FROM coverage_item`);
  await run(`DELETE FROM coverage_run`);
  await run(`DELETE FROM api_spend`);
});

afterAll(async () => {
  await close();
});

test("a run records what the vendor billed in api_spend", async () => {
  const out = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    client: fakeClient({
      "2026-09-03": {
        notices: [
          { externalId: "A", capturedDate: "2026-09-03", versionKey: "v1", title: "t" },
        ],
        records: 5,
        feedCount: 5,
        pages: 1,
      },
    }),
  });
  expect(out.recordsSpent).toBe(5);
  const spend = await one<{ total: string }>(
    `SELECT sum(records)::text AS total FROM api_spend WHERE endpoint = 'opportunity'`,
  );
  expect(Number(spend!.total)).toBe(5);
});

/* 🔴 THE TALLY MUST SURVIVE A FAILED WRITE. api-spend.ts's final review
 * settled this: by the time the fetch returns, the VENDOR HAS BILLED. A
 * rolled-back write must not erase a spend that really happened -- against a
 * ceiling that cannot be read back, under-reporting is the dangerous
 * direction. */
test("the spend is recorded even when the item write fails", async () => {
  const client: HigherGovClient = {
    async fetchDay() {
      return {
        notices: [{ externalId: "A", capturedDate: "2026-09-03", versionKey: null, title: null }],
        records: 7,
        feedCount: 7,
        pages: 1,
      };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
  };
  /* `failItemWriteForTest` throws a plain Error after the fetches and after
   * the spend is recorded, but before any coverage_item is written -- which
   * is exactly the window this test exists to probe. */
  /* `failItemWriteForTest` is a declared field on RunOptions, not a cast:
   * a test-only escape hatch is named for what it is rather than smuggled
   * past the type system. */
  await expect(
    runCoverage({ from: "2026-09-03", to: "2026-09-03", client, failItemWriteForTest: true }),
  ).rejects.toThrow();
  const spend = await one<{ total: string }>(
    `SELECT coalesce(sum(records),0)::text AS total FROM api_spend`,
  );
  expect(Number(spend!.total)).toBe(7);
});

/* 🔴 THE HARD STOP. The cost model is a projection from ONE observation
 * (R5, 5 records for one day). A run must abort rather than overspend. */
test("a run aborts at maxRecordsPerRun rather than continuing", async () => {
  const heavy: FeedResult = {
    notices: [],
    records: COVERAGE.maxRecordsPerRun + 1,
    feedCount: 9999,
    pages: 1,
  };
  const out = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-05",
    client: fakeClient({ "2026-09-03": heavy }),
  });
  expect(out.aborted).toBe(true);
  expect(out.abortReason).toContain("maxRecordsPerRun");
  const row = await one<{ aborted: boolean }>(`SELECT aborted FROM coverage_run LIMIT 1`);
  expect(row!.aborted).toBe(true);
});

const keyOf = (...ids: string[]): KeyEntry[] =>
  ids.map((externalId) => ({
    externalId,
    segment: "state_agency" as const,
    keyOrigin: "Indiana IDOA solicitations",
    deadline: "2026-09-30",
  }));

test("an aborted run's unqueried days leave no misses behind", async () => {
  const heavy: FeedResult = { notices: [], records: COVERAGE.maxRecordsPerRun + 1, feedCount: 1, pages: 1 };
  await runCoverage({
    from: "2026-09-03",
    to: "2026-09-05",
    key: keyOf("A", "B", "C"),
    client: fakeClient({ "2026-09-03": heavy }),
  });
  /* Three notices we never resolved. Every one must be `unchecked`; a single
   * `missing` here is coverage decay manufactured out of our own budget cap.
   * The key is non-empty ON PURPOSE -- with no key the assertion holds even
   * if the abort logic were deleted, and would prove nothing. */
  const misses = await all(`SELECT 1 FROM coverage_item WHERE carried = 'missing'`);
  expect(misses).toHaveLength(0);
  const unchecked = await all(`SELECT 1 FROM coverage_item WHERE carried = 'unchecked'`);
  expect(unchecked).toHaveLength(3);
});

/* 🔴 THE FALSE-MISS GUARD. fetchDay answers "what did you capture in this
 * window", not "do you carry this notice" -- and most of the answer key was
 * captured before the window opens. */
test("a notice absent from the window is looked up by id before being called missing", async () => {
  const client: HigherGovClient = {
    async fetchDay() {
      return { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
    async fetchBySourceId(sourceId) {
      return {
        notices: [
          { externalId: sourceId, capturedDate: "2026-08-01", versionKey: null, title: null },
        ],
        records: 1,
        feedCount: 1,
        pages: 1,
      };
    },
  };
  await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    key: keyOf("003000000088067"),
    client,
  });
  /* Captured 2026-08-01 -- BEFORE the window. Window-absence is not absence. */
  const row = await one<{ carried: string }>(`SELECT carried FROM coverage_item`);
  expect(row!.carried).toBe("carried");
});

test("a notice in neither the window nor the id lookup is a real miss, and cost nothing", async () => {
  const client: HigherGovClient = {
    async fetchDay() {
      return { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
    async fetchBySourceId() {
      return { notices: [], records: 0, feedCount: 0, pages: 1 };
    },
  };
  const out = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    key: keyOf("003000000088067"),
    client,
  });
  const row = await one<{ carried: string }>(`SELECT carried FROM coverage_item`);
  expect(row!.carried).toBe("missing");
  /* The zero is the point: a miss is free to establish and free to re-check,
   * because the meter counts records RETURNED. */
  expect(out.recordsSpent).toBe(0);
});

/* 🔴 A day the client could only half-read must not be graded. Page one of
 * three means two pages of notices we never saw, and every one of them would
 * read downstream as a notice HigherGov does not carry. */
test("a day whose feed spans more than one page aborts rather than grading a truncation", async () => {
  const out = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    key: keyOf("003000000088067"),
    client: fakeClient({
      "2026-09-03": { notices: [], records: 5, feedCount: 500, pages: 3 },
    }),
  });
  expect(out.aborted).toBe(true);
  expect(out.abortReason).toContain("page 1 of 3");
  /* Unchecked, NOT missing -- we did not establish anything about this notice. */
  const row = await one<{ carried: string }>(`SELECT carried FROM coverage_item`);
  expect(row!.carried).toBe("unchecked");
});

/* 🔴 THE SAVED-SEARCH DETECTOR. R1: state filtering exists ONLY through a
 * saved search living in HigherGov's account, not our code. feed_count is
 * how a silent edit becomes visible. */
test("the run records the feed count for the saved-search detector", async () => {
  await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    client: fakeClient({
      "2026-09-03": { notices: [], records: 0, feedCount: 4242, pages: 1 },
    }),
  });
  const row = await one<{ feed_count: number }>(`SELECT feed_count FROM coverage_run LIMIT 1`);
  expect(row!.feed_count).toBe(4242);
});

test("the monthly ceiling refuses a run before it spends", async () => {
  const sourceId = await one<{ id: number }>(
    `SELECT id FROM source WHERE name = 'HigherGov'`,
  );
  const { MONTHLY_RECORD_CEILING } = await import("../extract/api-spend.js");
  await run(
    `INSERT INTO api_spend (source_id, endpoint, records) VALUES ($1, 'opportunity', $2)`,
    [sourceId!.id, MONTHLY_RECORD_CEILING],
  );
  const out = await runCoverage({
    from: "2026-09-03",
    to: "2026-09-03",
    client: fakeClient({}),
  });
  expect(out.aborted).toBe(true);
  expect(out.abortReason).toContain("ceiling");
  expect(out.recordsSpent).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/server/src/coverage/run.test.ts`
Expected: FAIL — cannot resolve `./run.js`.

- [ ] **Step 3: Write the implementation**

Create `app/server/src/coverage/run.ts`:

```ts
/* ONE RUN: ASK, COMPARE, RECORD, TALLY.
 *
 * The only module here that touches both the network and the database, which
 * is why the spend guard, the abort and the writes all live in this one
 * place rather than being spread across the pure modules.
 *
 * ⚠️ THIS RUN DOES NOT INGEST. Not HigherGov's rows (spec §5.1 -- ingesting a
 * source still under test would move F6 and F7, two of the three predicates
 * blocking GO/NO-GO, using data from a source we have not decided to keep),
 * and not the free source's either (spec §5.2 -- importing IDOA is a separate
 * operator act with its own commands; folding it in would make a measurement
 * run mutate holdings).
 *
 * Net: this writes coverage_run, coverage_item and api_spend. It touches no
 * holdings. That is weaker than "read-only" and is said that way rather than
 * rounded up. */
import { all, insert, one, run as exec } from "../db/index.js";
import {
  MONTHLY_RECORD_CEILING,
  recordSpend,
  spentThisMonth,
} from "../extract/api-spend.js";
import { higherGovClient, HIGHERGOV_SOURCE_NAME, type HigherGovClient } from "./highergov-client.js";
import { IDOA_SOURCE_NAME, type KeyEntry } from "./answer-key.js";
import { dedupBySourceId, observe, type Observation } from "./compare.js";
import { COVERAGE } from "./thresholds.js";
import type { FeedNotice } from "./highergov-client.js";

export interface RunOutcome {
  runId: number;
  recordsSpent: number;
  itemsObserved: number;
  aborted: boolean;
  abortReason?: string;
}

export interface RunOptions {
  from: string;
  to: string;
  client?: HigherGovClient;
  /** The free answer key. Injected so the run is testable without reaching
   * IDOA's live page -- and so a sub-state key can be supplied without this
   * module knowing how each buyer's page is shaped. */
  key?: KeyEntry[];
  fetchImpl?: typeof fetch;
  /** Test-only: forces the item write to throw, to prove the tally survives
   * it. Named for what it is rather than hidden behind a mock. */
  failItemWriteForTest?: boolean;
}

function days(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export async function runCoverage(opts: RunOptions): Promise<RunOutcome> {
  const client = opts.client ?? higherGovClient;

  const source = await one<{ id: number }>(`SELECT id FROM source WHERE name = $1`, [
    HIGHERGOV_SOURCE_NAME,
  ]);
  if (!source) {
    /* Fail LOUD rather than keying api_spend with undefined. Migration 019
     * seeds this row; if it is gone, every tally would silently attach to
     * nothing and the ceiling would never fire. */
    throw new Error(
      `No source row named '${HIGHERGOV_SOURCE_NAME}' (migration 019). ` +
        `Refusing to spend against an unknown source.`,
    );
  }

  const runId = await insert(
    `INSERT INTO coverage_run (source_id, cohort_from, cohort_to) VALUES ($1, $2, $3) RETURNING id`,
    [source.id, opts.from, opts.to],
  );

  /* THE CEILING IS CHECKED BEFORE ANY CALL, not after. Consumption cannot be
   * read back from the vendor at all (CLAUDE.md §5.1), so the only safe
   * moment to refuse is before the money is spent. */
  const alreadySpent = await spentThisMonth(HIGHERGOV_SOURCE_NAME);
  if (alreadySpent >= MONTHLY_RECORD_CEILING) {
    const reason =
      `Monthly ceiling reached: ${alreadySpent} of ${MONTHLY_RECORD_CEILING} records ` +
      `already spent this month. Refusing to call.`;
    await exec(`UPDATE coverage_run SET aborted = true, note = $2 WHERE id = $1`, [runId, reason]);
    return { runId, recordsSpent: 0, itemsObserved: 0, aborted: true, abortReason: reason };
  }

  const key = opts.key ?? [];
  const feed: FeedNotice[] = [];
  let spent = 0;

  /* Notices an earlier run already saw carried. Spec §5.5: a notice enters
   * the cohort once and SETTLES when carried -- re-asking would spend a
   * record to learn what we already know. */
  const settledRows = await all<{ external_id: string }>(
    `SELECT DISTINCT external_id FROM coverage_item WHERE carried = 'carried'`,
  );
  const settledIds = new Set(settledRows.map((r) => r.external_id));
  let feedCount: number | null = null;
  let aborted = false;
  let abortReason: string | undefined;

  for (const day of days(opts.from, opts.to)) {
    const result = await client.fetchDay(day, opts.fetchImpl);

    /* THE TALLY COMMITS ON ITS OWN, BEFORE ANYTHING ELSE. The vendor has
     * already billed by the time fetchDay returns -- nothing after this
     * un-bills it. api-spend.ts's final review reversed the original
     * spec on exactly this point. */
    await recordSpend({ run: exec }, {
      sourceId: source.id,
      endpoint: "opportunity",
      records: result.records,
    });
    spent += result.records;
    if (feedCount === null) feedCount = result.feedCount;

    feed.push(...result.notices);

    /* 🔴 A TRUNCATED DAY MUST NOT BE GRADED. The client reads page one and
     * cannot request page two -- deliberately, because paging spends records.
     * But rows we never received are indistinguishable downstream from rows
     * HigherGov does not carry: they become FALSE MISSES, the same defect the
     * id-lookup guard below exists to prevent. Refusing to grade is the safe
     * direction; narrowing the window is the operator's fix. */
    if (result.pages !== null && result.pages > 1) {
      aborted = true;
      abortReason =
        `Day ${day} returned page 1 of ${result.pages}. This client does not page, ` +
        `so grading would count rows we never received as rows HigherGov does not ` +
        `carry. Narrow the window and re-run.`;
      break;
    }

    if (spent >= COVERAGE.maxRecordsPerRun) {
      aborted = true;
      abortReason =
        `Stopped at maxRecordsPerRun: ${spent} records exceeds ${COVERAGE.maxRecordsPerRun}. ` +
        `Remaining days were not queried, and their notices stay 'unchecked' rather than ` +
        `becoming misses.`;
      break;
    }
  }

  const { notices, collapsed } = dedupBySourceId(feed);

  /* 🔴 THE FALSE-MISS GUARD, AND THE RUN IS WRONG WITHOUT IT.
   *
   * fetchDay answers "what did you CAPTURE in this window", not "do you CARRY
   * this notice". Most of the answer key was captured before the window
   * opens, so treating window-absence as a miss would manufacture coverage
   * decay out of our own choice of dates -- the exact mirror of the
   * `unchecked`-counted-as-miss defect compare.ts guards against, and in the
   * direction that wrongly un-shelves the adapter backlog.
   *
   * Nearly free by construction: the meter counts records RETURNED
   * (CLAUDE.md §5.1), so a lookup for a notice they genuinely do not carry
   * returns nothing and bills nothing. It costs one record precisely when it
   * converts a false miss into a real find -- the case where we learn
   * something. */
  const found = new Map(notices.map((n) => [n.externalId, n]));
  const checkedIds = new Set<string>();

  if (!aborted) {
    for (const entry of key) {
      if (found.has(entry.externalId)) {
        checkedIds.add(entry.externalId);
        continue;
      }
      /* 🔴 SETTLED EARLIER, SO WE DID NOT LOOK -- AND MUST NOT SAY WE DID.
       * This used to be folded into the condition above, adding the id to
       * `checkedIds`. That was a false-miss generator: `checkedIds` means "we
       * asked", `found` means "they have it", and `observe` grades
       * not-in-found + in-checked as MISSING. A notice settled `carried` by an
       * earlier run is in neither this run's feed nor its probes, so every
       * later run wrote it as a miss -- one per settled notice per run,
       * compounding forever, for a record we deliberately did not spend.
       * Leaving it out of `checkedIds` records `unchecked`, which is what
       * actually happened; gradedItems() still surfaces the earlier `carried`. */
      if (settledIds.has(entry.externalId)) continue;
      if (spent >= COVERAGE.maxRecordsPerRun) {
        /* Out of budget. Everything still unresolved stays `unchecked` and is
         * re-asked next run -- which is what the accumulating cohort is for.
         * The cap is deliberately NOT raised here: it governs money, it ships
         * unratified, and raising it is Matt's ruling to make. */
        aborted = true;
        abortReason =
          `Stopped at maxRecordsPerRun: ${spent} of ${COVERAGE.maxRecordsPerRun} records. ` +
          `Unresolved notices stay 'unchecked' and are re-asked next run.`;
        break;
      }
      const probe = await client.fetchBySourceId(entry.externalId, opts.fetchImpl);
      await recordSpend({ run: exec }, {
        sourceId: source.id,
        endpoint: "opportunity",
        records: probe.records,
      });
      spent += probe.records;
      checkedIds.add(entry.externalId);
      const hit = dedupBySourceId(probe.notices).notices[0];
      /* The id is VERIFIED, not assumed. observe() re-keys off n.externalId, so
       * a probe answering with a different notice would write a miss here and
       * a spurious carried elsewhere -- and the "unique by construction"
       * property this map relies on would quietly stop holding. */
      if (hit && hit.externalId === entry.externalId) found.set(entry.externalId, hit);
    }
  }

  const observations: Observation[] = observe(key, [...found.values()], checkedIds);

  if (opts.failItemWriteForTest) {
    throw new Error("forced item-write failure (test only)");
  }

  const idoaSource = await one<{ id: number }>(`SELECT id FROM source WHERE name = $1`, [
    IDOA_SOURCE_NAME,
  ]);

  for (const o of observations) {
    const entry = key.find((k) => k.externalId === o.externalId)!;
    await exec(
      `INSERT INTO coverage_item
         (run_id, external_id, segment, key_source_id, key_origin, key_seen_at,
          deadline, carried, captured_date, lead_days)
       VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8, $9)`,
      [
        runId,
        o.externalId,
        o.segment,
        entry.keyOrigin === IDOA_SOURCE_NAME ? (idoaSource?.id ?? null) : null,
        entry.keyOrigin,
        entry.deadline,
        o.carried,
        o.capturedDate,
        o.leadDays,
      ],
    );
  }

  await exec(
    `UPDATE coverage_run
        SET records_spent = $2, duplicates_collapsed = $3, feed_count = $4,
            search_id = $5, aborted = $6, note = $7
      WHERE id = $1`,
    [
      runId,
      spent,
      collapsed,
      feedCount,
      process.env.HIGHERGOV_SEARCH_ID ?? null,
      aborted,
      abortReason ?? null,
    ],
  );

  return {
    runId,
    recordsSpent: spent,
    itemsObserved: observations.length,
    aborted,
    abortReason,
  };
}

/** Every settled observation ever recorded, for grading. The cohort
 * ACCUMULATES across runs (spec §5.5) and each notice is taken at its LATEST
 * observation -- a notice carried late must stop reading as a permanent miss
 * the moment it is finally carried. */
export async function gradedItems() {
  return all<{
    externalId: string;
    segment: "state_agency" | "sub_state";
    carried: "carried" | "missing" | "unchecked";
    leadDays: number | null;
  }>(
    `SELECT DISTINCT ON (ci.external_id)
            ci.external_id AS "externalId", ci.segment,
            ci.carried, ci.lead_days AS "leadDays"
       FROM coverage_item ci
       JOIN coverage_run cr ON cr.id = ci.run_id
      ORDER BY ci.external_id,
               /* carried beats missing beats unchecked, THEN newest. Once the
                * budget cap can leave a notice \`unchecked\`, ordering by
                * recency alone would let a later run OVERWRITE an earlier
                * \`carried\` with "we didn't look" -- a settled finding erased
                * by a budget stop, biasing C1/C2 toward decay. */
               CASE ci.carried WHEN 'carried' THEN 0 WHEN 'missing' THEN 1 ELSE 2 END,
               cr.run_at DESC`,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/server/src/coverage/run.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Prove the abort by mutation**

Comment out the `checked.clear()` line inside the abort branch, and run the whole file:
Run: `npx vitest run app/server/src/coverage/run.test.ts`
Expected: FAIL on "an aborted run's unqueried days leave no misses behind". **Restore.**

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add app/server/src/coverage/run.ts app/server/src/coverage/run.test.ts
git commit -m "Coverage: the run, and an abort that cannot manufacture a miss"
```

---

### Task 8: `npm run recall`, and the paperwork that makes it findable

**Files:**
- Create: `app/server/src/coverage/coverage-cli.ts`
- Modify: `package.json` (add the `recall` script)
- Modify: `CLAUDE.md:~60` (the operator-commands paragraph in §2)
- Modify: `STATUS.md` (a new RESUME HERE entry)
- Modify: `docs/Proto2PRD-Lessons.md` (append the lesson)

**Interfaces:**
- Consumes: `measureCoverage`/`GradedItem` (Task 6), `gradedItems`/`runCoverage` (Task 7).
- Produces: the `npm run recall` command.

- [ ] **Step 1: Write the CLI**

Create `app/server/src/coverage/coverage-cli.ts`:

```ts
/* Thin CLI over run.ts and measure.ts. Mirrors fitness/fitness-cli.ts's
 * shape: same pathToFileURL entry guard, same catch/close handling, no
 * measurement logic here.
 *
 * WHY A CLI AND NOT A ROUTE: ruling 3A forbids new UI slices. A report a
 * person runs is the whole delivery.
 *
 * ⚠️ UNLIKE `npm run fitness`, THIS IS NOT READ-ONLY AND NOT FREE. It writes
 * coverage_run, coverage_item and api_spend, and it SPENDS METERED RECORDS.
 * CLAUDE.md §5.1 governs every invocation: inside the standing 500-record
 * budget calls may be made without asking each time, but every one is
 * counted, reported and justified in the same breath. */
import { pathToFileURL } from "node:url";
import { close } from "../db/index.js";
import { runCoverage, gradedItems } from "./run.js";
import { measureCoverage } from "./measure.js";
import { idoaKeyFrom } from "./answer-key.js";
import { COVERAGE, COVERAGE_RATIFIED } from "./thresholds.js";
import { IDOA_URL } from "../scrape/adapters/idoa.js";

const MARK: Record<string, string> = {
  pass: "PASS",
  fail: "FAIL",
  marginal: "MARGINAL",
  unknown: "UNKNOWN",
};

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=")[1];
}

export async function main(): Promise<void> {
  const from = arg("from");
  const to = arg("to");
  if (!from || !to) {
    throw new Error(
      "Usage: npm run recall -- --from=YYYY-MM-DD --to=YYYY-MM-DD\n" +
        "The window is REQUIRED and never defaulted: a default window is a " +
        "default spend, and this command costs metered records.",
    );
  }

  /* The answer key is fetched FREE, from IDOA's own page. */
  const html = await (await fetch(IDOA_URL)).text();
  const key = idoaKeyFrom(html);
  console.log(`Answer key: ${key.length} notices from IDOA (free).`);

  const outcome = await runCoverage({ from, to, key });

  console.log(
    `\nRun ${outcome.runId}: ${outcome.itemsObserved} observed, ` +
      `${outcome.recordsSpent} records spent (ceiling per run ${COVERAGE.maxRecordsPerRun}).`,
  );
  if (outcome.aborted) console.log(`⚠️  ABORTED: ${outcome.abortReason}`);

  const items = await gradedItems();
  console.log(`\nCohort accumulated across all runs: ${items.length} settled notices.\n`);

  for (const p of measureCoverage(items)) {
    console.log(`  ${p.id}  ${MARK[p.verdict]!.padEnd(9)} ${p.statement}`);
    console.log(`        ${p.property} · threshold ${p.threshold} · measured ${p.measured}`);
    if (p.detail) console.log(`        ${p.detail}`);
  }

  if (!COVERAGE_RATIFIED) {
    console.log(
      `\n⚖️  THIS VERDICT IS NOT BINDING. The thresholds are proposals ` +
        `awaiting Matt's ruling (spec §8).`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => close());
}
```

- [ ] **Step 2: Verify `IDOA_URL` is exported**

Run: `grep -n "export const IDOA_URL" app/server/src/scrape/adapters/idoa.ts`
Expected: a match. If it is not exported, add `export` to its declaration — it is a constant, and the CLI needs the same URL the adapter uses rather than a second copy.

- [ ] **Step 3: Add the npm script**

In `package.json`, after the `"fitness"` line:

```json
    "recall": "tsx --env-file-if-exists=.env app/server/src/coverage/coverage-cli.ts",
```

- [ ] **Step 4: Verify the command refuses to run without a window**

Run: `npm run recall`
Expected: exits non-zero with the usage message. **This must not make any network call** — the window check comes before the fetch.

- [ ] **Step 5: Update CLAUDE.md §2**

The paragraph currently naming two operator commands must name three. Replace the sentence beginning *"The two operator commands"* with:

```markdown
**The three operator commands, none of which is reachable from any screen.** `npm run fitness` measures the data floor and scores every source from recorded evidence — read-only, no arguments. `npm run contracts:ingest` loads the Indiana EDS contract register (~205k rows, 86 seconds). `npm run recall -- --from=YYYY-MM-DD --to=YYYY-MM-DD` measures HigherGov's coverage decay against a free answer key — **it is the only one that SPENDS METERED RECORDS, and §5.1 governs every invocation.** **All three act on whatever `DATABASE_URL` names**, so check which branch you are pointed at before the second one — ingesting production is a deliberate act and never a default.
```

- [ ] **Step 6: Add a STATUS.md RESUME HERE entry**

Insert immediately after the `## 🔖 RESUME HERE` heading, above the 2026-09-05 entry, and update that heading's date to today:

```markdown
## ✅ 2026-09-06 — STEP ③ IS BUILT, AND IT HAS NOT BEEN RUN

**`npm run recall` exists. It has never made a live HigherGov call, deliberately** — CLAUDE.md §5.1 covers testing, so every test in the slice runs against fixtures or an injected client. **The first live run is an operator act, and it needs a proposed record count first.**

**What it measures:** coverage decay — does HigherGov keep finding things? Four predicates, C1–C4, all with UNRATIFIED thresholds. **C2 is the gate**: a notice carried too late to bid is a miss with a tick beside it.

⚖️ **FOUR RULINGS WAITING, none of which costs a record.** The four C-thresholds; `minCohortSize: 30` in particular, which is BELOW R7's population floor of 100 and traded down to keep the test bounded; `MONTHLY_RECORD_CEILING`, which D2 left unratified at 1,000 and which this slice makes load-bearing for a second actor; and the forward cadence. **And one thing to fill in: the sub-state buyer list** — spec §8.1 carries an empty template, because the right buyers are the ones in KP's working geography and that is Matt's knowledge, not a lookup.

⚠️ **The first run will not resolve the whole answer key.** Confirming ~71 notices costs about one record each where HigherGov carries them, against a per-run cap of 40. Everything unresolved stays `unchecked` — **not** a miss — and is re-asked next run. **A complete first census therefore takes two or three runs**, which is the accumulating cohort working as designed rather than a fault. The cap was deliberately NOT raised to cover it: it governs money, it is unratified, and raising it is Matt's ruling to make.

⚠️ **The sub-state half of the answer key is NOT BUILT.** `idoaKeyFrom` covers the state-agency segment only. Until the sub-state key exists, `measureCoverage` sees one segment, and **weakest-segment-wins is measuring the segment we did not buy HigherGov for.** The predicate machinery is ready for it; the pages are not chosen. This is the largest open gap in the slice and it is named rather than discovered later.

Spec: `docs/superpowers/specs/2026-09-06-highergov-coverage-reliability-design.md`. Plan: `docs/superpowers/plans/2026-09-06-highergov-coverage-reliability.md`.
```

- [ ] **Step 7: Append the lesson to Proto2PRD-Lessons.md**

Add as a new numbered subsection at the end of the §2 series:

```markdown
### 2.NN An answer key you already froze is a window you already have

**Observed 2026-09-06.** Step ③ needed coverage recall over time, and the obvious
reading was that it needed to WAIT — pick a window, run daily, adjudicate at the
end. Nothing could be measured until the window closed.

**But a 71-item census had been frozen four days earlier**, for an unrelated
purpose (the buy case). Diffing today's free scrape against it produced a real
new-notice cohort immediately. **The wall-clock had already elapsed; nobody had
been watching it.**

**Proposed generalisation.** Before designing a longitudinal measurement, search
the repository for a FROZEN ARTEFACT — a census, a fixture, a committed answer
key, a recorded run — and check its date. A test that "needs two weeks" often
needs two weeks *from the earliest thing already on disk*, not from today. The
artefact was usually captured for a different purpose, which is why it does not
present itself as a baseline.

**The corollary that makes it act-able:** when freezing any census, record the
capture date in the artefact itself. The 71-item key was usable as a baseline
only because its heading said `captured 2026-09-02`.

**Why not promoted.** One instance, one project.
```

- [ ] **Step 8: Run the gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add package.json CLAUDE.md STATUS.md docs/Proto2PRD-Lessons.md app/server/src/coverage/coverage-cli.ts
git commit -m "Coverage: npm run recall, and the paperwork that makes it findable"
```

---

### Task 9: The whole-slice review pass

**Files:**
- Modify: whatever the review finds.

**Interfaces:**
- Consumes: everything.
- Produces: a merged slice.

- [ ] **Step 1: Run the full gate on the branch**

Run: `npm run check`
Expected: exit 0. **Record the exact test and file counts** — they go in the merge message.

- [ ] **Step 2: Prove no live call is reachable from any test**

Run: `grep -rn "highergov.com" app/server/src/coverage/ | grep -v "\.test\." | grep -v fixtures`
Expected: exactly one hit, the `HOST` constant in `highergov-client.ts`.

Run: `grep -rln "fetch(" app/server/src/coverage/*.test.ts`
Expected: no output. **Every test injects a client or a `fetchImpl`; none calls `fetch` itself.**

- [ ] **Step 3: Prove the key cannot reach a log**

Run: `grep -rn "console\." app/server/src/coverage/`
Expected: hits only in `coverage-cli.ts`, and none of them prints a URL, a raw response body, or anything derived from one.

- [ ] **Step 4: Request review**

Use the `superpowers:requesting-code-review` skill on the whole branch diff. **Ask specifically about the two things a green suite could not catch**, in the spirit of CLAUDE.md §4:
  1. Can any path write a HigherGov row into `solicitation` or `sighting`? (Spec §5.1 — this is the decision the design turns on.)
  2. Can any path count an `unchecked` notice as a miss? (That would manufacture coverage decay out of our own budget cap.)

- [ ] **Step 5: Merge**

```bash
git checkout main
git merge --no-ff coverage-reliability
```

The merge message records: the gate count on the MERGED result (re-run, not quoted from the branch), the four rulings still open, and the sub-state gap.

- [ ] **Step 6: Re-run the gate on the merged result**

Run: `npm run check`
Expected: exit 0, same counts. **This is the step STATUS.md's own 2026-09-06 correction exists because of** — a branch figure is not a merged figure until it is re-run.

---

## Self-Review

**Spec coverage.** Every section maps to a task: §3.1–3.2 → Tasks 4, 7 · §3.3 → Task 7 · §3.4 hazard 1 (dedup) → Task 5 · §3.4 hazard 2 (saved search) → Tasks 1, 3, 7 · §3.5 (deadline-relative lead) → Task 5 · §4 (C1–C4) → Task 6 · §4.1 (weakest segment) → Task 6 · §4.2–4.3 → Tasks 2, 6 · §5.1–5.2 (no ingest) → Task 7 · §5.3–5.5 → Task 1 · §6 (cost, hard stop) → Tasks 2, 7 · §7 (layout) → all · §7.1 (§5.3 rules) → Task 3 · §9 (testing) → every task · §10 (out of scope) → Task 9 Step 2.

**One spec requirement with no task, and it is deliberate.** §8.1's **sub-state answer key is not implemented** — the buyer list is Matt's to fill in, and building a scraper per municipality before the buyers are chosen would be guessing. Task 8 Step 6 names this in STATUS as the largest open gap rather than letting it pass silently. **Until it exists, weakest-segment-wins grades one segment, and it is not the one HigherGov was bought for.**

**One spec correction made here.** The spec's §5.4 gave `deadline` as `timestamptz`. `merge/closes-at.ts` returns a bare `YYYY-MM-DD` and its header explains why; the migration uses `date`, and Task 1's comment records the reason.

**Type consistency.** `Segment` is declared once (Task 4) and imported everywhere. `Carried` is declared once (Task 5). `FeedNotice`/`FeedResult` once (Task 3). `PredicateResult` is reused from `fitness/floor.ts` rather than redeclared. `GradedItem` (Task 6) matches the column aliases `gradedItems()` returns (Task 7): `externalId`, `segment`, `carried`, `leadDays`.
