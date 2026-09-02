# IDOA Adapter and the Second Source Shape — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest Indiana IDOA solicitations by teaching the scrape framework a second source shape — undated open-set snapshots — without letting a synthesised date pass as a published one.

**Architecture:** `Adapter` becomes a discriminated union of `WindowedAdapter` (today's behaviour, unchanged) and `SnapshotAdapter` (no date window, no cross-invocation resume). `SnapshotItem` structurally omits `modifiedAt`, so an undated source cannot fabricate one. `run.ts` dispatches on `shape`. A listing-level provenance marker distinguishes a published date from an observed one before IDOA writes either.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Node 24, Express, Postgres via `pg`, Vitest, `linkedom` or regex parsing for HTML (see Task 7), existing `artifact.ts` capture layer.

**Spec:** `docs/superpowers/specs/2026-09-02-idoa-adapter-design.md` — read it first; this plan argues from it.

## Global Constraints

- **`npm run check` is the gate and must exit 0.** It runs typecheck, the full Vitest suite, the token round-trip, and a dev-gallery absence check.
- **Tests use Vitest**, not Jest. Import `{ expect, test }` from `"vitest"`.
- **ESM with explicit `.js` specifiers** on relative imports, even from `.ts` files (`./sam.js`).
- **Mutation-prove important tests whole-file, never with `-t`** (Proto2PRD lesson 2.23): a `-t` filter skips the other tests and proves nothing about isolation. Record which tests failed *and* which passed.
- **Do not fabricate dates.** The entire point of this slice. If a value is not published by the source, it is not written as though it were.
- **`DATABASE_URL` points at the `test` branch by design.** Never run migrations against production from a task; production migration is a deliberate operator act (`npm run migrate:production`).
- **Commit after every task.** Frequent commits; each task's deliverable stands alone.
- **Spec §11 scope fence:** no screen, no scheduling, no second adapter, no capability declarations.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/server/src/scrape/adapter.ts` | **Modify.** Split `Adapter` into the union; add `SourceShape`, `WindowedItem`/`SnapshotItem`, `WindowedPage`/`SnapshotPage`. |
| `app/server/src/scrape/contract.ts` | **Modify.** `since` becomes conditional on shape; add `limit`. |
| `app/server/src/scrape/run.ts` | **Modify.** Dispatch on `shape`; add `runSnapshot`; enforce `limit`. |
| `app/server/src/scrape/adapters/idoa.ts` | **Create.** Parse the IDOA table; `parseIdoaPage` exported for fixture tests. |
| `app/server/src/scrape/adapters/idoa.test.ts` | **Create.** Fixture-driven parse tests. |
| `app/server/src/scrape/adapters/fixtures/idoa-listing.html` | **Create.** Captured live page. |
| `app/server/src/scrape/adapters/registry.ts` | **Modify.** Register `idoa`. |
| `app/server/src/scrape/adapters/{sam,usaspending,fake}.ts` | **Modify.** Add `shape: "windowed"`. |
| `app/server/migrations/014_date_provenance.sql` | **Create.** The provenance marker. |
| `app/server/src/merge/posted-at.ts` | **Modify.** Write provenance alongside the value. |
| `app/server/src/scrape/cli.ts` | **Modify.** `--limit`, `--listings-only`, `--documents-only`; chain by default. |
| `docs/2026-09-02-idoa-page-facts.md` | **Create.** Task 1's recorded findings. |

---

## Task 1: Verify the page before parsing a line of it

**Spec:** §3.1 (the third table) and §8 (the ordering trap). **Blocking — do this first.**

**Files:**
- Create: `docs/2026-09-02-idoa-page-facts.md`
- Create: `app/server/src/scrape/adapters/fixtures/idoa-listing.html`

**Interfaces:**
- Consumes: nothing.
- Produces: the fixture every later task parses, and two answers Task 7 depends on.

- [ ] **Step 1: Capture the live page to the fixture path**

```bash
curl -sS "https://www.in.gov/idoa/procurement/current-business-opportunities/" \
  -o app/server/src/scrape/adapters/fixtures/idoa-listing.html
wc -c app/server/src/scrape/adapters/fixtures/idoa-listing.html
```

Expected: a file of non-trivial size (tens of KB). If it is tiny, the page is JS-rendered after all and the spec's "static HTML" claim is wrong — **stop and report that**, because it invalidates §3.

- [ ] **Step 2: Answer "what is the third table?"**

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const html = readFileSync('app/server/src/scrape/adapters/fixtures/idoa-listing.html','utf8');
const tables = html.split(/<table/i).slice(1);
tables.forEach((t,i)=>{
  const headers = [...t.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m=>m[1].replace(/<[^>]+>/g,'').trim());
  const rows = (t.match(/<tr/gi)||[]).length - 1;
  console.log('table '+i+': rows='+rows+'  headers='+JSON.stringify(headers));
});
"
```

Record every table's headers and row count.

- [ ] **Step 3: Answer "what is the row ordering?"**

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const html = readFileSync('app/server/src/scrape/adapters/fixtures/idoa-listing.html','utf8');
const ids = [...html.matchAll(/\b(\d{15})\b/g)].map(m=>m[1]);
const dues = [...html.matchAll(/(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}(?:AM|PM))/gi)].map(m=>m[1]);
const asc = (a)=>a.every((v,i)=>i===0||a[i-1]<=v);
console.log('event ids in document order, sorted ascending? ', asc(ids));
console.log('due dates in document order, sorted ascending? ', asc(dues.map(d=>d.slice(6,10)+d.slice(0,2)+d.slice(3,5))));
console.log('first 5 ids : ', ids.slice(0,5));
console.log('first 5 dues: ', dues.slice(0,5));
"
```

- [ ] **Step 4: Write the findings down**

Create `docs/2026-09-02-idoa-page-facts.md` recording, with the capture date:
the number of `<table>` elements and each one's headers and row count; **which
tables contain solicitations and the TOTAL row count across them**; whether the
ordering is by due date, by Event ID, or neither; and — if neither — the
explicit statement that **no order-derived signal may be recorded** (spec §8's
default-out posture).

- [ ] **Step 5: Commit**

```bash
git add docs/2026-09-02-idoa-page-facts.md app/server/src/scrape/adapters/fixtures/idoa-listing.html
git commit -m "IDOA: capture the page and answer the two questions parsing depends on"
```

---

## Task 2: Split the Adapter type into two shapes

**Spec:** §2.1.

**Files:**
- Modify: `app/server/src/scrape/adapter.ts`
- Modify: `app/server/src/scrape/adapters/sam.ts`, `usaspending.ts`, `fake.ts`
- Test: `app/server/src/scrape/adapter.test.ts` (create)

**Interfaces:**
- Produces: `SourceShape`, `WindowedItem`, `SnapshotItem`, `WindowedPage`, `SnapshotPage`, `WindowedAdapter`, `SnapshotAdapter`, `Adapter` (union), and the type guard `isSnapshot(a: Adapter): a is SnapshotAdapter`.

- [ ] **Step 1: Write the failing test**

Create `app/server/src/scrape/adapter.test.ts`:

```ts
import { expect, test } from "vitest";
import { isSnapshot, type Adapter, type SnapshotAdapter } from "./adapter.js";

const snap: SnapshotAdapter = {
  shape: "snapshot",
  name: "stub",
  async fetchSnapshot() {
    return { items: [], nextCursor: null, requestUrl: "x", httpStatus: 200, payload: "" };
  },
};

test("isSnapshot narrows the union", () => {
  const a: Adapter = snap;
  expect(isSnapshot(a)).toBe(true);
  if (isSnapshot(a)) {
    /* Compiles only because the guard narrowed it -- a windowed adapter has
     * no fetchSnapshot. This is the assertion the whole type split exists
     * for, and it is checked by tsc, not at runtime. */
    expect(typeof a.fetchSnapshot).toBe("function");
  }
});

test("a snapshot item has nowhere to put a date", () => {
  /* The point of SnapshotItem: fabricating a modifiedAt must be
   * structurally impossible, not merely discouraged. If someone widens
   * SnapshotItem to allow it, this stops compiling. */
  const item = { externalId: "a", raw: {} };
  expect(Object.keys(item)).not.toContain("modifiedAt");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run app/server/src/scrape/adapter.test.ts`
Expected: FAIL — `isSnapshot` is not exported from `./adapter.js`.

- [ ] **Step 3: Rewrite `adapter.ts`**

Keep every existing comment; add the split. The file becomes:

```ts
export type SourceShape = "windowed" | "snapshot";

export interface WindowedItem {
  externalId: string;
  modifiedAt: string;
  raw: unknown;
}

/* NO modifiedAt, and that is the whole point: an undated source must have
 * nowhere to put a fabricated date. See the design doc §2.1. */
export interface SnapshotItem {
  externalId: string;
  raw: unknown;
}

interface PageBase {
  nextCursor: string | null;
  requestUrl: string;
  httpStatus: number;
  payload: string;
}

export interface WindowedPage extends PageBase {
  items: WindowedItem[];
  undatedSkipped?: number;
}

export interface SnapshotPage extends PageBase {
  items: SnapshotItem[];
  /* No undatedSkipped: there is no date to be missing, so the counter would
   * always read 0 and be mistaken for "we checked and found none". */
}

export interface WindowedAdapter {
  shape: "windowed";
  name: string;
  fetchListing(since: string, until: string, cursor: string | null): Promise<WindowedPage>;
}

export interface SnapshotAdapter {
  shape: "snapshot";
  name: string;
  fetchSnapshot(cursor: string | null): Promise<SnapshotPage>;
}

export type Adapter = WindowedAdapter | SnapshotAdapter;

export function isSnapshot(a: Adapter): a is SnapshotAdapter {
  return a.shape === "snapshot";
}

/** @deprecated Kept so existing importers keep compiling. Use WindowedItem. */
export type ListingItem = WindowedItem;
/** @deprecated Kept so existing importers keep compiling. Use WindowedPage. */
export type ListingPage = WindowedPage;
```

- [ ] **Step 4: Tag the three existing adapters**

In `sam.ts`, `usaspending.ts` and `fake.ts`, add `shape: "windowed" as const,` as the
first property of the returned adapter object. No other change.

- [ ] **Step 5: Run typecheck and the full suite**

Run: `npm run typecheck && npx vitest run`
Expected: PASS. Fix any consumer the union broke by narrowing with `isSnapshot`.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/scrape/adapter.ts app/server/src/scrape/adapter.test.ts app/server/src/scrape/adapters/
git commit -m "Adapters have a shape, and a snapshot item has nowhere to put a date"
```

---

## Task 3: `since` becomes conditional, and `limit` arrives

**Spec:** §4, §5.

**Files:**
- Modify: `app/server/src/scrape/contract.ts`
- Test: `app/server/src/scrape/contract.test.ts` (exists — add to it)

**Interfaces:**
- Consumes: `SourceShape` from Task 2.
- Produces: `RunRequest.limit?: number`, `RunRequest.since?: string`, and `validateRun(input, shape: SourceShape)`.

- [ ] **Step 1: Write the failing tests**

Append to `app/server/src/scrape/contract.test.ts`:

```ts
test("a windowed run still refuses to start without a window", () => {
  expect(() => validateRun({ source: "sam", depth: "listing" }, "windowed")).toThrow(/since is required/);
});

test("a snapshot run does not take a window at all", () => {
  const r = validateRun({ source: "idoa", depth: "listing" }, "snapshot");
  expect(r.since).toBeUndefined();
  expect(r.until).toBeUndefined();
});

test("a snapshot run REJECTS a window rather than ignoring it", () => {
  /* Silently accepting `since` on a source that cannot honour it is exactly
   * the §5.4 failure -- a parameter accepted and quietly ignored. */
  expect(() => validateRun({ source: "idoa", depth: "listing", since: "2026-01-01" }, "snapshot"))
    .toThrow(/does not accept a date window/);
});

test("limit is accepted, bounded, and optional", () => {
  expect(validateRun({ source: "idoa", depth: "listing", limit: 10 }, "snapshot").limit).toBe(10);
  expect(validateRun({ source: "idoa", depth: "listing" }, "snapshot").limit).toBeUndefined();
  expect(() => validateRun({ source: "idoa", depth: "listing", limit: 0 }, "snapshot"))
    .toThrow(/limit must be a positive integer/);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run app/server/src/scrape/contract.test.ts`
Expected: FAIL — `validateRun` takes one argument.

- [ ] **Step 3: Implement**

Add `"limit"` to `ALLOWED`. Change the signature to `validateRun(input: unknown, shape: SourceShape): RunRequest`. Make `since`/`until` optional on `RunRequest`. Then:

```ts
  if (shape === "snapshot") {
    if (o.since !== undefined || o.until !== undefined) {
      throw new Error(
        "A snapshot source does not accept a date window. It returns what is currently open; " +
          "there is no past to ask for. See the IDOA design §4.",
      );
    }
  } else {
    /* Unchanged, and still fail-closed: a missing window must never mean
     * "everything". */
    if (typeof o.since !== "string" || !o.since) {
      throw new Error("since is required — a run with no window refuses to start");
    }
    if (!isValidDate(o.since)) {
      throw new Error(`since must be an ISO-8601 date (YYYY-MM-DD[T...]), got: ${o.since}`);
    }
  }

  if (o.limit !== undefined) {
    if (typeof o.limit !== "number" || !Number.isInteger(o.limit) || o.limit < 1) {
      throw new Error(`limit must be a positive integer, got: ${String(o.limit)}`);
    }
  }
```

Return `since`/`until` only on the windowed branch; carry `limit: o.limit as number | undefined`.

- [ ] **Step 4: Update the two entry points**

`cli.ts` and `routes/admin.ts` call `validateRun`. Both already call `resolveSource()`; pass the resolved adapter's `shape` as the second argument.

- [ ] **Step 5: Run the full suite**

Run: `npm run typecheck && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/scrape/contract.ts app/server/src/scrape/contract.test.ts app/server/src/scrape/cli.ts app/server/src/routes/admin.ts
git commit -m "A snapshot run refuses a window rather than ignoring one, and limit arrives"
```

---

## Task 4: `run.ts` dispatches on shape

**Spec:** §4, §4.1.

**Files:**
- Modify: `app/server/src/scrape/run.ts`
- Test: `app/server/src/scrape/run.test.ts` (exists — add to it)

**Interfaces:**
- Consumes: `isSnapshot`, `SnapshotAdapter` (Task 2); `RunRequest.limit` (Task 3).
- Produces: `runScrape` accepting either shape; `RunResult.nextUntil` is `null` for snapshots.

- [ ] **Step 1: Write the failing test**

```ts
import { isSnapshot } from "./adapter.js";

function stubSnapshot(pages: Array<{ ids: string[]; next: string | null }>) {
  let i = 0;
  return {
    shape: "snapshot" as const,
    name: "stub-snap",
    async fetchSnapshot(_cursor: string | null) {
      const p = pages[i++]!;
      return {
        items: p.ids.map((id) => ({ externalId: id, raw: { id } })),
        nextCursor: p.next,
        requestUrl: "https://example.test/page",
        httpStatus: 200,
        payload: JSON.stringify(p.ids),
      };
    },
  };
}

test("a snapshot run walks its pages and reports no resume marker", async () => {
  const adapter = stubSnapshot([
    { ids: ["a", "b"], next: "p2" },
    { ids: ["c"], next: null },
  ]);
  const res = await runScrape(
    { source: "stub-snap", depth: "listing", budgetMs: 60_000 },
    adapter,
    tmpArtifactPath(),
  );
  expect(res.rows).toBe(3);
  expect(res.done).toBe(true);
  /* There is no window to narrow, so there is nothing to resume FROM.
   * A date here would be an invented one. */
  expect(res.nextUntil).toBeNull();
  expect(res.noProgress).toBe(false);
});

test("a partial snapshot run does not offer a resume it cannot honour", async () => {
  const adapter = stubSnapshot([{ ids: ["a"], next: "p2" }]);
  const res = await runScrape(
    { source: "stub-snap", depth: "listing", budgetMs: 0 },
    adapter,
    tmpArtifactPath(),
  );
  expect(res.done).toBe(false);
  expect(res.nextUntil).toBeNull();
});
```

Use whatever `tmpArtifactPath()` helper `run.test.ts` already uses; if it has none, write the artifact into `os.tmpdir()`.

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run app/server/src/scrape/run.test.ts`
Expected: FAIL — `runScrape` calls `adapter.fetchListing`, which a snapshot adapter does not have.

- [ ] **Step 3: Extract the windowed loop, add the snapshot loop**

Rename the existing body to `runWindowed(req, adapter, art, now, started)`. Add:

```ts
/* THE SNAPSHOT LOOP. Deliberately much smaller than the windowed one: there
 * is no window to narrow, so there is no lowWater, no nextUntil, and no
 * cross-invocation resume.
 *
 * A snapshot of "what is currently open" SHIFTS between runs, so a cursor
 * saved from a previous invocation may skip rows or duplicate them, and
 * neither failure is visible in the result. So a run that exhausts its
 * budget reports partial and starts over next time. At IDOA's ~50 rows that
 * costs nothing; if a snapshot source ever grows big enough for it to hurt,
 * repeated partial runs say so loudly instead of miscounting quietly. */
async function runSnapshot(
  req: RunRequest,
  adapter: SnapshotAdapter,
  art: ReturnType<typeof openArtifact>,
  now: () => number,
  started: number,
): Promise<RunResult> {
  let cursor: string | null = null;
  let rows = 0;
  let done = false;

  for (;;) {
    const page = await adapter.fetchSnapshot(cursor);
    const capId = art.writeCapture({
      hop: "listing",
      url: page.requestUrl,
      httpStatus: page.httpStatus,
      payload: page.payload,
    });
    for (const item of page.items) {
      if (req.limit !== undefined && rows >= req.limit) break;
      art.writeRecord({ externalId: item.externalId, captureId: capId, raw: item.raw });
      rows++;
    }
    if (req.limit !== undefined && rows >= req.limit) { done = true; break; }
    cursor = page.nextCursor;
    if (cursor === null) { done = true; break; }
    if (now() - started >= req.budgetMs) break;
  }

  return { done, nextUntil: null, rows, artifactPath: art.path, undatedSkipped: 0, noProgress: false };
}
```

Then dispatch at the top of `runScrape`:

```ts
  if (isSnapshot(adapter)) return runSnapshot(req, adapter, art, now, started);
  return runWindowed(req, adapter, art, now, started);
```

Match `art.writeRecord`'s real signature — read `artifact.ts` before writing this step.

- [ ] **Step 4: Run and verify**

Run: `npx vitest run app/server/src/scrape/run.test.ts`
Expected: PASS, including every pre-existing windowed test.

- [ ] **Step 5: Mutation-prove the dispatch**

Replace the dispatch with `return runWindowed(req, adapter as never, art, now, started);` and run the **whole file**: `npx vitest run app/server/src/scrape/run.test.ts`. Both snapshot tests must fail; every windowed test must still pass. Record which failed and which passed, then revert.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/scrape/run.ts app/server/src/scrape/run.test.ts
git commit -m "run.ts dispatches on shape, and a snapshot offers no resume it cannot honour"
```

---

## Task 5: `limit` on the windowed path too

**Spec:** §5 — `limit` applies to **both** shapes.

**Files:**
- Modify: `app/server/src/scrape/run.ts`
- Test: `app/server/src/scrape/run.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("limit stops a windowed run at the requested number of rows", async () => {
  const adapter = stubWindowed([
    { items: [d("a","2026-01-03"), d("b","2026-01-02"), d("c","2026-01-01")], next: null },
  ]);
  const res = await runScrape(
    { source: "stub", since: "2026-01-01", until: "2026-01-04", depth: "listing", budgetMs: 60_000, limit: 2 },
    adapter,
    tmpArtifactPath(),
  );
  expect(res.rows).toBe(2);
  /* The budget is a platform rail; the limit is operator intent. Hitting the
   * limit is a completed request, not a truncated one. */
  expect(res.done).toBe(true);
});
```

`d(id, date)` builds `{ externalId: id, modifiedAt: date, raw: {} }`; `stubWindowed` mirrors `stubSnapshot` but implements `fetchListing`. Reuse whatever `run.test.ts` already has if equivalent helpers exist.

- [ ] **Step 2: Run and watch it fail** — `npx vitest run app/server/src/scrape/run.test.ts`. Expected: `rows` is 3.

- [ ] **Step 3: Enforce it in `runWindowed`**

Inside the per-item loop, before writing:

```ts
      /* Operator intent, distinct from the time budget. Hitting the budget
       * means the platform stopped us; hitting the limit means this is what
       * was asked for -- so this path sets done rather than leaving a
       * partial run the caller would try to resume. */
      if (req.limit !== undefined && rows >= req.limit) { done = true; break; }
```

and break the outer page loop when `done` is set.

⚠️ **Do not let the limit poison `lowWater`.** `lowWater` must reflect rows actually **written**. Stopping mid-page is fine; recomputing or skipping the `lowWater` update is not.

- [ ] **Step 4: Run the whole file** — `npx vitest run app/server/src/scrape/run.test.ts`. Expected: PASS, all tests.

- [ ] **Step 5: Mutation-prove** — delete the `limit` guard, run the whole file. Exactly the two limit tests (Tasks 4 and 5) must fail. Revert.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/scrape/run.ts app/server/src/scrape/run.test.ts
git commit -m "limit is operator intent and applies to both shapes"
```

---

## Task 6: Date provenance, before anything writes an observed date

**Spec:** §7. **This must land before Task 8 enables IDOA.**

**Files:**
- Create: `app/server/migrations/014_date_provenance.sql`
- Modify: `app/server/src/merge/posted-at.ts`
- Test: `app/server/src/merge/posted-at.test.ts`

**Interfaces:**
- Produces: `solicitation.posted_at_origin` with values `published | observed`, NULL when `posted_at` is NULL.

- [ ] **Step 1: Write the migration**

```sql
-- WHERE DID THIS DATE COME FROM? Nothing has ever asked.
--
-- Ruled by Matt 2026-09-02: "Adapters return what they can, and the merge
-- layer sorts out what's trustworthy." That ruling only works if merge can
-- TELL. `extracted_field` already carries origin and confidence; listing-level
-- dates are merged bare, so a first-seen-derived posted_at written into the
-- same column is indistinguishable from SAM's published one -- and the
-- distinction is lost silently, which is the shape of every field-level defect
-- this project has already paid for.
--
--   published  the source states this date. SAM.gov's postedDate.
--   observed   WE first saw the row on this date. IDOA and every other
--              snapshot source, which publish no posting date at all.
--
-- NULL when posted_at is NULL: a provenance for a value that does not exist
-- would be inventing the thing this column exists to prevent.
ALTER TABLE solicitation ADD COLUMN posted_at_origin text;

ALTER TABLE solicitation ADD CONSTRAINT solicitation_posted_at_origin_valid
  CHECK (
    (posted_at IS NULL AND posted_at_origin IS NULL)
    OR (posted_at IS NOT NULL AND posted_at_origin IN ('published', 'observed'))
  );

-- Every row that exists today came from SAM.gov, which publishes postedDate.
-- Correct, cheap, and true -- not a default chosen for convenience.
UPDATE solicitation SET posted_at_origin = 'published' WHERE posted_at IS NOT NULL;
```

- [ ] **Step 2: Write the failing test**

```ts
test("a published posted_at is recorded as published", async () => {
  // ...seed a solicitation via the existing merge test harness...
  const row = await one(`SELECT posted_at, posted_at_origin FROM solicitation WHERE id = $1`, [id]);
  expect(row.posted_at_origin).toBe("published");
});

test("the CHECK refuses a date with no provenance", async () => {
  await expect(
    run(`UPDATE solicitation SET posted_at = '2026-01-01', posted_at_origin = NULL WHERE id = $1`, [id]),
  ).rejects.toThrow(/solicitation_posted_at_origin_valid/);
});
```

Follow the existing patterns in `posted-at.test.ts` for schema setup (`useTestSchema()`).

- [ ] **Step 3: Run and watch it fail** — `npx vitest run app/server/src/merge/posted-at.test.ts`. Expected: FAIL, column does not exist.

- [ ] **Step 4: Apply the migration to the test branch and implement**

```bash
node --env-file-if-exists=.env --import tsx app/server/src/db/migrate.ts
```

Then update `posted-at.ts` to write `posted_at_origin = 'published'` wherever it writes `posted_at` from a payload.

- [ ] **Step 5: Run the full suite** — `npm run check`. Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/server/migrations/014_date_provenance.sql app/server/src/merge/posted-at.ts app/server/src/merge/posted-at.test.ts
git commit -m "A date now says where it came from, before anything writes an observed one"
```

---

## Task 7: The IDOA adapter

**Spec:** §3, §6.1, §8. **Depends on Task 1's answers.**

**Files:**
- Create: `app/server/src/scrape/adapters/idoa.ts`
- Create: `app/server/src/scrape/adapters/idoa.test.ts`

**Interfaces:**
- Consumes: `SnapshotAdapter`, `SnapshotItem`, `SnapshotPage` (Task 2).
- Produces: `parseIdoaPage(html: string): { items: SnapshotItem[] }` and `idoaAdapter(): SnapshotAdapter`.

`raw` per item is `{ eventId, eventName, agency, description, responseDueBy, contact, documentsUrl }` — all strings, `documentsUrl` nullable.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIdoaPage } from "./idoa.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(HERE, "fixtures/idoa-listing.html"), "utf8");

test("parses every solicitation row on the page", () => {
  const { items } = parseIdoaPage(FIXTURE);
  /* ⚠️ Replace N with the TOTAL from docs/2026-09-02-idoa-page-facts.md,
   * across every solicitations table -- not the largest one. An adapter that
   * silently reads one table of two is the defect this number guards. */
  expect(items.length).toBe(/* N from Task 1 */ 0);
});

test("an item carries the Event ID as its external id", () => {
  const { items } = parseIdoaPage(FIXTURE);
  expect(items[0]!.externalId).toMatch(/^\d{15}$/);
});

test("no item carries a date presented as a posting date", () => {
  /* The whole reason this shape exists. IDOA publishes no posting date, so
   * there must be nothing in the item that could be mistaken for one. */
  for (const item of parseIdoaPage(FIXTURE).items) {
    expect(item).not.toHaveProperty("modifiedAt");
  }
});

test("the documents URL is the scraped href, not a constructed one", () => {
  const { items } = parseIdoaPage(FIXTURE);
  const withDocs = items.filter((i) => (i.raw as any).documentsUrl);
  expect(withDocs.length).toBeGreaterThan(0);
  for (const i of withDocs) {
    expect((i.raw as any).documentsUrl).toMatch(/^https?:\/\//);
  }
});
```

- [ ] **Step 2: Run and watch it fail** — `npx vitest run app/server/src/scrape/adapters/idoa.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement the parser**

Parse with regex over the captured HTML (no new dependency — the project has none for HTML and `sam.ts` parses JSON). Walk `<tr>` blocks inside every table whose header row matches the solicitations headers recorded in Task 1; extract the six cells and the `href` of the Bid Documents anchor.

⚠️ **Take `documentsUrl` from the anchor's `href`.** Do not build it from the Event ID — a constructed URL is a guess about a pattern, and when the pattern changes it 404s silently across every row at once (spec §6.1).

- [ ] **Step 4: Implement the adapter**

```ts
export function idoaAdapter(): SnapshotAdapter {
  return {
    shape: "snapshot",
    name: "Indiana IDOA solicitations",
    async fetchSnapshot(_cursor: string | null): Promise<SnapshotPage> {
      const url = "https://www.in.gov/idoa/procurement/current-business-opportunities/";
      const res = await fetch(url);
      const payload = await res.text();
      const { items } = parseIdoaPage(payload);
      /* One page. If IDOA ever paginates, this is where a cursor goes --
       * and §4.1 already says a snapshot does not resume across
       * invocations, so the cursor is within-run only. */
      return { items, nextCursor: null, requestUrl: url, httpStatus: res.status, payload };
    },
  };
}
```

- [ ] **Step 5: Run and verify** — `npx vitest run app/server/src/scrape/adapters/idoa.test.ts`. Expected: PASS.

- [ ] **Step 6: Mutation-prove the row count**

Change the parser to read only the first matching table, then run the **whole file**. The row-count test must fail. Revert. (If the page turns out to have exactly one solicitations table, record that in the test's comment and skip this mutation, saying so.)

- [ ] **Step 7: Commit**

```bash
git add app/server/src/scrape/adapters/idoa.ts app/server/src/scrape/adapters/idoa.test.ts
git commit -m "The IDOA adapter reads every solicitations table, and carries no invented date"
```

---

## Task 8: Register it and turn the source on

**Files:**
- Modify: `app/server/src/scrape/adapters/registry.ts`
- Test: `app/server/src/scrape/resolve-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("idoa resolves to the registry row it binds to", () => {
  expect(ADAPTERS.idoa).toBeDefined();
  expect(ADAPTERS.idoa!.sourceName).toBe("Indiana IDOA solicitations");
  expect(ADAPTERS.idoa!.make().shape).toBe("snapshot");
});
```

- [ ] **Step 2: Run and watch it fail** — Expected: `ADAPTERS.idoa` is undefined.

- [ ] **Step 3: Register**

```ts
import { idoaAdapter } from "./idoa.js";
// ...
  idoa: { sourceName: "Indiana IDOA solicitations", make: () => idoaAdapter() },
```

The `sourceName` must match the `source.name` row **exactly** — resolve-source looks it up by name.

- [ ] **Step 4: Run the full gate** — `npm run check`. Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/server/src/scrape/adapters/registry.ts app/server/src/scrape/resolve-source.test.ts
git commit -m "IDOA is in the registry, and it is the first snapshot source"
```

> **Enabling the `source` row (`enabled = true`) is an operator act on a real database, not a code change.** It happens in Task 10, deliberately, after the adapter has been proven against the fixture.

---

## Task 9: The document pass, chained by default

**Spec:** §6.

**Files:**
- Modify: `app/server/src/scrape/cli.ts`
- Test: `app/server/src/scrape/cli.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test("by default a run does listings AND documents", async () => {
  const calls = await runCliWith(["--source", "idoa"]);
  expect(calls).toEqual(["listings", "documents"]);
});

test("--listings-only does exactly one half", async () => {
  expect(await runCliWith(["--source", "idoa", "--listings-only"])).toEqual(["listings"]);
});

test("--documents-only does exactly the other half", async () => {
  expect(await runCliWith(["--source", "idoa", "--documents-only"])).toEqual(["documents"]);
});

test("the two flags together are refused rather than silently ranked", async () => {
  await expect(runCliWith(["--source", "idoa", "--listings-only", "--documents-only"]))
    .rejects.toThrow(/mutually exclusive/);
});
```

`runCliWith` should invoke the CLI's exported main with injected fakes recording which passes ran; follow whatever seam `cli.test.ts` already uses.

- [ ] **Step 2: Run and watch them fail** — Expected: FAIL, flags unknown.

- [ ] **Step 3: Implement**

Add the two flags and the chaining. Carry this comment:

```ts
/* CHAINED BY DEFAULT, and the distinction is the point (design §6).
 *
 * A separate PASS is Matt's ruling: documents get their own budget and their
 * own failure modes. A separately INVOKED pass is not a ruling -- it is an
 * accident of how SAM was built, and it is measurable: after two slices,
 * 12 of 9,883 SAM solicitations have documents. 0.1%. A second pass nobody
 * invokes does not happen.
 *
 * So one operator action runs both. The flags exist for when exactly one is
 * wanted, and passing both is refused rather than silently ranked. */
```

- [ ] **Step 4: Run the whole file** — `npx vitest run app/server/src/scrape/cli.test.ts`. Expected: PASS.

- [ ] **Step 5: Mutation-prove the chaining** — remove the documents call from the default path and run the whole file. The default-path test must fail; the two flag tests must still pass. Revert.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/scrape/cli.ts app/server/src/scrape/cli.test.ts
git commit -m "Documents are a separate pass, chained by default -- SAM's 0.1% is the argument"
```

---

## Task 10: The demo criterion, run for real

**Spec:** §10. **Not a code task. Run it and write down what happened, including anything that fails.**

- [ ] **Step 1: Enable the source on the `test` branch**

```bash
node --env-file-if-exists=.env --import tsx -e "
import { run } from './app/server/src/db/index.js';
await run(\"UPDATE source SET enabled = true WHERE name = 'Indiana IDOA solicitations'\");
"
```

- [ ] **Step 2: Run it, listings only first**

```bash
npm run scrape -- --source idoa --listings-only
```

Record the row count. **Compare it against a count taken by hand from the live page the same day.** If they differ, stop — that is Task 1's third-table risk landing for real.

- [ ] **Step 3: Verify no row claims a published date**

```sql
SELECT count(*) FROM solicitation s
  JOIN source src ON src.id = s.source_id
 WHERE src.name = 'Indiana IDOA solicitations' AND s.posted_at_origin = 'published';
```

Expected: **0**.

- [ ] **Step 4: Run the chained default and the flags**

```bash
npm run scrape -- --source idoa            # both passes
npm run scrape -- --source idoa --limit 10 # returns 10, and says so
```

Confirm at least one ZIP parsed to an `extracted_field`.

- [ ] **Step 5: The free correctness check**

IDOA's live table includes *"General Supervision-State Complaint Corrective Act"*, already in production from `Corpus import — Indiana open (2026-08-04)`. Diff the adapter's output for that row against the corpus row. **Report any field that disagrees** — this is an answer key the project rarely gets.

- [ ] **Step 6: Write the results into STATUS and commit**

Record: rows found vs hand count, documents fetched, extracted fields produced, the correctness-check result, and **anything that did not work**. A criterion reported as met without its numbers is not met.

---

## Self-Review

**Spec coverage.** §1 → Task 2. §2/§2.1 → Task 2. §3 → Tasks 1, 7. §3.1 → Task 1 (blocking) and Task 7 step 1's row-count assertion. §4/§4.1 → Task 4. §5 → Tasks 3, 5. §6/§6.1 → Tasks 9, 7 step 3. §7 → Task 6. §8 → Task 1 steps 3–4. §9 → the mutation steps in Tasks 4, 5, 7, 9. §10 → Task 10. §11 → the Global Constraints scope fence. §12 q1/q2 → Task 1; q3 → Task 6; **q4 (the $75,000 floor) has no task** — it is a reporting caveat, not code, and is carried in the spec for whoever writes up Indiana's volume number. Flagged rather than silently dropped.

**Placeholders.** One deliberate: Task 7 step 1's row count is `/* N from Task 1 */`, because the number does not exist until Task 1 runs and inventing it would defeat the test. Every other step carries real content.

**Type consistency.** `SnapshotAdapter`/`SnapshotItem`/`SnapshotPage`/`isSnapshot` (Task 2) are used with those exact names in Tasks 4, 7, 8. `RunRequest.limit` (Task 3) is consumed in Tasks 4 and 5. `parseIdoaPage`/`idoaAdapter` (Task 7) are consumed in Task 8. `posted_at_origin` (Task 6) is asserted in Task 10 step 3.
