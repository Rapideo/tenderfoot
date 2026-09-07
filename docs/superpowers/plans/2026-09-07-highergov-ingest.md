# HigherGov Ingest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a $500/yr purchase deliver Indiana opportunities into the app — HigherGov currently has a registry row and nothing else.

**Architecture:** Reuse `coverage/highergov-client.ts` (one place handles the credential) and add a **windowed** adapter over `captured_date` that scrubs its payload before it becomes a hashed artifact. Everything downstream is the existing `scrape → import → merge` path. A budget-guarded CLI does a costed dry run before committing to a window.

**Tech Stack:** TypeScript (ESM, `.js` specifiers), Node 24, Postgres on Neon, Vitest.

**Spec:** [`docs/superpowers/specs/2026-09-07-highergov-ingest-design.md`](../specs/2026-09-07-highergov-ingest-design.md)

---

## Global Constraints

- **🛑 NO LIVE HIGHERGOV CALL IN ANY TASK.** CLAUDE.md §5.1 covers testing and "quick checks". Every test injects `fetchImpl` or a fake client and reads a committed fixture. `highergov-client.ts` already throws under `VITEST` when `fetchImpl` is left at the real global — do not weaken that guard.
- **🔴 `document_path` IS A CREDENTIAL.** It embeds the api_key on every row. It must never reach a `FeedNotice`, a log, the database, or **an artifact**.
- **🔴 THE PAYLOAD IS SCRUBBED BEFORE IT BECOMES AN ARTIFACT.** `scrape/run.ts` passes `page.payload` straight to `art.writeCapture`, and `import-artifact.ts` hashes the resulting file into `ingest_run.artifact_sha256` (`NOT NULL UNIQUE`). An unscrubbed payload writes a live credential into storage permanently. Scrub **once**, at the adapter boundary, and let the hash be computed over the scrubbed bytes.
- **`val_est` is NEVER written to `value_cents`.** R6: these are inferred bands, not published figures. Migration 019's note forbids them beside sourced facts.
- **The source name is `"HigherGov"`**, exactly as migration 019 seeds it.
- **ESM import specifiers end in `.js`.** The gate is `npm run check`, exit 0. Baseline: **893 tests / 100 files**.
- **Do not leave stray files in the repo.**

### Interfaces defined across tasks

```ts
// Task 1 — coverage/highergov-client.ts (modified)
export interface FeedNotice {
  externalId: string;
  capturedDate: string | null;
  versionKey: string | null;
  title: string | null;
  /** The full record with document_path REMOVED. Never contains a key. */
  raw: Record<string, unknown>;
}

// Task 3 — scrape/adapters/highergov.ts
export function scrubPayload(body: string): string;
export function higherGovAdapter(fetchImpl?: typeof fetch): WindowedAdapter;
export const HIGHERGOV_ADAPTER_KEY = "highergov";

// Task 8 — ingest/highergov-cli.ts
export interface DryRunResult {
  sampledDay: string;
  recordsThatDay: number;
  windowDays: number;
  projectedRecords: number;
  remainingThisMonth: number;
  affordable: boolean;
}
export async function dryRun(from: string, to: string, client?: HigherGovClient): Promise<DryRunResult>;
```

---

## File Structure

| File | Responsibility |
|---|---|
| `app/server/src/coverage/highergov-client.ts` | **Modified.** Carries the scrubbed full row |
| `app/server/src/scrape/adapters/highergov.ts` | The windowed adapter + payload scrubber |
| `app/server/src/scrape/adapters/fixtures/highergov-listing.json` | A realistic multi-field fixture |
| `app/server/src/scrape/adapters/registry.ts` | **Modified.** One `ADAPTERS` entry |
| `app/server/src/triage/eligibility.ts` | **Modified.** `'forecast'` joins `NOT_BIDDABLE` |
| `app/server/src/merge/{closes-at,description,place,org-chain}.ts` | **Modified.** One `case "HigherGov"` each |
| `app/server/src/fitness/floor.ts` | **Modified.** F6's population |
| `app/server/src/extract/document-clients.ts` | **Modified.** The `DOCUMENT_CLIENTS` entry D2 left out |
| `app/server/src/ingest/highergov-cli.ts` | `npm run ingest:highergov`, budget-guarded |

---

### Task 1: The client carries the full scrubbed row

**Files:**
- Modify: `app/server/src/coverage/highergov-client.ts`
- Modify: `app/server/src/coverage/highergov-client.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `FeedNotice.raw` — used by Task 3.

- [ ] **Step 1: Write the failing test**

Append to `highergov-client.test.ts`:

```ts
/* The ingest needs every field the coverage test threw away -- description,
 * deadline, agency -- but document_path must STILL never appear. The whole
 * value of one client is that this stays true in one place. */
test("a notice carries the full record, with document_path removed", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  const first = out.notices[0]!;
  expect(first.raw).toBeDefined();
  expect(first.raw.source_id).toBe("003000000088067");
  expect(first.raw.title).toBe("300 SP Salamonie Sludge and WW RemovalBid Documents");
  expect("document_path" in first.raw).toBe(false);
});

test("no key-shaped value survives into raw, at any depth", async () => {
  const out = await higherGovClient.fetchDay("2026-09-03", fakeFetch(FIXTURE));
  const serialized = JSON.stringify(out.notices.map((n) => n.raw));
  expect(serialized).not.toContain("api_key");
  expect(serialized).not.toContain("FAKEKEY");
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --env-file-if-exists=.env ./node_modules/vitest/vitest.mjs run app/server/src/coverage/highergov-client.test.ts`
Expected: FAIL — `first.raw` is undefined.

- [ ] **Step 3: Implement**

In `highergov-client.ts`, add `raw` to the `FeedNotice` interface (see Global Constraints for the exact shape) and change `toNotice`:

```ts
function toNotice(r: RawResult): FeedNotice | null {
  const externalId = str(r.source_id);
  if (!externalId) return null;
  /* document_path is REMOVED here, not merely unread. Deleting it from a
   * copy is what makes "no caller can leak what it never received" true of
   * `raw` as well as of the named fields -- the ingest needs everything
   * else, so "we only copy four fields" is no longer the guarantee. */
  const { document_path: _dropped, ...rest } = r as Record<string, unknown>;
  return {
    externalId,
    capturedDate: str(r.captured_date),
    versionKey: str(r.version_key),
    title: str(r.title),
    raw: rest,
  };
}
```

`RawResult` must gain an index signature so the rest-spread type-checks:

```ts
interface RawResult {
  source_id?: unknown;
  captured_date?: unknown;
  version_key?: unknown;
  title?: unknown;
  [key: string]: unknown;
}
```

- [ ] **Step 4: Run the test**

Expected: PASS. The whole file should now be 14 tests.

- [ ] **Step 5: Mutation check**

Replace the destructure with `raw: r as Record<string, unknown>` (i.e. stop removing `document_path`), re-run the **whole file**, and confirm "no key-shaped value survives into raw" FAILS. **Restore.** Record both outputs in your report.

- [ ] **Step 6: Gate and commit**

```bash
npm run check
git add app/server/src/coverage/highergov-client.ts app/server/src/coverage/highergov-client.test.ts
git commit -m "HigherGov: the client carries the whole row, minus the credential"
```

---

### Task 2: `forecast` joins the non-biddable vocabulary

**Files:**
- Modify: `app/server/src/triage/eligibility.ts`
- Modify: `app/server/src/triage/eligibility.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `'forecast'` in `NOT_BIDDABLE` — relied on by Task 5's mapper.

- [ ] **Step 1: Write the failing test**

Append to `eligibility.test.ts`:

```ts
/* ⚖️ Ruling ③ (Matt, 2026-09-07): forecasts are INGESTED and HELD, but never
 * queued. They carry no deadline and no value estimate (R4 measured
 * val_est 0 of 8), so a triager would be sorting rows that cannot be sorted. */
test("a forecast is not biddable", () => {
  expect(NOT_BIDDABLE).toContain("forecast");
});

/* 🔴 THE DISTINCTION THAT MUST NOT BLUR. eligibility.ts's own header keeps
 * PRESOLICITATION notices in the queue -- "the earliest signal a requirement
 * exists, and lead time is worth more to a small firm than to a large one".
 * A forecast is excluded for being unbiddable TODAY, not for being early. */
test("presolicitation is still biddable", () => {
  expect(NOT_BIDDABLE).not.toContain("presolicitation");
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --env-file-if-exists=.env ./node_modules/vitest/vitest.mjs run app/server/src/triage/eligibility.test.ts`
Expected: FAIL on "a forecast is not biddable".

- [ ] **Step 3: Implement**

Add `"forecast"` to the `NOT_BIDDABLE` array, with a comment beside the entry:

```ts
  /* ⚖️ Ruling ③, 2026-09-07. HigherGov's `sled_forecast` source_type -- the
   * pre-RFP layer design spec §4.6 asks for, arriving unrequested (R4).
   * Excluded for being UNBIDDABLE TODAY (no deadline, no value estimate),
   * never for being early: the early-signal principle above is untouched. */
  "forecast",
```

- [ ] **Step 4: Run the test**

Expected: PASS, both tests.

- [ ] **Step 5: Gate and commit**

```bash
npm run check
git add app/server/src/triage/eligibility.ts app/server/src/triage/eligibility.test.ts
git commit -m "HigherGov: a forecast is held, not queued"
```

---

### Task 3: The adapter, and the scrub that stops a key reaching storage

**Files:**
- Create: `app/server/src/scrape/adapters/highergov.ts`
- Create: `app/server/src/scrape/adapters/highergov.test.ts`
- Create: `app/server/src/scrape/adapters/fixtures/highergov-listing.json`

**Interfaces:**
- Consumes: `higherGovClient`, `FeedNotice`, `redact` (Task 1 / existing).
- Produces: `scrubPayload`, `higherGovAdapter`, `HIGHERGOV_ADAPTER_KEY` — used by Tasks 4 and 8.

- [ ] **Step 1: Write the fixture**

Create `fixtures/highergov-listing.json`. **The `document_path` values are synthetic key-shaped strings** so the scrub test has something to catch. Field names are taken from `docs/2026-09-03-highergov-field-mapping.md`, which was built from real pulls:

```json
{
  "meta": { "pagination": { "page": 1, "pages": 1, "count": 3 } },
  "results": [
    {
      "source_id": "003000000088067",
      "captured_date": "2026-09-03",
      "version_key": "v1",
      "title": "300 SP Salamonie Sludge and WW RemovalBid Documents",
      "description_text": "Removal of accumulated sludge and wastewater at the Salamonie site.",
      "due_date": "2026-09-03",
      "agency_name": "Natural Resources",
      "source_type": "sled",
      "pop_state": "IN",
      "val_est_low": 250000,
      "document_path": "https://www.highergov.com/api-external/document/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001"
    },
    {
      "source_id": "004950000088400",
      "captured_date": "2026-09-04",
      "version_key": "v1",
      "title": "AMB 28942 TOC Gas Gen",
      "description_text": null,
      "due_date": "2026-09-24",
      "agency_name": "Environmental Management",
      "source_type": "sled",
      "pop_state": "IN",
      "val_est_low": null,
      "document_path": "https://www.highergov.com/api-external/document/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001"
    },
    {
      "source_id": "FORECAST-2027-ROADS",
      "captured_date": "2026-09-05",
      "version_key": "v1",
      "title": "2027 Road Resurfacing Program",
      "description_text": "Anticipated resurfacing program for the 2027 season.",
      "due_date": null,
      "agency_name": "Allen County",
      "source_type": "sled_forecast",
      "pop_state": "IN",
      "val_est_low": null,
      "document_path": "https://www.highergov.com/api-external/document/?api_key=FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001"
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

Create `highergov.test.ts`:

```ts
/* 🛑 NO LIVE CALLS. Every case injects fetchImpl. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

process.env.HIGHERGOV_API_KEY = "TESTKEYTESTKEYTESTKEYTESTKEY0000";
process.env.HIGHERGOV_SEARCH_ID = "TESTSEARCHID";

const { higherGovAdapter, scrubPayload } = await import("./highergov.js");

const FIXTURE = readFileSync(
  fileURLToPath(new URL("./fixtures/highergov-listing.json", import.meta.url)),
  "utf8",
);

function fakeFetch(body: string): typeof fetch {
  return (async () =>
    new Response(body, { status: 200, headers: { "content-type": "application/json" } })) as any;
}

/* 🔴 THE ONE THAT MATTERS. scrape/run.ts hands `page.payload` straight to
 * art.writeCapture, and import-artifact.ts hashes the file into
 * ingest_run.artifact_sha256. An unscrubbed payload writes a live
 * credential into storage permanently, hashed and immutable. */
test("the payload carries no api_key", () => {
  const scrubbed = scrubPayload(FIXTURE);
  expect(FIXTURE).toContain("api_key");
  expect(scrubbed).not.toContain("FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001");
  expect(scrubbed).toContain("REDACTED");
});

test("the scrub is stable, so two runs over identical data hash the same", () => {
  expect(scrubPayload(FIXTURE)).toBe(scrubPayload(FIXTURE));
  expect(scrubPayload(scrubPayload(FIXTURE))).toBe(scrubPayload(FIXTURE));
});

test("the page's payload is the scrubbed one, not the raw body", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  expect(page.payload).not.toContain("FAKEKEYFAKEKEYFAKEKEYFAKEKEY0001");
});

test("every result becomes an item keyed by source_id", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  expect(page.items.map((i) => i.externalId)).toEqual([
    "003000000088067", "004950000088400", "FORECAST-2027-ROADS",
  ]);
});

/* captured_date is HigherGov's own watermark (R9), and modifiedAt is the
 * field scrape/run.ts compares against the window. */
test("modifiedAt is captured_date", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-05", null,
  );
  expect(page.items[0]!.modifiedAt).toBe("2026-09-03");
});

/* An item with no captured_date cannot be placed in the window. adapter.ts:
 * it is counted, never allowed to decide the window or poison the resume
 * marker. */
test("an undated record is skipped and counted, not dropped silently", async () => {
  const body = JSON.stringify({
    meta: { pagination: { page: 1, pages: 1, count: 1 } },
    results: [{ source_id: "X", captured_date: null, title: "t" }],
  });
  const page = await higherGovAdapter(fakeFetch(body)).fetchListing(
    "2026-09-03", "2026-09-05", null,
  );
  expect(page.items).toHaveLength(0);
  expect(page.undatedSkipped).toBe(1);
});

test("the raw record rides along on the item, without document_path", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-05", null,
  );
  const raw = page.items[0]!.raw as Record<string, unknown>;
  expect(raw.description_text).toContain("Salamonie");
  expect("document_path" in raw).toBe(false);
});

/* A single page and done: paginating costs records, and this adapter reads
 * one page per day-window call by design. */
test("a single-page response reports no next cursor", async () => {
  const page = await higherGovAdapter(fakeFetch(FIXTURE)).fetchListing(
    "2026-09-03", "2026-09-03", null,
  );
  expect(page.nextCursor).toBeNull();
});
```

- [ ] **Step 3: Run it and confirm it fails**

Expected: FAIL — cannot resolve `./highergov.js`.

- [ ] **Step 4: Implement**

Create `app/server/src/scrape/adapters/highergov.ts`:

```ts
/* THE HIGHERGOV LISTING ADAPTER.
 *
 * 🔴 THE REASON THIS FILE IS CAREFUL. scrape/run.ts passes `page.payload`
 * straight into art.writeCapture, and ingest/import-artifact.ts hashes the
 * resulting file into ingest_run.artifact_sha256 (NOT NULL UNIQUE). Every
 * HigherGov row carries `document_path`, and `document_path` embeds the
 * api_key. An unscrubbed payload therefore writes a LIVE CREDENTIAL into
 * storage: permanently, hashed, immutable, in the place hardest to retract.
 *
 * That is the 2026-09-03 leak in a worse location. It happened because a
 * scrub() helper covered every ERROR path while field VALUES printed raw --
 * the key was thought of as something in the request, not something that
 * comes back.
 *
 * ⚠️ AND THE SCRUB MUST BE STABLE, not merely present. The artifact's hash
 * is computed over the scrubbed bytes, so a scrub applied inconsistently
 * would make two runs over identical data hash differently and quietly
 * change what the UNIQUE constraint means. scrubPayload is idempotent and
 * a test pins that.
 *
 * ⚠️ NO DATABASE ACCESS, and no spend accounting here. An adapter fetches
 * and parses; ingest/highergov-cli.ts owns the budget, the ceiling and the
 * tally -- the same split coverage/highergov-client.ts already states. */
import type { WindowedAdapter, ListingItem, ListingPage } from "../adapter.js";
import { higherGovClient, redact } from "../../coverage/highergov-client.js";

export const HIGHERGOV_ADAPTER_KEY = "highergov";

/** Scrub a raw response body for safe persistence. Idempotent: scrubbing an
 * already-scrubbed body returns it unchanged, which is what lets the
 * artifact hash be stable across runs. */
export function scrubPayload(body: string): string {
  return redact(body);
}

export function higherGovAdapter(fetchImpl: typeof fetch = fetch): WindowedAdapter {
  return {
    shape: "windowed",
    /* Must match migration 019's seeded source.name exactly --
     * resolve-source.ts looks it up by this string. */
    name: "HigherGov",

    async fetchListing(since, _until, _cursor): Promise<ListingPage> {
      /* ONE DAY PER CALL. R5 only ever sent a single `captured_date`, and
       * whether the parameter accepts a range is unverified -- the dry run
       * in highergov-cli.ts answers it for free. Until it does, the caller
       * walks days and this reads one. `since` IS the day. */
      const result = await higherGovClient.fetchDay(since, fetchImpl);

      let undatedSkipped = 0;
      const items: ListingItem[] = [];
      for (const n of result.notices) {
        /* adapter.ts §5.4: a record with no usable date cannot be placed in
         * the window. Counted, never allowed to decide it. */
        if (!n.capturedDate) {
          undatedSkipped++;
          continue;
        }
        items.push({ externalId: n.externalId, modifiedAt: n.capturedDate, raw: n.raw });
      }

      return {
        items,
        undatedSkipped,
        nextCursor: null,
        /* NOT the real URL: it carries the api_key as a query parameter
         * (CLAUDE.md §5.3) and this value is persisted in the artifact. */
        requestUrl: `highergov:/opportunity/?captured_date=${since}`,
        httpStatus: 200,
        payload: scrubPayload(JSON.stringify({ capturedDate: since, results: result.notices.map((n) => n.raw) })),
      };
    },
  };
}
```

- [ ] **Step 5: Run the tests**

Expected: PASS, 8 tests.

- [ ] **Step 6: Mutation check**

Change `payload:` to use the unscrubbed `JSON.stringify({...})` without `scrubPayload`, re-run the **whole file**, confirm "the page's payload carries no api_key" FAILS. **Restore.** Record both outputs.

- [ ] **Step 7: Gate and commit**

```bash
npm run check
git add app/server/src/scrape/adapters/highergov.ts app/server/src/scrape/adapters/highergov.test.ts app/server/src/scrape/adapters/fixtures/highergov-listing.json
git commit -m "HigherGov: the adapter, and the scrub that keeps a key out of storage"
```

---

### Task 4: Register the adapter

**Files:**
- Modify: `app/server/src/scrape/adapters/registry.ts`
- Modify: `app/server/src/scrape/adapters/registry.test.ts`

**Interfaces:**
- Consumes: `higherGovAdapter`, `HIGHERGOV_ADAPTER_KEY` (Task 3).
- Produces: `ADAPTERS.highergov` — used by the scrape CLI and Task 8.

- [ ] **Step 1: Write the failing test**

Append to `registry.test.ts`:

```ts
/* The sourceName must match migration 019's seeded row exactly.
 * resolve-source.ts looks it up by this string, and a mismatch is not an
 * error anywhere -- it surfaces as "No source row named ..." at IMPORT
 * time, after the whole scrape has already run and been billed. */
test("highergov resolves to the seeded source name", () => {
  expect(ADAPTERS.highergov?.sourceName).toBe("HigherGov");
});

test("highergov builds a windowed adapter", () => {
  const a = ADAPTERS.highergov!.make();
  expect(a.shape).toBe("windowed");
  expect(a.name).toBe("HigherGov");
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --env-file-if-exists=.env ./node_modules/vitest/vitest.mjs run app/server/src/scrape/adapters/registry.test.ts`
Expected: FAIL — `ADAPTERS.highergov` is undefined.

- [ ] **Step 3: Implement**

In `registry.ts`, import and add the entry:

```ts
import { higherGovAdapter } from "./highergov.js";
```

```ts
  /* ⚠️ THE FIRST METERED ADAPTER IN THIS MAP. Every other entry is free to
   * run; this one bills per record against an allowance that cannot be read
   * back from the vendor. `npm run scrape -- --source highergov` therefore
   * spends money, and `npm run ingest:highergov` is the guarded door that
   * checks the budget first (ingest/highergov-cli.ts). */
  highergov: { sourceName: "HigherGov", make: () => higherGovAdapter() },
```

- [ ] **Step 4: Run the test**

Expected: PASS.

- [ ] **Step 5: Gate and commit**

```bash
npm run check
git add app/server/src/scrape/adapters/registry.ts app/server/src/scrape/adapters/registry.test.ts
git commit -m "HigherGov: registered, and it is the first adapter that costs money"
```

---

### Task 5: The merge mapping — four modules, one case each

**Files:**
- Modify: `app/server/src/merge/closes-at.ts`
- Modify: `app/server/src/merge/description.ts`
- Modify: `app/server/src/merge/place.ts`
- Modify: `app/server/src/merge/org-chain.ts`
- Modify: the matching `.test.ts` for each

**Interfaces:**
- Consumes: the raw shape from Task 3's fixture.
- Produces: HigherGov rows that carry a deadline, a description, a place and an org.

⚠️ **Field names come from `docs/2026-09-03-highergov-field-mapping.md`**, built from real pulls. They are evidence, not a guess — but they have not been re-verified against a response captured by *this* code. Task 9 reconciles them.

- [ ] **Step 1: Write the failing tests**

In `closes-at.test.ts`:

```ts
/* HigherGov publishes an ISO date in `due_date`. Unlike IDOA's
 * "09/03/2026 10:00:00AM EST" this needs no shape-parsing -- but it still
 * must return a BARE date, because closes_at is a bare calendar date and
 * every other case in this file returns one. */
test("HigherGov's due_date lands as a bare ISO date", () => {
  expect(closesAt("HigherGov", { due_date: "2026-09-24" })).toBe("2026-09-24");
});

test("a HigherGov timestamp is truncated, not rejected", () => {
  expect(closesAt("HigherGov", { due_date: "2026-09-24T15:00:00Z" })).toBe("2026-09-24");
});

/* A forecast has no due date, and a null must stay null rather than
 * becoming today or an empty string. */
test("a HigherGov row with no due_date has no deadline", () => {
  expect(closesAt("HigherGov", { due_date: null })).toBeNull();
});
```

In `description.test.ts`:

```ts
/* 34% of HigherGov rows carry no description (R11). A missing one must be
 * null, never "" -- F6 measures length and an empty string is a real,
 * measurable zero while null is an absence. */
test("HigherGov's description_text lands, and a missing one is null", () => {
  expect(descriptionFrom("HigherGov", { description_text: "Sludge removal." })).toBe("Sludge removal.");
  expect(descriptionFrom("HigherGov", { description_text: null })).toBeNull();
});
```

In `place.test.ts`:

```ts
test("HigherGov's pop_state lands as the place", () => {
  expect(placeFrom("HigherGov", { pop_state: "IN" })).toEqual({ state: "IN" });
});
```

In `org-chain.test.ts`:

```ts
test("HigherGov's agency_name lands as the organisation", () => {
  expect(orgChainFrom("HigherGov", { agency_name: "Natural Resources" })).toEqual(["Natural Resources"]);
});
```

⚠️ **Before writing these, open each test file and match its existing calling convention exactly** — the exported function names above are the ones this plan assumes; if a file exports a differently-named entry point, use the real one and say so in your report.

- [ ] **Step 2: Run each and confirm they fail**

Run: `node --env-file-if-exists=.env ./node_modules/vitest/vitest.mjs run app/server/src/merge/`
Expected: FAIL on the four new tests, with HigherGov falling through to each module's `default` and returning null/empty.

- [ ] **Step 3: Implement the four cases**

`closes-at.ts` — add above the `default`:

```ts
    /* HigherGov publishes ISO. Sliced to 10 characters so a timestamp and a
     * bare date both land as the bare calendar date this column holds --
     * the same normalisation coverage/compare.ts's leadDays does, and for
     * the same reason: the vendor's shape here is not pinned by anything. */
    case "HigherGov": {
      const d = r.due_date;
      if (typeof d !== "string" || d.length < 10) return null;
      const bare = d.slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(bare) ? bare : null;
    }
```

`description.ts`:

```ts
    /* ⚠️ 34% of rows carry NO description (R11), and 58% among sub-state
     * buyers -- the segment this source was bought for. A missing one is
     * null, never "": F6 measures length, and an empty string is a real
     * measurable zero where null is an absence. D2's on-demand documents
     * are the answer to the absence, not this function. */
    case "HigherGov":
      return typeof r.description_text === "string" && r.description_text.length > 0
        ? r.description_text
        : null;
```

`place.ts`:

```ts
    /* R1: `pop_state` is a RESPONSE field. It is NOT a usable request
     * filter -- three state parameters were accepted and silently ignored,
     * which is why the Indiana scoping lives in the saved search instead. */
    case "HigherGov":
      return typeof r.pop_state === "string" ? { state: r.pop_state } : null;
```

`org-chain.ts`:

```ts
    /* One level, not a chain. HigherGov publishes a flat agency name; the
     * sub-state buyers that make this source worth having ("Allen County")
     * have no parent chain to walk. */
    case "HigherGov":
      return typeof r.agency_name === "string" && r.agency_name.length > 0
        ? [r.agency_name]
        : [];
```

**Match each file's real return type** — read the neighbouring `case "SAM.gov"` and mirror its shape rather than the sketch above if they differ.

- [ ] **Step 4: Run the tests**

Expected: PASS, all four new tests plus every pre-existing one.

- [ ] **Step 5: Gate and commit**

```bash
npm run check
git add app/server/src/merge/
git commit -m "HigherGov: four merge cases, and val_est is not one of them"
```

⚠️ **`val_est_low` is deliberately NOT mapped.** R6: inferred bands, not published figures — migration 019 forbids them beside sourced facts. If you find yourself adding a `value_cents` case, stop and report it.

---

### Task 6: F6 stops counting rows nobody has looked at

**Files:**
- Modify: `app/server/src/fitness/floor.ts`
- Modify: `app/server/src/fitness/floor.test.ts`

**Interfaces:**
- Consumes: `solicitation.attachments_checked_at` (migration 011).
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing test**

Append to `floor.test.ts` (follow the file's existing fixture conventions for inserting solicitations):

```ts
/* ⚖️ Ruling ① (Matt, 2026-09-07). A row with an empty description whose
 * documents have NEVER been fetched is not KNOWN to be unreadable -- it is
 * unexamined. The same three-state discipline as document.extract_status,
 * source.health and coverage_item.carried.
 *
 * Without this, ingesting HigherGov drags F6's p10 from 57 to 0 purely by
 * arriving, because a third of its rows carry no description (R11). */
test("F6 ignores an empty description nobody has looked for documents on", async () => {
  await insertBiddable({ description: "x".repeat(400), attachmentsCheckedAt: null });
  await insertBiddable({ description: "", attachmentsCheckedAt: null });
  const f6 = await measureF6();
  expect(f6.measured).toBe(400);
});

/* 🔴 AND THE OTHER HALF, which is what stops this becoming a way to hide a
 * real failure. A row we DID fetch documents for and still cannot read is
 * a genuine gap and stays in the population. */
test("F6 counts an empty description we did look for documents on", async () => {
  await insertBiddable({ description: "x".repeat(400), attachmentsCheckedAt: new Date() });
  await insertBiddable({ description: "", attachmentsCheckedAt: new Date() });
  const f6 = await measureF6();
  expect(Number(f6.measured)).toBeLessThan(400);
});
```

- [ ] **Step 2: Run and confirm the first fails**

Run: `node --env-file-if-exists=.env ./node_modules/vitest/vitest.mjs run app/server/src/fitness/floor.test.ts`
Expected: FAIL — F6 currently counts both rows, so the p10 is 0, not 400.

- [ ] **Step 3: Implement**

In `measureF6`, extend the `WHERE`:

```sql
      WHERE ${NOT_BIDDABLE_SQL}
        AND (
          length(coalesce(s.description, '')) > 0
          OR s.attachments_checked_at IS NOT NULL
        )
```

with this comment above the query:

```ts
/* ⚖️ RULING ① (Matt, 2026-09-07): F6 measures what we have LOOKED AT.
 *
 * An empty description on a row whose documents were never fetched is not
 * evidence that the row is unreadable -- it is evidence that nobody asked.
 * Counting it would let F6 fall purely because we ingested a broader
 * source: HigherGov carries no description on 34% of rows (R11), which
 * would drag this p10 from 57 to 0 on arrival, reporting a collapse in
 * data quality that is really an increase in coverage.
 *
 * ⚠️ THIS IS NOT A WAY TO HIDE A FAILURE, and the second condition is why.
 * Once attachments_checked_at is stamped, the row counts whatever it holds.
 * A notice we fetched documents for and still cannot read is a real gap and
 * F6 must feel it. Only "we have not asked yet" is excluded, and D2's
 * on-demand fetch is what turns that state into an answer.
 *
 * ⚠️ CHANGES A PREDICATE MATT RATIFIED IN D4. It changes the POPULATION,
 * not the threshold, and it makes F6 harder to satisfy by accident rather
 * than easier -- but it is a change to a ratified predicate. */
```

Also update F6's `detail` so the excluded count is visible rather than silent:

```ts
    detail: `p10 = ${p10} characters over ${n} examined biddable rows.`,
```

- [ ] **Step 4: Run the tests**

Expected: PASS, both.

- [ ] **Step 5: Mutation check**

Remove the `OR s.attachments_checked_at IS NOT NULL` clause, re-run the **whole file**, and confirm "F6 counts an empty description we did look for documents on" FAILS. **Restore.** This proves the exclusion cannot hide a real gap.

- [ ] **Step 6: Gate and commit**

```bash
npm run check
git add app/server/src/fitness/floor.ts app/server/src/fitness/floor.test.ts
git commit -m "F6 measures what we looked at, not what we merely hold"
```

---

### Task 7: The document client D2 left out

**Files:**
- Modify: `app/server/src/extract/document-clients.ts`
- Modify: `app/server/src/extract/document-clients.test.ts`

**Interfaces:**
- Consumes: `higherGovClient` (existing).
- Produces: `DOCUMENT_CLIENTS["HigherGov"]`.

- [ ] **Step 1: Write the failing test**

Append to `document-clients.test.ts`:

```ts
/* ⚖️ D2 built the on-demand mechanism and deliberately left DOCUMENT_CLIENTS
 * holding one entry, so the whole path could be proven against SAM.gov at
 * zero metered cost. This is the entry it left out. */
test("HigherGov has a document client", () => {
  expect(DOCUMENT_CLIENTS["HigherGov"]).toBeDefined();
});

/* 🔴 The meter counts records RETURNED. A document fetch that returns ten
 * documents cost eleven records (1 opportunity + 10 documents, verified
 * 2026-09-03: 478 -> 489). `records` must be what the VENDOR billed, never
 * the count we kept. */
test("the document fetch reports what the vendor billed, not what we kept", async () => {
  const body = JSON.stringify({
    meta: { pagination: { count: 2 } },
    results: [
      { file_name: "sow.pdf", document_path: "https://x/?api_key=FAKEKEYFAKEKEY0002" },
      { file_name: "", document_path: "https://x/?api_key=FAKEKEYFAKEKEY0002" },
    ],
  });
  const out = await DOCUMENT_CLIENTS["HigherGov"]!.fetchFor("003000000088067", fakeFetch(body));
  /* One document is unusable (no filename) and is not kept -- but both were
   * returned, so both were billed. */
  expect(out.documents).toHaveLength(1);
  expect(out.records).toBe(2);
});

test("no document url leaks the api_key", async () => {
  const body = JSON.stringify({
    meta: { pagination: { count: 1 } },
    results: [{ file_name: "sow.pdf", document_path: "https://x/?api_key=FAKEKEYFAKEKEY0002" }],
  });
  const out = await DOCUMENT_CLIENTS["HigherGov"]!.fetchFor("x", fakeFetch(body));
  expect(JSON.stringify(out)).not.toContain("FAKEKEYFAKEKEY0002");
});
```

Add a `fakeFetch` helper at the top of the file if one does not already exist, and set `process.env.HIGHERGOV_API_KEY` before the import, exactly as `highergov-client.test.ts` does.

- [ ] **Step 2: Run and confirm it fails**

Expected: FAIL — `DOCUMENT_CLIENTS["HigherGov"]` is undefined.

- [ ] **Step 3: Implement**

Add to `document-clients.ts` a `higherGovDocumentClient` that calls `/document/?api_key=…&source_id=…`, returns `{documents, records}` where `records` is the **raw result count**, and **never lets `document_path` into a returned `sourceUrl`** — the download URL must be reconstructed without the key, or the document recorded with no URL at all if that is not possible. State in a comment which you did and why.

Register it:

```ts
export const DOCUMENT_CLIENTS: Record<string, DocumentClient> = {
  [SAM_SOURCE_NAME]: samDocumentClient,
  /* ⚠️ THE FIRST METERED DOCUMENT CLIENT. ~11 records per open (verified
   * 2026-09-03), against a 1,000/month ceiling shared with the ingest --
   * roughly 90 opens a month before the ceiling refuses. */
  HigherGov: higherGovDocumentClient,
};
```

- [ ] **Step 4: Run the tests**

Expected: PASS.

- [ ] **Step 5: Gate and commit**

```bash
npm run check
git add app/server/src/extract/document-clients.ts app/server/src/extract/document-clients.test.ts
git commit -m "HigherGov: the document client D2 deliberately left out"
```

---

### Task 8: The guarded door — `npm run ingest:highergov`

**Files:**
- Create: `app/server/src/ingest/highergov-cli.ts`
- Create: `app/server/src/ingest/highergov-cli.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: everything above; `spentThisMonth`/`MONTHLY_RECORD_CEILING` from `../extract/api-spend.js`.
- Produces: `dryRun`, `DryRunResult`, the npm script.

- [ ] **Step 1: Write the failing test**

Create `highergov-cli.test.ts`:

```ts
import { expect, test } from "vitest";
import type { HigherGovClient } from "../coverage/highergov-client.js";

process.env.HIGHERGOV_API_KEY = "TESTKEYTESTKEYTESTKEYTESTKEY0000";
process.env.HIGHERGOV_SEARCH_ID = "TESTSEARCHID";

const { dryRun, projectWindow } = await import("./highergov-cli.js");

function clientReturning(records: number): HigherGovClient {
  return {
    async fetchDay() { return { notices: [], records, feedCount: records, pages: 1 }; },
    async fetchBySourceId() { return { notices: [], records: 0, feedCount: 0, pages: 1 }; },
  };
}

/* 🔴 R5's "5 records for one day" is ONE OBSERVATION ON ONE DAY
 * (Proto2PRD-Lessons §2.15). At 15/day a 90-day backfill is 1,350 records
 * and the ceiling refuses partway, leaving a half-loaded window. The dry
 * run costs ~5 records and turns the guess into a measurement. */
test("the projection is the sampled day's rate times the window", () => {
  expect(projectWindow(5, 90)).toBe(450);
  expect(projectWindow(15, 90)).toBe(1350);
});

test("a window that fits is affordable", async () => {
  const r = await dryRun("2026-09-01", "2026-09-30", clientReturning(5), 0);
  expect(r.windowDays).toBe(30);
  expect(r.projectedRecords).toBe(150);
  expect(r.affordable).toBe(true);
});

/* 🔴 REFUSING IS THE POINT. Discovering mid-run that the ceiling is
 * exhausted leaves a half-loaded window and a spend nobody planned. */
test("a window that would cross the ceiling is refused before spending", async () => {
  const r = await dryRun("2026-01-01", "2026-12-31", clientReturning(15), 0);
  expect(r.affordable).toBe(false);
  expect(r.projectedRecords).toBeGreaterThan(r.remainingThisMonth);
});

test("spend already made this month reduces what is affordable", async () => {
  const generous = await dryRun("2026-09-01", "2026-09-30", clientReturning(5), 0);
  const tight = await dryRun("2026-09-01", "2026-09-30", clientReturning(5), 900);
  expect(generous.affordable).toBe(true);
  expect(tight.affordable).toBe(false);
});
```

- [ ] **Step 2: Run and confirm it fails**

Expected: FAIL — cannot resolve `./highergov-cli.js`.

- [ ] **Step 3: Implement**

Create `app/server/src/ingest/highergov-cli.ts`. It must:

1. **Require `--from` and `--to`**, validated with the same round-trip check `coverage-cli.ts` uses (shape regex, `Date.parse`, re-serialise and compare — the regex alone lets `2026-13-01` through and `Date.parse` alone rolls `2026-02-30` forward to March 2nd). Reject `from > to`.
2. **Print the database host** before anything, exactly as `db/migrate.ts` does — `api_spend` is per-database and running against the wrong one spends real money into a ledger the ceiling never reads.
3. **Run the dry run first, always.** Sample one day, project across the window, compare against `MONTHLY_RECORD_CEILING - spentThisMonth("HigherGov")`.
4. **Refuse and exit non-zero when not affordable**, printing both numbers.
5. **Stop after the dry run when `--dry-run` is passed**, so the projection can be seen without committing.
6. **Record the dry run's own spend in `api_spend`** — it was billed.

Export the two pure pieces so they are testable without a network:

```ts
export function projectWindow(recordsPerDay: number, windowDays: number): number {
  return recordsPerDay * windowDays;
}

export async function dryRun(
  from: string,
  to: string,
  client: HigherGovClient = higherGovClient,
  alreadySpent?: number,
): Promise<DryRunResult> { /* … */ }
```

`alreadySpent` is a parameter with a default so the tests need no database; the CLI passes `await spentThisMonth("HigherGov")`.

- [ ] **Step 4: Run the tests**

Expected: PASS, 4 tests.

- [ ] **Step 5: Add the npm script**

In `package.json`, after `"contracts:ingest:production"`:

```json
    "ingest:highergov": "tsx --env-file-if-exists=.env app/server/src/ingest/highergov-cli.ts",
```

- [ ] **Step 6: Verify it refuses without a window, making no call**

Run: `npm run ingest:highergov`
Expected: exits non-zero with usage. **No network call** — the window check precedes everything. Paste the real output into your report.

- [ ] **Step 7: Gate and commit**

```bash
npm run check
git add app/server/src/ingest/highergov-cli.ts app/server/src/ingest/highergov-cli.test.ts package.json
git commit -m "HigherGov: a guarded door that measures the window before buying it"
```

---

### Task 9: Reconcile the fixture, and the paperwork

**Files:**
- Modify: `CLAUDE.md` §2 (the operator-commands paragraph)
- Modify: `STATUS.md`
- Modify: `app/server/src/scrape/adapters/fixtures/highergov-listing.json` if reconciliation requires it

- [ ] **Step 1: Reconcile the fixture against a real response**

The fixture's field names come from `docs/2026-09-03-highergov-field-mapping.md`, built from real pulls, but have **not** been verified against a response captured by this code.

**Do not make a live call to check.** Instead, read `docs/2026-09-03-highergov-field-mapping.md` §1 in full and confirm every field name Task 5's mappers read (`due_date`, `description_text`, `pop_state`, `agency_name`, `source_type`) appears there with the meaning assumed. **Report any that do not**, and flag them as needing verification on the first live run rather than guessing an alternative.

- [ ] **Step 2: Update CLAUDE.md §2**

The paragraph names three operator commands and must name four. Replace the sentence beginning *"The three operator commands"*:

```markdown
**The four operator commands, none of which is reachable from any screen.** `npm run fitness` measures the data floor and scores every source from recorded evidence — read-only, no arguments. `npm run contracts:ingest` loads the Indiana EDS contract register (~205k rows, 86 seconds). `npm run recall -- --from=… --to=…` measures HigherGov's coverage decay against a free answer key. `npm run ingest:highergov -- --from=… --to=…` loads HigherGov opportunities, and does a costed dry run before it commits. **The last two SPEND METERED RECORDS and §5.1 governs every invocation.** **All four act on whatever `DATABASE_URL` names**, so check which branch you are pointed at first — and note that `api_spend` is per-database, so a run against the wrong one spends real money into a ledger the ceiling never reads.
```

- [ ] **Step 3: Add a STATUS entry**

Insert immediately after the `## 🔖 RESUME HERE` heading, above the newest existing entry, and update that heading's date:

```markdown
## ✅ HIGHERGOV INGESTS — THE PURCHASE FINALLY DELIVERS ROWS

**`npm run ingest:highergov -- --from=… --to=…`.** HigherGov had a registry row and nothing else since 2026-09-03; it now has an adapter, a document client, and four merge cases.

**🔴 THE CONSTRAINT THAT SHAPED THE SLICE.** `scrape/run.ts` hands the payload straight to `writeCapture`, and `import-artifact.ts` hashes the file into `ingest_run.artifact_sha256`. Every HigherGov row carries `document_path`, which embeds the api_key — so an unscrubbed payload would write a **live credential into storage permanently, hashed and immutable**. The payload is scrubbed at the adapter boundary and the scrub is **idempotent**, because the hash is computed over the scrubbed bytes and an inconsistent scrub would make two runs over identical data hash differently.

⚖️ **F6 CHANGED, and it changes a predicate ratified in D4.** It now excludes rows with an empty description whose documents were never fetched — unexamined is not unreadable. Without it, ingesting HigherGov would have dragged the p10 from 57 to 0 on arrival (34% of its rows carry no description, R11), reporting a collapse in quality that is really an increase in coverage. **The population changed, not the threshold**, and a row we *did* fetch documents for and still cannot read stays counted.

⚖️ **Forecasts are held, never queued.** `sled_forecast` → `kind: 'forecast'` → `NOT_BIDDABLE`. Narrower than it sounds: presolicitations stay in the queue, because early signal is worth more to a small firm. A forecast is excluded for being unbiddable *today*.

⚠️ **`val_est` is still not written to `value_cents`** — R6's inferred bands, migration 019's standing prohibition.
```

- [ ] **Step 4: Gate and commit**

```bash
npm run check
git add CLAUDE.md STATUS.md app/server/src/scrape/adapters/fixtures/highergov-listing.json
git commit -m "HigherGov: the paperwork, and the fixture reconciled against the field mapping"
```

---

### Task 10: Whole-slice verification

- [ ] **Step 1: Run the full gate and record the counts**

Run: `npm run check` — must exit 0. Record test and file counts for the merge message.

- [ ] **Step 2: Prove no live call is reachable**

```bash
grep -rn "highergov.com" app/server/src/scrape app/server/src/ingest | grep -v "\.test\." | grep -v fixtures
grep -rln "[^a-zA-Z]fetch(" app/server/src/scrape/adapters/highergov.test.ts app/server/src/ingest/highergov-cli.test.ts
```
Expected: no hits from either. Every HTTP call routes through the one client.

- [ ] **Step 3: Prove no credential can reach storage**

```bash
node --env-file-if-exists=.env -e '
const {execSync}=require("child_process");
const k=process.env.HIGHERGOV_API_KEY;
const files=execSync("git grep -I --cached -l \"\" -- app/server/src",{encoding:"utf8"}).trim().split("\n");
let hits=0;
for(const f of files){ if(require("fs").readFileSync(f,"utf8").includes(k)){console.log("LEAK:",f);hits++} }
console.log(hits===0?"CLEAN":"FAIL");'
```
Expected: `CLEAN`.

- [ ] **Step 4: Request review**

Use `superpowers:requesting-code-review` on the whole branch diff. Ask specifically about the two things a green suite cannot catch:
1. **Can any path put an unscrubbed payload into an artifact?** Trace `fetchListing` → `writeCapture` → `import-artifact`.
2. **Can `val_est` reach `value_cents` by any route?**

- [ ] **Step 5: Merge and re-run the gate on the merged result**

Merging is Matt's call — present the branch and the gate figures, do not merge unasked. Re-run `npm run check` on the merged result and record that it matches the branch.

---

## Self-Review

**Spec coverage.** §1 (the gap) → Tasks 3–8. §2 ruling ① → Task 6. Ruling ② → Task 8's dry run. Ruling ③ → Tasks 2 and 5. §3.1 (one client) → Task 1. §3.2 (windowed adapter) → Tasks 3–4. §4 (the artifact hazard) → Task 3, with a mutation check. §5 (forecast vocabulary) → Task 2. §6 (F6) → Task 6. §7 (cost and dry run) → Task 8. §8 (standing rulings) → Task 5's `val_est` warning and Task 7. §9 (blocked/open) → Task 9 Step 1. §10 (out of scope) → nothing built for it.

**One spec requirement deliberately has no task.** §9's third open item — verifying the response field for **agency** — is reconciled against the field-mapping doc in Task 9 Step 1 rather than against a live response, because verifying it live would cost records and CLAUDE.md §5.1 requires that be proposed separately. The plan records it as needing confirmation on the first live run.

**Placeholder scan.** No "TBD", no "similar to Task N". Task 5 and Task 7 each contain one instruction to *read the neighbouring code and match its real convention* — that is deliberate: the exact signatures of four merge modules were not read while writing this plan, and inventing them would be worse than telling the implementer to look.

**Type consistency.** `FeedNotice.raw` (Task 1) is what `ListingItem.raw` carries (Task 3). `HIGHERGOV_ADAPTER_KEY` and `sourceName: "HigherGov"` agree with migration 019. `DryRunResult`'s fields match the assertions in Task 8's tests.
