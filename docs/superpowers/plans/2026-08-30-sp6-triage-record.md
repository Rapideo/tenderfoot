# SP6 — Triage and record: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the triage queue and the solicitation record, and instrument the GO / NO-GO gate — so a person can read everything active sources return, decide on it, and get two defensible numbers out.

**Architecture:** The queue is a **query**, not a table: eligible = no decision yet and not closed, ordered `closes_at ASC NULLS LAST`. The gate's measurement runs against a **materialised per-source random sample** (migration 012) whose population size is recorded at draw time, so *Interested-per-hundred* has a denominator that is a stored fact. Decisions are **append-only** `pursuit` rows; the current state is the latest row per solicitation, and undo appends a reversal. The record view resolves `extracted_field` rows at read time through the existing `precedence.ts`, showing conflicts beneath the winner rather than resolving them away.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Express, Postgres via `pg`, React 19 + react-router-dom, Vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-08-30-sp6-triage-record-design.md`

## Global Constraints

- **Gate is `npm run check` from the repo root.** It must exit 0 at the end of every task. Baseline entering this plan: **430 tests / 58 files**.
- **TDD, without exception.** Write the failing test, run it, watch it fail *for the stated reason*, then implement. A test that passes on first run is testing something that already worked.
- **SERVER import specifiers end in `.js`** even for TypeScript sources, matching the existing codebase. **CLIENT imports do not** — `app/client` is bundled by Vite and its existing files import extensionlessly (`from "../primitives"`, `from "./adminSecret"`). Follow each side's own convention; mixing them breaks the build on one side or the other.
- **No judgment, anywhere.** Nothing in this slice scores, ranks, filters or gates. Sampling selects what a human reads in order to measure; it never changes what the product returns. Design spec §1.1.
- **Writes are gated, reads are not.** Every `POST` here sits behind `requireAdminSecret` from `lib/adminSecret.js`. Every `GET` stays open, so screens load without turning a shared secret into a login.
- **Decisions are append-only.** Never `UPDATE` a `pursuit` row and never `DELETE` one. Undo is an `INSERT`.
- **`value_cents` and every `count(*)` arrive from `pg` as JavaScript NUMBERS, not strings.** `db/index.ts:20` runs `pg.types.setTypeParser(20, …)`, which parses bigint (OID 20) to `Number` once, centrally, so no call site has to. Type these `number | null` and format from a number.

  > ⚠️ **This constraint said the exact opposite until 2026-08-30, and the correction is Task 3's implementer's, not mine.** It read *"arrives as a STRING… no setTypeParser is configured in this repo"*, which is false — the parser has been there since the Postgres port, with a comment explaining why. The error was not cosmetic: Task 11's `money()` was written to call `.slice()` on the value, which throws on a number, while its test fixture used a quoted string and passed. **A green test over a browser crash — the exact failure shape SP3.6 was bitten by.** Everywhere this plan still says a count comes back as a string, it is wrong; the `Number(...)` wrappers left in place are harmless no-ops kept as belt-and-braces.
- **Test isolation is schema-per-file.** `useTestSchema("test_<name>")` then `await resetSchema()` at module top, BEFORE the dynamic imports that open a pool.
- **No network in tests.** Every fixture is inserted directly.
- **Deviations go in `docs/admin-deviations.md`**, the continuous series. D10 is current; this plan adds **D11–D15**.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/server/migrations/012_triage.sql` | `triage_sample`, `triage_sample_item`, the `pursuit_latest` index |
| `app/server/src/triage/latest.ts` | The `DISTINCT ON` current-state query and its reusable SQL fragment |
| `app/server/src/triage/eligibility.ts` | The membership predicate, alone, so `queue.ts` and `sample.ts` need not import each other |
| `app/server/src/triage/queue.ts` | Queue membership, ordering, paging, and the deadline-conflict flag |
| `app/server/src/triage/sample.ts` | Drawing, reading and listing materialised samples |
| `app/server/src/triage/decide.ts` | Appending a decision; mandatory-on-Pass |
| `app/server/src/triage/metrics.ts` | Volume per source per week; Interested-per-hundred per source |
| `app/server/src/routes/triage.ts` | The five new endpoints |
| `app/server/src/routes/index.ts` | *Modified* — extend `GET /solicitations/:id`; bound `GET /solicitations` |
| `app/client/src/primitives/Button.tsx` | *Modified* — gains `onClick` and `ariaLabel`. SP2 built it inert; SP6 is the trigger STATUS named |
| `app/client/src/shell/Shell.tsx` | Region A.1 + A.2, wrapping every product screen |
| `app/client/src/triage/Queue.tsx` | View 1.1 + 1.3 — card, cost panel, decision bar, keyboard |
| `app/client/src/triage/useQueueKeys.ts` | Keyboard bindings, isolated so they are testable without the screen |
| `app/client/src/record/Record.tsx` | Views 2.3, 2.4, 2.5 |
| `app/client/src/router.tsx` | *Modified* — queue at `/`, record at `/solicitation/:id`, Health to `/health` |

---

## Task 1: Migration 012 — the sample store and the pursuit index

**Files:**
- Create: `app/server/migrations/012_triage.sql`
- Test: `app/server/src/db/schema.test.ts` (append)

**Interfaces:**
- Consumes: nothing
- Produces: tables `triage_sample`, `triage_sample_item`; index `pursuit_latest`

- [ ] **Step 1: Write the failing schema tests**

Append to `app/server/src/db/schema.test.ts`:

```ts
test("triage_sample records the population it drew from", async () => {
  const src = await insert(`INSERT INTO source (name) VALUES ('sample fixture') RETURNING id`);
  const sample = await insert(
    `INSERT INTO triage_sample (source_id, seed, n_requested, population_size)
     VALUES ($1, 'seed-a', 100, 4812) RETURNING id`,
    [src],
  );
  const row = await one<{ population_size: number; n_requested: number }>(
    `SELECT population_size, n_requested FROM triage_sample WHERE id = $1`,
    [sample],
  );
  /* Both, separately. A source with 40 eligible rows and n=100 draws 40,
   * and one number cannot carry both facts. */
  expect(row?.population_size).toBe(4812);
  expect(row?.n_requested).toBe(100);
});

test("population_size cannot be left off a sample", async () => {
  const src = await insert(`INSERT INTO source (name) VALUES ('no denominator') RETURNING id`);
  await expect(
    dbRun(
      `INSERT INTO triage_sample (source_id, seed, n_requested) VALUES ($1, 'seed-b', 10)`,
      [src],
    ),
  ).rejects.toThrow();
});

test("one solicitation may hold many pursuit rows -- history is legal", async () => {
  const sol = await insert(
    `INSERT INTO solicitation (title, source_id) VALUES ('append fixture', 1) RETURNING id`,
  );
  await dbRun(`INSERT INTO pursuit (solicitation_id, state) VALUES ($1, 'Interested')`, [sol]);
  await dbRun(
    `INSERT INTO pursuit (solicitation_id, state, reason) VALUES ($1, 'Not Interested', 'reversed')`,
    [sol],
  );
  const rows = await all<{ state: string }>(
    `SELECT state FROM pursuit WHERE solicitation_id = $1`,
    [sol],
  );
  /* Both survive. The reversal IS the second row. */
  expect(rows).toHaveLength(2);
});

test("pursuit_latest index exists, because every read depends on it", async () => {
  const idx = await all<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename = 'pursuit'`,
    [SCHEMA],
  );
  expect(idx.map((i) => i.indexname)).toContain("pursuit_latest");
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/server/src/db/schema.test.ts`
Expected: FAIL — `relation "triage_sample" does not exist`.

- [ ] **Step 3: Write migration 012**

Create `app/server/migrations/012_triage.sql`:

```sql
-- SP6. The gate's measurement needs a denominator that is a STORED FACT,
-- not a recomputation.
--
-- A seeded ORDER BY is a deterministic permutation of the ELIGIBLE SET, and
-- eligibility is "not closed and not yet decided" -- a set that moves under
-- the session as deadlines pass and ingests land. So a re-seeded draw is
-- reproducible only against a population that no longer exists. The number
-- outlives the session: six months on, "Interested-per-hundred was 3.2 for
-- SAM.gov" needs a denominator somebody can reconstruct.
--
-- This is the discipline corpus/calibration/README.md already imposes, and
-- the discipline two failures this month came from lacking.
CREATE TABLE triage_sample (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id       integer NOT NULL REFERENCES source(id),
  drawn_at        timestamptz NOT NULL DEFAULT now(),
  seed            text NOT NULL,
  -- What was ASKED for. Kept apart from the item count on purpose: a source
  -- with 40 eligible rows and n=100 draws 40, and those are different facts.
  n_requested     integer NOT NULL,
  -- Eligible rows AT DRAW TIME. THE DENOMINATOR.
  population_size integer NOT NULL,
  note            text
);

CREATE TABLE triage_sample_item (
  sample_id       integer NOT NULL REFERENCES triage_sample(id),
  solicitation_id integer NOT NULL REFERENCES solicitation(id),
  position        integer NOT NULL,
  PRIMARY KEY (sample_id, solicitation_id)
);

-- Decisions are APPEND-ONLY (spec §5.1). `pursuit_solicitation` was already
-- a plain index rather than a unique constraint, so history was legal in the
-- schema before this migration -- what it was missing was a way to read the
-- latest row cheaply.
--
-- created_at, NOT decided_at: decided_at is a `text` column in migration 002
-- and cannot be sorted reliably. id DESC breaks a same-millisecond tie.
CREATE INDEX pursuit_latest ON pursuit(solicitation_id, created_at DESC, id DESC);
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run app/server/src/db/schema.test.ts`
Expected: PASS, all four.

- [ ] **Step 5: Run the gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/server/migrations/012_triage.sql app/server/src/db/schema.test.ts
git commit -m "Migration 012: the sample store, and an index for append-only decisions"
```

---

## Task 2: `triage/latest.ts` — the current-state query

**Files:**
- Create: `app/server/src/triage/latest.ts`
- Test: `app/server/src/triage/latest.test.ts`

**Interfaces:**
- Consumes: `db/index.js` (`all`)
- Produces:
  - `LATEST_PURSUIT: string` — a SQL fragment, one row per solicitation that has any pursuit row
  - `interface LatestPursuit { pursuit_id: number; solicitation_id: number; state: PursuitState; reason: string |  /* bigint. db/index.ts:20 parses OID 20 to Number centrally, so this is a
   * NUMBER here, not a string. Formatted at the edge. */
  value_cents: number | null; decided_by: string | null; created_at: string }`
  - `type PursuitState = "New" | "Triaged" | "Interested" | "Not Interested"`
  - `latestPursuitFor(ids: number[]): Promise<LatestPursuit[]>`

- [ ] **Step 1: Write the failing test**

Create `app/server/src/triage/latest.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_latest");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, run } = await import("../db/index.js");
const { latestPursuitFor } = await import("./latest.js");

beforeAll(async () => {
  await migrate(false);
}, 120000);
afterAll(async () => {
  await close();
});

async function solicitation(title: string): Promise<number> {
  return insert(
    `INSERT INTO solicitation (title, source_id) VALUES ($1, 1) RETURNING id`,
    [title],
  );
}

test("the latest row wins, and the earlier ones still exist", async () => {
  const sol = await solicitation("reversal");
  await run(
    `INSERT INTO pursuit (solicitation_id, state, created_at)
     VALUES ($1, 'Interested', '2026-08-30T10:00:00Z')`,
    [sol],
  );
  await run(
    `INSERT INTO pursuit (solicitation_id, state, reason, created_at)
     VALUES ($1, 'Not Interested', 'on second look', '2026-08-30T11:00:00Z')`,
    [sol],
  );

  const latest = await latestPursuitFor([sol]);
  expect(latest).toHaveLength(1);
  expect(latest[0]!.state).toBe("Not Interested");
  expect(latest[0]!.reason).toBe("on second look");
});

/* Two decisions inside the same millisecond are not hypothetical: an undo
 * followed immediately by a re-decision is exactly that shape, and
 * created_at alone cannot order them. */
test("a same-timestamp tie is broken by id, not left to chance", async () => {
  const sol = await solicitation("tie");
  const stamp = "2026-08-30T12:00:00.000Z";
  await run(
    `INSERT INTO pursuit (solicitation_id, state, created_at) VALUES ($1, 'Interested', $2)`,
    [sol, stamp],
  );
  await run(
    `INSERT INTO pursuit (solicitation_id, state, created_at) VALUES ($1, 'Not Interested', $2)`,
    [sol, stamp],
  );

  const latest = await latestPursuitFor([sol]);
  expect(latest[0]!.state).toBe("Not Interested");
});

test("a solicitation with no pursuit row returns nothing, not a fabricated New", async () => {
  const sol = await solicitation("untouched");
  expect(await latestPursuitFor([sol])).toHaveLength(0);
});

test("an empty id list issues no query and returns nothing", async () => {
  expect(await latestPursuitFor([])).toEqual([]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run app/server/src/triage/latest.test.ts`
Expected: FAIL — cannot resolve `./latest.js`.

- [ ] **Step 3: Implement**

Create `app/server/src/triage/latest.ts`:

```ts
import { all } from "../db/index.js";

export type PursuitState = "New" | "Triaged" | "Interested" | "Not Interested";

export interface LatestPursuit {
  pursuit_id: number;
  solicitation_id: number;
  state: PursuitState;
  reason: string | null;
  decided_by: string | null;
  created_at: string;
}

/* Decisions are APPEND-ONLY (spec §5.1), so "the decision" is always the
 * newest row rather than the only one. This fragment is exported so the
 * queue and the metrics embed the SAME definition -- two hand-written
 * DISTINCT ONs would be two definitions, and the one that drifted would be
 * the one nobody was looking at.
 *
 * ORDER BY created_at DESC, id DESC: decided_at is `text` in migration 002
 * and unsortable; id breaks a same-millisecond tie deterministically. */
export const LATEST_PURSUIT = `
  SELECT DISTINCT ON (solicitation_id)
         id AS pursuit_id, solicitation_id, state, reason, decided_by, created_at
    FROM pursuit
   ORDER BY solicitation_id, created_at DESC, id DESC`;

export async function latestPursuitFor(ids: number[]): Promise<LatestPursuit[]> {
  if (ids.length === 0) return [];
  return all<LatestPursuit>(
    `SELECT * FROM (${LATEST_PURSUIT}) p WHERE p.solicitation_id = ANY($1)`,
    [ids],
  );
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run app/server/src/triage/latest.test.ts`
Expected: PASS, all four.

- [ ] **Step 5: Run the gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/triage/latest.ts app/server/src/triage/latest.test.ts
git commit -m "The latest-decision query, defined once so the queue and metrics cannot drift"
```

---

## Task 3: `triage/queue.ts` — membership, order, and constant cost

**Files:**
- Create: `app/server/src/triage/eligibility.ts`
- Create: `app/server/src/triage/queue.ts`
- Test: `app/server/src/triage/queue.test.ts`

> **Controller ruling (pre-flight, 2026-08-30): `ELIGIBLE` lives in its own module, not in `queue.ts`.** As first drafted, `queue.ts` imported `getSample` from `sample.ts` (Task 5) while `sample.ts` imported `ELIGIBLE` back from `queue.ts` — a genuine ESM cycle. It would happen to work, because both uses sit inside function bodies and resolve lazily, but it breaks the moment either is used at module top level. A one-export module with one responsibility costs four lines.

**Interfaces:**
- Consumes: `LATEST_PURSUIT` from `./latest.js`
- Produces:
  - `interface QueueItem { id, title, org_name, jurisdiction, closes_at, value_cents, kind, set_aside, source_name, documents, sightings, deadline_conflict }`
  - `interface QueuePage { mode: "all" | "sample"; sample: null; total: number; remaining: number; items: QueueItem[] }`
  - `queuePage(opts?: { limit?: number; offset?: number }): Promise<QueuePage>`
  - `ELIGIBLE: string` from `./eligibility.js` — the membership predicate, imported by both `queue.ts` and `sample.ts`

**Note on `sample` and `mode`:** this task always returns `mode: "all"` and `sample: null`. Task 5 adds sample mode. The fields exist from the start so the client's shape never changes.

- [ ] **Step 1: Write the failing tests**

Create `app/server/src/triage/queue.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_queue");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, run, pool } = await import("../db/index.js");
const { queuePage } = await import("./queue.js");

/* Statement spy, copied in shape from merge.test.ts: a spy, not a stub, and
 * attached at module level because pool.on("connect") fires at client
 * CREATION -- a listener registered inside a test would count zero, which is
 * indistinguishable from a passing fix. */
const statements: string[] = [];
pool.on("connect", (client) => {
  const c = client as unknown as { query: (...a: any[]) => any };
  const orig = c.query.bind(c);
  c.query = (...a: any[]) => {
    statements.push(typeof a[0] === "string" ? a[0] : (a[0]?.text ?? ""));
    return orig(...a);
  };
});

const FUTURE = "2027-06-01";
const PAST = "2020-01-01";

beforeAll(async () => {
  await migrate(false);
}, 120000);
afterAll(async () => {
  await close();
});

async function sol(title: string, closesAt: string | null): Promise<number> {
  return insert(
    `INSERT INTO solicitation (title, source_id, closes_at) VALUES ($1, 1, $2) RETURNING id`,
    [title, closesAt],
  );
}

test("an undecided, still-open solicitation is in the queue", async () => {
  const id = await sol("open and undecided", FUTURE);
  const page = await queuePage();
  expect(page.items.map((i) => i.id)).toContain(id);
});

test("a decided solicitation leaves the queue", async () => {
  const id = await sol("already judged", FUTURE);
  await run(`INSERT INTO pursuit (solicitation_id, state) VALUES ($1, 'Interested')`, [id]);
  const page = await queuePage();
  expect(page.items.map((i) => i.id)).not.toContain(id);
});

/* 'New' is the schema default and means UNDECIDED. A row carrying it must
 * stay in the queue -- treating any pursuit row as a decision would empty
 * the queue for anything the system had merely touched. */
test("a pursuit row in state New is not a decision", async () => {
  const id = await sol("touched but undecided", FUTURE);
  await run(`INSERT INTO pursuit (solicitation_id, state) VALUES ($1, 'New')`, [id]);
  const page = await queuePage();
  expect(page.items.map((i) => i.id)).toContain(id);
});

test("a reversal back to New returns it to the queue", async () => {
  const id = await sol("reversed to undecided", FUTURE);
  await run(
    `INSERT INTO pursuit (solicitation_id, state, created_at)
     VALUES ($1, 'Interested', '2026-08-30T10:00:00Z')`,
    [id],
  );
  await run(
    `INSERT INTO pursuit (solicitation_id, state, created_at)
     VALUES ($1, 'New', '2026-08-30T11:00:00Z')`,
    [id],
  );
  const page = await queuePage();
  expect(page.items.map((i) => i.id)).toContain(id);
});

test("a closed solicitation is not in the queue", async () => {
  const id = await sol("closed last year", PAST);
  const page = await queuePage();
  expect(page.items.map((i) => i.id)).not.toContain(id);
});

/* A missing deadline is not a reason to hide an opportunity. But sorting
 * unknown-as-urgent is how a null becomes a false alarm, so it goes last. */
test("a solicitation with no deadline is included, and sorted last", async () => {
  const undated = await sol("no deadline at all", null);
  const dated = await sol("closes soon", FUTURE);
  const page = await queuePage();
  const ids = page.items.map((i) => i.id);
  expect(ids).toContain(undated);
  expect(ids.indexOf(dated)).toBeLessThan(ids.indexOf(undated));
});

test("soonest deadline comes first", async () => {
  const later = await sol("closes later", "2027-12-01");
  const sooner = await sol("closes sooner", "2027-01-15");
  const page = await queuePage();
  const ids = page.items.map((i) => i.id);
  expect(ids.indexOf(sooner)).toBeLessThan(ids.indexOf(later));
});

/* THE ASSERTION IS CONSTANCY, NOT SMALLNESS -- the merge.ts precedent. A
 * bound like `<= 5` passes for any implementation whose constant happens to
 * fit, and keeps passing when cost quietly becomes proportional again with a
 * small multiplier. Only a set-based implementation can issue the same
 * number of statements for 5 items and for 25. */
test("queue cost is CONSTANT in the number of items returned", async () => {
  for (let i = 0; i < 5; i++) await sol(`small ${i}`, FUTURE);
  statements.length = 0;
  const small = await queuePage({ limit: 5 });
  const smallStatements = statements.length;

  for (let i = 0; i < 25; i++) await sol(`large ${i}`, FUTURE);
  statements.length = 0;
  const large = await queuePage({ limit: 25 });
  const largeStatements = statements.length;

  /* The page must actually have returned the work -- five times as many
   * items. A queue that returned nothing would be constant too, and
   * worthless. */
  expect(small.items).toHaveLength(5);
  expect(large.items).toHaveLength(25);

  expect(largeStatements).toBe(smallStatements);
}, 120000);
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/server/src/triage/queue.test.ts`
Expected: FAIL — cannot resolve `./queue.js`.

- [ ] **Step 3: Implement**

Create `app/server/src/triage/eligibility.ts`:

```ts
/* MEMBERSHIP. Undecided, and not closed.
 *
 * "Undecided" is: no pursuit row at all, OR a latest row still in 'New'.
 * 'New' is migration 002's default and means untouched -- treating any
 * pursuit row as a decision would empty the queue for anything the system
 * had merely written a placeholder for.
 *
 * closes_at is `text` holding ISO dates, so a string comparison against a
 * bound ISO date is the correct ordering. NULL is included deliberately:
 * a missing deadline is not a reason to hide an opportunity.
 *
 * IT LIVES IN ITS OWN MODULE so queue.ts and sample.ts can both use it
 * without importing each other -- queue.ts needs sample.ts's getSample, and
 * a mutual import is a cycle waiting to bite.
 *
 * Expects the caller to bind today's ISO date as $1, and to have joined
 * the latest-pursuit view as `lp` and the solicitation as `s`. */
export const ELIGIBLE = `
      (lp.state IS NULL OR lp.state = 'New')
  AND (s.closes_at IS NULL OR s.closes_at >= $1)`;
```

Create `app/server/src/triage/queue.ts`:

```ts
import { all, one } from "../db/index.js";
import { LATEST_PURSUIT } from "./latest.js";
import { ELIGIBLE } from "./eligibility.js";

export interface DeadlineConflict {
  value_text: string;
  origin: "listing" | "document";
  quote: string | null;
}

export interface QueueItem {
  id: number;
  title: string;
  org_name: string | null;
  jurisdiction: string | null;
  closes_at: string | null;
  /* bigint. db/index.ts:20 parses OID 20 to Number centrally -- "parsed
   * here, once, rather than at fourteen call sites" -- so this is a NUMBER,
   * not a string. Formatted at the edge. */
  value_cents: number | null;
  kind: string | null;
  set_aside: string | null;
  source_name: string | null;
  documents: number;
  sightings: number;
  /* Region 1.1.1: show the disagreement rather than silently picking a
   * winner. Empty for the overwhelming majority of rows. */
  deadline_conflict: DeadlineConflict[];
}

export interface QueuePage {
  mode: "all" | "sample";
  sample: null;
  total: number;
  remaining: number;
  items: QueueItem[];
}

const NOW_ISO = () => new Date().toISOString().slice(0, 10);

export async function queuePage(
  opts: { limit?: number; offset?: number } = {},
): Promise<QueuePage> {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 200));
  const offset = Math.max(0, opts.offset ?? 0);
  const today = NOW_ISO();

  const counted = await one<{ total: number }>(
    `SELECT count(*) AS total
       FROM solicitation s
       LEFT JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = s.id
      WHERE ${ELIGIBLE}`,
    [today],
  );
  const total = Number(counted?.total ?? 0);

  /* ONE statement for the page, whatever its size -- including the
   * per-item document counts, sighting counts and deadline conflicts,
   * which are lateral aggregates rather than a query per row. This is
   * what the constancy test in queue.test.ts pins. */
  const items = await all<QueueItem>(
    `SELECT s.id, s.title, o.name AS org_name, o.jurisdiction,
            s.closes_at, s.value_cents, s.kind, s.set_aside,
            src.name AS source_name,
            (SELECT count(*)::int FROM document d WHERE d.solicitation_id = s.id) AS documents,
            (SELECT count(*)::int FROM sighting g WHERE g.solicitation_id = s.id) AS sightings,
            COALESCE(
              (SELECT json_agg(json_build_object(
                        'value_text', ef.value_text,
                        'origin', ef.origin,
                        'quote', ef.quote))
                 FROM extracted_field ef
                WHERE ef.solicitation_id = s.id
                  AND ef.field_name = 'closes_at'
                  AND ef.value_text IS NOT NULL
                  AND s.closes_at IS NOT NULL
                  AND ef.value_text <> s.closes_at),
              '[]'::json) AS deadline_conflict
       FROM solicitation s
       LEFT JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = s.id
       LEFT JOIN organization o ON o.id = s.org_id
       LEFT JOIN source src ON src.id = s.source_id
      WHERE ${ELIGIBLE}
      ORDER BY s.closes_at ASC NULLS LAST, s.id ASC
      LIMIT ${limit} OFFSET ${offset}`,
    [today],
  );

  return { mode: "all", sample: null, total, remaining: Math.max(0, total - offset), items };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run app/server/src/triage/queue.test.ts`
Expected: PASS, all eight.

- [ ] **Step 5: Run the gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/triage/queue.ts app/server/src/triage/queue.test.ts
git commit -m "The queue: undecided and open, soonest deadline first, at constant cost"
```

---

## Task 4: `triage/decide.ts` — append-only decisions

**Files:**
- Create: `app/server/src/triage/decide.ts`
- Test: `app/server/src/triage/decide.test.ts`

**Interfaces:**
- Consumes: `latestPursuitFor`, `PursuitState`, `LatestPursuit` from `./latest.js`
- Produces:
  - `class ReasonRequiredError extends Error`
  - `interface DecisionInput { solicitationId: number; state: PursuitState; reason?: string | null; decidedBy?: string | null; requireReasonOnPass?: boolean }`
  - `recordDecision(input: DecisionInput): Promise<LatestPursuit>`

- [ ] **Step 1: Write the failing tests**

Create `app/server/src/triage/decide.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_decide");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, close, insert } = await import("../db/index.js");
const { recordDecision, ReasonRequiredError } = await import("./decide.js");

beforeAll(async () => {
  await migrate(false);
}, 120000);
afterAll(async () => {
  await close();
});

async function sol(title: string): Promise<number> {
  return insert(
    `INSERT INTO solicitation (title, source_id) VALUES ($1, 1) RETURNING id`,
    [title],
  );
}

test("a decision appends a row and returns the new latest state", async () => {
  const id = await sol("first decision");
  const latest = await recordDecision({
    solicitationId: id,
    state: "Interested",
    decidedBy: "matt",
  });
  expect(latest.state).toBe("Interested");
  expect(latest.decided_by).toBe("matt");
});

/* THE APPEND-ONLY PROPERTY. This is the test that fails the moment somebody
 * "optimises" this into an UPDATE. */
test("changing a decision leaves the earlier one intact", async () => {
  const id = await sol("changed my mind");
  await recordDecision({ solicitationId: id, state: "Interested" });
  await recordDecision({ solicitationId: id, state: "Not Interested", reason: "too big for us" });

  const rows = await all<{ state: string }>(
    `SELECT state FROM pursuit WHERE solicitation_id = $1 ORDER BY id`,
    [id],
  );
  expect(rows.map((r) => r.state)).toEqual(["Interested", "Not Interested"]);
});

test("undo is an append back to New, not a delete", async () => {
  const id = await sol("mis-tap");
  await recordDecision({ solicitationId: id, state: "Not Interested", reason: "wrong key" });
  const latest = await recordDecision({ solicitationId: id, state: "New" });

  expect(latest.state).toBe("New");
  const rows = await all<{ id: number }>(
    `SELECT id FROM pursuit WHERE solicitation_id = $1`,
    [id],
  );
  expect(rows).toHaveLength(2);
});

/* A rejection with no reason is the one event that teaches nothing (SVRC
 * Region 1.1.4). Mandatory on Pass is the DEFAULT, not a law. */
test("Pass with no reason is refused by default", async () => {
  const id = await sol("silent pass");
  await expect(
    recordDecision({ solicitationId: id, state: "Not Interested" }),
  ).rejects.toBeInstanceOf(ReasonRequiredError);
});

test("whitespace is not a reason", async () => {
  const id = await sol("whitespace pass");
  await expect(
    recordDecision({ solicitationId: id, state: "Not Interested", reason: "   " }),
  ).rejects.toBeInstanceOf(ReasonRequiredError);
});

test("a firm may switch mandatory-on-Pass off", async () => {
  const id = await sol("obvious junk");
  const latest = await recordDecision({
    solicitationId: id,
    state: "Not Interested",
    requireReasonOnPass: false,
  });
  expect(latest.state).toBe("Not Interested");
  expect(latest.reason).toBeNull();
});

test("Interested needs no reason", async () => {
  const id = await sol("clear yes");
  const latest = await recordDecision({ solicitationId: id, state: "Interested" });
  expect(latest.state).toBe("Interested");
});

test("an unknown state is refused before it reaches the CHECK constraint", async () => {
  const id = await sol("bad state");
  await expect(
    recordDecision({ solicitationId: id, state: "Maybe" as never }),
  ).rejects.toThrow(/state/i);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/server/src/triage/decide.test.ts`
Expected: FAIL — cannot resolve `./decide.js`.

- [ ] **Step 3: Implement**

Create `app/server/src/triage/decide.ts`:

```ts
import { run } from "../db/index.js";
import { latestPursuitFor, type LatestPursuit, type PursuitState } from "./latest.js";

const STATES: readonly PursuitState[] = ["New", "Triaged", "Interested", "Not Interested"];

/* Distinct from a generic Error so the route can answer 400 rather than 500:
 * a missing reason is the caller's to fix, not a fault. */
export class ReasonRequiredError extends Error {
  constructor() {
    super(
      "A reason is required on Pass. This is a default, not a law -- " +
        "requireReasonOnPass may be switched off, and what that gives up is " +
        "the corpus a reason vocabulary would later be derived from.",
    );
    this.name = "ReasonRequiredError";
  }
}

export interface DecisionInput {
  solicitationId: number;
  state: PursuitState;
  reason?: string | null;
  decidedBy?: string | null;
  /** SVRC Region 1.1.4, ratified 2026-08-12: default on, switchable. */
  requireReasonOnPass?: boolean;
}

/* APPEND-ONLY. Never UPDATE, never DELETE (spec §5.1).
 *
 * It is the rule the rest of the system already runs on -- precedence.ts
 * keeps rejected values, conflicts are rows rather than a flag, gated items
 * are filed rather than deleted. A decision that silently overwrote its
 * predecessor would be the one place this project discards evidence, and it
 * would do it to the data the GO/NO-GO number is computed from. */
export async function recordDecision(input: DecisionInput): Promise<LatestPursuit> {
  const { solicitationId, state, decidedBy = null, requireReasonOnPass = true } = input;

  if (!STATES.includes(state)) {
    throw new Error(`Unknown pursuit state "${state}". One of: ${STATES.join(", ")}.`);
  }

  const reason = input.reason?.trim() ? input.reason.trim() : null;
  if (state === "Not Interested" && requireReasonOnPass && !reason) {
    throw new ReasonRequiredError();
  }

  await run(
    `INSERT INTO pursuit (solicitation_id, state, reason, decided_by, decided_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [solicitationId, state, reason, decidedBy, new Date().toISOString()],
  );

  const [latest] = await latestPursuitFor([solicitationId]);
  if (!latest) throw new Error(`Decision on ${solicitationId} did not persist.`);
  return latest;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run app/server/src/triage/decide.test.ts`
Expected: PASS, all eight.

- [ ] **Step 5: Run the gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/triage/decide.ts app/server/src/triage/decide.test.ts
git commit -m "Decisions are appended, never overwritten -- and Pass carries a reason"
```

---

## Task 5: `triage/sample.ts` — the materialised draw

**Files:**
- Create: `app/server/src/triage/sample.ts`
- Modify: `app/server/src/triage/queue.ts` (add `sampleId` support — it imports `ELIGIBLE` from `./eligibility.js`, created in Task 3)
- Test: `app/server/src/triage/sample.test.ts`

**Interfaces:**
- Consumes: `ELIGIBLE` from `./eligibility.js`
- Produces:
  - `interface SampleHeader { id, source_id, source_name, drawn_at, seed, n_requested, population_size, drawn, decided, note }`
  - `drawSample(opts: { sourceId: number; n: number; seed?: string; note?: string }): Promise<SampleHeader>`
  - `getSample(id: number): Promise<SampleHeader | null>`
  - `listSamples(): Promise<SampleHeader[]>`
- Also produces: `queuePage({ sampleId })` returning `mode: "sample"` and a populated `sample`

- [ ] **Step 1: Write the failing tests**

Create `app/server/src/triage/sample.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_sample");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, close, insert, run } = await import("../db/index.js");
const { drawSample, getSample } = await import("./sample.js");
const { queuePage } = await import("./queue.js");

const FUTURE = "2027-06-01";
let source: number;

beforeAll(async () => {
  await migrate(false);
  source = await insert(`INSERT INTO source (name) VALUES ('sampling source') RETURNING id`);
}, 120000);
afterAll(async () => {
  await close();
});

async function sol(title: string, sourceId = source): Promise<number> {
  return insert(
    `INSERT INTO solicitation (title, source_id, closes_at) VALUES ($1, $2, $3) RETURNING id`,
    [title, sourceId, FUTURE],
  );
}

test("the draw records the population it drew from", async () => {
  for (let i = 0; i < 20; i++) await sol(`pop ${i}`);
  const sample = await drawSample({ sourceId: source, n: 5, seed: "alpha" });

  expect(sample.n_requested).toBe(5);
  expect(sample.drawn).toBe(5);
  /* The denominator is what was ELIGIBLE, not what was drawn. */
  expect(sample.population_size).toBeGreaterThanOrEqual(20);
});

test("asking for more than exists draws all of it, and says so", async () => {
  const lonely = await insert(`INSERT INTO source (name) VALUES ('one row only') RETURNING id`);
  await sol("the only one", lonely);
  const sample = await drawSample({ sourceId: lonely, n: 100, seed: "beta" });

  expect(sample.n_requested).toBe(100);
  expect(sample.drawn).toBe(1);
  expect(sample.population_size).toBe(1);
});

test("the same seed draws the same rows", async () => {
  const a = await drawSample({ sourceId: source, n: 5, seed: "same-seed" });
  const b = await drawSample({ sourceId: source, n: 5, seed: "same-seed" });

  const ids = async (id: number) =>
    (
      await all<{ solicitation_id: number }>(
        `SELECT solicitation_id FROM triage_sample_item WHERE sample_id = $1 ORDER BY position`,
        [id],
      )
    ).map((r) => r.solicitation_id);

  expect(await ids(a.id)).toEqual(await ids(b.id));
});

test("different seeds draw different rows", async () => {
  const a = await drawSample({ sourceId: source, n: 5, seed: "seed-one" });
  const b = await drawSample({ sourceId: source, n: 5, seed: "seed-two" });

  const ids = async (id: number) =>
    (
      await all<{ solicitation_id: number }>(
        `SELECT solicitation_id FROM triage_sample_item WHERE sample_id = $1 ORDER BY position`,
        [id],
      )
    ).map((r) => r.solicitation_id);

  expect(await ids(a.id)).not.toEqual(await ids(b.id));
});

/* THE PROPERTY THE WHOLE MIGRATION EXISTS FOR. A seeded ORDER BY over the
 * live eligible set would silently reshuffle here, and the denominator the
 * session started with would not be the one it ended with. */
test("a sample does not change when new solicitations arrive", async () => {
  const sample = await drawSample({ sourceId: source, n: 5, seed: "stability" });
  const before = await all<{ solicitation_id: number }>(
    `SELECT solicitation_id FROM triage_sample_item WHERE sample_id = $1 ORDER BY position`,
    [sample.id],
  );

  for (let i = 0; i < 40; i++) await sol(`arrived later ${i}`);

  const after = await all<{ solicitation_id: number }>(
    `SELECT solicitation_id FROM triage_sample_item WHERE sample_id = $1 ORDER BY position`,
    [sample.id],
  );
  expect(after).toEqual(before);

  const reread = await getSample(sample.id);
  expect(reread?.population_size).toBe(sample.population_size);
});

/* Removing it would MOVE THE DENOMINATOR, which is the exact failure the
 * materialised draw exists to prevent. */
test("an item whose deadline passes stays in the sample", async () => {
  const doomed = await sol("closes during the session");
  const sample = await drawSample({ sourceId: source, n: 200, seed: "closing" });

  await run(`UPDATE solicitation SET closes_at = '2020-01-01' WHERE id = $1`, [doomed]);

  const items = await all<{ solicitation_id: number }>(
    `SELECT solicitation_id FROM triage_sample_item WHERE sample_id = $1`,
    [sample.id],
  );
  expect(items.map((i) => i.solicitation_id)).toContain(doomed);
});

test("the queue in sample mode says so, and carries the denominator", async () => {
  const sample = await drawSample({ sourceId: source, n: 5, seed: "mode" });
  const page = await queuePage({ sampleId: sample.id });

  expect(page.mode).toBe("sample");
  expect(page.sample?.population_size).toBe(sample.population_size);
  expect(page.items.length).toBeLessThanOrEqual(5);
});

test("a second draw for the same source is a new sample, never an edit", async () => {
  const first = await drawSample({ sourceId: source, n: 3, seed: "first" });
  const second = await drawSample({ sourceId: source, n: 3, seed: "second" });
  expect(second.id).not.toBe(first.id);

  const stillThere = await getSample(first.id);
  expect(stillThere?.population_size).toBe(first.population_size);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/server/src/triage/sample.test.ts`
Expected: FAIL — cannot resolve `./sample.js`.

- [ ] **Step 3: Implement the draw**

Create `app/server/src/triage/sample.ts`:

```ts
import { all, one, tx } from "../db/index.js";
import { ELIGIBLE } from "./eligibility.js";
import { LATEST_PURSUIT } from "./latest.js";

export interface SampleHeader {
  id: number;
  source_id: number;
  source_name: string;
  drawn_at: string;
  seed: string;
  n_requested: number;
  /** Eligible rows AT DRAW TIME. The denominator. */
  population_size: number;
  /** How many were actually drawn -- differs from n_requested on a small source. */
  drawn: number;
  /** How many of them now carry a decision. */
  decided: number;
  note: string | null;
}

const HEADER_SQL = `
  SELECT ts.id, ts.source_id, src.name AS source_name, ts.drawn_at, ts.seed,
         ts.n_requested, ts.population_size, ts.note,
         (SELECT count(*)::int FROM triage_sample_item i WHERE i.sample_id = ts.id) AS drawn,
         (SELECT count(*)::int
            FROM triage_sample_item i
            JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = i.solicitation_id
           WHERE i.sample_id = ts.id AND lp.state <> 'New') AS decided
    FROM triage_sample ts
    JOIN source src ON src.id = ts.source_id`;

const TODAY = () => new Date().toISOString().slice(0, 10);

/* Drawing is an EXPLICIT operator action that records its own population.
 *
 * Sampling is a MEASUREMENT PROTOCOL, not a filter: it selects what a human
 * reads in order to measure, never what the product returns. The queue's own
 * membership and order are untouched by it (spec §2.1).
 *
 * md5(id || seed) is a deterministic permutation -- not cryptographic, and
 * it does not need to be. What it needs is to be reproducible and unrelated
 * to any property of the row, so the draw is not accidentally ordered by
 * deadline, value, or insertion. */
export async function drawSample(opts: {
  sourceId: number;
  n: number;
  seed?: string;
  note?: string;
}): Promise<SampleHeader> {
  const seed = opts.seed ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const n = Math.max(1, Math.min(opts.n, 1000));
  const today = TODAY();

  const id = await tx(async (q) => {
    const pop = await q.one<{ total: number }>(
      `SELECT count(*) AS total
         FROM solicitation s
         LEFT JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = s.id
        WHERE s.source_id = $2 AND ${ELIGIBLE}`,
      [today, opts.sourceId],
    );
    const populationSize = Number(pop?.total ?? 0);

    const header = await q.one<{ id: number }>(
      `INSERT INTO triage_sample (source_id, seed, n_requested, population_size, note)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [opts.sourceId, seed, opts.n, populationSize, opts.note ?? null],
    );
    const sampleId = header!.id;

    const picked = await q.all<{ id: number }>(
      `SELECT s.id
         FROM solicitation s
         LEFT JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = s.id
        WHERE s.source_id = $2 AND ${ELIGIBLE}
        ORDER BY md5(s.id::text || $3)
        LIMIT ${n}`,
      [today, opts.sourceId, seed],
    );

    /* UNNEST, not a row per INSERT and not a VALUES list -- the established
     * pattern from the SP3.5 ingestion fix. It collapses the round trips AND
     * the bind parameters, so the statement count does not scale with n. */
    if (picked.length > 0) {
      await q.run(
        `INSERT INTO triage_sample_item (sample_id, solicitation_id, position)
         SELECT $1, sol_id, pos
           FROM UNNEST($2::int[], $3::int[]) AS t(sol_id, pos)`,
        [sampleId, picked.map((p) => p.id), picked.map((_, i) => i)],
      );
    }
    return sampleId;
  });

  const header = await getSample(id);
  if (!header) throw new Error(`Sample ${id} did not persist.`);
  return header;
}

export async function getSample(id: number): Promise<SampleHeader | null> {
  return one<SampleHeader>(`${HEADER_SQL} WHERE ts.id = $1`, [id]);
}

export async function listSamples(): Promise<SampleHeader[]> {
  return all<SampleHeader>(`${HEADER_SQL} ORDER BY ts.drawn_at DESC`);
}
```

- [ ] **Step 4: Teach `queuePage` about sample mode**

In `app/server/src/triage/queue.ts`, change the imports, the `QueuePage` interface and the signature:

```ts
import { all, one } from "../db/index.js";
import { LATEST_PURSUIT } from "./latest.js";
import { getSample, type SampleHeader } from "./sample.js";
```

```ts
export interface QueuePage {
  mode: "all" | "sample";
  sample: SampleHeader | null;
  total: number;
  remaining: number;
  items: QueueItem[];
}
```

Replace the body of `queuePage` with:

```ts
export async function queuePage(
  opts: { limit?: number; offset?: number; sampleId?: number } = {},
): Promise<QueuePage> {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 200));
  const offset = Math.max(0, opts.offset ?? 0);
  const today = NOW_ISO();

  const sample = opts.sampleId ? await getSample(opts.sampleId) : null;
  if (opts.sampleId && !sample) throw new Error(`No sample ${opts.sampleId}.`);

  /* In sample mode the population is the DRAWN SET, so membership is
   * restricted to it -- but eligibility still applies within it, because a
   * drawn row that has since been decided has left the queue. It has NOT
   * left the sample: the denominator does not move. */
  const scope = sample ? `AND EXISTS (
        SELECT 1 FROM triage_sample_item i
         WHERE i.sample_id = ${sample.id} AND i.solicitation_id = s.id)` : "";

  const counted = await one<{ total: number }>(
    `SELECT count(*) AS total
       FROM solicitation s
       LEFT JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = s.id
      WHERE ${ELIGIBLE} ${scope}`,
    [today],
  );
  const total = Number(counted?.total ?? 0);

  const items = await all<QueueItem>(
    `SELECT s.id, s.title, o.name AS org_name, o.jurisdiction,
            s.closes_at, s.value_cents, s.kind, s.set_aside,
            src.name AS source_name,
            (SELECT count(*)::int FROM document d WHERE d.solicitation_id = s.id) AS documents,
            (SELECT count(*)::int FROM sighting g WHERE g.solicitation_id = s.id) AS sightings,
            COALESCE(
              (SELECT json_agg(json_build_object(
                        'value_text', ef.value_text,
                        'origin', ef.origin,
                        'quote', ef.quote))
                 FROM extracted_field ef
                WHERE ef.solicitation_id = s.id
                  AND ef.field_name = 'closes_at'
                  AND ef.value_text IS NOT NULL
                  AND s.closes_at IS NOT NULL
                  AND ef.value_text <> s.closes_at),
              '[]'::json) AS deadline_conflict
       FROM solicitation s
       LEFT JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = s.id
       LEFT JOIN organization o ON o.id = s.org_id
       LEFT JOIN source src ON src.id = s.source_id
      WHERE ${ELIGIBLE} ${scope}
      ORDER BY s.closes_at ASC NULLS LAST, s.id ASC
      LIMIT ${limit} OFFSET ${offset}`,
    [today],
  );

  return {
    mode: sample ? "sample" : "all",
    sample,
    total,
    remaining: Math.max(0, total - offset),
    items,
  };
}
```

- [ ] **Step 5: Run both suites and watch them pass**

Run: `npx vitest run app/server/src/triage/`
Expected: PASS — `sample.test.ts` all eight, and `queue.test.ts` still all eight.

- [ ] **Step 6: Run the gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/server/src/triage/sample.ts app/server/src/triage/sample.test.ts app/server/src/triage/queue.ts
git commit -m "Materialise the gate's sample, so its denominator is a fact and not a recomputation"
```

---

## Task 6: `triage/metrics.ts` — the two gate numbers

**Files:**
- Create: `app/server/src/triage/metrics.ts`
- Test: `app/server/src/triage/metrics.test.ts`

**Interfaces:**
- Consumes: `LATEST_PURSUIT` from `./latest.js`
- Produces:
  - `interface WeeklyVolume { source_id: number; source_name: string; week: string; solicitations: number }`
  - `interface VolumeReport { weeks: WeeklyVolume[]; excluded_no_posted_at: number; total_rows: number }`
  - `volumePerSourcePerWeek(): Promise<VolumeReport>`
  - `interface InterestedRate { sample_id, source_id, source_name, population_size, drawn, decided, interested, interested_per_hundred }`
  - `interestedPerHundred(): Promise<InterestedRate[]>`

- [ ] **Step 1: Write the failing tests**

Create `app/server/src/triage/metrics.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_metrics");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, run } = await import("../db/index.js");
const { volumePerSourcePerWeek, interestedPerHundred } = await import("./metrics.js");
const { drawSample } = await import("./sample.js");
const { recordDecision } = await import("./decide.js");

let source: number;

beforeAll(async () => {
  await migrate(false);
  source = await insert(`INSERT INTO source (name) VALUES ('metrics source') RETURNING id`);
}, 120000);
afterAll(async () => {
  await close();
});

async function sol(title: string, postedAt: string | null): Promise<number> {
  return insert(
    `INSERT INTO solicitation (title, source_id, posted_at, closes_at)
     VALUES ($1, $2, $3, '2027-06-01') RETURNING id`,
    [title, source, postedAt],
  );
}

/* THE DEFINITION THAT MATTERS. sighting.seen_at is when WE saw a row, and
 * nothing ingests unless a human asks it to -- so a seen_at series measures
 * who was at the laptop, not what the market produced. This test makes the
 * two disagree on purpose: two solicitations posted in DIFFERENT weeks, both
 * sighted in the SAME week, which is exactly what a bulk backfill looks
 * like. A seen_at implementation collapses them into one bucket. */
test("volume is bucketed by when the buyer posted, not by when we scraped", async () => {
  const early = await sol("posted in June", "2026-06-03");
  const late = await sol("posted in August", "2026-08-19");
  for (const id of [early, late]) {
    await run(
      `INSERT INTO sighting (source_id, solicitation_id, seen_at)
       VALUES ($1, $2, '2026-08-28T00:00:00Z')`,
      [source, id],
    );
  }

  const report = await volumePerSourcePerWeek();
  const mine = report.weeks.filter((w) => w.source_id === source);
  expect(mine.length).toBeGreaterThanOrEqual(2);
});

test("rows with no posted_at are excluded, and the exclusion is reported", async () => {
  await sol("no posting date", null);
  const report = await volumePerSourcePerWeek();
  expect(report.excluded_no_posted_at).toBeGreaterThanOrEqual(1);
  expect(report.total_rows).toBeGreaterThan(report.excluded_no_posted_at);
});

test("Interested-per-hundred reports what it was measured over", async () => {
  const ids: number[] = [];
  for (let i = 0; i < 10; i++) ids.push(await sol(`rate ${i}`, "2026-08-01"));
  const sample = await drawSample({ sourceId: source, n: 10, seed: "rate-seed" });

  await recordDecision({ solicitationId: ids[0]!, state: "Interested" });
  await recordDecision({
    solicitationId: ids[1]!,
    state: "Not Interested",
    reason: "parts order",
  });

  const rates = await interestedPerHundred();
  const mine = rates.find((r) => r.sample_id === sample.id);
  expect(mine).toBeDefined();
  expect(mine!.population_size).toBeGreaterThanOrEqual(10);
  expect(mine!.decided).toBe(2);
  expect(mine!.interested).toBe(1);
  expect(mine!.interested_per_hundred).toBe(50);
});

/* A reversal counts ONCE, at its latest state. Counting rows rather than
 * solicitations would report 100 Interested out of 50 decisions. */
test("a reversed decision counts once, as what it became", async () => {
  const id = await sol("changed my mind", "2026-08-01");
  const sample = await drawSample({ sourceId: source, n: 200, seed: "reversal-seed" });

  await recordDecision({ solicitationId: id, state: "Interested" });
  await recordDecision({ solicitationId: id, state: "Not Interested", reason: "on reflection" });

  const mine = (await interestedPerHundred()).find((r) => r.sample_id === sample.id)!;
  expect(mine.interested).toBe(0);
  expect(mine.decided).toBe(1);
});

/* A rate over zero decisions is UNKNOWN, not zero. Reporting 0 would read
 * as "nothing here interests us" when it means "nobody has looked". */
test("a sample nobody has triaged reports no rate at all", async () => {
  const virgin = await insert(`INSERT INTO source (name) VALUES ('untouched source') RETURNING id`);
  await insert(
    `INSERT INTO solicitation (title, source_id, posted_at, closes_at)
     VALUES ('never triaged', $1, '2026-08-01', '2027-06-01') RETURNING id`,
    [virgin],
  );
  const sample = await drawSample({ sourceId: virgin, n: 5, seed: "virgin" });

  const mine = (await interestedPerHundred()).find((r) => r.sample_id === sample.id)!;
  expect(mine.decided).toBe(0);
  expect(mine.interested_per_hundred).toBeNull();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/server/src/triage/metrics.test.ts`
Expected: FAIL — cannot resolve `./metrics.js`.

- [ ] **Step 3: Implement**

Create `app/server/src/triage/metrics.ts`:

```ts
import { all, one } from "../db/index.js";
import { LATEST_PURSUIT } from "./latest.js";

export interface WeeklyVolume {
  source_id: number;
  source_name: string;
  /** ISO date of the Monday that starts the week. */
  week: string;
  solicitations: number;
}

export interface VolumeReport {
  weeks: WeeklyVolume[];
  /** Never silently dropped: a series with an unstated exclusion is the same
   *  class of error as a rate with the wrong denominator. */
  excluded_no_posted_at: number;
  total_rows: number;
}

/* VOLUME PER SOURCE PER WEEK, computed on posted_at and never on seen_at.
 *
 * sighting.seen_at is when WE saw a row. Nothing ingests unless a human asks
 * it to (known risk, 2026-08-15), so sightings cluster on the days somebody
 * ran a scrape. A weekly series built on seen_at measures OPERATOR
 * BEHAVIOUR, and would show a source surging or dying when all that changed
 * was who was at the laptop.
 *
 * posted_at is `text`. Rows whose value will not parse as a date are
 * excluded by the same predicate that excludes NULL, and counted with them:
 * an unparseable date is no more a measurement than a missing one. */
export async function volumePerSourcePerWeek(): Promise<VolumeReport> {
  const weeks = await all<WeeklyVolume>(
    `SELECT s.source_id,
            src.name AS source_name,
            to_char(date_trunc('week', s.posted_at::date), 'YYYY-MM-DD') AS week,
            count(*)::int AS solicitations
       FROM solicitation s
       JOIN source src ON src.id = s.source_id
      WHERE s.posted_at IS NOT NULL
        AND s.posted_at ~ '^\\d{4}-\\d{2}-\\d{2}'
      GROUP BY s.source_id, src.name, date_trunc('week', s.posted_at::date)
      ORDER BY src.name, week`,
  );

  const counts = await one<{ total: number; excluded: number }>(
    `SELECT count(*) AS total,
            count(*) FILTER (
              WHERE posted_at IS NULL OR posted_at !~ '^\\d{4}-\\d{2}-\\d{2}'
            ) AS excluded
       FROM solicitation`,
  );

  return {
    weeks,
    excluded_no_posted_at: Number(counts?.excluded ?? 0),
    total_rows: Number(counts?.total ?? 0),
  };
}

export interface InterestedRate {
  sample_id: number;
  source_id: number;
  source_name: string;
  population_size: number;
  drawn: number;
  decided: number;
  interested: number;
  /** NULL when nothing has been decided. A rate over zero is UNKNOWN, not zero. */
  interested_per_hundred: number | null;
}

/* INTERESTED-PER-HUNDRED, per source, against the materialised sample.
 *
 * Counts SOLICITATIONS at their LATEST state, not pursuit rows -- an
 * Interested later reversed to Pass counts once, as Pass, and the reversal
 * is still on the record.
 *
 * Three numbers ship together because any one alone misleads:
 * population_size says what the sample represents, `drawn` how big it is,
 * and `decided` how much of it has actually been read. A half-triaged
 * sample then reads as a half-triaged sample rather than as a rate. */
export async function interestedPerHundred(): Promise<InterestedRate[]> {
  return all<InterestedRate>(
    `WITH latest AS (${LATEST_PURSUIT}),
     decided AS (
       SELECT i.sample_id,
              count(*)::int AS decided,
              count(*) FILTER (WHERE l.state = 'Interested')::int AS interested
         FROM triage_sample_item i
         JOIN latest l ON l.solicitation_id = i.solicitation_id
        WHERE l.state <> 'New'
        GROUP BY i.sample_id
     )
     SELECT ts.id AS sample_id, ts.source_id, src.name AS source_name,
            ts.population_size,
            (SELECT count(*)::int FROM triage_sample_item i WHERE i.sample_id = ts.id) AS drawn,
            COALESCE(d.decided, 0) AS decided,
            COALESCE(d.interested, 0) AS interested,
            CASE WHEN COALESCE(d.decided, 0) = 0 THEN NULL
                 ELSE round(100.0 * d.interested / d.decided, 2)::float8
            END AS interested_per_hundred
       FROM triage_sample ts
       JOIN source src ON src.id = ts.source_id
       LEFT JOIN decided d ON d.sample_id = ts.id
      ORDER BY ts.drawn_at DESC`,
  );
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run app/server/src/triage/metrics.test.ts`
Expected: PASS, all five.

- [ ] **Step 5: Run the gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/triage/metrics.ts app/server/src/triage/metrics.test.ts
git commit -m "The gate's two numbers -- volume on posted_at, and a rate that says what it measured"
```

---

## Task 7: The triage routes

**Files:**
- Create: `app/server/src/routes/triage.ts`
- Modify: `app/server/src/index.ts` (mount the router)
- Test: `app/server/src/routes/triage.test.ts`

**Interfaces:**
- Consumes: `queuePage`, `drawSample`, `getSample`, `listSamples`, `recordDecision`, `ReasonRequiredError`, `volumePerSourcePerWeek`, `interestedPerHundred`
- Produces: `export const triage: Router`, mounted at `/api`

Endpoints: `GET /api/queue`, `POST /api/triage/samples` *(gated)*, `GET /api/triage/samples`, `POST /api/solicitations/:id/decision` *(gated)*, `GET /api/triage/metrics`.

- [ ] **Step 1: Write the failing tests**

Create `app/server/src/routes/triage.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_triage_routes");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, close, insert } = await import("../db/index.js");
const { app } = await import("../index.js");

const ADMIN_SECRET = "test-shared-secret-do-not-use-in-prod";
let source: number;
let solicitation: number;

beforeAll(async () => {
  await migrate(false);
  source = await insert(`INSERT INTO source (name) VALUES ('route source') RETURNING id`);
  solicitation = await insert(
    `INSERT INTO solicitation (title, source_id, posted_at, closes_at)
     VALUES ('route fixture', $1, '2026-08-01', '2027-06-01') RETURNING id`,
    [source],
  );
}, 120000);
beforeEach(() => {
  process.env.ADMIN_SECRET = ADMIN_SECRET;
});
afterAll(async () => {
  await close();
});

async function call(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  headers: Record<string, string> = { "X-Admin-Secret": ADMIN_SECRET },
) {
  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } finally {
    server.close();
  }
}

test("the queue is readable without a secret -- reads are not gated", async () => {
  const res = await call("GET", "/api/queue", undefined, {});
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  expect(body.mode).toBe("all");
  expect(Array.isArray(body.items)).toBe(true);
});

test("drawing a sample without the secret is refused", async () => {
  const res = await call("POST", "/api/triage/samples", { source_id: source, n: 5 }, {});
  expect(res.status).toBe(401);
});

test("drawing a sample with the secret records its denominator", async () => {
  const res = await call("POST", "/api/triage/samples", {
    source_id: source,
    n: 5,
    seed: "route-seed",
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as any;
  expect(body.population_size).toBeGreaterThanOrEqual(1);
  expect(body.seed).toBe("route-seed");
});

test("a sample for an unknown source is a 404, not an empty success", async () => {
  const res = await call("POST", "/api/triage/samples", { source_id: 999999, n: 5 });
  expect(res.status).toBe(404);
});

test("deciding without the secret is refused", async () => {
  const res = await call(
    "POST",
    `/api/solicitations/${solicitation}/decision`,
    { state: "Interested" },
    {},
  );
  expect(res.status).toBe(401);
});

test("a decision appends and returns the new latest state", async () => {
  const res = await call("POST", `/api/solicitations/${solicitation}/decision`, {
    state: "Interested",
    decided_by: "matt",
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as any;
  expect(body.state).toBe("Interested");

  const rows = await all(`SELECT id FROM pursuit WHERE solicitation_id = $1`, [solicitation]);
  expect(rows.length).toBeGreaterThanOrEqual(1);
});

/* A missing reason is the caller's to fix, not a fault -- 400, never 500. */
test("Pass with no reason answers 400 and names the field", async () => {
  const res = await call("POST", `/api/solicitations/${solicitation}/decision`, {
    state: "Not Interested",
  });
  expect(res.status).toBe(400);
  const body = (await res.json()) as any;
  expect(body.field).toBe("reason");
});

test("a decision on an unknown solicitation is a 404", async () => {
  const res = await call("POST", "/api/solicitations/999999/decision", { state: "Interested" });
  expect(res.status).toBe(404);
});

test("metrics report both numbers and the exclusion", async () => {
  const res = await call("GET", "/api/triage/metrics", undefined, {});
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  expect(body.volume).toHaveProperty("excluded_no_posted_at");
  expect(Array.isArray(body.interested)).toBe(true);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/server/src/routes/triage.test.ts`
Expected: FAIL — 404 on every path; the router does not exist.

- [ ] **Step 3: Implement the router**

Create `app/server/src/routes/triage.ts`:

```ts
import { Router } from "express";
import { one } from "../db/index.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAdminSecret } from "../lib/adminSecret.js";
import { queuePage } from "../triage/queue.js";
import { drawSample, listSamples } from "../triage/sample.js";
import { recordDecision, ReasonRequiredError } from "../triage/decide.js";
import { interestedPerHundred, volumePerSourcePerWeek } from "../triage/metrics.js";

/* SP6. Reads open, writes gated -- the rule routes/index.ts already
 * follows. Reads stay open so the screens load without turning a shared
 * bearer secret into a login, which design spec §7 says it is not.
 *
 * The writes are gated for a concrete reason rather than a ceremonial one:
 * production is public BY DECISION (§5), and a stranger clicking Pass would
 * corrupt the gate's own measurement. */
export const triage = Router();

const clampInt = (raw: unknown, fallback: number, min: number, max: number): number => {
  const n = Number(raw);
  /* Number("") is 0 and Number(undefined) is NaN, so `Number(x) || fallback`
   * would accept a NEGATIVE -- SP4's Task 11 shipped exactly that bug, where
   * -5 is truthy and Math.min does not catch it. Validate, then clamp. */
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(Math.trunc(n), max));
};

triage.get(
  "/queue",
  asyncHandler(async (req, res) => {
    const sampleId = req.query.sample ? clampInt(req.query.sample, 0, 1, 2 ** 31 - 1) : undefined;
    res.json(
      await queuePage({
        limit: clampInt(req.query.limit, 25, 1, 200),
        offset: clampInt(req.query.offset, 0, 0, 2 ** 31 - 1),
        sampleId,
      }),
    );
  }),
);

triage.get(
  "/triage/samples",
  asyncHandler(async (_req, res) => {
    res.json({ samples: await listSamples() });
  }),
);

triage.post(
  "/triage/samples",
  requireAdminSecret,
  asyncHandler(async (req, res) => {
    const { source_id, n, seed, note } = req.body ?? {};
    const sourceId = Number(source_id);
    if (!Number.isInteger(sourceId)) {
      return res.status(400).json({ error: "source_id must be an integer.", field: "source_id" });
    }
    const src = await one(`SELECT id FROM source WHERE id = $1`, [sourceId]);
    if (!src) return res.status(404).json({ error: `No source ${sourceId}.` });

    const sample = await drawSample({
      sourceId,
      n: clampInt(n, 100, 1, 1000),
      seed: typeof seed === "string" && seed.trim() ? seed.trim() : undefined,
      note: typeof note === "string" ? note : undefined,
    });
    res.status(201).json(sample);
  }),
);

triage.post(
  "/solicitations/:id/decision",
  requireAdminSecret,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const exists = await one(`SELECT id FROM solicitation WHERE id = $1`, [id]);
    if (!exists) return res.status(404).json({ error: `No solicitation ${id}.` });

    const { state, reason, decided_by, require_reason_on_pass } = req.body ?? {};
    try {
      const latest = await recordDecision({
        solicitationId: id,
        state,
        reason,
        decidedBy: typeof decided_by === "string" ? decided_by : null,
        requireReasonOnPass: require_reason_on_pass !== false,
      });
      return res.status(201).json(latest);
    } catch (err) {
      if (err instanceof ReasonRequiredError) {
        return res.status(400).json({ error: err.message, field: "reason" });
      }
      throw err;
    }
  }),
);

triage.get(
  "/triage/metrics",
  asyncHandler(async (_req, res) => {
    res.json({
      volume: await volumePerSourcePerWeek(),
      interested: await interestedPerHundred(),
    });
  }),
);
```

- [ ] **Step 4: Mount it**

In `app/server/src/index.ts`, add the import beside the existing route imports:

```ts
import { triage } from "./routes/triage.js";
```

and mount it immediately after the existing `app.use("/api", api);` line:

```ts
app.use("/api", triage);
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run app/server/src/routes/triage.test.ts`
Expected: PASS, all nine.

- [ ] **Step 6: Run the gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/server/src/routes/triage.ts app/server/src/routes/triage.test.ts app/server/src/index.ts
git commit -m "Triage endpoints: queue, samples, decisions, metrics -- reads open, writes gated"
```

---

## Task 8: The record endpoint, and bounding `GET /solicitations`

**Files:**
- Modify: `app/server/src/routes/index.ts`
- Test: `app/server/src/routes/routes.test.ts` (append)

**Interfaces:**
- Consumes: `resolveField` from `../extract/precedence.js`, `latestPursuitFor` from `../triage/latest.js`
- Produces: `GET /api/solicitations/:id` now additionally returns `fields: ResolvedField[]`, `timeline: TimelineEvent[]`, `decision: LatestPursuit | null`
  - `interface ResolvedField { field_name: string; value: string | null; origin: "listing" | "document" | null; confidence: number | null; quote: string | null; note: string | null; state: "found" | "absent" | "not_looked_for"; conflicts: { value_text: string; origin: string; quote: string | null; confidence: number | null }[] }`
  - `interface TimelineEvent { kind: "sighting" | "resolution"; at: string; source_name: string | null; detail: string }`

- [ ] **Step 1: Write the failing tests**

Append to `app/server/src/routes/routes.test.ts`:

```ts
test("a record carries its fields, each with value, confidence and quote", async () => {
  const sol = await insert(
    `INSERT INTO solicitation (title, source_id, closes_at)
     VALUES ('cited record', 1, '2026-09-17') RETURNING id`,
  );
  await run(
    `INSERT INTO extracted_field
       (solicitation_id, field_name, value_text, origin, quote, confidence, produced_by)
     VALUES ($1, 'closes_at', '2026-09-17', 'listing', NULL, 1.0, 'mechanical')`,
    [sol],
  );

  const [, body] = await get(`/solicitations/${sol}`);
  const closes = body.fields.find((f: any) => f.field_name === "closes_at");
  expect(closes.value).toBe("2026-09-17");
  expect(closes.confidence).toBe(1);
  expect(closes.state).toBe("found");
});

/* THE FSSA NEAR-MISS, made visible. The listing wins, and the losing value
 * is still there with its quote -- a rejection you cannot inspect is a bug
 * you will never find. */
test("a disagreement is shown beneath the winner, not resolved away", async () => {
  const sol = await insert(
    `INSERT INTO solicitation (title, source_id, closes_at)
     VALUES ('conflicted record', 1, '2026-09-17') RETURNING id`,
  );
  await run(
    `INSERT INTO extracted_field
       (solicitation_id, field_name, value_text, origin, confidence, produced_by)
     VALUES ($1, 'closes_at', '2026-09-17', 'listing', 1.0, 'mechanical')`,
    [sol],
  );
  await run(
    `INSERT INTO extracted_field
       (solicitation_id, field_name, value_text, origin, quote, confidence, produced_by)
     VALUES ($1, 'closes_at', '2026-08-26', 'document',
             'proposals due August 26, 2026', 0.72, 'mechanical')`,
    [sol],
  );

  const [, body] = await get(`/solicitations/${sol}`);
  const closes = body.fields.find((f: any) => f.field_name === "closes_at");

  expect(closes.value).toBe("2026-09-17");
  expect(closes.conflicts).toHaveLength(1);
  expect(closes.conflicts[0].value_text).toBe("2026-08-26");
  expect(closes.conflicts[0].quote).toContain("August 26");
});

/* Three states, not two. "We looked and it is not there" is a different
 * fact from "we never looked", and collapsing them is how a missing ceiling
 * quietly becomes a guessed one. */
test("absent and never-looked-for are different states", async () => {
  const sol = await insert(
    `INSERT INTO solicitation (title, source_id) VALUES ('sparse record', 1) RETURNING id`,
  );
  await run(
    `INSERT INTO extracted_field
       (solicitation_id, field_name, value_text, origin, produced_by)
     VALUES ($1, 'value_cents', NULL, 'document', 'mechanical')`,
    [sol],
  );

  const [, body] = await get(`/solicitations/${sol}`);
  const looked = body.fields.find((f: any) => f.field_name === "value_cents");
  const never = body.fields.find((f: any) => f.field_name === "set_aside");

  expect(looked.state).toBe("absent");
  expect(never.state).toBe("not_looked_for");
});

test("a record carries its sightings in order as a timeline", async () => {
  const sol = await insert(
    `INSERT INTO solicitation (title, source_id) VALUES ('timeline record', 1) RETURNING id`,
  );
  await run(
    `INSERT INTO sighting (source_id, solicitation_id, seen_at)
     VALUES (1, $1, '2026-08-20T00:00:00Z')`,
    [sol],
  );
  await run(
    `INSERT INTO sighting (source_id, solicitation_id, seen_at)
     VALUES (1, $1, '2026-08-10T00:00:00Z')`,
    [sol],
  );

  const [, body] = await get(`/solicitations/${sol}`);
  const sightings = body.timeline.filter((e: any) => e.kind === "sighting");
  expect(sightings).toHaveLength(2);
  expect(new Date(sightings[0].at).getTime()).toBeLessThan(
    new Date(sightings[1].at).getTime(),
  );
});

test("the solicitation list is bounded", async () => {
  const [, body] = await get("/solicitations?limit=2");
  expect(body.solicitations.length).toBeLessThanOrEqual(2);
});

/* SP4's Task 11 shipped `Number(x) || 10`, where -5 is truthy and Math.min
 * does not catch it. The test that let it through asserted only a 200 --
 * equally true with the clamp deleted. This one asserts the VALUE. */
test("a negative limit does not become a negative LIMIT", async () => {
  const [status, body] = await get("/solicitations?limit=-5");
  expect(status).toBe(200);
  expect(body.solicitations.length).toBeGreaterThanOrEqual(1);
});
```

> **Controller correction, 2026-08-30 — this brief originally told you to ADD a `get` helper. Do not.** `routes.test.ts` already has one, and a second declaration is a TypeScript redeclaration error. Match the file as it actually is:
>
> - **`get` already exists** and returns a TUPLE, not a `Response`: `const get = (p: string): Promise<Res> => fetch(base + p).then(async r => [r.status, await r.json()] as Res)`. The tests above are written against that shape — `const [, body] = await get(...)`. Its comment explains why the body is typed rather than left `unknown`: an untyped body fails typecheck while vitest passes, "exactly the split that let a red gate through once already."
> - **`base` already ends in `/api`**, so paths are `/solicitations/5`, never `/api/solicitations/5`.
> - **The server is started once in `beforeAll` and closed in `afterAll`** — do not spin one up per call.
> - **`insert` and `run` are NOT imported in this file yet.** The dynamic import currently reads `const { close } = await import("../db/index.js");` — extend it to `const { close, insert, run } = await import("../db/index.js");`. The fixtures above need both.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/server/src/routes/routes.test.ts`
Expected: FAIL — `body.fields` is undefined.

- [ ] **Step 3: Extend the record endpoint**

In `app/server/src/routes/index.ts`, add to the imports:

```ts
import { resolveField, type FieldRow } from "../extract/precedence.js";
import { latestPursuitFor } from "../triage/latest.js";
```

Replace the `GET /solicitations` handler's `order` line and query with a bounded version:

```ts
api.get(
  "/solicitations",
  asyncHandler(async (req, res) => {
    const order = req.query.order === "newest" ? "posted_at DESC" : "closes_at ASC";
    /* BOUNDED. This returned every row -- 9,883 on a deliberately-public
     * production. Validate before clamping: `Number(x) || 200` accepts a
     * negative, because -5 is truthy and Math.min does not catch it. */
    const asInt = (raw: unknown, fallback: number, min: number, max: number) => {
      const n = Number(raw);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(Math.trunc(n), max));
    };
    const limit = asInt(req.query.limit, 200, 1, 1000);
    const offset = asInt(req.query.offset, 0, 0, 2 ** 31 - 1);

    const rows = await all(
      `SELECT s.*, o.name AS org_name, o.jurisdiction,
              (SELECT count(*) FROM sighting g WHERE g.solicitation_id = s.id) AS sightings,
              (SELECT count(*) FROM document d WHERE d.solicitation_id = s.id) AS documents
         FROM solicitation s
    LEFT JOIN organization o ON o.id = s.org_id
     ORDER BY ${order}
        LIMIT ${limit} OFFSET ${offset}`,
    );
    res.json({ count: rows.length, order, limit, offset, solicitations: rows });
  }),
);
```

Then extend the `GET /solicitations/:id` handler. Replace its `res.json({...})` call with:

```ts
    const documents = await all("SELECT * FROM document WHERE solicitation_id = $1", [id]);
    const sightings = await all<{ id: number; seen_at: string; source_name: string }>(
      `SELECT g.*, src.name AS source_name
         FROM sighting g JOIN source src ON src.id = g.source_id
        WHERE g.solicitation_id = $1 ORDER BY g.seen_at`,
      [id],
    );

    /* SIX FIELDS, ALWAYS. A field with no row at all is "never looked for",
     * which is a different fact from a row with a NULL value ("looked and it
     * is not there"). Rendering only the rows that exist would collapse the
     * two, which SVRC View 2.3 forbids in as many words. */
    const FIELDS = [
      "closes_at", "qa_closes_at", "prebid_at", "prebid_required", "set_aside", "value_cents",
    ] as const;

    const raw = await all<
      FieldRow & { field_name: string; confidence: number | null; note: string | null }
    >(
      `SELECT field_name, value_text, origin, quote, document_id, confidence, note
         FROM extracted_field WHERE solicitation_id = $1`,
      [id],
    );

    const fields = FIELDS.map((name) => {
      const rows = raw.filter((r) => r.field_name === name);
      if (rows.length === 0) {
        return {
          field_name: name, value: null, origin: null, confidence: null,
          quote: null, note: null, state: "not_looked_for" as const, conflicts: [],
        };
      }
      const resolved = resolveField(rows);
      const winner = rows.find(
        (r) => r.value_text === resolved.value && r.origin === resolved.origin,
      );
      return {
        field_name: name,
        value: resolved.value,
        origin: resolved.origin,
        confidence: winner?.confidence ?? null,
        quote: winner?.quote ?? null,
        note: winner?.note ?? null,
        state: resolved.value === null ? ("absent" as const) : ("found" as const),
        conflicts: resolved.conflicts.map((c) => ({
          value_text: c.value_text as string,
          origin: c.origin,
          quote: c.quote,
          confidence: (c as { confidence?: number | null }).confidence ?? null,
        })),
      };
    });

    /* The timeline records what the DOCUMENTS did and what the SYSTEM
     * decided. Entity resolution is the least visible thing this system
     * does and the easiest to get silently wrong (SVRC View 2.5); this is
     * the only place a person watches it happen. */
    const timeline = [
      ...sightings.map((g) => ({
        kind: "sighting" as const,
        at: g.seen_at,
        source_name: g.source_name,
        detail: `Seen in ${g.source_name}`,
      })),
      ...(row.org_name
        ? [{
            kind: "resolution" as const,
            at: row.created_at as string,
            source_name: null,
            detail: `Buyer resolved to ${row.org_name}`,
          }]
        : []),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const [decision] = await latestPursuitFor([id]);

    res.json({ ...row, sightings, documents, fields, timeline, decision: decision ?? null });
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run app/server/src/routes/routes.test.ts`
Expected: PASS, all six new plus the existing ones.

- [ ] **Step 5: Run the gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/routes/index.ts app/server/src/routes/routes.test.ts
git commit -m "The record endpoint: six fields with citations, conflicts kept, and a bounded list"
```

---

## Task 9: The shell, and the route move

**Files:**
- Create: `app/client/src/shell/Shell.tsx`, `app/client/src/shell/Shell.css`
- Create: `app/client/src/shell/Shell.test.tsx`
- Modify: `app/client/src/router.tsx`

**Interfaces:**
- Consumes: `HeaderLockup`, `StatusBar` from `../primitives/index.js`
- Produces: `Shell({ queueCount, reduced, children }: { queueCount?: number; reduced?: boolean; children: ReactNode })`

**Routes after this task:** `/` → Queue (Task 10), `/solicitation/:id` → Record (Task 12), `/admin` unchanged, `/health` → the existing `Health` page, `/dev/gallery` unchanged.

Until Task 11 lands, point `/` at a placeholder that renders `<Shell>` with no children — the route move and the shell are one reviewable unit, and the queue follows in Task 11.

- [ ] **Step 1: Write the failing test**

Create `app/client/src/shell/Shell.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { Shell } from "./Shell";

/* CONTROLLER RULING (pre-flight, 2026-08-30): every Shell render is wrapped.
 * Shell's nav renders <Link to="/">, and <Link> outside a Router THROWS --
 * so four of the five tests below would have failed for a reason that has
 * nothing to do with what they assert. */
const render = (ui: ReactNode) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const SOURCES = [
  { id: 1, name: "SAM.gov", health: "ok", enabled: true, last_run_at: "2026-08-28T04:03:59Z" },
  { id: 2, name: "Illinois", health: "failing", enabled: true, last_run_at: null },
  { id: 3, name: "Michigan", health: "rot", enabled: true, last_run_at: null },
  { id: 4, name: "GovWin IQ", health: "excluded", enabled: false, last_run_at: null },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubSources() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(SOURCES), { status: 200 })),
  );
}

test("the status bar counts only sources that are actually ingested", async () => {
  stubSources();
  render(<Shell queueCount={12}>content</Shell>);
  /* GovWin is `excluded` -- it is not a source that could be failing, so
   * counting it would report a permanent fault that is a legal posture. */
  await waitFor(() => expect(screen.getByText(/3 sources/i)).toBeTruthy());
});

test("failing and rot are reported separately, because they mean different things", async () => {
  stubSources();
  render(<Shell queueCount={0}>content</Shell>);
  await waitFor(() => expect(screen.getByText(/1 failing/i)).toBeTruthy());
  expect(screen.getByText(/1 rot/i)).toBeTruthy();
});

test("the queue counter shows what is left to decide", async () => {
  stubSources();
  render(<Shell queueCount={12}>content</Shell>);
  await waitFor(() => expect(screen.getByLabelText(/queue count/i).textContent).toContain("12"));
});

/* SVRC Screen 1: the queue wants full width and no competing affordances. */
test("the reduced shell collapses primary nav", async () => {
  stubSources();
  const { container } = render(
    <Shell queueCount={1} reduced>
      content
    </Shell>,
  );
  await waitFor(() => expect(container.querySelector(".shell--reduced")).toBeTruthy());
  expect(screen.queryByRole("navigation")).toBeNull();
});

/* A status bar that renders zeros while the fetch is in flight is a status
 * bar that says "all clear" before it knows anything. */
test("counts are absent, not zero, before the sources load", () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(<Shell queueCount={0}>content</Shell>);
  expect(screen.queryByText(/0 failing/i)).toBeNull();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run app/client/src/shell/Shell.test.tsx`
Expected: FAIL — cannot resolve `./Shell`.

- [ ] **Step 3: Implement the shell**

Create `app/client/src/shell/Shell.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { HeaderLockup, StatusBar } from "../primitives";
import "./Shell.css";

interface SourceRow {
  id: number;
  name: string;
  health: string;
  enabled: boolean;
  last_run_at: string | null;
}

/* Region A.2 exists so a GO/NO-GO is not measured during an outage nobody
 * noticed: known risks record five silent-failure instances across three
 * source platforms, and a gate measured while a source was quietly dead is a
 * measurement of the outage, not of the market.
 *
 * `excluded` is NOT counted. It is a LEGAL POSTURE, not a fault -- counting
 * it would report a permanent failure for a source we have decided never to
 * ingest. */
function summarise(sources: SourceRow[]) {
  const live = sources.filter((s) => s.health !== "excluded");
  const stamps = sources
    .map((s) => s.last_run_at)
    .filter((v): v is string => Boolean(v))
    .sort();
  return {
    sources: live.length,
    failing: live.filter((s) => s.health === "failing").length,
    rotSuspected: live.filter((s) => s.health === "rot").length,
    lastRun: stamps.length ? stamps[stamps.length - 1]! : "never",
  };
}

export function Shell({
  queueCount,
  reduced = false,
  children,
}: {
  queueCount?: number;
  reduced?: boolean;
  children: ReactNode;
}) {
  const [sources, setSources] = useState<SourceRow[] | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/sources")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => live && setSources(rows as SourceRow[]))
      .catch(() => live && setSources([]));
    return () => {
      live = false;
    };
  }, []);

  const summary = sources ? summarise(sources) : null;

  return (
    <div className={`shell${reduced ? " shell--reduced" : ""}`}>
      <header className="shell__header">
        <HeaderLockup />
        {!reduced && (
          <nav role="navigation" className="shell__nav">
            <Link to="/">Queue</Link>
            <Link to="/admin">Admin</Link>
          </nav>
        )}
        {queueCount !== undefined && (
          <span className="shell__count" aria-label="Queue count">
            {queueCount}
          </span>
        )}
      </header>

      <main className="shell__main">{children}</main>

      {/* Absent, not zero, until the sources are known: a status bar that
        * renders zeros while the request is in flight says "all clear"
        * before it knows anything. */}
      {summary && (
        <StatusBar
          sources={summary.sources}
          failing={summary.failing}
          rotSuspected={summary.rotSuspected}
          lastRun={summary.lastRun}
        />
      )}
    </div>
  );
}
```

Create `app/client/src/shell/Shell.css`:

```css
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--ground);
}
.shell__header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--brdsoft);
}
.shell__nav {
  display: flex;
  gap: var(--space-3);
}
.shell__count {
  margin-left: auto;
  font: var(--type-ui-action);
}
.shell__main {
  flex: 1;
  min-height: 0;
}
.shell--reduced .shell__header {
  gap: var(--space-2);
}
```

> If any token above is not defined in `tokens.css`, use the nearest one that is — `npm run tokens` fails the gate on an invented token. Check `app/client/src/tokens/` before guessing.

- [ ] **Step 4: Move the routes**

In `app/client/src/router.tsx`, replace the two product `<Route>` elements with:

```tsx
      {/* The queue is the daily driver and takes the root. The Health page
        * moves to /health; `GET /api/health` -- the endpoint production
        * verification actually calls -- is untouched by this. */}
      <Route path="/" element={<Queue />} />
      <Route path="/solicitation/:id" element={<Record />} />
      <Route path="/health" element={<Health />} />
      <Route path="/admin" element={<Admin />} />
```

and add the imports. Until Tasks 11 and 13 land, define the two placeholders at the top of the file:

```tsx
import { Shell } from "./shell/Shell";
const Queue = () => <Shell queueCount={0}>Queue lands in Task 11.</Shell>;
const Record = () => <Shell>Record lands in Task 13.</Shell>;
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run app/client/src/shell/Shell.test.tsx`
Expected: PASS, all five.

- [ ] **Step 6: Run the gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/client/src/shell app/client/src/router.tsx
git commit -m "The shell: Region A.1 and A.2 at last, and the queue takes the root"
```

---

## Task 10: `Button` learns to be pressed

**Files:**
- Modify: `app/client/src/primitives/Button.tsx`
- Test: `app/client/src/primitives/Button.test.tsx` (append)

**Interfaces:**
- Produces: `Button` additionally accepts `onClick?: () => void` and `ariaLabel?: string`, and renders `type="button"`

**Why this is its own task.** SP2 built every primitive **inert on purpose** — the gallery proved they looked right, and nothing was wired. `Button` therefore has `variant`, `size`, `keycap`, `disabled` and `children`, and **no handler at all**: the `<button>` it renders cannot be pressed. SP6 is the first slice to compose a real screen, which is precisely the trigger STATUS named for the `Button` work (*"first moves INSIDE SP6"*). This is a change to a signed-off design-system primitive, so it is reviewable on its own rather than buried inside a screen.

**Scope discipline:** add the handler and nothing else. **Do not add the danger-primary variant** — it is `confirmReason`'s pass branch, it still has no consumer, and building a variant ahead of need is what the 3× recurrence bar exists to prevent.

- [ ] **Step 1: Write the failing tests**

Append to `app/client/src/primitives/Button.test.tsx`:

```tsx
test("a button can be pressed", () => {
  const onClick = vi.fn();
  render(
    <Button variant="primary" onClick={onClick}>
      Interested
    </Button>,
  );
  screen.getByRole("button", { name: "Interested" }).click();
  expect(onClick).toHaveBeenCalledOnce();
});

test("a disabled button does not fire", () => {
  const onClick = vi.fn();
  render(
    <Button variant="primary" onClick={onClick} disabled>
      Interested
    </Button>,
  );
  screen.getByRole("button", { name: "Interested" }).click();
  expect(onClick).not.toHaveBeenCalled();
});

/* The keycap is INSIDE the button, so its letter joins the accessible name
 * -- "Interested I" rather than "Interested". An explicit label keeps a
 * control targetable by automation, which is how SP3.6's buttons were
 * finally proved to work. */
test("an explicit label survives a keycap", () => {
  render(
    <Button variant="primary" keycap="I" ariaLabel="Interested">
      Interested
    </Button>,
  );
  expect(screen.getByRole("button", { name: "Interested" })).toBeTruthy();
});

/* Default type is "submit". Inside a form, an un-typed decision button
 * submits the form and reloads the page instead of deciding. */
test("it is type=button, not an accidental submit", () => {
  render(<Button variant="primary">Interested</Button>);
  expect(screen.getByRole("button").getAttribute("type")).toBe("button");
});
```

If `vi` or `screen` is not already imported in that file, add them to the existing `vitest` and `@testing-library/react` imports.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/client/src/primitives/Button.test.tsx`
Expected: FAIL — `onClick` is not a valid prop; the type test reports `null`.

- [ ] **Step 3: Implement**

In `app/client/src/primitives/Button.tsx`, extend the signature and the element:

```tsx
export function Button({
  variant,
  size = "default",
  keycap,
  disabled,
  onClick,
  ariaLabel,
  children,
}: {
  variant: ButtonVariant;
  size?: ButtonSize;
  keycap?: string;
  disabled?: boolean;
  /* ADDED AT SP6. SP2 built this primitive inert on purpose -- the gallery
   * proved it looked right and nothing was wired. This slice is the first
   * to compose a real screen, which is the trigger STATUS named. */
  onClick?: () => void;
  /* The keycap renders inside the button, so its letter joins the
   * accessible name. An explicit label keeps the control targetable. */
  ariaLabel?: string;
  children: ReactNode;
}) {
  const sizeClass = size === "sm" ? " btn--sm" : "";
  return (
    <button
      /* Default is "submit": inside a form, an un-typed decision button
       * submits and reloads instead of deciding. */
      type="button"
      className={`btn btn--${variant}${sizeClass}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
      {keycap && <Keycap>{keycap}</Keycap>}
    </button>
  );
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run app/client/src/primitives/Button.test.tsx`
Expected: PASS — the four new tests plus every existing one.

- [ ] **Step 5: Run the gate**

Run: `npm run check`
Expected: exit 0. `/dev/gallery` still renders every primitive; nothing about the gallery changes.

- [ ] **Step 6: Commit**

```bash
git add app/client/src/primitives/Button.tsx app/client/src/primitives/Button.test.tsx
git commit -m "Button learns to be pressed -- the first move inside SP6, and only that move"
```

---

## Task 11: The queue screen

**Files:**
- Create: `app/client/src/triage/Queue.tsx`, `app/client/src/triage/Queue.css`
- Create: `app/client/src/triage/Queue.test.tsx`
- Modify: `app/client/src/router.tsx` (drop the placeholder)

**Interfaces:**
- Consumes: `GET /api/queue`, `POST /api/solicitations/:id/decision`, `Shell`, and the primitives `Card`, `FactPanel`, `FactTile`, `Chip`, `Button`, `Callout`, `MicroLabel`, `ShortcutCard`
- Produces: `Queue()`

- [ ] **Step 1: Write the failing tests**

Create `app/client/src/triage/Queue.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Queue } from "./Queue";

const ITEM = {
  id: 7,
  title: "Care-management workflow redesign",
  org_name: "Indiana FSSA",
  jurisdiction: "IN",
  closes_at: "2026-09-17",
  value_cents: 45000000,
  kind: "RFP",
  set_aside: null,
  source_name: "SAM.gov",
  documents: 3,
  sightings: 2,
  deadline_conflict: [],
};

function page(over: Record<string, unknown> = {}) {
  return { mode: "all", sample: null, total: 1, remaining: 1, items: [ITEM], ...over };
}

function stub(body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const renderQueue = () =>
  render(
    <MemoryRouter>
      <Queue />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

test("the card shows the four facts that decide most items", async () => {
  stub(page());
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());
  expect(screen.getByText(/Indiana FSSA/)).toBeTruthy();
  expect(screen.getByText(/2026-09-17/)).toBeTruthy();
  expect(screen.getByText(/450,000/)).toBeTruthy();
});

/* Region 1.1.1. This display currently carries the FSSA near-miss risk
 * ALONE, because the Gated Items Drawer is parked. */
test("a deadline disagreement is shown, not resolved away", async () => {
  stub(
    page({
      items: [
        {
          ...ITEM,
          deadline_conflict: [
            { value_text: "2026-08-26", origin: "document", quote: "proposals due August 26" },
          ],
        },
      ],
    }),
  );
  renderQueue();
  await waitFor(() => expect(screen.getByText(/2026-08-26/)).toBeTruthy());
  expect(screen.getByText(/proposals due August 26/)).toBeTruthy();
});

/* D12. The strip is built and lives on /dev/gallery; it does not render
 * here. A panel captioned "MACHINE SCORES" showing four dashes reads as
 * "the machine scored this and found nothing". */
test("no score strip appears on the card", async () => {
  stub(page());
  const { container } = renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());
  expect(container.querySelector(".score-strip")).toBeNull();
  expect(screen.queryByText(/machine scores/i)).toBeNull();
});

/* D14. None of the panel's four facts are extracted. It says so rather than
 * being quietly dropped -- if the session repeatedly wants a fact this
 * panel cannot give, that is a finding the gate should produce. */
test("the pursuit-cost panel renders, empty and labelled", async () => {
  stub(page());
  renderQueue();
  await waitFor(() => expect(screen.getByText(/pursuit cost/i)).toBeTruthy());
  expect(screen.getByText(/not yet extracted/i)).toBeTruthy();
});

test("sample mode announces itself and its denominator", async () => {
  stub(
    page({
      mode: "sample",
      sample: {
        id: 3,
        source_name: "SAM.gov",
        seed: "alpha",
        population_size: 4812,
        drawn: 100,
        decided: 12,
        n_requested: 100,
      },
    }),
  );
  renderQueue();
  await waitFor(() => expect(screen.getByText(/sample/i)).toBeTruthy());
  expect(screen.getByText(/4,812/)).toBeTruthy();
  expect(screen.getByText(/SAM\.gov/)).toBeTruthy();
});

test("Pass is blocked until a reason is given", async () => {
  const fetchMock = stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());

  screen.getByRole("button", { name: /^pass$/i }).click();
  await waitFor(() => expect(screen.getByText(/reason is required/i)).toBeTruthy());

  const posts = fetchMock.mock.calls.filter((c) => (c[1] as any)?.method === "POST");
  expect(posts).toHaveLength(0);
});

test("an empty queue offers somewhere to go", async () => {
  stub(page({ total: 0, remaining: 0, items: [] }));
  renderQueue();
  await waitFor(() => expect(screen.getByText(/queue cleared/i)).toBeTruthy());
  expect(screen.getByText(/draw another sample/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/client/src/triage/Queue.test.tsx`
Expected: FAIL — cannot resolve `./Queue`.

- [ ] **Step 3: Implement**

Create `app/client/src/triage/Queue.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell } from "../shell/Shell";
import {
  Button, Callout, Card, Chip, FactPanel, MicroLabel, ShortcutCard,
} from "../primitives";
import { adminHeaders, getAdminSecret } from "../admin/adminSecret";
import "./Queue.css";

interface DeadlineConflict {
  value_text: string;
  origin: string;
  quote: string | null;
}
interface QueueItem {
  id: number;
  title: string;
  org_name: string | null;
  jurisdiction: string | null;
  closes_at: string | null;
  value_cents: number | null;
  kind: string | null;
  set_aside: string | null;
  source_name: string | null;
  documents: number;
  sightings: number;
  deadline_conflict: DeadlineConflict[];
}
interface SampleHeader {
  id: number;
  source_name: string;
  seed: string;
  population_size: number;
  drawn: number;
  decided: number;
  n_requested: number;
}
interface QueuePage {
  mode: "all" | "sample";
  sample: SampleHeader | null;
  total: number;
  remaining: number;
  items: QueueItem[];
}

/* value_cents is a bigint, and db/index.ts:20 parses OID 20 to Number
 * centrally -- so this arrives as a NUMBER over JSON, not a string.
 *
 * ⚠️ This function previously called .slice() on it, which throws on a
 * number. It passed its test only because the fixture quoted the value.
 * That is a green test over a browser crash -- keep the fixture a number. */
function money(cents: number | null): string {
  if (cents === null || cents === undefined) return "—";
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export function Queue() {
  const [page, setPage] = useState<QueuePage | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const sampleId = new URLSearchParams(window.location.search).get("sample");

  const load = useCallback(async () => {
    const qs = sampleId ? `?sample=${encodeURIComponent(sampleId)}` : "";
    const res = await fetch(`/api/queue${qs}`);
    if (res.ok) setPage((await res.json()) as QueuePage);
  }, [sampleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = page?.items[0] ?? null;

  const decide = useCallback(
    async (state: "Interested" | "Not Interested" | "New", forId?: number) => {
      const id = forId ?? current?.id;
      if (!id) return;
      /* Mandatory on Pass -- blocked HERE as well as on the server, so a
       * mis-tap never becomes a request. */
      if (state === "Not Interested" && !reason.trim()) {
        setError("A reason is required on Pass.");
        return;
      }
      const secret = getAdminSecret();
      if (!secret) return;
      const res = await fetch(`/api/solicitations/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders(secret) },
        body: JSON.stringify({ state, reason: reason.trim() || null }),
      });
      if (!res.ok) {
        setError(((await res.json()) as any).error ?? "Decision failed.");
        return;
      }
      setReason("");
      setError(null);
      await load();
    },
    [current, reason, load],
  );

  if (!page) return <Shell reduced>Loading…</Shell>;

  if (page.items.length === 0) {
    return (
      <Shell reduced queueCount={0}>
        <div className="queue__cleared">
          <h2>Queue cleared</h2>
          {/* D13. The SVRC calls this content undesigned; this is the
            * smallest thing that keeps the session alive rather than
            * dead-ending it. */}
          <ShortcutCard title="Draw another sample" description="Measure a different source." />
          <ShortcutCard title="Metrics" description="Volume and Interested-per-hundred." />
          <ShortcutCard title="Admin" description="Sources, health, and runs." />
        </div>
      </Shell>
    );
  }

  const item = current!;
  return (
    <Shell reduced queueCount={page.remaining}>
      {page.mode === "sample" && page.sample && (
        <div className="queue__sample-banner">
          <MicroLabel>
            {`SAMPLE · ${page.sample.drawn} of ${page.sample.population_size.toLocaleString()} · ` +
              `${page.sample.source_name} · seed ${page.sample.seed}`}
          </MicroLabel>
        </div>
      )}

      <Card>
        <h2 className="queue__title">{item.title}</h2>
        <div className="queue__facts">
          <span>{item.org_name ?? "Buyer unknown"}</span>
          <span>{item.closes_at ?? "No deadline stated"}</span>
          <span>{money(item.value_cents)}</span>
          {item.kind && <Chip tone="neutral">{item.kind}</Chip>}
        </div>

        {item.deadline_conflict.length > 0 && (
          <Callout>
            <MicroLabel>DEADLINE DISAGREEMENT</MicroLabel>
            {item.deadline_conflict.map((c) => (
              <div key={`${c.origin}-${c.value_text}`}>
                <strong>{c.value_text}</strong> — {c.origin}
                {c.quote && <em> “{c.quote}”</em>}
              </div>
            ))}
          </Callout>
        )}

        {/* D14: Region 1.1.3 renders and says what it does not have. */}
        <FactPanel
          title="PURSUIT COST"
          note="Required forms, conference, references and notarization are not yet extracted."
        />

        <div className="queue__decision">
          <textarea
            aria-label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why? (required on Pass)"
          />
          {/* The keycap prop already exists on Button and puts the shortcut
            * ON the control it triggers, rather than in a legend beside it.
            * ariaLabel is what keeps each one unambiguously targetable by
            * automation -- the keycap letter otherwise joins the accessible
            * name, and SP3.6's lesson is that a control you cannot target is
            * a control nobody proves works. */}
          <Button
            variant="primary"
            keycap="I"
            ariaLabel="Interested"
            onClick={() => void decide("Interested")}
          >
            Interested
          </Button>
          <Button
            variant="secondary"
            keycap="P"
            ariaLabel="Pass"
            onClick={() => void decide("Not Interested")}
          >
            Pass
          </Button>
          <Button
            variant="ghost"
            keycap="↵"
            ariaLabel="Open record"
            onClick={() => navigate(`/solicitation/${item.id}`)}
          >
            Open record
          </Button>
        </div>
        {error && <Callout>{error}</Callout>}
      </Card>
    </Shell>
  );
}
```

Create `app/client/src/triage/Queue.css` with layout only — no colours that are not tokens:

```css
.queue__title { font: var(--type-heading); margin: 0 0 var(--space-2); }
.queue__facts { display: flex; flex-wrap: wrap; gap: var(--space-3); }
.queue__decision { display: flex; gap: var(--space-2); align-items: flex-start; margin-top: var(--space-4); }
.queue__decision textarea { flex: 1; min-height: 3rem; }
.queue__sample-banner { padding: var(--space-2) var(--space-4); }
.queue__cleared { display: grid; gap: var(--space-3); padding: var(--space-5); }
```

- [ ] **Step 4: Drop the placeholder**

In `app/client/src/router.tsx`, delete the `const Queue = ...` placeholder and import the real one:

```tsx
import { Queue } from "./triage/Queue";
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run app/client/src/triage/Queue.test.tsx`
Expected: PASS, all seven.

- [ ] **Step 6: Run the gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/client/src/triage app/client/src/router.tsx
git commit -m "The queue screen: one card, the disagreement shown, and Pass carries a reason"
```

---

## Task 12: Keyboard and undo

**Files:**
- Create: `app/client/src/triage/useQueueKeys.ts`
- Create: `app/client/src/triage/useQueueKeys.test.ts`
- Modify: `app/client/src/triage/Queue.tsx`

**Interfaces:**
- Produces: `useQueueKeys(handlers: { onInterested(): void; onPass(): void; onUndo(): void; onOpen(): void }): void`

- [ ] **Step 1: Write the failing tests**

Create `app/client/src/triage/useQueueKeys.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { useQueueKeys } from "./useQueueKeys";

afterEach(cleanup);

function mount(handlers: Parameters<typeof useQueueKeys>[0]) {
  const Probe = () => {
    useQueueKeys(handlers);
    return createElement("textarea", { "aria-label": "Reason" });
  };
  return render(createElement(Probe));
}

function press(key: string, target: EventTarget = document.body) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

test("i marks interested, p passes, u undoes, enter opens", () => {
  const h = {
    onInterested: vi.fn(), onPass: vi.fn(), onUndo: vi.fn(), onOpen: vi.fn(),
  };
  mount(h);
  press("i");
  press("p");
  press("u");
  press("Enter");
  expect(h.onInterested).toHaveBeenCalledOnce();
  expect(h.onPass).toHaveBeenCalledOnce();
  expect(h.onUndo).toHaveBeenCalledOnce();
  expect(h.onOpen).toHaveBeenCalledOnce();
});

/* The reason box is a text field on the same screen as single-letter
 * shortcuts. Typing "pass on this" must not fire Pass four times. */
test("typing in the reason box does not trigger shortcuts", () => {
  const h = {
    onInterested: vi.fn(), onPass: vi.fn(), onUndo: vi.fn(), onOpen: vi.fn(),
  };
  const { getByLabelText } = mount(h);
  press("p", getByLabelText("Reason"));
  expect(h.onPass).not.toHaveBeenCalled();
});

test("a modified key is the browser's, not ours", () => {
  const h = {
    onInterested: vi.fn(), onPass: vi.fn(), onUndo: vi.fn(), onOpen: vi.fn(),
  };
  mount(h);
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "p", metaKey: true, bubbles: true }),
  );
  expect(h.onPass).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/client/src/triage/useQueueKeys.test.ts`
Expected: FAIL — cannot resolve `./useQueueKeys`.

- [ ] **Step 3: Implement**

Create `app/client/src/triage/useQueueKeys.ts`:

```ts
import { useEffect } from "react";

/* Keyboard first: the SVRC's whole design assumes someone clearing forty
 * items, not browsing three. */
export function useQueueKeys(handlers: {
  onInterested(): void;
  onPass(): void;
  onUndo(): void;
  onOpen(): void;
}): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      /* The reason box is a text field on the same screen as single-letter
       * shortcuts. Without this, typing "pass on this" fires Pass four
       * times -- and the decision is the one thing on this screen that must
       * not happen by accident. */
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "i": handlers.onInterested(); break;
        case "p": handlers.onPass(); break;
        case "u": handlers.onUndo(); break;
        case "enter": handlers.onOpen(); break;
        default: return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}
```

- [ ] **Step 4: Wire undo into the queue**

In `app/client/src/triage/Queue.tsx`, add the import and track the last decision:

```tsx
import { useQueueKeys } from "./useQueueKeys";
```

Add beside the other state:

```tsx
  const [lastDecided, setLastDecided] = useState<number | null>(null);
```

In `decide`, after `setReason("")`, record it:

```tsx
      setLastDecided(id);
```

Add the undo callback and the key bindings after `decide`:

```tsx
  /* UNDO IS AN APPEND, not a delete: it decides the row back to New, and
   * both rows survive (spec §5.1). No time limit -- it is simply
   * "decide it again". */
  const undo = useCallback(async () => {
    if (lastDecided === null) return;
    await decide("New", lastDecided);
    setLastDecided(null);
  }, [lastDecided, decide]);

  useQueueKeys({
    onInterested: () => void decide("Interested"),
    onPass: () => void decide("Not Interested"),
    onUndo: () => void undo(),
    onOpen: () => current && navigate(`/solicitation/${current.id}`),
  });
```

Interested, Pass and Open record already carry their shortcuts on the buttons themselves (Task 11 uses `Button`'s `keycap` prop). **Undo has no button** — it is keyboard-only — so it needs the one hint that has nowhere else to live. Add it after the "Open record" button:

```tsx
          <span className="queue__keys">
            <Keycap>U</Keycap> undo
          </span>
```

and add `Keycap` to the primitives import.

- [ ] **Step 5: Add the undo test to `Queue.test.tsx`**

```tsx
test("undo appends a return to New rather than deleting", async () => {
  const fetchMock = stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());

  screen.getByRole("button", { name: /interested/i }).click();
  await waitFor(() =>
    expect(fetchMock.mock.calls.some((c) => (c[1] as any)?.method === "POST")).toBe(true),
  );

  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "u", bubbles: true }));

  await waitFor(() => {
    const bodies = fetchMock.mock.calls
      .filter((c) => (c[1] as any)?.method === "POST")
      .map((c) => JSON.parse((c[1] as any).body));
    expect(bodies.some((b) => b.state === "New")).toBe(true);
  });
});
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npx vitest run app/client/src/triage/`
Expected: PASS — three key tests and eight queue tests.

- [ ] **Step 7: Run the gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add app/client/src/triage
git commit -m "Keyboard triage, and an undo that appends rather than deletes"
```

---

## Task 13: The record screen

**Files:**
- Create: `app/client/src/record/Record.tsx`, `app/client/src/record/Record.css`
- Create: `app/client/src/record/Record.test.tsx`
- Modify: `app/client/src/router.tsx` (drop the placeholder)

**Interfaces:**
- Consumes: `GET /api/solicitations/:id`, `Shell`, `Section`, `TableRow`, `Chip`, `MicroLabel`, `Callout`
- Produces: `Record()`

- [ ] **Step 1: Write the failing tests**

Create `app/client/src/record/Record.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Record } from "./Record";

const RECORD = {
  id: 7,
  title: "Care-management workflow redesign",
  org_name: "Indiana FSSA",
  closes_at: "2026-09-17",
  fields: [
    {
      field_name: "closes_at", value: "2026-09-17", origin: "listing",
      confidence: 1, quote: null, note: null, state: "found",
      conflicts: [
        {
          value_text: "2026-08-26", origin: "document",
          quote: "proposals due August 26, 2026", confidence: 0.72,
        },
      ],
    },
    {
      field_name: "value_cents", value: null, origin: "document",
      confidence: null, quote: null, note: null, state: "absent", conflicts: [],
    },
    {
      field_name: "set_aside", value: null, origin: null,
      confidence: null, quote: null, note: null, state: "not_looked_for", conflicts: [],
    },
  ],
  documents: [
    {
      id: 1, filename: "SCOPE OF WORK.docx", media_type: "docx",
      extract_status: "extracted", source_url: "https://sam.gov/a.docx",
      extracted_text: "The deadline is September 17, 2026.",
    },
  ],
  timeline: [
    { kind: "sighting", at: "2026-08-10T00:00:00Z", source_name: "SAM.gov", detail: "Seen in SAM.gov" },
    { kind: "resolution", at: "2026-08-11T00:00:00Z", source_name: null, detail: "Buyer resolved to Indiana FSSA" },
  ],
  decision: null,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderRecord(body: unknown = RECORD) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  );
  return render(
    <MemoryRouter initialEntries={["/solicitation/7"]}>
      <Routes>
        <Route path="/solicitation/:id" element={<Record />} />
      </Routes>
    </MemoryRouter>,
  );
}

/* SP4 criterion bullet 2, deferred here by ruling. Until this renders, SP4
 * proves a citation is STORED, never that it is READABLE. */
test("a field shows its value, its confidence, and its quoted passage", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByText(/2026-09-17/)).toBeTruthy());
  expect(screen.getByText(/72%/)).toBeTruthy();
  expect(screen.getByText(/proposals due August 26, 2026/)).toBeTruthy();
});

/* SP4 criterion bullet 3. The FSSA near-miss, visible in the product for
 * the first time. */
test("a conflict renders beneath the winner, with its origin", async () => {
  const { container } = renderRecord();
  await waitFor(() => expect(screen.getByText(/2026-08-26/)).toBeTruthy());
  const conflict = container.querySelector(".record__conflict");
  expect(conflict).toBeTruthy();
  expect(conflict!.textContent).toContain("document");
});

test("absent and never-looked-for read differently", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByText(/absent from bundle/i)).toBeTruthy());
  expect(screen.getByText(/not yet looked for/i)).toBeTruthy();
});

/* D11. The bytes were discarded by SP4's ruling, so the link out is the
 * only route back to the original. */
test("a document links out and shows its extracted text", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByText(/SCOPE OF WORK.docx/)).toBeTruthy());
  const link = screen.getByRole("link", { name: /SCOPE OF WORK.docx/i });
  expect(link.getAttribute("href")).toBe("https://sam.gov/a.docx");
  expect(screen.getByText(/The deadline is September 17, 2026/)).toBeTruthy();
});

test("the timeline shows what the documents did and what the system decided", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByText(/Seen in SAM.gov/)).toBeTruthy());
  expect(screen.getByText(/Buyer resolved to Indiana FSSA/)).toBeTruthy();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/client/src/record/Record.test.tsx`
Expected: FAIL — cannot resolve `./Record`.

- [ ] **Step 3: Implement**

Create `app/client/src/record/Record.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Shell } from "../shell/Shell";
import { Callout, MicroLabel, Section } from "../primitives";
import "./Record.css";

interface Conflict {
  value_text: string;
  origin: string;
  quote: string | null;
  confidence: number | null;
}
interface Field {
  field_name: string;
  value: string | null;
  origin: string | null;
  confidence: number | null;
  quote: string | null;
  note: string | null;
  state: "found" | "absent" | "not_looked_for";
  conflicts: Conflict[];
}
interface Doc {
  id: number;
  filename: string;
  media_type: string | null;
  extract_status: string;
  source_url: string | null;
  extracted_text: string | null;
}
interface Event {
  kind: string;
  at: string;
  source_name: string | null;
  detail: string;
}
interface RecordBody {
  id: number;
  title: string;
  org_name: string | null;
  fields: Field[];
  documents: Doc[];
  timeline: Event[];
}

const pct = (c: number | null) => (c === null ? "—" : `${Math.round(c * 100)}%`);

/* THREE STATES, NOT TWO. "We looked and it is not there" is a different fact
 * from "we never looked", and collapsing them is how a missing ceiling
 * quietly becomes a guessed one (SVRC View 2.3). */
function stateLabel(f: Field): string {
  if (f.state === "absent") return "absent from bundle";
  if (f.state === "not_looked_for") return "not yet looked for";
  return f.origin ?? "";
}

export function Record() {
  const { id } = useParams();
  const [body, setBody] = useState<RecordBody | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/solicitations/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => live && setBody(b as RecordBody))
      .catch(() => live && setBody(null));
    return () => {
      live = false;
    };
  }, [id]);

  if (!body) return <Shell>Loading…</Shell>;

  return (
    <Shell>
      <h1 className="record__title">{body.title}</h1>
      <p className="record__buyer">{body.org_name ?? "Buyer unknown"}</p>

      <Section>
        <MicroLabel>EXTRACTED FIELDS</MicroLabel>
        {body.fields.map((f) => (
          <div key={f.field_name} className="record__field">
            <span className="record__field-name">{f.field_name}</span>
            <span className="record__field-value">{f.value ?? "—"}</span>
            <span className="record__field-state">{stateLabel(f)}</span>
            <span className="record__field-conf">{pct(f.confidence)}</span>
            {f.quote && <blockquote className="record__quote">“{f.quote}”</blockquote>}
            {f.note && <span className="record__note">{f.note}</span>}

            {/* The losing value is KEPT and SHOWN. A rejection you cannot
              * inspect is a bug you will never find -- and this display is
              * what makes the FSSA near-miss visible in the product. */}
            {f.conflicts.map((c) => (
              <div key={`${c.origin}-${c.value_text}`} className="record__conflict">
                <strong>{c.value_text}</strong>
                <span> — {c.origin}</span>
                <span> {pct(c.confidence)}</span>
                {c.quote && <blockquote>“{c.quote}”</blockquote>}
              </div>
            ))}
          </div>
        ))}
      </Section>

      <Section recessed>
        <MicroLabel>DOCUMENTS</MicroLabel>
        {/* D11: the bytes were discarded by SP4's ruling, so what is here is
          * the stored text and a link back to the original. */}
        <Callout>
          Documents are parsed and discarded — a citation quotes the extracted
          passage. The link opens the original at its source.
        </Callout>
        {body.documents.map((d) => (
          <div key={d.id} className="record__doc">
            {d.source_url ? (
              <a href={d.source_url} target="_blank" rel="noreferrer">
                {d.filename}
              </a>
            ) : (
              <span>{d.filename}</span>
            )}
            <span className="record__doc-status">{d.extract_status}</span>
            {d.extracted_text && <pre className="record__text">{d.extracted_text}</pre>}
          </div>
        ))}
      </Section>

      <Section>
        <MicroLabel>TIMELINE</MicroLabel>
        {body.timeline.map((e) => (
          <div key={`${e.kind}-${e.at}-${e.detail}`} className="record__event">
            <span className="record__event-at">{e.at}</span>
            <span>{e.detail}</span>
          </div>
        ))}
      </Section>
    </Shell>
  );
}
```

Create `app/client/src/record/Record.css`:

```css
.record__title { font: var(--type-heading); margin: var(--space-4) var(--space-4) 0; }
.record__buyer { margin: 0 var(--space-4) var(--space-4); }
.record__field { display: grid; gap: var(--space-1); padding: var(--space-2) 0; }
.record__conflict { padding-left: var(--space-4); }
.record__quote, .record__conflict blockquote { margin: 0; font-style: italic; }
.record__doc { padding: var(--space-2) 0; }
.record__text { white-space: pre-wrap; max-height: 12rem; overflow: auto; }
.record__event { display: flex; gap: var(--space-3); }
```

- [ ] **Step 4: Drop the placeholder**

In `app/client/src/router.tsx`, delete the `const Record = ...` placeholder and import the real one:

```tsx
import { Record } from "./record/Record";
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run app/client/src/record/Record.test.tsx`
Expected: PASS, all five.

- [ ] **Step 6: Run the gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/client/src/record app/client/src/router.tsx
git commit -m "The record: fields with their citations, conflicts kept visible, and the timeline"
```

---

## Task 14: The deviations and the docs

**Files:**
- Modify: `docs/admin-deviations.md`
- Modify: `STATUS.md`
- Modify: `docs/superpowers/specs/2026-08-28-sp4-fetch-extraction-design.md` (§10.1 — mark bullets 2 and 3 discharged)

**Interfaces:**
- Consumes: everything above
- Produces: documentation only. No code.

- [ ] **Step 1: Write D11–D15**

Append to `docs/admin-deviations.md`, following the existing entry format (each carries what the reference says, what was built, and why):

- **D11** — `View 2.4` shows stored `extracted_text` and a link to `source_url`, not the bundle inline. Migration 008 discarded the bytes by SP4's ruling; there is nothing to render inline.
- **D12** — the score strip does not render on the composed queue card. Records both dated rulings (SVRC `Region 1.1.2`, 2026-08-11 vs STATUS, 2026-08-13), Matt's resolution on 2026-08-30, and the correction that the vestigial look was NOT undesigned — `ScoreBar`'s null branch was built at SP2.
- **D13** — `View 1.3 : Queue Cleared` content, invented because the SVRC calls it undesigned. Three `ShortcutCard`s.
- **D14** — `Region 1.1.3` renders empty and states that its four facts are unextracted.
- **D15** — default order is deadline-soonest-first; the ratified `AMBIGUITY FIRST` default needs a scorer and cannot ship. Note that the SVRC's answer returns intact when qualification is designed.

- [ ] **Step 2: Discharge SP4's deferred bullets**

In `docs/superpowers/specs/2026-08-28-sp4-fetch-extraction-design.md` §10.1, add a dated line recording that bullets 2 and 3 are now built and where — `app/client/src/record/Record.tsx`, tested in `Record.test.tsx`. Do **not** rewrite the section: the record of what the deferral cost stays as written.

- [ ] **Step 3: Update STATUS.md**

Replace the RESUME HERE block with SP6's state. Record:
- the seven rulings and where the spec is
- the new gate count from `npm run check`
- **the stale claim now corrected:** "how vestigial should look is undesigned" — SP2 built it
- the sequencing prerequisite: production has zero documents, so criterion bullets 5 and 6 need Discover to run on production first

- [ ] **Step 4: Run the gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs STATUS.md
git commit -m "Deviations D11-D15, and the docs brought up to what SP6 actually built"
```

---

## Task 15: The demo criterion, run for real

**Files:** none — this is execution, and its output is a record in `STATUS.md`.

**This task cannot be discharged by `curl`.** SP3.6 passed every server-side test while both of its buttons were broken in a browser; SP4's §10 restated the lesson. Bullets 2–6 require a browser.

- [ ] **Step 1: Decide where the record half runs**

Production holds ~9,883 solicitations and **zero documents**. Either run Discover on production first — SP4's one unrun criterion bullet — or take the record half on `test` and **say so in the record**. What must not happen is the demo being taken on `test` and reported as production.

⚠️ The first Discover click on production writes `document` rows into a database that has none.

- [ ] **Step 2: Draw a sample**

```bash
curl -sS -X POST "$BASE/api/triage/samples" \
  -H "Content-Type: application/json" -H "X-Admin-Secret: $ADMIN_SECRET" \
  -d '{"source_id": 1, "n": 100, "seed": "gate-2026-08-30"}'
```

Record `population_size`, `drawn` and `seed` in STATUS. **These are the denominator** — a number without them is not reconstructable later.

- [ ] **Step 3: Triage it in a browser, from the keyboard**

Seed the secret **before navigating**, or `window.prompt` deadlocks CDP:

```js
Page.addScriptToEvaluateOnNewDocument(
  `sessionStorage.setItem('tenderfoot.adminSecret', '<secret>')`
);
```

Confirm on screen: the sample banner shows `drawn of population_size`, the counter decrements, and `I` / `P` / `U` all work without touching the mouse.

- [ ] **Step 4: Exercise undo, and verify both rows survive**

```sql
SELECT id, state, reason, created_at FROM pursuit
 WHERE solicitation_id = <id> ORDER BY id;
```

Expected: two or more rows, the earlier one intact.

- [ ] **Step 5: Open a record and read a citation**

Confirm a field shows **value, confidence and the quoted passage** (bullet 5), and that a **disagreement shows both values with their origins** (bullet 6). If no conflict exists in the data, say so plainly rather than reporting the bullet as passed.

- [ ] **Step 6: Take both numbers**

```bash
curl -sS "$BASE/api/triage/metrics"
```

Record volume per source per week, Interested-per-hundred per source, and **`excluded_no_posted_at`**. Quote the rate only alongside `population_size`, `drawn` and `decided`.

- [ ] **Step 7: Write the result into STATUS.md and commit**

Record what passed, what did not, and **which database each half ran against**. A criterion half-run is recorded as half-run — SP3.6's server half passed while its buttons were broken, and saying so is what made the browser round worth doing.

```bash
git add STATUS.md
git commit -m "SP6 demo criterion: run, with the sample's denominator on the record"
```

---

## Self-review notes

**Spec coverage.** §3 → Task 1. §4.1–4.2 → Task 3. §4.3 → Task 5. §5.1–5.2 → Task 4. §5.3 → Task 7. §6.1–6.3 → Tasks 8 and 13. §7 → Task 9. §8.1–8.2 → Task 6. §9 → Tasks 7 and 8. §10 → distributed across the task each edge belongs to (small source → Task 5; deadline passing mid-session → Task 5; empty reason → Tasks 4, 7, 11; undo no-op → Task 12; second draw → Task 5; CDP seeding → Tasks 11 and 15). §11 → the four weighted tests are in Tasks 3, 5, 4 and 6. §12 → Task 14. §14 → Task 15. §15 → Task 15 Step 1.

**One task the spec did not anticipate.** Task 10 exists because reading the primitives showed `Button` has **no click handler at all** — SP2 built it inert by design. The spec assumed a decision bar could be composed from what SP2 shipped; it cannot, quite. This is the `Button` work STATUS already predicted would be a first move inside SP6, and it is scoped to the handler alone.

**Two things a reviewer should push on.** The `deadline_conflict` subquery in Task 3 compares `extracted_field.value_text` against `solicitation.closes_at` as **strings** — real data may hold `2026-09-17` in one and `2026-09-17T00:00:00Z` in the other, which would report a conflict that is only a format difference. If the first live run shows spurious conflicts, normalise both sides before comparing and add the test that catches it. And Task 6's `posted_at` regex accepts a leading ISO date; if SAM.gov's `posted_at` turns out to carry a format the regex rejects, the exclusion count will be large and **that is the signal to look**, not a reason to loosen the filter silently.
