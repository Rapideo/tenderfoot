# Indiana EDS Contract Register Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load ~204,991 Indiana awarded contracts into the `contract` table — the first row it will ever hold — clearing floor predicates F1 and F2.

**Architecture:** A standalone module under `app/server/src/contracts/`, writing **direct to `contract`**. It deliberately does **not** use the `Adapter` interface, add a `SourceShape`, register in `adapters/registry.ts`, or produce an artifact — those all feed `sighting`, and §2 of the spec makes "a contract cannot reach the triage queue" a structural property rather than a filter. The fetcher makes **two requests** — one to learn `totalResults`, one to fetch that many — and **asserts completeness against `totalResults`**. It does not paginate, because the API's `page` parameter is silently ignored, and it does not window, because `startDate`/`endDate` filters fully-contained-within and so cannot tile the register (Task 1; ledger Ruling 3).

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
| `app/server/src/contracts/completeness.ts` | **Create.** Parse, and the assertion that the fetch arrived whole. **PURE — no network, no database.** This is where the lesson lives, so it must be testable with a fake. |
| `app/server/src/contracts/completeness.test.ts` | **Create.** Including the short-response test. |
| `app/server/src/contracts/eds-client.ts` | **Create.** Two HTTP calls. Politeness settings live here. |
| `app/server/src/contracts/eds-client.test.ts` | **Create.** Against a committed fixture; never the network. |
| `app/server/src/contracts/fixtures/eds-sample.json` | **Create.** A small real slice — the full register is 78 MB. |
| `app/server/src/contracts/import.ts` | **Create.** Row mapping and the idempotent write. |
| `app/server/src/contracts/import.test.ts` | **Create.** Idempotency, the natural key, and the queue guard. |
| `app/server/src/contracts/ingest.ts` | **Create.** Orchestration: client → import → `ingest_run`. |
| `app/server/src/contracts/ingest.test.ts` | **Create.** With a fake client. |
| `app/server/src/contracts/contracts-cli.ts` | **Create.** Thin CLI, mirroring `merge/merge-cli.ts`. |
| `package.json` | **Modify.** Add `contracts:ingest`. |
| `app/server/migrations/024_eds_page_ignored.sql` | **Create (Task 9).** Record `page` in the registry's `silently_ignored`. |

**Why `completeness.ts` is pure and separate.** The assertion is the one piece of logic that, if wrong, makes the whole ingest silently incomplete. Keeping it free of network and database means its tests are fast, deterministic, and can simulate a truncated response — which is impossible against a live API that never truncates on demand.

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

## Task 3: `completeness.ts` — the assertion, pure

> ⚠️ **THIS TASK WAS REWRITTEN after Task 1. See Ruling 3 in the ledger.**
> Task 1 established that `startDate`/`endDate` is a **fully-contained-within**
> filter: a contract's own start AND end must both fall inside the window, so
> every contract spanning a boundary is invisible to both neighbours. Year
> windows recovered **24,933 of 204,991 — an 88% shortfall.** Verified
> independently: 2019–2021 returns 16,801 while 2020 alone returns 1,334.
>
> **No date window can tile this register**, so window splitting is gone.
> Measured instead: **one request returns all 204,991 rows in 47s at 78 MB.**
> The completeness assertion survives and becomes the WHOLE guarantee.

**Files:**
- Create: `app/server/src/contracts/completeness.ts`
- Test: `app/server/src/contracts/completeness.test.ts`

**Interfaces:**
- Consumes: nothing. **Pure — no network, no database.**
- Produces:
  - `interface RegisterPage { total: number; rows: unknown[] }`
  - `function parseRegister(payload: string): RegisterPage`
  - `function assertComplete(page: RegisterPage): void` — throws when short

- [ ] **Step 1: Write the failing test**

Create `app/server/src/contracts/completeness.test.ts`:

```typescript
import { expect, test } from "vitest";
import { parseRegister, assertComplete } from "./completeness.js";

test("parseRegister reads the total and the rows from DIFFERENT places", () => {
  /* pagination.totalResults and results.length. That separation IS the
   * truncation check -- collapsing them makes it vacuous. */
  const p = parseRegister(JSON.stringify({
    results: [{ id: "a" }],
    pagination: { totalResults: 9 },
  }));
  expect(p.total).toBe(9);
  expect(p.rows).toHaveLength(1);
});

test("a complete page passes", () => {
  expect(() =>
    assertComplete({ total: 3, rows: [{ id: "a" }, { id: "b" }, { id: "c" }] }),
  ).not.toThrow();
});

/* 🔴 THE ASSERTION THIS MODULE EXISTS FOR.
 *
 * The API's `page` parameter is SILENTLY IGNORED -- pages 1, 2 and 100 return
 * identical records -- so there is no cursor to follow and no second request
 * that would fill a gap. If the single fetch comes back short, the ONLY safe
 * outcome is a loud failure. A partial register that looks complete is the
 * exact failure this whole design exists to prevent. */
test("a short page throws, naming both numbers", () => {
  const p = { total: 204991, rows: [{ id: "a" }] };
  expect(() => assertComplete(p)).toThrow(/204991/);
  expect(() => assertComplete(p)).toThrow(/returned 1/);
});

/* An empty request body returns a ZEROED pagination block rather than
 * everything. Zero-and-zero is internally consistent so it must not throw --
 * the caller checks the count separately. */
test("a zeroed response is consistent and does not throw", () => {
  expect(() => assertComplete({ total: 0, rows: [] })).not.toThrow();
});

/* More rows than claimed is also a contract violation. Never observed, and an
 * assertion checking only one direction would not notice. */
test("more rows than the stated total also throws", () => {
  expect(() =>
    assertComplete({ total: 1, rows: [{ id: "a" }, { id: "b" }] }),
  ).toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/contracts/completeness.test.ts`
Expected: FAIL — `Cannot find module './completeness.js'`

- [ ] **Step 3: Write the implementation**

Create `app/server/src/contracts/completeness.ts`:

```typescript
/* THE COMPLETENESS ASSERTION. It is the entire correctness guarantee of this
 * ingest, which is why it lives alone, pure, and heavily tested.
 *
 * 🔴 THE API'S `page` PARAMETER IS SILENTLY IGNORED. Measured 2026-09-03:
 * pages 1, 2 and 100 at pageSize 50 returned IDENTICAL record sets -- 50 of 50
 * ids overlapping, same first id, same last. So there is no cursor, no second
 * request that could fill a gap, and no way to "continue" a short fetch.
 *
 * 🔴 AND DATE WINDOWS CANNOT TILE THE REGISTER. `startDate`/`endDate` filters
 * fully-contained-within -- a contract's own start AND end must both sit inside
 * the window -- so everything spanning a boundary is invisible to both
 * neighbours. Year windows recovered 24,933 of 204,991.
 *
 * What is left is one request for everything, and one question: did we receive
 * as many rows as the API says exist? A partial register that LOOKS complete is
 * the failure this file exists to make impossible. */

export interface RegisterPage {
  /** What the API says exists: `pagination.totalResults`. */
  total: number;
  /** What it actually handed over: `results`. */
  rows: unknown[];
}

/* Read from two different places on purpose. Deriving `total` from
 * `rows.length` would make assertComplete tautologically true. */
export function parseRegister(payload: string): RegisterPage {
  const j = JSON.parse(payload) as {
    results?: unknown[];
    pagination?: { totalResults?: number };
  };
  return {
    total: Number(j.pagination?.totalResults ?? 0),
    rows: j.results ?? [],
  };
}

export function assertComplete(page: RegisterPage): void {
  if (page.rows.length !== page.total) {
    throw new Error(
      `Incomplete register fetch: the API reports ${page.total} contracts but ` +
        `returned ${page.rows.length}. There is no cursor to continue with — ` +
        `this source silently ignores its own page parameter — so this is a ` +
        `hard stop rather than something to page past.`,
    );
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/contracts/completeness.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Mutation-prove the assertion, twice**

**Mutation A.** In `parseRegister`, change `total` to `Number(j.results?.length ?? 0)` — derive it from the rows.
Run the **whole file**. Expected: *"parseRegister reads the total and the rows from DIFFERENT places"* fails. Revert.

**Mutation B.** Change `assertComplete`'s condition to `if (false)`.
Run the **whole file**. Expected: *"a short page throws"* and *"more rows than the stated total also throws"* both fail. Revert.

Confirm 5 pass.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/contracts/completeness.ts app/server/src/contracts/completeness.test.ts
git commit -m "The completeness assertion, because there is no cursor to continue with"
```

---

## Task 4: `eds-client.ts` — two requests, politely

> ⚠️ **REWRITTEN after Task 1 — Ruling 3.** No windows, no pagination.
> **Two requests total:** one with `pageSize: 1` to learn `totalResults`, then
> one for that many rows plus a margin. The size comes from the API rather than
> a hard-coded 204,991, so a growing register cannot silently truncate us.

**Files:**
- Create: `app/server/src/contracts/eds-client.ts`
- Create: `app/server/src/contracts/fixtures/eds-sample.json`
- Test: `app/server/src/contracts/eds-client.test.ts`

**Interfaces:**
- Consumes: `parseRegister`, `assertComplete` from `./completeness.js`.
- Produces:
  - `const EDS_URL: string`
  - `interface EdsRow { id: string; vendorName: string; agencyName: string; businessUnit: string; startDate: string; endDate: string; amount: number; actionType: string; amendment: number; zipCode: string; pdfUrl: string }`
  - `async function fetchRegister(opts?: { fetchImpl?: typeof fetch; delayMs?: number }): Promise<EdsRow[]>`

- [ ] **Step 1: Capture the fixture**

The real register is 78 MB — far too large to commit. Capture a small **real**
slice instead:

```bash
cd "C:/Users/matts/Desktop/Tenderfoot"
node --input-type=module -e '
import { writeFileSync } from "node:fs";
const U = "https://secure.in.gov/apps/idoa/contractsearch/api/contracts/search";
const H = { "content-type": "application/json", accept: "application/json",
  "user-agent": "Tenderfoot/0.1 (Koehler Partners; procurement research)" };
const r = await (await fetch(U, { method: "POST", headers: H,
  body: JSON.stringify({ page: 1, pageSize: 200 }) })).json();
writeFileSync("app/server/src/contracts/fixtures/eds-sample.json",
  JSON.stringify({ results: r.results,
                   pagination: { totalResults: r.results.length } }, null, 1));
console.log("captured " + r.results.length + " rows");
'
```

⚠️ **Note what that rewrite does and why it is honest:** `totalResults` is set to
the sample's own row count so the fixture is internally consistent and
`assertComplete` passes on it. The register's real 204,991 is asserted against
the live API in Task 8, never against a fixture.

If the sandbox blocks outbound network to `secure.in.gov`, run the capture with
the sandbox disabled — it is a read of a public endpoint.

- [ ] **Step 2: Write the failing test**

Create `app/server/src/contracts/eds-client.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { fetchRegister } from "./eds-client.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(HERE, "fixtures/eds-sample.json"), "utf8");
const SAMPLE = JSON.parse(FIXTURE) as { results: unknown[] };

test("it asks for the count first, then for that many rows", async () => {
  const bodies: Array<Record<string, number>> = [];
  const fake: typeof fetch = async (_u, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(FIXTURE, { status: 200 });
  };
  const rows = await fetchRegister({ fetchImpl: fake, delayMs: 0 });

  expect(bodies).toHaveLength(2);
  /* First: the cheapest possible question -- how many are there? */
  expect(bodies[0]!.pageSize).toBe(1);
  /* Second: at least that many. The count comes FROM THE API, never from a
   * hard-coded 204,991, so a growing register cannot silently truncate us. */
  expect(bodies[1]!.pageSize).toBeGreaterThanOrEqual(SAMPLE.results.length);
  expect(rows).toHaveLength(SAMPLE.results.length);
});

test("`page` is always 1 and is never used as a cursor", async () => {
  const bodies: Array<Record<string, number>> = [];
  const fake: typeof fetch = async (_u, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(FIXTURE, { status: 200 });
  };
  await fetchRegister({ fetchImpl: fake, delayMs: 0 });
  /* This API ignores `page` entirely, so sending anything but 1 would be a lie
   * about how the fetcher works. Both keys must still always be present: an
   * empty body returns a ZEROED pagination block, not everything. */
  for (const b of bodies) expect(b.page).toBe(1);
});

test("it sends an identifying user-agent", async () => {
  let ua = "";
  const fake: typeof fetch = async (_u, init) => {
    ua = String((init?.headers as Record<string, string>)["user-agent"] ?? "");
    return new Response(FIXTURE, { status: 200 });
  };
  await fetchRegister({ fetchImpl: fake, delayMs: 0 });
  expect(ua).toMatch(/Tenderfoot/);
});

test("a non-2xx stops on the first failure rather than retrying", async () => {
  let calls = 0;
  const fake: typeof fetch = async () => {
    calls += 1;
    return new Response("no", { status: 429 });
  };
  await expect(fetchRegister({ fetchImpl: fake, delayMs: 0 })).rejects.toThrow(/429/);
  /* Retrying into a rate limiter is how a guest gets blocked. */
  expect(calls).toBe(1);
});

/* 🔴 The completeness assertion must fire THROUGH the client, not only in its
 * own unit test. A response shorter than its stated total is the silent
 * truncation case, and there is no cursor to recover with. */
test("a short response throws instead of returning a partial register", async () => {
  const short = JSON.stringify({ results: [{ id: "x" }], pagination: { totalResults: 500 } });
  const fake: typeof fetch = async () => new Response(short, { status: 200 });
  await expect(fetchRegister({ fetchImpl: fake, delayMs: 0 })).rejects.toThrow(
    /Incomplete register/,
  );
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/contracts/eds-client.test.ts`
Expected: FAIL — `Cannot find module './eds-client.js'`

- [ ] **Step 4: Write the implementation**

Create `app/server/src/contracts/eds-client.ts`:

```typescript
/* Two requests against Indiana's public contract register, politely.
 *
 * A state transparency API is an intended-use resource, not something to be
 * squeezed: an identifying User-Agent, a pause between the two calls, and STOP
 * on the first non-2xx rather than retrying into a rate limiter. The polite
 * failure is to stop.
 *
 * WHY TWO REQUESTS AND NOT MANY. `page` is silently ignored by this source, and
 * date windows cannot tile it -- they filter fully-contained-within, so
 * anything spanning a boundary vanishes from both neighbours. What works is
 * asking for everything at once: measured 2026-09-03, 204,991 rows in 47s at
 * 78 MB. The first request costs one row and says how many to ask for; the
 * second gets them. */
import { parseRegister, assertComplete, type RegisterPage } from "./completeness.js";

export const EDS_URL =
  "https://secure.in.gov/apps/idoa/contractsearch/api/contracts/search";

const UA = "Tenderfoot/0.1 (Koehler Partners; procurement research)";

/* Asked for on top of the reported total, so a handful of contracts filed
 * between the count and the fetch cannot truncate the run. If that margin is
 * ever not enough, assertComplete catches it loudly. */
const MARGIN = 5_000;

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

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

async function ask(doFetch: typeof fetch, pageSize: number): Promise<RegisterPage> {
  const res = await doFetch(EDS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": UA,
    },
    /* page is ALWAYS 1 and is not a cursor -- this API ignores it. Both keys
     * must be present regardless: an empty body returns a zeroed pagination
     * block rather than everything. */
    body: JSON.stringify({ page: 1, pageSize }),
  });

  if (!res.ok) {
    throw new Error(
      `EDS returned ${res.status}. Stopping rather than retrying — see the ` +
        `politeness note in this file's header.`,
    );
  }
  return parseRegister(await res.text());
}

export async function fetchRegister(
  opts: { fetchImpl?: typeof fetch; delayMs?: number } = {},
): Promise<EdsRow[]> {
  const doFetch = opts.fetchImpl ?? fetch;
  const delayMs = opts.delayMs ?? 1000;

  /* One row, purely to read pagination.totalResults. Cheap, and it means the
   * size comes from the API rather than a constant that rots. */
  const probe = await ask(doFetch, 1);
  if (delayMs > 0) await sleep(delayMs);

  const full = await ask(doFetch, probe.total + MARGIN);
  assertComplete(full);
  return full.rows as EdsRow[];
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --env-file=.env node_modules/vitest/vitest.mjs run app/server/src/contracts/eds-client.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Mutation-prove the stop-on-error**

Change the `if (!res.ok)` block so it falls through instead of throwing.

Run the **whole file**. Expected: *"a non-2xx stops on the first failure"* fails.

Revert and re-run.

- [ ] **Step 7: Commit**

```bash
git add app/server/src/contracts/eds-client.ts app/server/src/contracts/eds-client.test.ts app/server/src/contracts/fixtures/eds-sample.json
git commit -m "Two requests: ask how many, then ask for them"
```

---

## Task 5: `import.ts` — the idempotent write

**Files:**
- Create: `app/server/src/contracts/import.ts`
- Test: `app/server/src/contracts/import.test.ts`

**Interfaces:**
- Consumes: `EdsRow` from `./eds-client.js`; `tx` from `../db/index.js`.

> ⚠️ **TWO CONTROLLER RULINGS BIND THIS TASK — they override the code below.**
>
> **Ruling 1: do NOT use `ON CONFLICT (name)` on `organization`.** That table's
> `name` column has **no unique constraint** (the only UNIQUE in migration 002 is
> `organization_alias (alias, org_id)`), so Postgres rejects it as a conflict
> target and the statement fails at runtime. **Use the pattern `merge.ts` already
> uses at `merge/merge.ts:610`:** `SELECT id, name FROM organization WHERE name =
> ANY($1::text[])`, then insert only the names not found. Measured: 698
> organizations, 0 duplicate names.
>
> **Ruling 2: do NOT import `orgChain`.** The EDS payload publishes a flat
> `agencyName` with no hierarchy, so there is no chain to read. Insert the name
> directly and leave the import out entirely.
>
> **Ruling 4: INSERT IN BATCHES OF 5,000.** After Task 1, the whole register
> arrives in ONE fetch of 204,991 rows. A single `unnest` insert would carry
> eight arrays of 204,991 elements — roughly 50 MB of bind parameters in one
> statement. Chunk the rows and run one insert per chunk inside the same
> transaction. `written` and `skipped` accumulate across chunks.
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
- Consumes: `importContracts` from `./import.js`; `EdsRow`, `fetchRegister` from `./eds-client.js`.

> ⚠️ **REWRITTEN after Task 1 — Ruling 3. There is no year loop.**
> The register arrives in ONE fetch. `ingestContracts` takes a `fetchAll: () =>
> Promise<EdsRow[]>` instead of `fetchWindow`, drops `fromYear`/`toYear`, and
> records **one** `ingest_run` for the whole register rather than one per window.
> `IngestReport` becomes `{ fetched, written, skipped }` — `windows` and
> `requests` no longer exist. Update the tests in this task to match: the
> two-year walk test becomes a single-fetch test, and the "window that cannot be
> split" test becomes "a short fetch aborts the ingest", driven by a `fetchAll`
> that rejects with `/Incomplete register/`.
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
- Consumes: `ingestContracts` from `./ingest.js`; `fetchRegister` from `./eds-client.js`.

> ⚠️ **REWRITTEN after Task 1 — Ruling 3.** The CLI takes **no year arguments**;
> the register is fetched whole. Drop the `fromYear`/`toYear` parsing and its
> usage error, drop the `windows` and `requests` lines from the printed report,
> and pass `fetchAll: () => fetchRegister()`. Keep the elapsed-time line — the
> real fetch takes about 47 seconds and a silent minute reads as a hang.
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
