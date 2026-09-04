# Indiana EDS Contract Register Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load ~204,991 Indiana awarded contracts into the `contract` table — the first row it will ever hold — clearing floor predicates F1 and F2.

**Architecture:** A standalone module under `app/server/src/contracts/`, writing **direct to `contract`**. It deliberately does **not** use the `Adapter` interface, add a `SourceShape`, register in `adapters/registry.ts`, or produce an artifact — those all feed `sighting`, and §2 of the spec makes "a contract cannot reach the triage queue" a structural property rather than a filter. The fetcher splits date windows recursively and **asserts completeness against `totalResults`**, because the API's `page` parameter is silently ignored.

**Tech Stack:** TypeScript ESM (`.js` import specifiers), Postgres via `pg`, vitest with schema-per-file isolation, `tsx` for the CLI.

**Spec:** [`docs/superpowers/specs/2026-09-03-indiana-contract-register-design.md`](../specs/2026-09-03-indiana-contract-register-design.md)

## Global Constraints

- **`page` IS SILENTLY IGNORED.** Pages 1, 2 and 100 return identical record sets. **Never paginate with it.** Completeness comes from comparing `totalResults` to `results.length`.
- **`value_cents` stays NULL.** Ruled by Matt 2026-09-03. `amount` lands in `amount_cents` as the per-row delta the source states. Writing a derived sum into `value_cents` is the provenance error `extracted_field.origin` exists to prevent.
- **Nothing scores, nothing filters, no control is wired.** Ruling 1A; design spec §7.10 clause 2.
- **No new UI.** Ruling 3A. The deliverable is a CLI.
- **Contracts must never reach the triage queue.** Nothing in this module may touch `solicitation`, `sighting` or `pursuit`.
- **Scraping runs LOCALLY** (Matt, 2026-09-03), against the `test` branch. Production is a separate deliberate act.
- **Politeness:** concurrency 1, a fixed delay between requests, a plain identifying `User-Agent`, and **stop on the first non-2xx** rather than retrying into a rate limiter.
- **`npm run check` must exit 0** before any task is complete.
- **Mutation-prove the important tests** — break the thing the test covers, confirm exactly the expected tests fail, and run the whole file.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/server/migrations/023_contract_ingest.sql` | **Create.** `source_id`, `amendment`, `action_type`, `amount_cents`, and the unique natural key. |
| `app/server/src/contracts/windows.ts` | **Create.** Window splitting. **PURE — no network, no database.** This is where the lesson lives, so it must be testable with a fake. |
| `app/server/src/contracts/windows.test.ts` | **Create.** Including the completeness-assertion test. |
| `app/server/src/contracts/eds-client.ts` | **Create.** One HTTP call. Politeness settings live here. |
| `app/server/src/contracts/eds-client.test.ts` | **Create.** Against a committed fixture; never the network. |
| `app/server/src/contracts/fixtures/eds-window.json` | **Create.** One real window's response. |
| `app/server/src/contracts/import.ts` | **Create.** Row mapping and the idempotent write. |
| `app/server/src/contracts/import.test.ts` | **Create.** Idempotency, the natural key, and the queue guard. |
| `app/server/src/contracts/ingest.ts` | **Create.** Orchestration: windows → client → import → `ingest_run`. |
| `app/server/src/contracts/ingest.test.ts` | **Create.** With a fake client. |
| `app/server/src/contracts/contracts-cli.ts` | **Create.** Thin CLI, mirroring `merge/merge-cli.ts`. |
| `package.json` | **Modify.** Add `contracts:ingest`. |
| `app/server/migrations/024_eds_page_ignored.sql` | **Create (Task 9).** Record `page` in the registry's `silently_ignored`. |

**Why `windows.ts` is pure and separate.** The completeness assertion is the one piece of logic that, if wrong, makes the whole ingest silently incomplete. Keeping it free of network and database means its tests are fast, deterministic, and can simulate a truncated response — which is impossible against a live API that never truncates on demand.

---

## Task 1: Settle what `startDate` and `endDate` actually filter on

**Files:**
- Create: `docs/2026-09-03-eds-window-semantics.md`

**Interfaces:**
- Produces: a documented answer that Task 3 depends on. **No code.**

**This task is a MEASUREMENT, not a feature**, and the spec makes it blocking: *"Do not write the loop until this is measured."* We proved these parameters move the count; we did not establish what they mean. A contract running 2019→2021 might land in either window, both, or neither — and the window arithmetic in Task 3 is different for each answer.

- [ ] **Step 1: Find a contract that spans a year boundary**

```bash
cd "C:/Users/matts/Desktop/Tenderfoot"
node --input-type=module -e '
const U="https://secure.in.gov/apps/idoa/contractsearch/api/contracts/search";
const H={"content-type":"application/json",accept:"application/json",
  "user-agent":"Tenderfoot/0.1 (Koehler Partners; procurement research)"};
const r=await(await fetch(U,{method:"POST",headers:H,
  body:JSON.stringify({page:1,pageSize:2000})})).json();
const span=r.results.filter(x=>String(x.startDate).slice(0,4)!==String(x.endDate).slice(0,4));
console.log("cross-year contracts in sample: "+span.length);
for(const c of span.slice(0,3))
  console.log("  "+c.id+"  "+String(c.startDate).slice(0,10)+" -> "+String(c.endDate).slice(0,10));
'
```

Record one id and its two dates. Call them `SPAN_ID`, `SPAN_START` (year `Y1`), `SPAN_END` (year `Y2`).

- [ ] **Step 2: Ask which windows return it**

Run four queries, each `pageSize: 25000`, and check whether `SPAN_ID` appears in `results`:

| Query | If it contains `SPAN_ID` |
|---|---|
| `{startDate: "Y1-01-01", endDate: "Y1-12-31"}` | the start year claims it |
| `{startDate: "Y2-01-01", endDate: "Y2-12-31"}` | the end year claims it |
| both | **windows OVERLAP** — dedup carries the weight |
| neither | 🔴 **windows GAP** — the design in Task 3 does not work as written |

- [ ] **Step 3: Confirm the totals reconcile**

Sum `totalResults` for windows `2004-01-01..2004-12-31` through `2027-01-01..2027-12-31`, one request each, 800ms apart. Compare to **204,991**.

- Equal → windows tile the register exactly.
- Greater → overlap. Fine; the unique key absorbs it.
- **Less → a gap, and Task 3 must key on a different field.** Stop and report.

- [ ] **Step 4: Write the findings**

Create `docs/2026-09-03-eds-window-semantics.md` recording: which window(s) claimed the cross-year contract, the per-year totals, their sum against 204,991, and **the resulting rule for Task 3** in one sentence.

- [ ] **Step 5: Commit**

```bash
git add docs/2026-09-03-eds-window-semantics.md
git commit -m "What the EDS date filters actually filter on"
```

---

## Task 2: Migration 023 — the columns `contract` is missing

**Files:**
- Create: `app/server/migrations/023_contract_ingest.sql`
- Test: `app/server/src/db/schema.test.ts` (modify — append)

**Interfaces:**
- Produces: `contract.source_id`, `contract.amendment`, `contract.action_type`, `contract.amount_cents`, and a unique index named `contract_natural_key`.

- [ ] **Step 1: Write the failing test**

Append to `app/server/src/db/schema.test.ts`, **before** the `resetSchema` test at the end of the file (that test drops the schema, so anything after it runs against nothing):

```typescript
test("023 gives contract the columns an ingest needs", async () => {
  const cols = (
    await all<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'contract'
          AND column_name IN ('source_id','amendment','action_type','amount_cents')
        ORDER BY column_name`,
      [SCHEMA],
    )
  ).map((c) => c.column_name);
  expect(cols).toEqual(["action_type", "amendment", "amount_cents", "source_id"]);
});

/* The contract id is NOT unique: A337-6-CWI-104 appears as amendment 0 (New,
 * $40,000) and amendment 1 (Amendment, $70,000). Keying on external_id alone
 * would collapse a contract's history into one row -- the same class of error
 * as the external_id fusion fixed in migration 022. */
test("023's natural key is (source_id, external_id, amendment)", async () => {
  const src = await insert(`INSERT INTO source (name) VALUES ('023 fixture') RETURNING id`);

  const a = await insert(
    `INSERT INTO contract (source_id, external_id, amendment, amount_cents)
     VALUES ($1, 'A337-6-CWI-104', 0, 4000000) RETURNING id`, [src],
  );
  /* Same contract, different amendment -> a SECOND row, not a conflict. */
  const b = await insert(
    `INSERT INTO contract (source_id, external_id, amendment, amount_cents)
     VALUES ($1, 'A337-6-CWI-104', 1, 7000000) RETURNING id`, [src],
  );
  expect(a).not.toBe(b);

  /* The same amendment twice IS a conflict -- that is what makes a re-run
   * idempotent instead of duplicating. */
  await expect(
    dbRun(
      `INSERT INTO contract (source_id, external_id, amendment, amount_cents)
       VALUES ($1, 'A337-6-CWI-104', 0, 4000000)`, [src],
    ),
  ).rejects.toThrow();

  await dbRun(`DELETE FROM contract WHERE source_id = $1`, [src]);
  await dbRun(`DELETE FROM source WHERE id = $1`, [src]);
});

/* value_cents is the column that will one day hold PUBLISHED figures from
 * HigherGov's /sl-contract/. amount_cents holds what THIS source states, which
 * is a per-amendment delta and not a contract value. Keeping them apart is the
 * whole reason there are two columns. */
test("023 leaves value_cents alone -- it is not where the delta goes", async () => {
  const col = await one<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'contract' AND column_name = 'value_cents'`,
    [SCHEMA],
  );
  expect(col?.column_name).toBe("value_cents");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/db/schema.test.ts`
Expected: FAIL — the columns do not exist.

- [ ] **Step 3: Write the migration**

Create `app/server/migrations/023_contract_ingest.sql`:

```sql
-- The `contract` table has existed since migration 002 and has never held a
-- row. Loading the Indiana EDS register needs four columns it does not have.
--
-- Design: docs/superpowers/specs/2026-09-03-indiana-contract-register-design.md

-- `contract` has NO source column at all -- a row today cannot say where it
-- came from. Every other ingested table carries one.
ALTER TABLE contract ADD COLUMN source_id integer REFERENCES source(id);

-- THE CONTRACT ID IS NOT UNIQUE. Measured 2026-09-03: A337-6-CWI-104 appears
-- as amendment 0 (New, $40,000) and amendment 1 (Amendment, $70,000). The
-- amendment number is half the identity.
ALTER TABLE contract ADD COLUMN amendment integer;

-- New | Amendment | Renewal | Unknown. ⚠️ 1,583 of 2,000 sampled rows are
-- "Unknown" -- that is a real property of the source, not a parse failure, and
-- anything treating action_type as reliable needs to know it.
ALTER TABLE contract ADD COLUMN action_type text;

-- ⚠️ THIS IS NOT value_cents, AND THE DISTINCTION IS THE POINT.
--
-- `amount` is EDS form field 6: a per-amendment DELTA. The running total is
-- field 7 and exists only inside the PDF, so no single row carries a contract's
-- value. Summing deltas per contract id is well-supported -- an amendment
-- adding $0 while extending an end date is a no-cost time extension, which only
-- makes sense as a delta -- but NOT verified.
--
-- value_cents will one day hold PUBLISHED figures from HigherGov's
-- /sl-contract/. Writing a derived sum into it beside sourced facts is the
-- provenance error extracted_field.origin and precedence.ts exist to prevent.
-- Ruled by Matt 2026-09-03: value_cents stays NULL.
ALTER TABLE contract ADD COLUMN amount_cents bigint;

-- What makes a re-run idempotent rather than duplicating. Partial, because
-- rows predating this ingest (there are none today) would have NULLs.
CREATE UNIQUE INDEX contract_natural_key
  ON contract (source_id, external_id, amendment)
  WHERE source_id IS NOT NULL AND external_id IS NOT NULL AND amendment IS NOT NULL;

CREATE INDEX contract_ends_at ON contract (ends_at);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Mutation-prove the natural key**

Change the unique index to `ON contract (source_id, external_id)` — dropping `amendment`.

Run the **whole file**. Expected: *"023's natural key is (source_id, external_id, amendment)"* fails, because inserting amendment 1 now conflicts with amendment 0.

Revert and re-run.

- [ ] **Step 6: Commit**

```bash
git add app/server/migrations/023_contract_ingest.sql app/server/src/db/schema.test.ts
git commit -m "Migration 023: a contract id is not unique, and amount is not a value"
```

---

## Task 3: `windows.ts` — splitting, and the assertion that makes it safe

**Files:**
- Create: `app/server/src/contracts/windows.ts`
- Test: `app/server/src/contracts/windows.test.ts`

**Interfaces:**
- Consumes: nothing. **Pure — no network, no database.**
- Produces:
  - `interface Window { from: string; to: string }` — inclusive ISO dates
  - `interface WindowFetch { total: number; rows: unknown[] }`
  - `type FetchWindow = (w: Window) => Promise<WindowFetch>`
  - `interface CollectResult { rows: unknown[]; windows: Window[]; requests: number }`
  - `function yearWindows(fromYear: number, toYear: number): Window[]`
  - `function splitWindow(w: Window): [Window, Window]`
  - `async function collectAll(windows: Window[], fetch: FetchWindow): Promise<CollectResult>`

- [ ] **Step 1: Write the failing test**

Create `app/server/src/contracts/windows.test.ts`:

```typescript
import { expect, test } from "vitest";
import { yearWindows, splitWindow, collectAll, type Window, type WindowFetch } from "./windows.js";

test("yearWindows produces one inclusive window per year", () => {
  const ws = yearWindows(2004, 2006);
  expect(ws).toEqual([
    { from: "2004-01-01", to: "2004-12-31" },
    { from: "2005-01-01", to: "2005-12-31" },
    { from: "2006-01-01", to: "2006-12-31" },
  ]);
});

test("splitWindow halves a window without gapping or overlapping", () => {
  const [a, b] = splitWindow({ from: "2020-01-01", to: "2020-12-31" });
  expect(a.from).toBe("2020-01-01");
  expect(b.to).toBe("2020-12-31");
  /* The halves must MEET: b starts the day after a ends. A gap loses records
   * silently; an overlap is merely wasteful. */
  const dayAfter = new Date(Date.parse(a.to) + 86400000).toISOString().slice(0, 10);
  expect(b.from).toBe(dayAfter);
});

/* 🔴 THE TEST THIS WHOLE MODULE EXISTS FOR.
 *
 * The API's `page` parameter is SILENTLY IGNORED -- pages 1, 2 and 100 return
 * identical records. So the only way to know a window arrived complete is to
 * compare the stated total against what came back. A response claiming 5,000
 * results while handing over 2,000 MUST split, not be accepted. */
test("a truncated response splits the window instead of being accepted", async () => {
  const seen: Window[] = [];
  const fetch = async (w: Window): Promise<WindowFetch> => {
    seen.push(w);
    /* The full year claims 5,000 but yields 2,000. Its halves are honest. */
    if (w.from === "2020-01-01" && w.to === "2020-12-31") {
      return { total: 5000, rows: Array.from({ length: 2000 }, (_, i) => ({ id: "big-" + i })) };
    }
    return { total: 10, rows: Array.from({ length: 10 }, (_, i) => ({ id: w.from + "-" + i })) };
  };

  const out = await collectAll([{ from: "2020-01-01", to: "2020-12-31" }], fetch);

  expect(seen.length).toBeGreaterThan(1);
  /* The truncated 2,000 must NOT appear in the output -- only the honest
   * halves. Accepting it is the silent-incompleteness failure. */
  expect(out.rows).toHaveLength(20);
  expect(out.rows.every((r) => !String((r as { id: string }).id).startsWith("big-"))).toBe(true);
});

test("a complete window is accepted without splitting", async () => {
  let calls = 0;
  const fetch = async (): Promise<WindowFetch> => {
    calls += 1;
    return { total: 3, rows: [{ id: "a" }, { id: "b" }, { id: "c" }] };
  };
  const out = await collectAll([{ from: "2020-01-01", to: "2020-12-31" }], fetch);
  expect(calls).toBe(1);
  expect(out.rows).toHaveLength(3);
  expect(out.windows).toEqual([{ from: "2020-01-01", to: "2020-12-31" }]);
});

/* A single day that still reports truncation cannot be split further. Throwing
 * is correct: silently returning a partial day is the failure this module
 * exists to prevent, and there is no honest smaller window to try. */
test("a single day that still truncates throws rather than returning a partial", async () => {
  const fetch = async (): Promise<WindowFetch> => ({ total: 99, rows: [{ id: "x" }] });
  await expect(
    collectAll([{ from: "2020-06-15", to: "2020-06-15" }], fetch),
  ).rejects.toThrow(/cannot be split/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/contracts/windows.test.ts`
Expected: FAIL — `Cannot find module './windows.js'`

- [ ] **Step 3: Write the implementation**

Create `app/server/src/contracts/windows.ts`:

```typescript
/* WINDOW SPLITTING, and the completeness assertion that makes it safe.
 *
 * 🔴 THE API'S `page` PARAMETER IS SILENTLY IGNORED. Measured 2026-09-03:
 * pages 1, 2 and 100 at pageSize 50 returned IDENTICAL record sets -- 50 of 50
 * ids overlapping, same first id, same last. The sixth §5.4 instance in this
 * project and the fourth platform.
 *
 * So there is no cursor to follow. The only safe pattern is to request a window
 * WHOLE and assert you got all of it: the response states `totalResults`, and
 * if that exceeds what arrived, the window is too big and must be split.
 *
 * PURE ON PURPOSE -- no network, no database. The completeness assertion is the
 * one piece of logic that, if wrong, makes the entire ingest silently
 * incomplete, and a live API will never truncate on demand to prove a test. */

/** Inclusive ISO date bounds, `YYYY-MM-DD`. */
export interface Window {
  from: string;
  to: string;
}

export interface WindowFetch {
  /** What the API says exists for this window. */
  total: number;
  /** What it actually handed over. */
  rows: unknown[];
}

export type FetchWindow = (w: Window) => Promise<WindowFetch>;

export interface CollectResult {
  rows: unknown[];
  /** The windows that came back COMPLETE. Split parents are not included. */
  windows: Window[];
  requests: number;
}

const DAY_MS = 86_400_000;
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export function yearWindows(fromYear: number, toYear: number): Window[] {
  const out: Window[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    out.push({ from: `${y}-01-01`, to: `${y}-12-31` });
  }
  return out;
}

/* The halves MEET: the second starts the day after the first ends. A gap loses
 * records silently, which is the failure mode this module exists to prevent;
 * an overlap merely costs a duplicate insert the natural key absorbs. */
export function splitWindow(w: Window): [Window, Window] {
  const a = Date.parse(w.from);
  const b = Date.parse(w.to);
  const mid = a + Math.floor((b - a) / 2 / DAY_MS) * DAY_MS;
  return [
    { from: w.from, to: iso(mid) },
    { from: iso(mid + DAY_MS), to: w.to },
  ];
}

export async function collectAll(
  windows: Window[],
  fetch: FetchWindow,
): Promise<CollectResult> {
  const rows: unknown[] = [];
  const complete: Window[] = [];
  let requests = 0;

  const queue = [...windows];
  while (queue.length) {
    const w = queue.shift()!;
    const { total, rows: got } = await fetch(w);
    requests += 1;

    if (total <= got.length) {
      rows.push(...got);
      complete.push(w);
      continue;
    }

    /* Truncated. A single day has no smaller honest window to try, and
     * returning the partial would be exactly the silent incompleteness this
     * guards against. */
    if (w.from === w.to) {
      throw new Error(
        `Window ${w.from} reports ${total} records but returned ${got.length}, ` +
          `and a single day cannot be split further. Raise pageSize or ` +
          `investigate the source.`,
      );
    }

    const [x, y] = splitWindow(w);
    queue.unshift(x, y);
  }

  return { rows, windows: complete, requests };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/contracts/windows.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Mutation-prove the completeness assertion**

Change `if (total <= got.length)` to `if (true)` — accept every response.

Run the **whole file**. Expected: *"a truncated response splits the window instead of being accepted"* and *"a single day that still truncates throws"* both fail.

Revert and re-run.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/contracts/windows.ts app/server/src/contracts/windows.test.ts
git commit -m "Window splitting, because the page parameter is silently ignored"
```

---

## Task 4: `eds-client.ts` — one request, politely

**Files:**
- Create: `app/server/src/contracts/eds-client.ts`
- Create: `app/server/src/contracts/fixtures/eds-window.json`
- Test: `app/server/src/contracts/eds-client.test.ts`

**Interfaces:**
- Consumes: `Window`, `WindowFetch` from `./windows.js`.
- Produces:
  - `const EDS_URL: string`
  - `interface EdsRow { id: string; vendorName: string; agencyName: string; businessUnit: string; startDate: string; endDate: string; amount: number; actionType: string; amendment: number; zipCode: string; pdfUrl: string }`
  - `function parseWindow(payload: string): WindowFetch`
  - `function edsClient(opts?: { fetchImpl?: typeof fetch; delayMs?: number }): FetchWindow`

- [ ] **Step 1: Capture the fixture**

```bash
cd "C:/Users/matts/Desktop/Tenderfoot"
node --input-type=module -e '
import { writeFileSync } from "node:fs";
const U="https://secure.in.gov/apps/idoa/contractsearch/api/contracts/search";
const H={"content-type":"application/json",accept:"application/json",
  "user-agent":"Tenderfoot/0.1 (Koehler Partners; procurement research)"};
const r=await(await fetch(U,{method:"POST",headers:H,body:JSON.stringify(
  {startDate:"2020-01-01",endDate:"2020-12-31",page:1,pageSize:25000})})).text();
writeFileSync("app/server/src/contracts/fixtures/eds-window.json", r);
const j=JSON.parse(r);
console.log("captured "+j.results.length+" rows, totalResults "+j.pagination.totalResults);
'
```

Expect ~1,334 rows. **Commit the fixture** — every parser test reads it instead of the network.

- [ ] **Step 2: Write the failing test**

Create `app/server/src/contracts/eds-client.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { parseWindow, edsClient } from "./eds-client.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(HERE, "fixtures/eds-window.json"), "utf8");

test("parseWindow reads the total and the rows apart from each other", () => {
  const out = parseWindow(FIXTURE);
  expect(out.total).toBeGreaterThan(0);
  expect(out.rows.length).toBeGreaterThan(0);
  /* The 2020 fixture is complete, so these agree. They are read from DIFFERENT
   * places -- pagination.totalResults and results.length -- and that
   * separation is what lets collectAll detect truncation at all. */
  expect(out.total).toBe(out.rows.length);
});

test("parseWindow keeps the fields the ingest maps", () => {
  const r = parseWindow(FIXTURE).rows[0] as Record<string, unknown>;
  for (const k of ["id", "vendorName", "agencyName", "startDate", "endDate", "amount",
                   "actionType", "amendment"]) {
    expect(r, `${k} missing`).toHaveProperty(k);
  }
});

/* An empty body returns zero results with a ZEROED pagination block -- it does
 * not mean "everything". Recorded in the Indiana pin, and it would read as a
 * complete empty window rather than as a mistake. */
test("parseWindow reports a zeroed response as zero, not as complete-and-empty", () => {
  const out = parseWindow(JSON.stringify({ results: [], pagination: { totalResults: 0 } }));
  expect(out.total).toBe(0);
  expect(out.rows).toEqual([]);
});

test("the client sends the window as dates and never sends `page` as a cursor", async () => {
  const calls: { url: string; body: any }[] = [];
  const fake: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response(FIXTURE, { status: 200 });
  };
  const client = edsClient({ fetchImpl: fake, delayMs: 0 });
  await client({ from: "2020-01-01", to: "2020-12-31" });

  expect(calls).toHaveLength(1);
  expect(calls[0]!.body.startDate).toBe("2020-01-01");
  expect(calls[0]!.body.endDate).toBe("2020-12-31");
  /* `page` is silently ignored by this API, so sending anything but 1 would be
   * a lie about how the fetcher works. Completeness comes from the split. */
  expect(calls[0]!.body.page).toBe(1);
  expect(calls[0]!.body.pageSize).toBeGreaterThanOrEqual(25000);
});

test("a non-2xx stops rather than retrying into a rate limiter", async () => {
  const fake: typeof fetch = async () => new Response("nope", { status: 429 });
  const client = edsClient({ fetchImpl: fake, delayMs: 0 });
  await expect(client({ from: "2020-01-01", to: "2020-12-31" })).rejects.toThrow(/429/);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/contracts/eds-client.test.ts`
Expected: FAIL — `Cannot find module './eds-client.js'`

- [ ] **Step 4: Write the implementation**

Create `app/server/src/contracts/eds-client.ts`:

```typescript
/* One HTTP call against Indiana's public contract register, politely.
 *
 * A state transparency API is an intended-use resource, not something to be
 * squeezed: concurrency 1, a fixed delay between requests, an identifying
 * User-Agent, and STOP on the first non-2xx rather than retrying into a rate
 * limiter. The polite failure is to stop. */
import type { FetchWindow, Window, WindowFetch } from "./windows.js";

export const EDS_URL =
  "https://secure.in.gov/apps/idoa/contractsearch/api/contracts/search";

/* Measured 2026-09-03: 25,000 rows came back in 6.2s at 9.4MB, and no ceiling
 * was found. 25,000 comfortably holds any single year -- the densest sampled
 * was well under it -- so a year needs one request and the split in windows.ts
 * only fires where the data is genuinely dense. */
const PAGE_SIZE = 25_000;

const UA = "Tenderfoot/0.1 (Koehler Partners; procurement research)";

export interface EdsRow {
  id: string;
  vendorName: string;
  agencyName: string;
  businessUnit: string;
  startDate: string;
  endDate: string;
  amount: number;
  actionType: string;
  amendment: number;
  zipCode: string;
  pdfUrl: string;
}

/* `total` and `rows` are read from DIFFERENT places on purpose --
 * pagination.totalResults and results.length. That separation is the entire
 * truncation check in windows.ts; collapsing them would make it vacuous. */
export function parseWindow(payload: string): WindowFetch {
  const j = JSON.parse(payload) as {
    results?: unknown[];
    pagination?: { totalResults?: number };
  };
  return {
    total: Number(j.pagination?.totalResults ?? 0),
    rows: j.results ?? [],
  };
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export function edsClient(
  opts: { fetchImpl?: typeof fetch; delayMs?: number } = {},
): FetchWindow {
  const doFetch = opts.fetchImpl ?? fetch;
  const delayMs = opts.delayMs ?? 800;

  return async (w: Window): Promise<WindowFetch> => {
    const res = await doFetch(EDS_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": UA,
      },
      /* ⚠️ page is ALWAYS 1 and is not a cursor. This API ignores it entirely
       * (pages 1, 2 and 100 return identical records), and an empty body
       * returns a zeroed pagination block rather than everything -- so both
       * page and pageSize must be present. Completeness comes from the window
       * split, never from paging. */
      body: JSON.stringify({
        startDate: w.from,
        endDate: w.to,
        page: 1,
        pageSize: PAGE_SIZE,
      }),
    });

    if (!res.ok) {
      throw new Error(
        `EDS returned ${res.status} for ${w.from}..${w.to}. Stopping rather ` +
          `than retrying — see the politeness note in this file's header.`,
      );
    }

    const out = parseWindow(await res.text());
    if (delayMs > 0) await sleep(delayMs);
    return out;
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/contracts/eds-client.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Mutation-prove the total/rows separation**

In `parseWindow`, change `total` to `Number(j.results?.length ?? 0)` — read both from the same place.

Run the **whole file** plus `windows.test.ts`. The eds-client tests still pass (the fixture is complete, so the numbers agree) — **which is the point.** Then confirm the real protection is in `windows.test.ts`'s truncation test, and add this assertion to `parseWindow reads the total and the rows apart`:

```typescript
  /* Proves they are read from different places: a payload whose stated total
   * EXCEEDS its rows must report the discrepancy, not hide it. */
  const short = parseWindow(JSON.stringify({ results: [{ id: "a" }], pagination: { totalResults: 9 } }));
  expect(short.total).toBe(9);
  expect(short.rows).toHaveLength(1);
```

Re-run with the mutation: that assertion now fails. Revert and re-run.

- [ ] **Step 7: Commit**

```bash
git add app/server/src/contracts/eds-client.ts app/server/src/contracts/eds-client.test.ts app/server/src/contracts/fixtures/eds-window.json
git commit -m "The EDS client: one request, politely, and page is never a cursor"
```

---

## Task 5: `import.ts` — the idempotent write

**Files:**
- Create: `app/server/src/contracts/import.ts`
- Test: `app/server/src/contracts/import.test.ts`

**Interfaces:**
- Consumes: `EdsRow` from `./eds-client.js`; `orgChain` from `../merge/org-chain.js`; `all`, `one`, `run`, `tx` from `../db/index.js`.
- Produces:
  - `interface ImportResult { written: number; skipped: number }`
  - `async function importContracts(sourceId: number, rows: EdsRow[]): Promise<ImportResult>`

- [ ] **Step 1: Write the failing test**

Create `app/server/src/contracts/import.test.ts`:

```typescript
import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_contract_import");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, one, all, run } = await import("../db/index.js");
const { importContracts } = await import("./import.js");

let src: number;

beforeAll(async () => {
  await migrate(false);
  src = await insert(`INSERT INTO source (name) VALUES ('EDS import fixture') RETURNING id`);
}, 120000);
afterAll(async () => {
  await close();
});

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "A337-6-CWI-104",
  vendorName: "TIMOTHY WARRICK",
  agencyName: "Adjutant General",
  businessUnit: "00110",
  startDate: "2006-05-01T00:00:00.0000000",
  endDate: "2007-04-30T00:00:00.0000000",
  amount: 40000,
  actionType: "New",
  amendment: 0,
  zipCode: "47441",
  pdfUrl: "https://contracts.idoa.in.gov/x.pdf",
  ...over,
});

test("a contract lands with its amount in amount_cents and value_cents NULL", async () => {
  await run(`DELETE FROM contract WHERE source_id = $1`, [src]);
  const out = await importContracts(src, [row() as any]);
  expect(out.written).toBe(1);

  const c = await one<{
    external_id: string; amendment: number; action_type: string;
    amount_cents: string; value_cents: string | null; starts_at: string; ends_at: string;
  }>(`SELECT external_id, amendment, action_type, amount_cents, value_cents,
             starts_at, ends_at FROM contract WHERE source_id = $1`, [src]);

  expect(c?.external_id).toBe("A337-6-CWI-104");
  expect(c?.amendment).toBe(0);
  expect(c?.action_type).toBe("New");
  /* Dollars in, CENTS stored -- the column says cents and the source says
   * dollars, and getting that wrong is a hundredfold error nobody notices. */
  expect(Number(c?.amount_cents)).toBe(4_000_000);
  /* 🔴 Ruled by Matt 2026-09-03. amount is a per-amendment delta, not a value. */
  expect(c?.value_cents).toBeNull();
  /* Dates are truncated to ISO days -- the source ships .0000000 fractions. */
  expect(c?.starts_at).toBe("2006-05-01");
  expect(c?.ends_at).toBe("2007-04-30");
});

test("re-importing the same rows writes nothing new", async () => {
  const before = await one<{ n: string }>(
    `SELECT count(*) n FROM contract WHERE source_id = $1`, [src]);
  const out = await importContracts(src, [row() as any]);
  const after = await one<{ n: string }>(
    `SELECT count(*) n FROM contract WHERE source_id = $1`, [src]);

  expect(out.written).toBe(0);
  expect(out.skipped).toBe(1);
  expect(after!.n).toBe(before!.n);
});

/* The contract id repeats across amendments. Two amendments are two rows. */
test("a second amendment of the same contract is a second row", async () => {
  const out = await importContracts(src, [
    row({ amendment: 1, actionType: "Amendment", amount: 70000 }) as any,
  ]);
  expect(out.written).toBe(1);

  const rows = await all<{ amendment: number; amount_cents: string }>(
    `SELECT amendment, amount_cents FROM contract
      WHERE source_id = $1 AND external_id = 'A337-6-CWI-104' ORDER BY amendment`, [src]);
  expect(rows.map((r) => r.amendment)).toEqual([0, 1]);
  expect(rows.map((r) => Number(r.amount_cents))).toEqual([4_000_000, 7_000_000]);
});

test("the agency becomes an organization via the shared org chain", async () => {
  const c = await one<{ org_id: number | null }>(
    `SELECT org_id FROM contract WHERE source_id = $1 AND amendment = 0`, [src]);
  expect(c?.org_id).not.toBeNull();
  const o = await one<{ name: string }>(`SELECT name FROM organization WHERE id = $1`,
    [c!.org_id]);
  expect(o?.name).toBe("Adjutant General");
});

/* 🔴 THE GUARD THAT MATTERS MOST. Design spec §2: nothing in the contract path
 * may touch solicitation, sighting or pursuit. A contract reaching the triage
 * queue would be work already awarded presented as an opportunity. */
test("importing contracts writes NOTHING to solicitation, sighting or pursuit", async () => {
  const before = await one<{ s: string; g: string; p: string }>(
    `SELECT (SELECT count(*) FROM solicitation) s,
            (SELECT count(*) FROM sighting) g,
            (SELECT count(*) FROM pursuit) p`);
  await importContracts(src, [
    row({ id: "QUEUE-GUARD-1", amendment: 0 }) as any,
    row({ id: "QUEUE-GUARD-2", amendment: 0 }) as any,
  ]);
  const after = await one<{ s: string; g: string; p: string }>(
    `SELECT (SELECT count(*) FROM solicitation) s,
            (SELECT count(*) FROM sighting) g,
            (SELECT count(*) FROM pursuit) p`);
  expect(after).toEqual(before);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/contracts/import.test.ts`
Expected: FAIL — `Cannot find module './import.js'`

- [ ] **Step 3: Write the implementation**

Create `app/server/src/contracts/import.ts`:

```typescript
/* Rows into `contract`. Direct, and deliberately so.
 *
 * Design spec §2: contracts do NOT go through sighting/merge. That pipeline
 * answers whether two sources saw the same thing and which observation is
 * newest, and neither applies to a single-source archive where each amendment
 * is its own record. Routing through it would mean making `sighting`
 * polymorphic to gain machinery that does nothing.
 *
 * 🔴 AND IT IS WHAT MAKES THE QUEUE SAFE STRUCTURALLY. Nothing in this file
 * touches solicitation, sighting or pursuit, so a contract cannot reach triage
 * by ANY code path -- a stronger guarantee than remembering to exclude them.
 * There is a test asserting exactly that. */
import { tx } from "../db/index.js";
import { orgChain } from "../merge/org-chain.js";
import type { EdsRow } from "./eds-client.js";

export interface ImportResult {
  written: number;
  /** Rows already present under the natural key. A re-run is all skips. */
  skipped: number;
}

/* The source ships "2006-05-01T00:00:00.0000000" -- seven fractional digits,
 * which Date.parse handles but the column does not need. starts_at/ends_at are
 * `text` holding ISO dates elsewhere in this schema, so match that. */
const day = (v: unknown): string | null => {
  const s = String(v ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

/* Dollars in, CENTS stored. The column name says cents; the source says
 * dollars. Math.round rather than truncation because a source that ever ships
 * 1234.56 should not silently lose the change. */
const cents = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

export async function importContracts(
  sourceId: number,
  rows: EdsRow[],
): Promise<ImportResult> {
  if (!rows.length) return { written: 0, skipped: 0 };

  return tx(async (q) => {
    /* Organisations first, one round trip, so the insert below can reference
     * them. orgChain is the SHARED reader -- the module D27 found had no test
     * file -- and it is keyed by the canonical registry source name. */
    const agencies = [...new Set(rows.map((r) => String(r.agencyName ?? "")).filter(Boolean))];
    const orgIds = new Map<string, number>();
    if (agencies.length) {
      await q.run(
        `INSERT INTO organization (name) SELECT unnest($1::text[])
         ON CONFLICT (name) DO NOTHING`,
        [agencies],
      );
      const found = await q.all<{ id: number; name: string }>(
        `SELECT id, name FROM organization WHERE name = ANY($1::text[])`,
        [agencies],
      );
      for (const o of found) orgIds.set(o.name, o.id);
    }

    /* ON CONFLICT DO NOTHING against the natural key is what makes a re-run
     * idempotent. `written` counts what the statement actually inserted, so a
     * second run reports 0 written and every row skipped -- which is the
     * assertion the idempotency test makes. */
    const inserted = await q.all<{ id: number }>(
      `INSERT INTO contract
         (source_id, external_id, amendment, action_type, amount_cents,
          starts_at, ends_at, org_id, source_note)
       SELECT $1::int, u.external_id, u.amendment::int, u.action_type,
              u.amount_cents::bigint, u.starts_at, u.ends_at, u.org_id::int, u.vendor
         FROM unnest($2::text[], $3::int[], $4::text[], $5::bigint[],
                     $6::text[], $7::text[], $8::int[], $9::text[])
           AS u(external_id, amendment, action_type, amount_cents,
                starts_at, ends_at, org_id, vendor)
       ON CONFLICT (source_id, external_id, amendment)
         WHERE source_id IS NOT NULL AND external_id IS NOT NULL AND amendment IS NOT NULL
         DO NOTHING
       RETURNING id`,
      [
        sourceId,
        rows.map((r) => String(r.id)),
        rows.map((r) => Number(r.amendment ?? 0)),
        rows.map((r) => (r.actionType ? String(r.actionType) : null)),
        rows.map((r) => cents(r.amount)),
        rows.map((r) => day(r.startDate)),
        rows.map((r) => day(r.endDate)),
        rows.map((r) => orgIds.get(String(r.agencyName ?? "")) ?? null),
        /* v1 lands the raw vendor name. Vendor resolution -- vendor_alias
         * knowing TIMOTHY WARRICK and Timothy Warrick, Inc. are one -- is its
         * own slice, and a corpus with un-normalised vendors is useful where a
         * corpus that does not exist is not. */
        rows.map((r) => (r.vendorName ? `vendorName: ${r.vendorName}` : null)),
      ],
    );

    /* value_cents is NOT written. Ruled 2026-09-03: `amount` is a
     * per-amendment delta, and value_cents will one day hold PUBLISHED figures
     * from HigherGov's /sl-contract/. */
    return { written: inserted.length, skipped: rows.length - inserted.length };
  });
}
```

> **Note for the implementer:** `orgChain` is imported for its source-name-keyed
> reading in later work, but v1 inserts `agencyName` directly because the EDS
> payload publishes a flat agency name with no hierarchy. **If the import test
> for organisations passes without calling `orgChain`, remove the import rather
> than leaving a decorative dependency** — and say so in the commit.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/contracts/import.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Mutation-prove the cents conversion**

Change `cents` to `return Number.isFinite(n) ? n : null` — dollars stored as if they were cents.

Run the **whole file**. Expected: *"a contract lands with its amount in amount_cents"* fails with 40000 instead of 4000000.

Revert and re-run.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/contracts/import.ts app/server/src/contracts/import.test.ts
git commit -m "Contracts write direct, and the queue guard is a test not a promise"
```

---

## Task 6: `ingest.ts` — orchestration and run accounting

**Files:**
- Create: `app/server/src/contracts/ingest.ts`
- Test: `app/server/src/contracts/ingest.test.ts`

**Interfaces:**
- Consumes: `collectAll`, `yearWindows`, `FetchWindow` from `./windows.js`; `importContracts` from `./import.js`; `EdsRow` from `./eds-client.js`.
- Produces:
  - `interface IngestReport { windows: number; requests: number; fetched: number; written: number; skipped: number }`
  - `async function ingestContracts(opts: { sourceName: string; fromYear: number; toYear: number; fetchWindow: FetchWindow }): Promise<IngestReport>`

- [ ] **Step 1: Write the failing test**

Create `app/server/src/contracts/ingest.test.ts`:

```typescript
import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_contract_ingest");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, one, all, run } = await import("../db/index.js");
const { ingestContracts } = await import("./ingest.js");

beforeAll(async () => {
  await migrate(false);
  await run(`INSERT INTO source (name) VALUES ('EDS ingest fixture')`);
}, 120000);
afterAll(async () => {
  await close();
});

const mkRow = (id: string, year: number) => ({
  id, vendorName: "V", agencyName: "A", businessUnit: "00110",
  startDate: `${year}-05-01T00:00:00.0000000`,
  endDate: `${year}-06-01T00:00:00.0000000`,
  amount: 100, actionType: "New", amendment: 0, zipCode: "1", pdfUrl: "u",
});

test("an ingest walks the years, writes the rows and records a run", async () => {
  const report = await ingestContracts({
    sourceName: "EDS ingest fixture",
    fromYear: 2020,
    toYear: 2021,
    fetchWindow: async (w) => {
      const y = Number(w.from.slice(0, 4));
      const rows = [mkRow(`C-${y}-1`, y), mkRow(`C-${y}-2`, y)];
      return { total: rows.length, rows };
    },
  });

  expect(report.windows).toBe(2);
  expect(report.fetched).toBe(4);
  expect(report.written).toBe(4);

  const n = await one<{ c: string }>(`SELECT count(*) c FROM contract`);
  expect(Number(n!.c)).toBe(4);

  /* One ingest_run per completed window, so a failure costs one window and
   * progress is durable. */
  const runs = await all<{ rows_imported: number }>(
    `SELECT rows_imported FROM ingest_run ORDER BY id`);
  expect(runs).toHaveLength(2);
  expect(runs.map((r) => r.rows_imported)).toEqual([2, 2]);
});

test("re-running the same years writes nothing and still records the runs", async () => {
  const before = await one<{ c: string }>(`SELECT count(*) c FROM contract`);
  const report = await ingestContracts({
    sourceName: "EDS ingest fixture",
    fromYear: 2020,
    toYear: 2021,
    fetchWindow: async (w) => {
      const y = Number(w.from.slice(0, 4));
      const rows = [mkRow(`C-${y}-1`, y), mkRow(`C-${y}-2`, y)];
      return { total: rows.length, rows };
    },
  });
  const after = await one<{ c: string }>(`SELECT count(*) c FROM contract`);

  expect(report.written).toBe(0);
  expect(report.skipped).toBe(4);
  expect(after!.c).toBe(before!.c);
});

test("an unknown source name fails loudly rather than writing nowhere", async () => {
  await expect(
    ingestContracts({
      sourceName: "no such source",
      fromYear: 2020, toYear: 2020,
      fetchWindow: async () => ({ total: 0, rows: [] }),
    }),
  ).rejects.toThrow(/no such source/i);
});

/* A truncated window must abort the whole ingest, not quietly load a subset.
 * The failure this design exists to prevent is a corpus that LOOKS complete. */
test("a window that cannot be split aborts the ingest", async () => {
  await expect(
    ingestContracts({
      sourceName: "EDS ingest fixture",
      fromYear: 2020, toYear: 2020,
      fetchWindow: async () => ({ total: 99, rows: [mkRow("X", 2020)] }),
    }),
  ).rejects.toThrow(/cannot be split/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/contracts/ingest.test.ts`
Expected: FAIL — `Cannot find module './ingest.js'`

- [ ] **Step 3: Write the implementation**

Create `app/server/src/contracts/ingest.ts`:

```typescript
/* Orchestration: windows -> client -> import -> ingest_run.
 *
 * One ingest_run per COMPLETED window, so a failure costs one window rather
 * than the whole register and progress is durable across sessions. */
import { one, insert } from "../db/index.js";
import { collectAll, yearWindows, type FetchWindow, type Window } from "./windows.js";
import { importContracts } from "./import.js";
import type { EdsRow } from "./eds-client.js";

export interface IngestReport {
  windows: number;
  requests: number;
  fetched: number;
  written: number;
  skipped: number;
}

export async function ingestContracts(opts: {
  sourceName: string;
  fromYear: number;
  toYear: number;
  fetchWindow: FetchWindow;
}): Promise<IngestReport> {
  const src = await one<{ id: number }>(`SELECT id FROM source WHERE name = $1`, [
    opts.sourceName,
  ]);
  if (!src) throw new Error(`No source row named ${opts.sourceName}`);

  const report: IngestReport = {
    windows: 0, requests: 0, fetched: 0, written: 0, skipped: 0,
  };

  /* Windows are collected and written ONE AT A TIME rather than gathering all
   * ~205k rows first. A 205k-row array is fine in memory, but a per-window
   * write means an interrupted run leaves completed windows durably recorded
   * instead of losing everything. */
  for (const year of yearWindows(opts.fromYear, opts.toYear)) {
    const out = await collectAll([year], opts.fetchWindow);
    report.requests += out.requests;
    report.windows += out.windows.length;
    report.fetched += out.rows.length;

    const res = await importContracts(src.id, out.rows as EdsRow[]);
    report.written += res.written;
    report.skipped += res.skipped;

    /* artifact_sha256 is NOT NULL UNIQUE on ingest_run and this path produces
     * no artifact, so the window's own identity stands in for one. It is
     * unique per (source, window, run) and says what it is when read. */
    await insert(
      `INSERT INTO ingest_run (source_id, ingested_through, artifact_sha256, rows_imported)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        src.id,
        year.to,
        `eds-window:${year.from}..${year.to}:${Date.now()}`,
        out.rows.length,
      ],
    );
  }

  return report;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/contracts/ingest.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Mutation-prove the abort**

In `windows.ts`, change the single-day `throw` to `{ rows.push(...got); complete.push(w); continue; }`.

Run **both** `windows.test.ts` and `ingest.test.ts`. Expected: the single-day test in `windows.test.ts` and *"a window that cannot be split aborts the ingest"* both fail.

Revert and re-run.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/contracts/ingest.ts app/server/src/contracts/ingest.test.ts
git commit -m "One ingest_run per window, so an interrupted run keeps its progress"
```

---

## Task 7: The CLI

**Files:**
- Create: `app/server/src/contracts/contracts-cli.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ingestContracts` from `./ingest.js`; `edsClient` from `./eds-client.js`.
- Produces: `main(): Promise<void>`; the npm script `contracts:ingest`.

- [ ] **Step 1: Write the CLI**

Create `app/server/src/contracts/contracts-cli.ts`:

```typescript
/* Thin CLI over ingest.ts. Mirrors merge/merge-cli.ts exactly: same
 * pathToFileURL entry guard, same catch/close handling, same pool closing on
 * both paths. No ingest logic lives here.
 *
 * RUNS LOCALLY, per Matt's standing ruling of 2026-09-03 -- "we should always
 * do scraping locally unless otherwise specified" -- which supersedes the
 * 2026-08-15 ruling that long ingestion runs on Vercel. No function ceiling, so
 * a multi-minute run is unremarkable.
 *
 *   npm run contracts:ingest -- 2004 2027
 */
import { pathToFileURL } from "node:url";
import { ingestContracts } from "./ingest.js";
import { edsClient } from "./eds-client.js";

const SOURCE = "Indiana EDS contract register";

export async function main(argv: string[]): Promise<void> {
  const fromYear = Number(argv[0] ?? 2004);
  const toYear = Number(argv[1] ?? new Date().getFullYear() + 1);
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear) || fromYear > toYear) {
    throw new Error(`Usage: contracts:ingest -- <fromYear> <toYear>`);
  }

  console.log(`\nIndiana EDS contract register — ${fromYear}..${toYear}\n`);
  const t0 = Date.now();
  const r = await ingestContracts({
    sourceName: SOURCE,
    fromYear,
    toYear,
    fetchWindow: edsClient(),
  });

  console.log(`  windows completed  ${r.windows}`);
  console.log(`  requests made      ${r.requests}`);
  console.log(`  rows fetched       ${r.fetched}`);
  console.log(`  rows written       ${r.written}`);
  console.log(`  rows already held  ${r.skipped}`);
  console.log(`  elapsed            ${Math.round((Date.now() - t0) / 1000)}s\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { close } = await import("../db/index.js");
  main(process.argv.slice(2))
    .then(() => close())
    .catch(async (e) => {
      console.error(e.message);
      await close();
      process.exit(1);
    });
}
```

- [ ] **Step 2: Add the npm script**

In `package.json`, after `"merge"`:

```json
    "contracts:ingest": "tsx --env-file-if-exists=.env app/server/src/contracts/contracts-cli.ts"
```

- [ ] **Step 3: Verify it refuses bad arguments**

Run: `npm run contracts:ingest -- 2030 2020`
Expected: exits 1 with the usage message. **Nothing is written.**

- [ ] **Step 4: Run the full gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/server/src/contracts/contracts-cli.ts package.json
git commit -m "npm run contracts:ingest, and it runs locally by ruling"
```

---

## Task 8: Run it for real, and check the success criteria

**Files:**
- Create: `docs/2026-09-03-eds-ingest-run.md`

**This task is a MEASUREMENT.** Nothing in it is code.

- [ ] **Step 1: Record the before state**

```bash
cd "C:/Users/matts/Desktop/Tenderfoot"
DATABASE_URL="$DATABASE_URL_TEST" npm run fitness 2>&1 | head -20
```

Note F1's and F2's verdicts, and the triage queue's row count:

```bash
node --env-file=.env --input-type=module -e '
import { one, close } from "./app/server/dist/db/index.js";
console.log(await one(`SELECT (SELECT count(*) FROM solicitation) sol,
                              (SELECT count(*) FROM contract) con`));
await close();'
```

- [ ] **Step 2: Run the ingest against the TEST branch**

```bash
npm run contracts:ingest -- 2004 2027
```

**Watch it.** Expect ~24 windows, more requests than windows if any year splits, and several minutes of wall clock. **Stop and investigate if it aborts** — an abort means a window could not be split, which is the design working.

- [ ] **Step 3: Check the four success criteria**

```bash
node --env-file=.env --input-type=module -e '
import { one, close } from "./app/server/dist/db/index.js";
const r = await one(`SELECT count(*) total,
       count(DISTINCT external_id) distinct_contracts,
       count(*) FILTER (WHERE value_cents IS NOT NULL) value_set,
       count(*) FILTER (WHERE org_id IS NULL) no_org
  FROM contract`);
console.log(r);
await close();'
```

| Criterion | Expected |
|---|---|
| `total` | **204,991** — or the shortfall is explained, not shrugged at |
| `value_set` | **0** — `value_cents` stays NULL |
| triage queue | **unchanged** from Step 1 |
| a second run | writes **0** rows |

- [ ] **Step 4: Confirm the floor moved**

```bash
DATABASE_URL="$DATABASE_URL_TEST" npm run fitness 2>&1 | head -20
```

**F1 and F2 must now read PASS.** That is the point of doing this now.

- [ ] **Step 5: Write the run record**

Create `docs/2026-09-03-eds-ingest-run.md` with: the row count against 204,991, how many windows split and which, elapsed time, requests made, the before/after floor verdicts, and **any discrepancy stated plainly rather than rounded away.**

- [ ] **Step 6: Commit**

```bash
git add docs/2026-09-03-eds-ingest-run.md
git commit -m "The register is loaded, and F1 and F2 are what it cost"
```

---

## Task 9: Correct the registry — `page` is silently ignored

**Files:**
- Create: `app/server/migrations/024_eds_page_ignored.sql`
- Test: `app/server/src/db/schema.test.ts` (modify — append)

**Why a migration rather than editing 003:** `migrate.ts` tracks applied migrations **by filename with no checksum**, so editing an applied file changes nothing on test or production while a fresh database gets different text. Silent, permanent divergence. An applied migration is a historical record; corrections come after it.

- [ ] **Step 1: Write the failing test**

Append to `app/server/src/db/schema.test.ts`, before the `resetSchema` test:

```typescript
/* The single most expensive thing to rediscover about this source. If it lives
 * only in a spec, the next person writes a pagination loop and silently loads
 * the same 2,000 records twenty-one times. */
test("024 records that the EDS `page` parameter is silently ignored", async () => {
  const row = await one<{ verified_facets: Record<string, unknown> | null }>(
    `SELECT verified_facets FROM source WHERE name = 'Indiana EDS contract register'`,
  );
  const blob = JSON.stringify(row?.verified_facets ?? {});
  expect(blob).toContain("page");
  expect(blob.toLowerCase()).toContain("silently_ignored");
  /* And the evidence, not just the claim. */
  expect(blob).toMatch(/identical|same records|pages 1/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/db/schema.test.ts`
Expected: FAIL — `page` is not in `verified_facets`.

- [ ] **Step 3: Write the migration**

Create `app/server/migrations/024_eds_page_ignored.sql`:

```sql
-- `page` is silently ignored by the Indiana EDS contract API, and 003 does not
-- say so. It lists page among neither the working nor the ignored parameters,
-- which reads as untested rather than as dangerous.
--
-- MEASURED 2026-09-03: pages 1, 2 and 100 at pageSize 50 returned IDENTICAL
-- record sets -- 50 of 50 ids overlapping, same first id (A6-6-CO-006), same
-- last (A179-4-IGBWLA-001). A bogusParam control returned the same baseline
-- count, which is what proves "unchanged" means "ignored" rather than
-- "misspelled by us". vendorName and agencyName are ignored on the same
-- evidence.
--
-- The sixth §5.4 instance in this project and the fourth platform. Recording it
-- HERE rather than only in a spec, because the next person to write an ingest
-- against this source will read the registry row, and a pagination loop built
-- on `page` loads the same 2,000 records once per window and reports success.
UPDATE source
   SET verified_facets = verified_facets || jsonb_build_object(
         'silently_ignored', jsonb_build_array(
             'sort=-publishDate', 'page', 'vendorName', 'agencyName'),
         'page_note',
           'MEASURED 2026-09-03: pages 1, 2 and 100 at pageSize 50 returned '
        || 'identical record sets, 50 of 50 ids overlapping. There is no cursor. '
        || 'Completeness comes from splitting a date window and comparing '
        || 'pagination.totalResults against results.length. See '
        || 'docs/superpowers/specs/2026-09-03-indiana-contract-register-design.md §3.',
         'works_verified_2026_09_03', jsonb_build_array(
             'pageSize', 'startDate', 'endDate', 'businessUnit'))
 WHERE name = 'Indiana EDS contract register';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full gate**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/server/migrations/024_eds_page_ignored.sql app/server/src/db/schema.test.ts
git commit -m "The registry says `page` lies, because the next person will read the row"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| §1 purpose, and F1/F2 | Task 8 checks both |
| §2 direct write, queue safety | Task 5 — the queue guard is a test, not a promise |
| §3 `page` ignored | Tasks 3, 4 (never paginates) and 9 (records it) |
| §4 window split + completeness | Task 3, with the truncation test as its centre |
| §4 blocking unknown — date semantics | **Task 1**, and it produces a document, not code |
| §5 metadata only, `value_cents` NULL | Task 2 (column), Task 5 (test asserts NULL) |
| §6 data model + natural key | Task 2 |
| §7 politeness, local, `ingest_run` per window | Task 4 (client), Task 6 (runs), Task 7 (CLI) |
| §8 testing | Tasks 3–6 |
| §9 success criteria | Task 8, all four |
| §10 open questions | Q1 → Task 1. **Q2 (does summing reconstruct the total), Q3 (negative amounts), Q4 (vendor resolution) and Q5 (actionType Unknown) are deliberately NOT tasks** — Q2 and Q3 need PDFs, Q4 is its own slice, Q5 is a data-quality note recorded in migration 023's comment. |

**2. Placeholder scan.** No TBD, no "add error handling", no "similar to Task N". Every code step carries its code. Tasks 1 and 8 are measurements whose deliverable is a document, and both say so.

**3. Type consistency.** `Window`, `WindowFetch`, `FetchWindow`, `CollectResult` are defined in Task 3 and consumed unchanged in Tasks 4 and 6. `EdsRow` is defined in Task 4 and consumed in Tasks 5 and 6. `ImportResult` (Task 5) and `IngestReport` (Task 6) are distinct types and never conflated. `collectAll` takes `Window[]` in both its definition and both call sites.

**One thing fixed inline:** Task 5's implementation imports `orgChain` but v1 inserts the flat agency name directly, since the EDS payload has no hierarchy. Rather than leave a decorative import, the task now instructs the implementer to **remove it if the organisation test passes without it, and say so in the commit.**
