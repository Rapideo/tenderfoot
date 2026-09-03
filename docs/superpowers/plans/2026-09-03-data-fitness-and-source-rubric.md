# Data Fitness and Source Rubric Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn "our data doesn't feel robust" into a repeatable verdict — a binding floor measured against the live database, and an ordinal rubric that scores each registered source on how much of the property list it can supply.

**Architecture:** A new `app/server/src/fitness/` module. `thresholds.ts` holds the proposed (unratified) numbers in one place; `floor.ts` measures our holdings, one function per predicate; `rubric.ts` scores a source row; `fitness-cli.ts` prints both. Migration 018 adds the three registry columns the rubric needs and the registry lacks. **No route, no screen** — ruling 3A forbids new UI slices, so the output is a CLI report.

**Tech Stack:** TypeScript ESM (`.js` import specifiers), Postgres via `pg`, vitest with schema-per-file isolation (`useTestSchema`), `tsx` for CLI entry points.

**Spec:** [`docs/superpowers/specs/2026-09-03-data-fitness-and-source-rubric-design.md`](../specs/2026-09-03-data-fitness-and-source-rubric-design.md)

## Global Constraints

- **The rubric scores SOURCES, never opportunities.** Spec §5.1. Every dimension must take a *source* as its subject. A dimension whose sentence reads naturally with a solicitation as its subject does not belong.
- **Nothing scores, nothing filters, no control is wired.** Ruling 1A; design spec §7.10 clause 2. This plan adds no ranking of solicitations or contracts.
- **No new UI slices.** Ruling 3A. Nothing in `app/client/` is touched by this plan.
- **Thresholds are PROPOSALS, not rulings.** Spec §3.2 and §8.1. They live in one file, each annotated `UNRATIFIED`, and no code may hard-code a threshold anywhere else.
- **`unknown` is a first-class value and is never collapsed to `weak`.** Spec §5.3. Recording an untested source as weak converts absence of evidence into evidence of absence.
- **R1 (legal posture) is a gate, not a score.** `out` disqualifies before any other dimension is computed. No probe is constructed for an `out` or `manual-only` row.
- **`npm run check` must exit 0** before any task is considered complete.
- **Mutation-prove the important tests.** CLAUDE.md §4: break the thing the test covers, confirm exactly the expected tests fail, and **run the whole file** — a `-t` filter proves nothing about isolation.
- **Scraping and long runs happen LOCALLY**, against the `test` branch (Matt, 2026-09-03). Local `DATABASE_URL` already points there; production is behind `DATABASE_URL_PRODUCTION`.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/server/src/fitness/thresholds.ts` | **Create.** The proposed floor thresholds, each marked UNRATIFIED. The only place a number lives. |
| `app/server/src/fitness/floor.ts` | **Create.** One measurement function per predicate F1–F7, plus `measureFloor()`. Reads only; writes nothing. |
| `app/server/src/fitness/floor.test.ts` | **Create.** Per-predicate tests against seeded fixtures. |
| `app/server/src/fitness/rubric.ts` | **Create.** `scoreSource()` — R1 as gate, R2–R9 as an ordinal profile. Pure over a row; no database. |
| `app/server/src/fitness/rubric.test.ts` | **Create.** Dimension tests plus the §5.4 acceptance test. |
| `app/server/src/fitness/fitness-cli.ts` | **Create.** Thin CLI, mirroring `merge/merge-cli.ts` exactly. |
| `app/server/migrations/018_source_rubric.sql` | **Create.** `cost_posture`, `annual_cost_usd`, `field_completeness`, `watermark_field`. |
| `package.json` | **Modify.** Add the `fitness` script. |
| `docs/2026-09-03-source-assessments.md` | **Create (Task 9).** The pass-1 output and the pass-2 probe list. |

**Why `rubric.ts` is pure over a row and `floor.ts` queries.** The floor is a statement about the database and cannot be tested without one. The rubric is a statement about a source's recorded metadata, so making it pure keeps the acceptance test (§5.4) a fast unit test with hand-written rows rather than a database fixture — and the acceptance test is the one that has to be trivially re-runnable every time a dimension changes.

---

## Task 1: Thresholds, and the floor's shape (F1, F2)

**Files:**
- Create: `app/server/src/fitness/thresholds.ts`
- Create: `app/server/src/fitness/floor.ts`
- Test: `app/server/src/fitness/floor.test.ts`

**Interfaces:**
- Consumes: `all`, `one` from `../db/index.js`.
- Produces: `type Verdict = "pass" | "fail" | "marginal" | "unknown"`; `interface PredicateResult { id, property, statement, threshold, measured, verdict, detail? }`; `measureF1()`, `measureF2()`, both `Promise<PredicateResult>`; `THRESHOLDS` object.

- [ ] **Step 1: Write the failing test**

Create `app/server/src/fitness/floor.test.ts`:

```typescript
import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_floor");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, run } = await import("../db/index.js");
const { measureF1, measureF2 } = await import("./floor.js");

beforeAll(async () => {
  await migrate(false);
  /* The seed ships eleven sources; this suite reasons about ingest_run rows,
   * so it clears the seeded registry and builds exactly what each test needs. */
  await run(`DELETE FROM ingest_run`);
  await run(`DELETE FROM sighting`);
  await run(`DELETE FROM solicitation`);
  await run(`DELETE FROM source`);
}, 120000);
afterAll(async () => {
  await close();
});

async function source(name: string, jurisdiction: string | null): Promise<number> {
  return insert(
    `INSERT INTO source (name, jurisdiction) VALUES ($1, $2) RETURNING id`,
    [name, jurisdiction],
  );
}

async function ingested(sourceId: number): Promise<void> {
  await run(
    `INSERT INTO ingest_run (source_id, artifact_sha256, rows_imported)
     VALUES ($1, $2, 1)`,
    [sourceId, `sha-${sourceId}-${Math.random()}`],
  );
}

test("F1 counts only sources that have actually ingested", async () => {
  const fed = await source("F1 federal", "US");
  await source("F1 never run", "IN");
  await ingested(fed);

  const r = await measureF1();
  expect(r.id).toBe("F1");
  expect(r.measured).toBe(1);
  expect(r.verdict).toBe("fail");
});

test("F1 passes at two ingested sources", async () => {
  const second = await source("F1 second", "IN");
  await ingested(second);

  const r = await measureF1();
  expect(r.measured).toBe(2);
  expect(r.verdict).toBe("pass");
});

test("F2 fails while no ingested source sits in the primary geography", async () => {
  await run(`DELETE FROM ingest_run`);
  await run(`DELETE FROM source`);
  const fed = await source("F2 federal only", "US");
  await ingested(fed);

  const r = await measureF2();
  expect(r.id).toBe("F2");
  expect(r.measured).toBe(0);
  expect(r.verdict).toBe("fail");
  expect(r.detail).toContain("IN");
});

test("F2 passes once an Indiana source has ingested", async () => {
  const indiana = await source("F2 indiana", "IN");
  await ingested(indiana);

  const r = await measureF2();
  expect(r.measured).toBe(1);
  expect(r.verdict).toBe("pass");
});

test("F2 reads the primary geography from firm_profile, not a constant", async () => {
  await run(`UPDATE firm_profile SET geography = $1`, [
    JSON.stringify({ primary: ["OH"], secondary: [], federal: true }),
  ]);

  const r = await measureF2();
  /* The Indiana source from the previous test no longer counts: the profile
   * now says Ohio. If this returns 1, the predicate hard-coded "IN". */
  expect(r.measured).toBe(0);
  expect(r.detail).toContain("OH");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/server/src/fitness/floor.test.ts`
Expected: FAIL — `Cannot find module './floor.js'`

- [ ] **Step 3: Write the thresholds module**

Create `app/server/src/fitness/thresholds.ts`:

```typescript
/* THE FLOOR'S NUMBERS LIVE HERE AND NOWHERE ELSE.
 *
 * Spec §3.2: "The predicates are the design. The thresholds are a RULING."
 * Every value below is a PROPOSAL that Matt has not ratified, and the spec's
 * §8.1 carries them as an open question. They are collected in one file so
 * that ratifying them is a single, visible edit rather than a hunt through
 * seven query modules -- and so that nobody can quietly introduce an eighth
 * number by hard-coding it at a call site.
 *
 * ⚠️ A FLOOR WITH UNRATIFIED THRESHOLDS IS NOT YET BINDING. measureFloor()
 * reports `ratified: false` while this flag is false, so a caller cannot
 * mistake a provisional verdict for the real one. */
export const THRESHOLDS_RATIFIED = false;

export const THRESHOLDS = {
  /** F1 — sources with at least one completed ingest. UNRATIFIED. */
  minIngestedSources: 2,
  /** F2 — ingested sources inside the Profile's primary geography. UNRATIFIED. */
  minPrimaryGeographySources: 1,
  /** F4 — longest run of consecutive ISO weeks with no ingest, in weeks. UNRATIFIED. */
  maxIngestGapWeeks: 1,
  /** F5 — real triage decisions needed for Interested-per-hundred. UNRATIFIED. */
  minDecisions: 100,
  /** F6 — 10th-percentile description length on biddable rows, characters. UNRATIFIED. */
  minDescriptionP10Chars: 200,
  /** F7 — share of document-deferring rows for which we hold a document. UNRATIFIED. */
  minDocumentReachability: 0.8,
} as const;
```

- [ ] **Step 4: Write the minimal floor implementation**

Create `app/server/src/fitness/floor.ts`:

```typescript
import { all, one } from "../db/index.js";
import { THRESHOLDS } from "./thresholds.js";

export type Verdict = "pass" | "fail" | "marginal" | "unknown";

export interface PredicateResult {
  /** "F1".."F7" */
  id: string;
  /** The property from spec §2 this predicate reads. */
  property: string;
  statement: string;
  threshold: number | string;
  measured: number | string;
  verdict: Verdict;
  /** Whatever a reader needs to act on the verdict. Never omitted on a fail. */
  detail?: string;
}

/* A source counts as INGESTED when it has an ingest_run row, not when it is
 * `enabled` and not when `last_run_at` is stamped. Those two say a run was
 * intended or attempted; an ingest_run row says one completed and wrote an
 * artifact hash. D27's whole finding is that intent and outcome diverge. */
const INGESTED_SOURCES = `
  SELECT DISTINCT s.id, s.name, s.jurisdiction
    FROM source s
    JOIN ingest_run ir ON ir.source_id = s.id`;

export async function measureF1(): Promise<PredicateResult> {
  const rows = await all<{ name: string }>(INGESTED_SOURCES);
  const n = rows.length;
  return {
    id: "F1",
    property: "P1",
    statement: "At least N sources have completed a real ingest",
    threshold: THRESHOLDS.minIngestedSources,
    measured: n,
    verdict: n >= THRESHOLDS.minIngestedSources ? "pass" : "fail",
    detail:
      n >= THRESHOLDS.minIngestedSources
        ? undefined
        : `Ingested: ${rows.map((r) => r.name).join(", ") || "none"}. ` +
          `A layer is only proven source-agnostic by a second source (D27).`,
  };
}

export async function measureF2(): Promise<PredicateResult> {
  /* Read the geography from the Profile rather than constant-folding "IN".
   * §1A: scope is a Profile setting, not code. A second customer is a second
   * row, and a hard-coded jurisdiction would make this predicate lie for them. */
  const profile = await one<{ geography: { primary?: string[] } | null }>(
    `SELECT geography FROM firm_profile
      JOIN vendor ON vendor.id = firm_profile.vendor_id
     WHERE vendor.is_self LIMIT 1`,
  );
  const primary = profile?.geography?.primary ?? [];
  if (primary.length === 0) {
    return {
      id: "F2",
      property: "P2",
      statement: "The Profile's primary geography is represented among ingested sources",
      threshold: THRESHOLDS.minPrimaryGeographySources,
      measured: "unknown",
      verdict: "unknown",
      detail: "firm_profile.geography has no `primary` array — nothing to measure against.",
    };
  }

  const rows = await all<{ name: string; jurisdiction: string | null }>(INGESTED_SOURCES);
  const inPrimary = rows.filter((r) => r.jurisdiction !== null && primary.includes(r.jurisdiction));
  const n = inPrimary.length;
  return {
    id: "F2",
    property: "P2",
    statement: "The Profile's primary geography is represented among ingested sources",
    threshold: THRESHOLDS.minPrimaryGeographySources,
    measured: n,
    verdict: n >= THRESHOLDS.minPrimaryGeographySources ? "pass" : "fail",
    detail:
      n >= THRESHOLDS.minPrimaryGeographySources
        ? undefined
        : `Primary geography is ${primary.join(", ")}; ingested jurisdictions are ` +
          `${[...new Set(rows.map((r) => r.jurisdiction ?? "null"))].join(", ") || "none"}.`,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run app/server/src/fitness/floor.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Mutation-prove F2 is not hard-coded**

In `floor.ts`, temporarily replace `const primary = profile?.geography?.primary ?? [];` with `const primary = ["IN"];`.

Run the **whole file**: `npx vitest run app/server/src/fitness/floor.test.ts`
Expected: exactly one failure — *"F2 reads the primary geography from firm_profile, not a constant"*. The other four still pass.

Revert the mutation and re-run to confirm 5 pass.

- [ ] **Step 7: Commit**

```bash
git add app/server/src/fitness/thresholds.ts app/server/src/fitness/floor.ts app/server/src/fitness/floor.test.ts
git commit -m "The floor's first two predicates, and the thresholds nobody has ratified yet"
```

---

## Task 2: F3 and F4 — deadline integrity and coverage continuity

**Files:**
- Modify: `app/server/src/fitness/floor.ts`
- Test: `app/server/src/fitness/floor.test.ts`

**Interfaces:**
- Consumes: `PredicateResult`, `THRESHOLDS` from Task 1; `EFFECTIVE_CLOSES_AT`, `NOT_BIDDABLE_SQL` from `../triage/eligibility.js`.
- Produces: `measureF3()`, `measureF4()`, both `Promise<PredicateResult>`.

**Why F3 is not a tautology.** `ELIGIBLE` is built on `EFFECTIVE_CLOSES_AT`, so "impossible dates reach the queue" is true by construction *today*. F3 measures it anyway, because the predicate is one refactor away from being wrong and the failure would be silent — which is precisely how the 62 were lost the first time.

- [ ] **Step 1: Write the failing tests**

Append to `app/server/src/fitness/floor.test.ts`:

```typescript
const { measureF3, measureF4 } = await import("./floor.js");

async function solicitation(
  sourceId: number,
  posted: string | null,
  closes: string | null,
  kind: string | null,
): Promise<number> {
  return insert(
    `INSERT INTO solicitation (title, source_id, posted_at, closes_at, kind)
     VALUES ('floor fixture', $1, $2, $3, $4) RETURNING id`,
    [sourceId, posted, closes, kind],
  );
}

test("F3 passes when an impossible-dated biddable row is still reachable", async () => {
  await run(`DELETE FROM pursuit`);
  await run(`DELETE FROM sighting`);
  await run(`DELETE FROM solicitation`);
  const src = await source("F3 source", "US");
  /* The real production shape: posted 2026-08-25, closes 2006-09-24. */
  await solicitation(src, "2026-08-25", "2006-09-24", "Solicitation");

  const r = await measureF3();
  expect(r.id).toBe("F3");
  expect(r.measured).toBe(0);
  expect(r.verdict).toBe("pass");
});

test("F3 counts an impossible-dated row that has been filtered out of reach", async () => {
  const src = await source("F3 hidden", "US");
  /* An Award Notice is NOT_BIDDABLE, so it is unreachable for a different and
   * legitimate reason. F3 must not count it -- otherwise the predicate fires
   * on a correct exclusion and cries wolf forever. */
  await solicitation(src, "2026-08-25", "2006-09-24", "Award Notice");

  const r = await measureF3();
  expect(r.measured).toBe(0);
  expect(r.verdict).toBe("pass");
});

test("F4 reports the longest gap between ingest weeks", async () => {
  await run(`DELETE FROM ingest_run`);
  const src = await source("F4 source", "US");
  await run(
    `INSERT INTO ingest_run (source_id, artifact_sha256, imported_at)
     VALUES ($1, 'f4-a', '2026-08-03T00:00:00Z'),
            ($1, 'f4-b', '2026-08-24T00:00:00Z')`,
    [src],
  );

  const r = await measureF4();
  expect(r.id).toBe("F4");
  /* 2026-08-03 and 2026-08-24 are three ISO weeks apart, so two weeks in
   * between had no ingest at all. */
  expect(r.measured).toBe(2);
  expect(r.verdict).toBe("fail");
});

test("F4 passes when ingests are weekly", async () => {
  await run(`DELETE FROM ingest_run`);
  const src = await source("F4 weekly", "US");
  await run(
    `INSERT INTO ingest_run (source_id, artifact_sha256, imported_at)
     VALUES ($1, 'f4-c', '2026-08-03T00:00:00Z'),
            ($1, 'f4-d', '2026-08-10T00:00:00Z')`,
    [src],
  );

  const r = await measureF4();
  expect(r.measured).toBe(0);
  expect(r.verdict).toBe("pass");
});

test("F4 is unknown rather than passing when nothing has ever ingested", async () => {
  await run(`DELETE FROM ingest_run`);

  const r = await measureF4();
  expect(r.verdict).toBe("unknown");
  expect(r.measured).toBe("unknown");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/server/src/fitness/floor.test.ts`
Expected: FAIL — `measureF3 is not a function`.

- [ ] **Step 3: Implement F3 and F4**

Append to `app/server/src/fitness/floor.ts`, and add the import at the top:

```typescript
import { EFFECTIVE_CLOSES_AT, NOT_BIDDABLE_SQL } from "../triage/eligibility.js";
```

```typescript
/* F3. THE 62, AND WHY THIS IS MEASURED RATHER THAN ASSUMED.
 *
 * 106 production rows close BEFORE they were posted -- the worst by 7,275
 * days, a year typo in SAM's own payload. Until `7964047` the queue predicate
 * compared closes_at directly, so those rows were filed as CLOSED and 62 live,
 * biddable ones were dropped in silence: ~1.4% of a week's discovery.
 *
 * EFFECTIVE_CLOSES_AT now resolves an impossible date to NULL, so they are
 * reachable again -- which makes the count below zero BY CONSTRUCTION today.
 * It is measured anyway because that construction is one refactor from being
 * wrong and the failure mode is silence. The test that matters is the second
 * one: a row excluded for a DIFFERENT and legitimate reason (an Award Notice
 * is not biddable) must not be counted, or the predicate cries wolf forever. */
export async function measureF3(): Promise<PredicateResult> {
  const row = await one<{ n: string }>(
    `SELECT count(*) AS n
       FROM solicitation s
      WHERE s.closes_at IS NOT NULL
        AND s.posted_at IS NOT NULL
        AND s.closes_at < s.posted_at
        AND ${NOT_BIDDABLE_SQL}
        AND ${EFFECTIVE_CLOSES_AT} IS NOT NULL`,
  );
  const n = Number(row?.n ?? 0);
  return {
    id: "F3",
    property: "P5",
    statement: "No biddable row is hidden by a deadline earlier than its own posting date",
    threshold: 0,
    measured: n,
    verdict: n === 0 ? "pass" : "fail",
    detail:
      n === 0
        ? undefined
        : `${n} biddable rows carry an impossible deadline that still resolves to a ` +
          `non-null effective deadline. EFFECTIVE_CLOSES_AT has stopped covering them.`,
  };
}

/* F4. "Was anybody watching?"
 *
 * Plan of Action §6.4: a GO/NO-GO measured during a window in which a source
 * was silently dead is a measurement of an outage, not of the market.
 *
 * Measured as the longest run of consecutive ISO weeks, between the first and
 * last ingest, in which NO ingest_run completed. Weeks are counted across all
 * sources together: one source running weekly while another is dead is a
 * per-source problem, and the per-source view is the rubric's job (R-series),
 * not the floor's.
 *
 * ⚠️ THE ADJUDICATION WINDOW IS STILL UNDEFINED -- spec §8.2. This measures
 * the span we actually have, not the span we should have. When the window is
 * ruled, this predicate gains a second clause and not a different shape. */
export async function measureF4(): Promise<PredicateResult> {
  const weeks = await all<{ week: string }>(
    `SELECT DISTINCT to_char(date_trunc('week', imported_at), 'YYYY-MM-DD') AS week
       FROM ingest_run
      ORDER BY week`,
  );

  const statement = "Ingestion has no unwatched gap between its first and last run";
  if (weeks.length === 0) {
    return {
      id: "F4",
      property: "P4",
      statement,
      threshold: THRESHOLDS.maxIngestGapWeeks,
      measured: "unknown",
      verdict: "unknown",
      detail: "No ingest_run rows exist. Nothing has ever been ingested, so there is no span to measure.",
    };
  }

  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  let worst = 0;
  for (let i = 1; i < weeks.length; i++) {
    const gap =
      (Date.parse(weeks[i].week) - Date.parse(weeks[i - 1].week)) / MS_PER_WEEK - 1;
    if (gap > worst) worst = gap;
  }
  const rounded = Math.round(worst);
  return {
    id: "F4",
    property: "P4",
    statement,
    threshold: THRESHOLDS.maxIngestGapWeeks,
    measured: rounded,
    verdict: rounded <= THRESHOLDS.maxIngestGapWeeks ? "pass" : "fail",
    detail:
      rounded <= THRESHOLDS.maxIngestGapWeeks
        ? undefined
        : `${rounded} consecutive weeks with no ingest, between ${weeks[0].week} and ` +
          `${weeks[weeks.length - 1].week}. A verdict taken over that span measures an outage.`,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/server/src/fitness/floor.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Mutation-prove F3 respects the biddable filter**

Remove `AND ${NOT_BIDDABLE_SQL}` from `measureF3`'s query.

Run the **whole file**: `npx vitest run app/server/src/fitness/floor.test.ts`
Expected: exactly one failure — *"F3 counts an impossible-dated row that has been filtered out of reach"*.

Revert and re-run to confirm 10 pass.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/fitness/floor.ts app/server/src/fitness/floor.test.ts
git commit -m "F3 and F4: the 62 stay measured, and an unwatched window is a finding"
```

---

## Task 3: F5, F6, F7 — decisions, descriptions, documents

**Files:**
- Modify: `app/server/src/fitness/floor.ts`
- Test: `app/server/src/fitness/floor.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–2.
- Produces: `measureF5()`, `measureF6()`, `measureF7()`, all `Promise<PredicateResult>`; `DOCUMENT_DEFERRAL_MARKERS: readonly string[]`.

- [ ] **Step 1: Write the failing tests**

Append to `app/server/src/fitness/floor.test.ts`:

```typescript
const { measureF5, measureF6, measureF7 } = await import("./floor.js");

test("F5 counts real decisions and ignores the 'New' placeholder", async () => {
  await run(`DELETE FROM pursuit`);
  await run(`DELETE FROM solicitation`);
  const src = await source("F5 source", "US");
  const a = await solicitation(src, "2026-08-01", "2026-12-01", "Solicitation");
  const b = await solicitation(src, "2026-08-01", "2026-12-01", "Solicitation");
  await run(`INSERT INTO pursuit (solicitation_id, state) VALUES ($1, 'New')`, [a]);
  await run(`INSERT INTO pursuit (solicitation_id, state) VALUES ($1, 'Interested')`, [b]);

  const r = await measureF5();
  expect(r.id).toBe("F5");
  expect(r.measured).toBe(1);
  expect(r.verdict).toBe("fail");
});

test("F6 reports the p10 description length over biddable rows only", async () => {
  await run(`DELETE FROM pursuit`);
  await run(`DELETE FROM solicitation`);
  const src = await source("F6 source", "US");
  /* Nine long descriptions and one short one: p10 lands on the short one. */
  for (let i = 0; i < 9; i++) {
    await run(
      `INSERT INTO solicitation (title, source_id, kind, description)
       VALUES ('long', $1, 'Solicitation', $2)`,
      [src, "x".repeat(900)],
    );
  }
  await run(
    `INSERT INTO solicitation (title, source_id, kind, description)
     VALUES ('short', $1, 'Solicitation', $2)`,
    [src, "x".repeat(50)],
  );
  /* An Award Notice with an empty description must not drag p10 down: it is
   * not a row anybody triages. */
  await run(
    `INSERT INTO solicitation (title, source_id, kind, description)
     VALUES ('award', $1, 'Award Notice', '')`,
    [src],
  );

  const r = await measureF6();
  expect(r.id).toBe("F6");
  expect(Number(r.measured)).toBeLessThan(200);
  expect(r.verdict).toBe("fail");
});

test("F7 measures reachability only over rows that defer to a document", async () => {
  await run(`DELETE FROM document`);
  await run(`DELETE FROM solicitation`);
  const src = await source("F7 source", "US");
  const defersWithDoc = await insert(
    `INSERT INTO solicitation (title, source_id, kind, description)
     VALUES ('a', $1, 'Solicitation', 'Base + four years - see SOW and additional items list')
     RETURNING id`,
    [src],
  );
  await insert(
    `INSERT INTO solicitation (title, source_id, kind, description)
     VALUES ('b', $1, 'Solicitation', 'Refer to the attached solicitation document.')
     RETURNING id`,
    [src],
  );
  /* Self-contained: must not enter the denominator at all. */
  await run(
    `INSERT INTO solicitation (title, source_id, kind, description)
     VALUES ('c', $1, 'Solicitation', 'A complete scope of work is described here in full.')`,
    [src],
  );
  await run(
    `INSERT INTO document (solicitation_id, filename) VALUES ($1, 'sow.pdf')`,
    [defersWithDoc],
  );

  const r = await measureF7();
  expect(r.id).toBe("F7");
  expect(r.detail).toContain("2");
  expect(Number(r.measured)).toBeCloseTo(0.5, 2);
  expect(r.verdict).toBe("fail");
});

test("F7 is unknown, not passing, when nothing defers to a document", async () => {
  await run(`DELETE FROM document`);
  await run(`DELETE FROM solicitation`);
  const src = await source("F7 empty", "US");
  await run(
    `INSERT INTO solicitation (title, source_id, kind, description)
     VALUES ('d', $1, 'Solicitation', 'Fully described inline.')`,
    [src],
  );

  const r = await measureF7();
  expect(r.verdict).toBe("unknown");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/server/src/fitness/floor.test.ts`
Expected: FAIL — `measureF5 is not a function`.

- [ ] **Step 3: Implement F5, F6, F7**

Append to `app/server/src/fitness/floor.ts`:

```typescript
/* F5. The one number no amount of engineering can produce.
 *
 * 'New' is migration 002's DEFAULT and means untouched -- counting it would
 * report the queue's size as its decision count. Only a state a person chose
 * is a decision. */
export async function measureF5(): Promise<PredicateResult> {
  const row = await one<{ n: string }>(
    `SELECT count(DISTINCT solicitation_id) AS n FROM pursuit WHERE state <> 'New'`,
  );
  const n = Number(row?.n ?? 0);
  return {
    id: "F5",
    property: "P9",
    statement: "Enough real triage decisions exist to compute Interested-per-hundred",
    threshold: THRESHOLDS.minDecisions,
    measured: n,
    verdict: n >= THRESHOLDS.minDecisions ? "pass" : "fail",
    detail:
      n >= THRESHOLDS.minDecisions
        ? undefined
        : `${n} decisions recorded. This number requires a person triaging a real ` +
          `sample; nothing else can produce it.`,
  };
}

/* F6. p10 rather than the median, deliberately.
 *
 * Sample 2's MEDIAN description is a comfortable 515 characters, and 6 of 25
 * are still under 200. A median hides the tail, and the tail is where a triage
 * decision becomes impossible. Restricted to biddable kinds because an award
 * notice's empty description is not a defect -- there is nothing to decide. */
export async function measureF6(): Promise<PredicateResult> {
  const row = await one<{ p10: number | null; n: string }>(
    `SELECT percentile_cont(0.1) WITHIN GROUP (
              ORDER BY length(coalesce(s.description, ''))
            ) AS p10,
            count(*) AS n
       FROM solicitation s
      WHERE ${NOT_BIDDABLE_SQL}`,
  );
  const n = Number(row?.n ?? 0);
  const statement = "The 10th-percentile description on a biddable row is readable";
  if (n === 0 || row?.p10 === null || row?.p10 === undefined) {
    return {
      id: "F6",
      property: "P6",
      statement,
      threshold: THRESHOLDS.minDescriptionP10Chars,
      measured: "unknown",
      verdict: "unknown",
      detail: "No biddable rows to measure.",
    };
  }
  const p10 = Math.round(row.p10);
  return {
    id: "F6",
    property: "P6",
    statement,
    threshold: THRESHOLDS.minDescriptionP10Chars,
    measured: p10,
    verdict: p10 >= THRESHOLDS.minDescriptionP10Chars ? "pass" : "fail",
    detail: `p10 = ${p10} characters over ${n} biddable rows.`,
  };
}

/* F7. WHAT COUNTS AS "DEFERS TO A DOCUMENT".
 *
 * A heuristic over phrases actually observed in SAM descriptions -- "Dental
 * prosthetics - BPA - Base + four years - see SOW and additional items list"
 * is the real 80-character example that made sample 1 unworkable.
 *
 * ⚠️ IT UNDER-COUNTS, AND THAT IS THE SAFE DIRECTION. A description that is
 * merely thin, without saying so, is not caught here -- F6 is what covers
 * that. A marker list that guessed generously would inflate the denominator
 * and make the ratio look worse than the evidence supports. */
export const DOCUMENT_DEFERRAL_MARKERS = [
  "see sow",
  "see attach",
  "see the attach",
  "additional items list",
  "attached solicitation",
  "refer to the attach",
  "see solicitation document",
  "as described in the attach",
] as const;

export async function measureF7(): Promise<PredicateResult> {
  const marker = DOCUMENT_DEFERRAL_MARKERS.map(
    (m) => `lower(s.description) LIKE '%${m}%'`,
  ).join(" OR ");

  const row = await one<{ defers: string; held: string }>(
    `SELECT count(*) AS defers,
            count(*) FILTER (WHERE d.id IS NOT NULL) AS held
       FROM solicitation s
       LEFT JOIN LATERAL (
              SELECT 1 AS id FROM document dd WHERE dd.solicitation_id = s.id LIMIT 1
            ) d ON true
      WHERE s.description IS NOT NULL
        AND ${NOT_BIDDABLE_SQL}
        AND (${marker})`,
  );

  const defers = Number(row?.defers ?? 0);
  const held = Number(row?.held ?? 0);
  const statement = "Where a description defers to a document, we hold the document";
  if (defers === 0) {
    return {
      id: "F7",
      property: "P7",
      statement,
      threshold: THRESHOLDS.minDocumentReachability,
      measured: "unknown",
      verdict: "unknown",
      detail: "No description matched a deferral marker, so there is nothing to reach.",
    };
  }
  const ratio = held / defers;
  return {
    id: "F7",
    property: "P7",
    statement,
    threshold: THRESHOLDS.minDocumentReachability,
    measured: Number(ratio.toFixed(3)),
    verdict: ratio >= THRESHOLDS.minDocumentReachability ? "pass" : "fail",
    detail: `${held} of ${defers} document-deferring rows have a document. ` +
      `Marker list under-counts by design.`,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/server/src/fitness/floor.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Mutation-prove F6 excludes unbiddable rows**

Remove `WHERE ${NOT_BIDDABLE_SQL}` from `measureF6`'s query.

Run the **whole file**: `npx vitest run app/server/src/fitness/floor.test.ts`
Expected: the F6 test fails — the empty-description Award Notice now drags p10 to 0, and while the assertion `toBeLessThan(200)` still holds, the count in `detail` changes. **If no test fails, the F6 test is too weak** — strengthen it by asserting `r.detail` contains `over 10 biddable rows`, then repeat the mutation.

Revert and re-run to confirm 15 pass.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/fitness/floor.ts app/server/src/fitness/floor.test.ts
git commit -m "F5 to F7: decisions, the description tail, and the documents we do not hold"
```

---

## Task 4: `measureFloor()` and the binding rule

**Files:**
- Modify: `app/server/src/fitness/floor.ts`
- Test: `app/server/src/fitness/floor.test.ts`

**Interfaces:**
- Consumes: `measureF1`–`measureF7`, `THRESHOLDS_RATIFIED`.
- Produces: `interface FloorReport { predicates: PredicateResult[]; blocksAdjudication: boolean; thresholdsRatified: boolean; summary: string }`; `measureFloor(): Promise<FloorReport>`.

- [ ] **Step 1: Write the failing test**

Append to `app/server/src/fitness/floor.test.ts`:

```typescript
const { measureFloor } = await import("./floor.js");

test("measureFloor blocks adjudication when any predicate fails", async () => {
  await run(`DELETE FROM ingest_run`);
  await run(`DELETE FROM pursuit`);
  await run(`DELETE FROM solicitation`);
  await run(`DELETE FROM source`);
  const src = await source("floor lonely", "US");
  await ingested(src);

  const report = await measureFloor();
  expect(report.predicates).toHaveLength(7);
  expect(report.predicates.map((p) => p.id)).toEqual([
    "F1", "F2", "F3", "F4", "F5", "F6", "F7",
  ]);
  expect(report.blocksAdjudication).toBe(true);
  expect(report.summary).toContain("F1");
});

test("an UNKNOWN predicate blocks adjudication just as a FAIL does", async () => {
  const report = await measureFloor();
  const unknowns = report.predicates.filter((p) => p.verdict === "unknown");
  expect(unknowns.length).toBeGreaterThan(0);
  expect(report.blocksAdjudication).toBe(true);
});

test("the report says out loud that the thresholds are unratified", async () => {
  const report = await measureFloor();
  expect(report.thresholdsRatified).toBe(false);
  expect(report.summary).toContain("UNRATIFIED");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/server/src/fitness/floor.test.ts`
Expected: FAIL — `measureFloor is not a function`.

- [ ] **Step 3: Implement `measureFloor`**

Append to `app/server/src/fitness/floor.ts`, importing `THRESHOLDS_RATIFIED` alongside `THRESHOLDS`:

```typescript
export interface FloorReport {
  predicates: PredicateResult[];
  /** True while any predicate is `fail` OR `unknown`. */
  blocksAdjudication: boolean;
  thresholdsRatified: boolean;
  summary: string;
}

/* THE BINDING RULE, ruled by Matt 2026-09-03 (spec §3.1):
 *
 *   No GO / NO-GO adjudication may be taken while a floor predicate fails.
 *
 * AND `unknown` BLOCKS EXACTLY AS `fail` DOES. That is the whole point of
 * keeping the two apart everywhere else: they mean different things to a
 * reader and the same thing to the gate. "We have not measured it" is not
 * permission to proceed -- it is the §5.4 silent-failure argument applied to
 * our own paperwork.
 *
 * THE RELEASE VALVE is deliberately NOT implemented here. A predicate that
 * proves structurally unachievable is promoted into the Target by EDITING THE
 * SPEC and deleting the predicate -- a visible act with a diff -- not by a
 * runtime flag that lets a failing floor quietly stop blocking. P8 (value on
 * open notices) was promoted that way before this code existed. */
export async function measureFloor(): Promise<FloorReport> {
  const predicates = [
    await measureF1(),
    await measureF2(),
    await measureF3(),
    await measureF4(),
    await measureF5(),
    await measureF6(),
    await measureF7(),
  ];

  const blocking = predicates.filter((p) => p.verdict === "fail" || p.verdict === "unknown");
  const ratifiedNote = THRESHOLDS_RATIFIED
    ? ""
    : " Thresholds are UNRATIFIED proposals (spec §8.1), so this verdict is provisional.";

  return {
    predicates,
    blocksAdjudication: blocking.length > 0,
    thresholdsRatified: THRESHOLDS_RATIFIED,
    summary:
      blocking.length === 0
        ? `Floor holds on all ${predicates.length} predicates.${ratifiedNote}`
        : `Floor BLOCKS adjudication. Not satisfied: ` +
          `${blocking.map((p) => `${p.id} (${p.verdict})`).join(", ")}.${ratifiedNote}`,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/server/src/fitness/floor.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Mutation-prove `unknown` blocks**

Change the filter to `p.verdict === "fail"` only.

Run the **whole file**: `npx vitest run app/server/src/fitness/floor.test.ts`
Expected: exactly one failure — *"an UNKNOWN predicate blocks adjudication just as a FAIL does"*.

Revert and re-run to confirm 18 pass.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/fitness/floor.ts app/server/src/fitness/floor.test.ts
git commit -m "The floor is binding, and 'we have not measured it' is not permission to proceed"
```

---

## Task 5: Migration 018 — the three columns the registry lacks

**Files:**
- Create: `app/server/migrations/018_source_rubric.sql`
- Test: `app/server/src/db/schema.test.ts` (modify — add assertions)

**Interfaces:**
- Produces: `source.cost_posture`, `source.annual_cost_usd`, `source.field_completeness`, `source.watermark_field`.

**Why `cost_posture` and not just a nullable number.** NULL on `annual_cost_usd` would mean *free* and *unknown* at once, and this project has paid repeatedly for exactly that conflation — `health='unknown'` exists as a distinct value for the same reason. A source we have not priced is not a free source.

- [ ] **Step 1: Write the failing test**

Append to `app/server/src/db/schema.test.ts` (inside the existing suite, following its established style):

```typescript
test("018 gives the registry the rubric's three missing dimensions", async () => {
  const cols = await all<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_name = 'source'
        AND column_name IN
            ('cost_posture', 'annual_cost_usd', 'field_completeness', 'watermark_field')
      ORDER BY column_name`,
  );
  expect(cols.map((c) => c.column_name)).toEqual([
    "annual_cost_usd", "cost_posture", "field_completeness", "watermark_field",
  ]);
});

test("cost_posture keeps 'free' and 'unknown' apart, and refuses anything else", async () => {
  const id = await insert(
    `INSERT INTO source (name, cost_posture) VALUES ('cost fixture', 'unknown') RETURNING id`,
  );
  const row = await one<{ cost_posture: string }>(
    `SELECT cost_posture FROM source WHERE id = $1`, [id],
  );
  expect(row?.cost_posture).toBe("unknown");

  await expect(
    run(`INSERT INTO source (name, cost_posture) VALUES ('bad cost', 'cheap')`),
  ).rejects.toThrow();
});

test("every seeded source starts at cost_posture 'free' — none has ever cost money", async () => {
  const row = await one<{ n: string }>(
    `SELECT count(*) AS n FROM source WHERE cost_posture <> 'free' AND name <> 'cost fixture'
       AND name <> 'bad cost'`,
  );
  expect(Number(row?.n)).toBe(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/server/src/db/schema.test.ts`
Expected: FAIL — the columns do not exist.

- [ ] **Step 3: Write the migration**

Create `app/server/migrations/018_source_rubric.sql`:

```sql
-- THE REGISTRY WAS ALREADY THE RUBRIC'S DATA MODEL, minus three columns.
--
-- Six of the nine rubric dimensions score columns that have existed since SP1:
-- legal_posture (R1, a GATE not a score), archive_depth (R2), adapter_tier
-- (R3), verified_facets (R4), platform (R5) and jurisdiction (R6). This
-- migration adds the three that were never needed while every source was free
-- and every adapter was written by hand.
--
-- ⚠️ COST IS TWO COLUMNS, NOT ONE, AND THAT IS THE POINT. A nullable
-- annual_cost_usd would mean "free" and "we have not priced it" with the same
-- NULL -- the exact conflation `health = 'unknown'` exists to avoid (migration
-- 006). A source nobody has priced is not a free source, and a rubric that
-- treats it as one would rank an unpriced aggregator above a $500 API.
--
-- Every existing row defaults to 'free', which is true: SAM.gov, USASpending,
-- the state portals and the corpus imports have never cost anything. HigherGov
-- would be the first paid source in the system's history ($500/yr), and BidNet
-- Direct is recorded at $500-$2,000/yr (Matt, 2026-09-03 -- the first pricing
-- datum this project has ever held for a paid aggregator).
ALTER TABLE source ADD COLUMN cost_posture text NOT NULL DEFAULT 'free'
  CHECK (cost_posture IN ('free', 'paid', 'unknown'));

-- Whole US dollars per year. NULL is correct for 'free' and for 'unknown';
-- cost_posture is what distinguishes them.
ALTER TABLE source ADD COLUMN annual_cost_usd integer;

-- R7. Which of the spec's properties this source actually supplies, measured
-- rather than assumed: {"P6":"strong","P8":"weak","P11":"unknown", ...}.
-- jsonb rather than columns because the property list is expected to grow and
-- a migration per property would be absurd.
ALTER TABLE source ADD COLUMN field_completeness jsonb;

-- R9. The field that permits an incremental resume -- SAM's modifiedDate,
-- Indiana EDS's endDate, HigherGov's captured_date. NULL means no watermark is
-- known, which forces a full re-read every run and is a real cost.
ALTER TABLE source ADD COLUMN watermark_field text;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/server/src/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full gate**

Run: `npm run check`
Expected: exit 0. Every migration test re-runs the whole ladder, so a syntax error in 018 fails loudly here.

- [ ] **Step 6: Commit**

```bash
git add app/server/migrations/018_source_rubric.sql app/server/src/db/schema.test.ts
git commit -m "Migration 018: a source that nobody has priced is not a free source"
```

---

## Task 6: `scoreSource()` — the rubric

**Files:**
- Create: `app/server/src/fitness/rubric.ts`
- Test: `app/server/src/fitness/rubric.test.ts`

**Interfaces:**
- Consumes: nothing from the database — pure over a row shape.
- Produces: `type Grade = "strong" | "adequate" | "weak" | "unknown"`; `interface RubricSubject { ... }`; `interface SourceProfile { name, disqualified, disqualifiedReason?, dimensions: Record<string, { grade: Grade; note: string }> }`; `scoreSource(s: RubricSubject): SourceProfile`.

- [ ] **Step 1: Write the failing test**

Create `app/server/src/fitness/rubric.test.ts`:

```typescript
import { expect, test } from "vitest";
import { scoreSource, type RubricSubject } from "./rubric.js";

function subject(over: Partial<RubricSubject> = {}): RubricSubject {
  return {
    name: "fixture",
    jurisdiction: "US",
    platform: "SAM",
    adapter_tier: "1 api",
    legal_posture: "in",
    archive_depth: null,
    verified_facets: null,
    cost_posture: "free",
    annual_cost_usd: null,
    field_completeness: null,
    watermark_field: null,
    primaryGeography: ["IN"],
    secondaryGeography: ["IL", "OH", "KY"],
    ...over,
  };
}

test("legal posture 'out' disqualifies before any other dimension is computed", () => {
  const p = scoreSource(subject({ name: "GovWin IQ", legal_posture: "out" }));
  expect(p.disqualified).toBe(true);
  expect(p.disqualifiedReason).toContain("legal_posture");
  /* R1 is a GATE. Nothing else is scored -- a disqualified source must not
   * present a profile that invites comparison. */
  expect(Object.keys(p.dimensions)).toEqual(["R1"]);
});

test("'manual-only' disqualifies from automated ingestion too", () => {
  const p = scoreSource(subject({ name: "Ohio OhioBuys", legal_posture: "manual-only" }));
  expect(p.disqualified).toBe(true);
});

test("an untested archive depth is 'unknown', never 'weak'", () => {
  const p = scoreSource(subject({ archive_depth: null }));
  expect(p.dimensions.R2.grade).toBe("unknown");
});

test("an archive documented as absent is 'weak' — that IS evidence", () => {
  const p = scoreSource(
    subject({ archive_depth: "NONE. Closed solicitations are not published." }),
  );
  expect(p.dimensions.R2.grade).toBe("weak");
});

test("a full archive is 'strong'", () => {
  const p = scoreSource(subject({ archive_depth: "FULL -- 204,439 contracts back to 2005." }));
  expect(p.dimensions.R2.grade).toBe("strong");
});

test("a tier-1 API scores above hand-written HTML", () => {
  expect(scoreSource(subject({ adapter_tier: "1 api" })).dimensions.R3.grade).toBe("strong");
  expect(scoreSource(subject({ adapter_tier: "3 html" })).dimensions.R3.grade).toBe("weak");
});

test("filter honesty is unknown until vary-a-parameter has actually run", () => {
  expect(scoreSource(subject({ verified_facets: null })).dimensions.R4.grade).toBe("unknown");
  expect(
    scoreSource(subject({ verified_facets: { works: ["naics"], verified: "count moved" } }))
      .dimensions.R4.grade,
  ).toBe("strong");
});

test("a source withholding totals cannot be verified and stays unknown", () => {
  const p = scoreSource(
    subject({ verified_facets: { note: "TOTALS ARE WITHHELD, so the check CANNOT RUN here." } }),
  );
  expect(p.dimensions.R4.grade).toBe("unknown");
});

test("primary geography outranks secondary, and outside the profile is weak", () => {
  expect(scoreSource(subject({ jurisdiction: "IN" })).dimensions.R6.grade).toBe("strong");
  expect(scoreSource(subject({ jurisdiction: "IL" })).dimensions.R6.grade).toBe("adequate");
  expect(scoreSource(subject({ jurisdiction: "MI" })).dimensions.R6.grade).toBe("weak");
});

test("cost 'unknown' is not graded as free", () => {
  expect(scoreSource(subject({ cost_posture: "free" })).dimensions.R8.grade).toBe("strong");
  expect(scoreSource(subject({ cost_posture: "unknown" })).dimensions.R8.grade).toBe("unknown");
  expect(
    scoreSource(subject({ cost_posture: "paid", annual_cost_usd: 500 })).dimensions.R8.grade,
  ).toBe("adequate");
});

test("no dimension produces a single aggregate score", () => {
  const p = scoreSource(subject());
  expect(p).not.toHaveProperty("score");
  expect(p).not.toHaveProperty("total");
  expect(p).not.toHaveProperty("rank");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/server/src/fitness/rubric.test.ts`
Expected: FAIL — `Cannot find module './rubric.js'`

- [ ] **Step 3: Implement the rubric**

Create `app/server/src/fitness/rubric.ts`:

```typescript
/* THE RUBRIC SCORES SOURCES. IT NEVER SCORES OPPORTUNITIES.
 *
 * Spec §5.1, and it is the constraint most likely to erode. Every dimension
 * below takes a SOURCE as its subject. A dimension whose sentence reads
 * naturally with a solicitation as its subject belongs to the qualification
 * design, which ruling 1A keeps parked and design spec §7.10 clause 2 guards.
 *
 * ⚠️ THERE IS DELIBERATELY NO AGGREGATE SCORE. A single number would let a
 * strong archive silently compensate for a failing legal posture, and would
 * make this file look like the scorer it must not become. R1 is a gate; the
 * rest is a PROFILE that a person reads. The last test in rubric.test.ts
 * asserts the absence, so adding a total breaks the suite on purpose.
 *
 * PURE OVER A ROW, no database. That keeps the §5.4 acceptance test a fast
 * unit test with hand-written rows -- and that test has to stay trivially
 * re-runnable, because it is the only thing proving the rubric reproduces
 * judgements already made. */

export type Grade = "strong" | "adequate" | "weak" | "unknown";

export interface RubricSubject {
  name: string;
  jurisdiction: string | null;
  platform: string | null;
  adapter_tier: string | null;
  legal_posture: string;
  archive_depth: string | null;
  verified_facets: Record<string, unknown> | null;
  cost_posture: string;
  annual_cost_usd: number | null;
  field_completeness: Record<string, string> | null;
  watermark_field: string | null;
  /** From firm_profile.geography — never constant-folded. */
  primaryGeography: string[];
  secondaryGeography: string[];
}

export interface SourceProfile {
  name: string;
  disqualified: boolean;
  disqualifiedReason?: string;
  dimensions: Record<string, { grade: Grade; note: string }>;
}

/* An archive_depth string is prose written by a researcher, not an enum. These
 * markers are matched against what the seed ACTUALLY contains -- "NONE.",
 * "FULL --", "DEEP --", "Assume none", "Unknown --". Anything unmatched is
 * `unknown`, which is the safe direction: a depth nobody can parse has not
 * been established. */
function gradeArchive(depth: string | null): { grade: Grade; note: string } {
  if (depth === null) {
    return { grade: "unknown", note: "archive_depth is null — never established." };
  }
  const d = depth.toLowerCase();
  if (d.startsWith("none") || d.startsWith("assume none")) {
    return { grade: "weak", note: "Documented as retaining nothing. That is evidence, not absence of it." };
  }
  if (d.startsWith("unknown")) {
    return { grade: "unknown", note: "Recorded as untestable." };
  }
  if (d.startsWith("full") || d.startsWith("deep")) {
    return { grade: "strong", note: depth };
  }
  return { grade: "adequate", note: depth };
}

function gradeTier(tier: string | null): { grade: Grade; note: string } {
  if (tier === null) return { grade: "unknown", note: "No adapter tier recorded." };
  if (tier.startsWith("1")) return { grade: "strong", note: "API — cheapest to build and to keep working." };
  if (tier.startsWith("2")) return { grade: "adequate", note: "Email or RSS subscription." };
  if (tier.startsWith("3")) return { grade: "weak", note: "HTML scraping — breaks on redesign." };
  return { grade: "weak", note: "Manual only — cannot be scheduled." };
}

/* §5.4. A source that WITHHOLDS totals cannot be checked at all, and recording
 * that as a failure would be wrong -- Michigan is not dishonest, it is
 * unmeasurable. Unknown is the honest grade and the registry note says why. */
function gradeFacets(f: Record<string, unknown> | null): { grade: Grade; note: string } {
  if (f === null) return { grade: "unknown", note: "vary-a-parameter has never been run." };
  const blob = JSON.stringify(f).toLowerCase();
  if (blob.includes("cannot run") || blob.includes("withheld")) {
    return { grade: "unknown", note: "Totals withheld — the check cannot run here." };
  }
  if (typeof (f as { verified?: unknown }).verified === "string") {
    return { grade: "strong", note: "Filters verified to move a count." };
  }
  if (Array.isArray((f as { silently_ignored?: unknown }).silently_ignored)) {
    const n = ((f as { silently_ignored: unknown[] }).silently_ignored).length;
    return n > 0
      ? { grade: "adequate", note: `${n} parameter(s) accepted and silently ignored — known and worked around.` }
      : { grade: "strong", note: "No silently-ignored parameters found." };
  }
  return { grade: "adequate", note: "Facets recorded but no verification statement." };
}

function gradeGeography(
  j: string | null,
  primary: string[],
  secondary: string[],
): { grade: Grade; note: string } {
  if (j === null) return { grade: "unknown", note: "No jurisdiction recorded." };
  if (j === "US") return { grade: "adequate", note: "Federal — in profile, but not the primary ground." };
  if (primary.includes(j)) return { grade: "strong", note: `${j} is the Profile's primary geography.` };
  if (secondary.includes(j)) return { grade: "adequate", note: `${j} is secondary geography.` };
  return { grade: "weak", note: `${j} is outside the Profile's geography.` };
}

function gradeCost(posture: string, usd: number | null): { grade: Grade; note: string } {
  if (posture === "free") return { grade: "strong", note: "No recurring cost." };
  if (posture === "unknown") {
    return { grade: "unknown", note: "Never priced. An unpriced source is not a free one." };
  }
  return {
    grade: "adequate",
    note: usd === null ? "Paid, amount not recorded." : `$${usd}/yr.`,
  };
}

export function scoreSource(s: RubricSubject): SourceProfile {
  /* R1 IS A GATE. It runs first and returns first. A disqualified source must
   * not present a full profile -- a profile invites comparison, and there is
   * nothing to compare when the source may not be contacted at all. */
  const r1: { grade: Grade; note: string } =
    s.legal_posture === "in"
      ? { grade: "strong", note: "Posture `in` — adapters may run on a schedule." }
      : {
          grade: "weak",
          note: `Posture \`${s.legal_posture}\` — no automated access. §5.5.1: documented permission moves it.`,
        };

  if (s.legal_posture !== "in") {
    return {
      name: s.name,
      disqualified: true,
      disqualifiedReason: `legal_posture=${s.legal_posture}`,
      dimensions: { R1: r1 },
    };
  }

  return {
    name: s.name,
    disqualified: false,
    dimensions: {
      R1: r1,
      R2: gradeArchive(s.archive_depth),
      R3: gradeTier(s.adapter_tier),
      R4: gradeFacets(s.verified_facets),
      R5: s.platform === null
        ? { grade: "unknown", note: "No platform recorded — leverage unassessable." }
        : { grade: "adequate", note: `Platform ${s.platform}. §5.7: one adapter may reach other states.` },
      R6: gradeGeography(s.jurisdiction, s.primaryGeography, s.secondaryGeography),
      R7: s.field_completeness === null
        ? { grade: "unknown", note: "Field completeness never measured." }
        : { grade: "adequate", note: JSON.stringify(s.field_completeness) },
      R8: gradeCost(s.cost_posture, s.annual_cost_usd),
      R9: s.watermark_field === null
        ? { grade: "unknown", note: "No watermark known — a run may have to re-read everything." }
        : { grade: "strong", note: `Incremental on \`${s.watermark_field}\`.` },
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/server/src/fitness/rubric.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Mutation-prove the R1 gate short-circuits**

In `scoreSource`, delete the early `return` block for `s.legal_posture !== "in"` so a disqualified source falls through to the full profile.

Run the **whole file**: `npx vitest run app/server/src/fitness/rubric.test.ts`
Expected: two failures — the `Object.keys(p.dimensions)` assertion in the first test, and `disqualified` in the second.

Revert and re-run to confirm 11 pass.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/fitness/rubric.ts app/server/src/fitness/rubric.test.ts
git commit -m "The rubric scores sources, never opportunities, and refuses to produce one number"
```

---

## Task 7: The acceptance test — does the rubric reproduce judgements already made?

**Files:**
- Modify: `app/server/src/fitness/rubric.test.ts`

**Interfaces:**
- Consumes: `scoreSource`, `RubricSubject` from Task 6.
- Produces: nothing new — this task is the calibration proof.

**Why this is its own task.** Spec §5.4: *"the rubric is calibrated only if, run cold, it reproduces judgements already made."* A reviewer could reasonably approve Task 6's dimensions and reject this — if the rubric grades IDOA solicitations as acceptable, the dimensions are wrong even though every unit test passes.

- [ ] **Step 1: Write the failing test**

Append to `app/server/src/fitness/rubric.test.ts`:

```typescript
/* THE ACCEPTANCE TEST (spec §5.4). These four rows are copied from
 * 003_seed_source_registry.sql, abbreviated only where the prose is long.
 * The rubric has to reach the conclusions Matt already reached by hand -- and
 * the IDOA one cost a whole adapter slice to learn (673 tests, unmerged). */

const GEO = { primaryGeography: ["IN"], secondaryGeography: ["IL", "OH", "KY"] };

test("ACCEPTANCE: it rejects Indiana IDOA solicitations, as Matt did on 2026-09-02", () => {
  const p = scoreSource({
    name: "Indiana IDOA solicitations",
    jurisdiction: "IN",
    platform: "IDOA static list",
    adapter_tier: "3 html",
    legal_posture: "in",
    archive_depth:
      "NONE. Closed solicitations are not published -- Indiana cannot be backtested on the solicitation side.",
    verified_facets: { note: "Plain HTML table. No RSS, API or bulk download." },
    cost_posture: "free",
    annual_cost_usd: null,
    field_completeness: null,
    watermark_field: null,
    ...GEO,
  });

  expect(p.disqualified).toBe(false);
  /* Strong on geography and cost, and that is exactly the trap: a weighted
   * total would have let those carry it. The two dimensions that decide are
   * the archive and the adapter cost, and both must read weak. */
  expect(p.dimensions.R2.grade).toBe("weak");
  expect(p.dimensions.R3.grade).toBe("weak");
  expect(p.dimensions.R9.grade).toBe("unknown");
});

test("ACCEPTANCE: it ranks the Indiana EDS contract register highly", () => {
  const p = scoreSource({
    name: "Indiana EDS contract register",
    jurisdiction: "IN",
    platform: "IDOA contract search",
    adapter_tier: "1 api",
    legal_posture: "in",
    archive_depth: "FULL -- 204,439 contracts back to 2005.",
    verified_facets: {
      works: ["businessUnit", "endDate", "pageSize", "sort=-modifiedDate"],
      silently_ignored: ["sort=-publishDate"],
    },
    cost_posture: "free",
    annual_cost_usd: null,
    field_completeness: null,
    watermark_field: "modifiedDate",
    ...GEO,
  });

  expect(p.disqualified).toBe(false);
  expect(p.dimensions.R2.grade).toBe("strong");
  expect(p.dimensions.R3.grade).toBe("strong");
  expect(p.dimensions.R6.grade).toBe("strong");
  expect(p.dimensions.R9.grade).toBe("strong");
});

test("ACCEPTANCE: the three paid aggregators fail on R1 alone, reaching no other dimension", () => {
  for (const name of ["GovWin IQ", "BidNet Direct", "BidPrime"]) {
    const p = scoreSource({
      name,
      jurisdiction: "US",
      platform: "Aggregator",
      adapter_tier: "4 manual",
      legal_posture: "out",
      archive_depth: null,
      verified_facets: null,
      cost_posture: "unknown",
      annual_cost_usd: null,
      field_completeness: null,
      watermark_field: null,
      ...GEO,
    });
    expect(p.disqualified).toBe(true);
    expect(Object.keys(p.dimensions)).toEqual(["R1"]);
  }
});

test("ACCEPTANCE: the EDS register out-profiles IDOA solicitations on the deciding dimensions", () => {
  /* Stated as a comparison because that is what a rubric is FOR, and stated
   * dimension-by-dimension because there is no total to compare. */
  const order: Record<string, number> = { strong: 3, adequate: 2, weak: 1, unknown: 0 };
  const idoa = scoreSource({
    name: "Indiana IDOA solicitations", jurisdiction: "IN", platform: "IDOA static list",
    adapter_tier: "3 html", legal_posture: "in",
    archive_depth: "NONE. Closed solicitations are not published.",
    verified_facets: null, cost_posture: "free", annual_cost_usd: null,
    field_completeness: null, watermark_field: null, ...GEO,
  });
  const eds = scoreSource({
    name: "Indiana EDS contract register", jurisdiction: "IN", platform: "IDOA contract search",
    adapter_tier: "1 api", legal_posture: "in",
    archive_depth: "FULL -- 204,439 contracts back to 2005.",
    verified_facets: { works: ["endDate"], silently_ignored: [] },
    cost_posture: "free", annual_cost_usd: null, field_completeness: null,
    watermark_field: "modifiedDate", ...GEO,
  });

  for (const dim of ["R2", "R3", "R9"]) {
    expect(order[eds.dimensions[dim].grade]).toBeGreaterThan(order[idoa.dimensions[dim].grade]);
  }
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run app/server/src/fitness/rubric.test.ts`
Expected: PASS, 15 tests. **If any acceptance test fails, the dimensions in Task 6 are wrong — fix `rubric.ts`, not the test.** That is what "calibrated" means here.

- [ ] **Step 3: Mutation-prove the acceptance test would catch a mis-graded archive**

In `gradeArchive`, change the `none`/`assume none` branch to return `adequate`.

Run the **whole file**: `npx vitest run app/server/src/fitness/rubric.test.ts`
Expected: at least three failures, including *"ACCEPTANCE: it rejects Indiana IDOA solicitations"*.

Revert and re-run to confirm 15 pass.

- [ ] **Step 4: Commit**

```bash
git add app/server/src/fitness/rubric.test.ts
git commit -m "The acceptance test: a rubric that cannot reproduce the IDOA red flag is not calibrated"
```

---

## Task 8: The CLI

**Files:**
- Create: `app/server/src/fitness/fitness-cli.ts`
- Modify: `package.json`
- Test: `app/server/src/fitness/fitness-cli.test.ts`

**Interfaces:**
- Consumes: `measureFloor` from `./floor.js`; `scoreSource`, `RubricSubject`, `SourceProfile` from `./rubric.js`.
- Produces: `loadSubjects(): Promise<RubricSubject[]>`, `main(): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `app/server/src/fitness/fitness-cli.test.ts`:

```typescript
import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_fitness_cli");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close } = await import("../db/index.js");
const { loadSubjects } = await import("./fitness-cli.js");

beforeAll(async () => {
  await migrate(false);
}, 120000);
afterAll(async () => {
  await close();
});

test("loadSubjects returns every seeded source, carrying the Profile's geography", async () => {
  const subjects = await loadSubjects();
  expect(subjects.length).toBeGreaterThanOrEqual(11);

  const govwin = subjects.find((s) => s.name === "GovWin IQ");
  expect(govwin?.legal_posture).toBe("out");

  /* The geography is attached from firm_profile, once, rather than each
   * dimension re-reading it. If this is empty, every R6 grade below is wrong. */
  expect(govwin?.primaryGeography).toEqual(["IN"]);
  expect(govwin?.secondaryGeography).toContain("IL");
});

test("every seeded source loads as cost_posture 'free'", async () => {
  const subjects = await loadSubjects();
  expect(subjects.every((s) => s.cost_posture === "free")).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/server/src/fitness/fitness-cli.test.ts`
Expected: FAIL — `Cannot find module './fitness-cli.js'`

- [ ] **Step 3: Implement the CLI**

Create `app/server/src/fitness/fitness-cli.ts`:

```typescript
/* Thin CLI over floor.ts and rubric.ts. Mirrors merge/merge-cli.ts's shape
 * exactly: same pathToFileURL entry guard, same catch/close handling, same
 * pool closing on both paths. No measurement logic lives here.
 *
 * WHY A CLI AND NOT A ROUTE: ruling 3A forbids new UI slices, and the Status
 * Dashboard is parked (docs/Pinned-Status-Dashboard.md). A report a person
 * runs is the whole delivery -- and merge-cli.ts's own header records why that
 * matters: a criterion nobody can perform is not demonstrated by green tests. */
import { pathToFileURL } from "node:url";
import { all, one } from "../db/index.js";
import { measureFloor } from "./floor.js";
import { scoreSource, type RubricSubject, type SourceProfile } from "./rubric.js";

export async function loadSubjects(): Promise<RubricSubject[]> {
  /* Read once, attach to every subject. Having each dimension re-read the
   * Profile would make scoreSource impure and untestable without a database. */
  const profile = await one<{ geography: { primary?: string[]; secondary?: string[] } | null }>(
    `SELECT geography FROM firm_profile
       JOIN vendor ON vendor.id = firm_profile.vendor_id
      WHERE vendor.is_self LIMIT 1`,
  );
  const primaryGeography = profile?.geography?.primary ?? [];
  const secondaryGeography = profile?.geography?.secondary ?? [];

  const rows = await all<Omit<RubricSubject, "primaryGeography" | "secondaryGeography">>(
    `SELECT name, jurisdiction, platform, adapter_tier, legal_posture,
            archive_depth, verified_facets, cost_posture, annual_cost_usd,
            field_completeness, watermark_field
       FROM source
      ORDER BY name`,
  );

  return rows.map((r) => ({ ...r, primaryGeography, secondaryGeography }));
}

function renderProfile(p: SourceProfile): string {
  if (p.disqualified) {
    return `  ${p.name}\n    DISQUALIFIED — ${p.disqualifiedReason}\n      R1  ${p.dimensions.R1.note}`;
  }
  const lines = Object.entries(p.dimensions)
    .map(([id, d]) => `      ${id}  ${d.grade.toUpperCase().padEnd(9)} ${d.note}`)
    .join("\n");
  return `  ${p.name}\n${lines}`;
}

export async function main(): Promise<void> {
  const floor = await measureFloor();

  console.log("THE FLOOR\n");
  for (const p of floor.predicates) {
    console.log(
      `  ${p.id}  ${p.verdict.toUpperCase().padEnd(9)} ${p.statement}\n` +
        `        threshold ${p.threshold} · measured ${p.measured}` +
        (p.detail ? `\n        ${p.detail}` : ""),
    );
  }
  console.log(`\n  ${floor.summary}\n`);

  const subjects = await loadSubjects();
  console.log("\nTHE SOURCE PROFILES\n");
  for (const s of subjects) {
    console.log(renderProfile(scoreSource(s)));
    console.log("");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { close } = await import("../db/index.js");
  main()
    .then(() => close())
    .catch(async (e) => {
      console.error(e.message);
      await close();
      process.exit(1);
    });
}
```

- [ ] **Step 4: Add the npm script**

In `package.json`, add to `"scripts"`, after `"merge"`:

```json
    "fitness": "tsx --env-file-if-exists=.env app/server/src/fitness/fitness-cli.ts"
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run app/server/src/fitness/fitness-cli.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Run the full gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 7: Run it for real against the test branch**

Run: `npm run fitness`
Expected: a floor report of 7 predicates and a profile per source. **Read the output.** A green test suite has passed in this project with both buttons broken; the point of this step is to look at what a person actually sees.

- [ ] **Step 8: Commit**

```bash
git add app/server/src/fitness/fitness-cli.ts app/server/src/fitness/fitness-cli.test.ts package.json
git commit -m "npm run fitness: the floor and the profiles, as a report a person runs"
```

---

## Task 9: Pass 1 — the assessment, and the probe list it produces

**Files:**
- Create: `docs/2026-09-03-source-assessments.md`
- Modify: `app/server/migrations/018_source_rubric.sql` — **no.** Findings land via a data update, not a migration. See Step 3.

**Interfaces:**
- Consumes: `npm run fitness` from Task 8.
- Produces: the pass-1 record and the pass-2 probe list.

**This task is a measurement, not a feature.** Its deliverable is a document and a set of `source_note` updates. Spec §6: *expect this pass to return mostly `unknown`, and treat that as the finding.*

- [ ] **Step 1: Run the report against production, read-only**

```bash
DATABASE_URL="$DATABASE_URL_PRODUCTION" npm run fitness > /tmp/fitness-production.txt
```

**This is a read-only command** — `floor.ts` and `rubric.ts` contain no writes. Confirm that before running: `grep -nE "INSERT|UPDATE|DELETE|ALTER" app/server/src/fitness/*.ts` must return nothing.

- [ ] **Step 2: Write the assessment document**

Create `docs/2026-09-03-source-assessments.md` containing:

- The floor report, verbatim, with the date and the row counts it was measured against.
- One section per source: the profile, and **for every `unknown`, what would resolve it**.
- A closing **probe list** — every `unknown` that a probe could close, ordered by cost, with the two standing constraints stated: R1 first (no probe is constructed for an `out` or `manual-only` row), and scraping runs locally against the `test` branch.

- [ ] **Step 3: Record the findings on the rows, not only in the document**

Spec §6: *a decision nobody wrote down is indistinguishable from one nobody made.* For each source where pass 1 established something the registry did not already hold, write it back:

```bash
# Example only — the real values come from Step 1's output.
# Run against the TEST branch first, read the result, then production deliberately.
psql "$DATABASE_URL" -c "UPDATE source SET watermark_field = 'modifiedDate' WHERE name = 'SAM.gov'"
```

**Do not batch these blind.** Each update is a claim; write the ones pass 1 actually established and leave the rest `NULL`, because `NULL` is the honest value for something nobody measured.

- [ ] **Step 4: Commit**

```bash
git add docs/2026-09-03-source-assessments.md
git commit -m "Pass 1: what the registry actually knows, and the eleven things it does not"
```

---

## Self-Review

**1. Spec coverage.**

| Spec section | Task |
|---|---|
| §2 property list P1–P15 | P1→F1 (T1), P2→F2 (T1), P4→F4 (T2), P5→F3 (T2), P6→F6 (T3), P7→F7 (T3), P9→F5 (T3). **P3, P10–P14 are scored by the rubric** (T6: R2, R5, R7, R9). **P8 and P15 are Target-only by §3.1's valve and §4 — deliberately unimplemented.** |
| §3.1 binding rule + valve | T4 (`blocksAdjudication`; the valve is a spec edit, not a runtime flag — documented in `measureFloor`'s comment) |
| §3.2 predicates F1–F7 | T1, T2, T3 |
| §4 Target | Not code. It is the spec's own section and needs no task. |
| §5.1 scope guard | T6 — the "no aggregate score" test asserts it structurally |
| §5.2 R1–R9 | T5 (columns R7/R8/R9), T6 (all nine graded) |
| §5.3 ordinal, `unknown` first-class | T6 |
| §5.4 acceptance test | T7 |
| §6 two-pass procedure | T9 (pass 1 + the probe list that defines pass 2) |
| §8 open questions | Carried, not resolved: §8.1 thresholds → `THRESHOLDS_RATIFIED` flag (T1); §8.2 window → named in `measureF4`'s comment (T2); §8.4 columns → T5. |

**Gap found and accepted:** §8.3 (does a failing floor block the contract work?) has no task because it is a ruling, not code. Matt accepted the spec's reading — floor blocks the GO/NO-GO only — on 2026-09-03.

**2. Placeholder scan.** No `TBD`, no "add error handling", no "similar to Task N". Every code step carries the code. Task 9's Step 3 shows an example command and explicitly says the real values come from Step 1 — that is a data-entry step, not a placeholder.

**3. Type consistency.** `PredicateResult` is defined in T1 and used unchanged in T2, T3, T4. `Verdict` and `Grade` are separate types on purpose — the floor's `marginal` has no rubric equivalent, and the rubric's `adequate` has no floor equivalent. `RubricSubject` is defined in T6 and consumed in T7 and T8; `loadSubjects` returns exactly it. `measureF1`–`measureF7` are named consistently and aggregated in `measureFloor`. `THRESHOLDS` and `THRESHOLDS_RATIFIED` are both exported from `thresholds.ts` and both imported in `floor.ts`.

**One inconsistency fixed inline:** Task 3's F6 mutation step originally asserted a failure the test could not detect. It now says so, and tells the implementer to strengthen the assertion first if nothing fails — because a mutation that proves nothing is worse than no mutation, and this project has already logged a review that confirmed code existed without asking whether a test covered it.
