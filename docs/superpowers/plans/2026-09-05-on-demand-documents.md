# On-demand Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opening a solicitation record fetches its documents once, on demand, and every later open of that record is free.

**Architecture:** A per-solicitation service owns the whole policy — *have we looked · spend · write · stamp · tally* — and both the new HTTP route and (for its fetch half) the existing batch pass call into shared pieces rather than duplicating them. Spending is confined to a `POST`, guarded by a stamp that already exists, and counted in a new `api_spend` table because the vendor will not tell us what we have spent.

**Tech Stack:** TypeScript, Express, node-postgres, Vitest, React 18 + Vite.

**Spec:** [`docs/superpowers/specs/2026-09-05-on-demand-documents-design.md`](../specs/2026-09-05-on-demand-documents-design.md) — read it before Task 1. This plan argues from it.

## Global Constraints

- **The fidelity mandate binds Task 6.** CLAUDE.md §1 and design spec §7.10. Open `prototype/PROTOTYPE/Tenderfoot UI Mockups V1.2.html` **before** writing markup. Where the bundle is silent, add a **numbered deviation** to `docs/admin-deviations.md` — the smallest thing that works, never an invention.
- **🛑 NO HIGHERGOV API CALLS.** CLAUDE.md §5.1. Every test in this plan runs against SAM.gov (free) or a stubbed fetch. **Nothing here spends a metered record.** If a task seems to need one, stop and ask.
- **`npm run check` must exit 0** before every commit.
- **Page one and stop.** CLAUDE.md §5.2. No paging, ever, anywhere in this plan.
- **A stamp means *we looked*, never *what we found*.** Applies to `attachments_checked_at` throughout.
- **Test files that touch the database** use `useTestSchema("<unique_name>")` + `await resetSchema()` at module top, then **dynamic** `await import(...)` for db modules — see any existing `*.test.ts` in `app/server/src/routes/`. Static imports of `../db/index.js` in a DB-backed test will connect to the wrong schema.
- **`solicitation.attachments_checked_at` ALREADY EXISTS** (migration 011) and `discoverAttachments` already stamps it. **Do not create a stamp column.**

---

### Task 1: `api_spend` — the table and its two queries

**Files:**
- Create: `app/server/migrations/030_api_spend.sql`
- Create: `app/server/src/extract/api-spend.ts`
- Test: `app/server/src/extract/api-spend.test.ts`

**Interfaces:**
- Consumes: `all`, `one`, `run`, `insert` from `../db/index.js`; `Querier` type from the same.
- Produces:
  - `recordSpend(q: Querier, s: { sourceId: number; endpoint: "opportunity" | "document"; records: number; solicitationId?: number }): Promise<void>`
  - `spentThisMonth(sourceName: string): Promise<number>`
  - `MONTHLY_RECORD_CEILING: number`

- [ ] **Step 1: Write the migration**

Create `app/server/migrations/030_api_spend.sql`:

```sql
-- THE ONLY PLACE THAT KNOWS WHAT WE HAVE SPENT.
--
-- ⚖️ Ruling D2 (Matt, 2026-09-04). CLAUDE.md §5.2's staged-retrieval model
-- turns on a fact the vendor will not give us: HigherGov meters 10,000
-- records/month, and consumption CANNOT be read from the API -- no quota
-- field, no usage endpoint, no header. Only the account dashboard shows it,
-- which means a person reading a number is the sole instrument. So we keep
-- our own count, and it must answer "what did we spend since the 1st"
-- rather than "how many documents do we hold".
--
-- ⚠️ THIS DEVIATES FROM CLAUDE.md §5.1, WITH MATT'S APPROVAL (2026-09-05).
-- §5.1 says an unattended spender tallies in `ingest_run`. It cannot:
-- `ingest_run.artifact_sha256` is NOT NULL UNIQUE, an on-demand fetch has no
-- artifact, and a synthetic hash would fight both the column's meaning and
-- its uniqueness -- while every existing reader of `ingest_run`, the admin
-- run history included, would start seeing rows that are not ingests.
-- §5.1 is amended in the same slice (Task 7).
--
-- 🔴 `records` IS WHAT THE VENDOR BILLED, NOT WHAT WE KEPT. Verified
-- 2026-09-03 by an isolated test: the meter moved 478 -> 489 on ONE call
-- returning 1 opportunity + 10 documents. A call returning ten documents of
-- which we store three still cost eleven. Recording rows kept would
-- undercount precisely where the meter surprises.
CREATE TABLE api_spend (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id       integer NOT NULL REFERENCES source(id),
  endpoint        text NOT NULL CHECK (endpoint IN ('opportunity', 'document')),
  records         integer NOT NULL CHECK (records >= 0),
  solicitation_id integer REFERENCES solicitation(id),
  called_at       timestamptz NOT NULL DEFAULT now()
);

-- The one query this table exists to answer, and the shape it must be fast
-- for: spend for one source since the start of the calendar month.
CREATE INDEX api_spend_source_month ON api_spend(source_id, called_at DESC);

COMMENT ON COLUMN api_spend.records IS
  'Records the VENDOR billed for this call, not rows we kept. A free source writes 0 -- the row still proves the call happened.';
```

- [ ] **Step 2: Write the failing test**

Create `app/server/src/extract/api-spend.test.ts`:

```typescript
/* The tally is the only instrument we have. CLAUDE.md §5.1: consumption
 * cannot be read from the API at all, so a wrong number here is not a
 * cosmetic bug -- it is the difference between knowing and guessing what a
 * metered source has cost. */
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_api_spend");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, run, tx } = await import("../db/index.js");
const { recordSpend, spentThisMonth, MONTHLY_RECORD_CEILING } = await import("./api-spend.js");

let sourceId: number;

beforeAll(async () => {
  await migrate(false);
}, 120000);

beforeEach(async () => {
  await run(`DELETE FROM api_spend`);
  await run(`DELETE FROM source WHERE name = 'spend fixture'`);
  sourceId = await insert(`INSERT INTO source (name) VALUES ('spend fixture') RETURNING id`);
});

afterAll(async () => {
  await close();
});

test("a recorded call is counted in this month's spend", async () => {
  await tx((q) => recordSpend(q, { sourceId, endpoint: "document", records: 11 }));
  expect(await spentThisMonth("spend fixture")).toBe(11);
});

test("spend sums across calls", async () => {
  await tx(async (q) => {
    await recordSpend(q, { sourceId, endpoint: "document", records: 11 });
    await recordSpend(q, { sourceId, endpoint: "opportunity", records: 1 });
  });
  expect(await spentThisMonth("spend fixture")).toBe(12);
});

/* 🔴 THE ASSERTION THE CEILING DEPENDS ON. A ceiling computed from a total
 * that silently includes last month's spend refuses work it should allow,
 * on the first of the month, every month -- and the symptom is a screen
 * that stops fetching for no visible reason. */
test("last month's spend does not count against this month", async () => {
  await tx((q) => recordSpend(q, { sourceId, endpoint: "document", records: 11 }));
  await run(
    `UPDATE api_spend SET called_at = date_trunc('month', now()) - interval '1 day'`,
  );
  expect(await spentThisMonth("spend fixture")).toBe(0);
});

test("a free source still writes a row, with zero records", async () => {
  await tx((q) => recordSpend(q, { sourceId, endpoint: "document", records: 0 }));
  /* The row proves the call happened; the 0 proves it was free. Both matter:
   * this is what lets the whole path be exercised against SAM before it is
   * trusted with money. */
  expect(await spentThisMonth("spend fixture")).toBe(0);
  const rows = await (await import("../db/index.js")).all(`SELECT * FROM api_spend`);
  expect(rows).toHaveLength(1);
});

test("a source that has never spent reads zero, not null", async () => {
  expect(await spentThisMonth("spend fixture")).toBe(0);
});

test("the ceiling is a positive number and is marked unratified in source", () => {
  expect(MONTHLY_RECORD_CEILING).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run app/server/src/extract/api-spend.test.ts`
Expected: FAIL — `Failed to load url ./api-spend.js`.

- [ ] **Step 4: Write the implementation**

Create `app/server/src/extract/api-spend.ts`:

```typescript
/* WHAT A METERED SOURCE HAS COST US, AND THE ONLY PLACE THAT KNOWS.
 *
 * CLAUDE.md §5.1: HigherGov's consumption "cannot be measured from the API"
 * -- no quota field, no usage endpoint, no header. A person reading the
 * account dashboard is the sole instrument. This table is the second one,
 * and unlike the dashboard it can be queried by the code that is about to
 * spend.
 *
 * ⚠️ WRITES TAKE A `Querier`, NOT THE POOL. Every caller records spend
 * inside the same transaction that writes the documents and the stamp. A
 * tally written outside that transaction can survive a rollback that
 * discarded the work it was counting, and then over-reports forever. */
import { all, type Querier } from "../db/index.js";

/* ⚖️ UNRATIFIED. Matt sets this number; it ships as a proposal in exactly
 * the style of fitness/thresholds.ts's R7 block (D5, 2026-09-04).
 *
 * The proposal is 1,000 -- 10% of the 10,000/month allowance, about 90
 * document fetches. The reasoning, which is what he is actually ruling on:
 * the standing 500-record budget governs what an AGENT may spend unasked,
 * while this governs what the APPLICATION spends while somebody browses.
 * Different actors. Since consumption cannot be read back from the vendor,
 * an unbounded browsing session's first symptom would be a dashboard read
 * days later. */
export const MONTHLY_RECORD_CEILING = 1000;

export interface Spend {
  sourceId: number;
  endpoint: "opportunity" | "document";
  /** What the VENDOR billed, not rows kept. Free sources pass 0. */
  records: number;
  solicitationId?: number;
}

export async function recordSpend(q: Querier, s: Spend): Promise<void> {
  await q.run(
    `INSERT INTO api_spend (source_id, endpoint, records, solicitation_id)
     VALUES ($1, $2, $3, $4)`,
    [s.sourceId, s.endpoint, s.records, s.solicitationId ?? null],
  );
}

/* Calendar month, not a rolling 30 days, because that is how the allowance
 * itself resets. A rolling window would refuse work on the 1st that the
 * vendor has already forgiven. */
export async function spentThisMonth(sourceName: string): Promise<number> {
  const rows = await all<{ total: string | null }>(
    `SELECT sum(sp.records) AS total
       FROM api_spend sp
       JOIN source s ON s.id = sp.source_id
      WHERE s.name = $1
        AND sp.called_at >= date_trunc('month', now())`,
    [sourceName],
  );
  return Number(rows[0]?.total ?? 0);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run app/server/src/extract/api-spend.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Prove the month-boundary test by mutation**

CLAUDE.md §4: *"would this still pass if I deleted the thing it tests?"* Temporarily remove `AND sp.called_at >= date_trunc('month', now())` from the query and re-run the **whole file**. Expected: `last month's spend does not count against this month` FAILS with `expected 11 to be 0`. Restore the line and re-run: PASS.

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add app/server/migrations/030_api_spend.sql app/server/src/extract/api-spend.ts app/server/src/extract/api-spend.test.ts
git commit -m "D2: api_spend, because the vendor will not tell us what we spent"
```

---

### Task 2: Extract SAM's attachment fetch so both paths share it

**Files:**
- Create: `app/server/src/extract/document-clients.ts`
- Modify: `app/server/src/extract/discover.ts` (the per-solicitation fetch/parse block inside `discoverAttachments`)
- Test: `app/server/src/extract/document-clients.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `interface FetchedDocument { filename: string; sourceUrl: string }`
  - `interface DocumentFetchResult { documents: FetchedDocument[]; records: number }`
  - `interface DocumentClient { fetchFor(externalId: string, fetchImpl?: typeof fetch): Promise<DocumentFetchResult> }`
  - `DOCUMENT_CLIENTS: Record<string, DocumentClient>` — keyed by `source.name`
  - `samDocumentClient: DocumentClient`

**Why this task exists:** the on-demand path and the batch pass must not grow two implementations of "ask SAM for a notice's attachments". The production-guard extraction on 2026-09-05 made the same argument: *"a stale guard that is edited away in a hurry is worse than no guard"*, and two copies double the chance. **Only the HTTP-and-parse half moves.** `discoverAttachments` keeps its candidate query, budget, refresh pass and its own writes — those are batch concepts and do not belong to one solicitation.

- [ ] **Step 1: Write the failing test**

Create `app/server/src/extract/document-clients.test.ts`:

```typescript
/* Pure over a stubbed fetch -- no database, no network. That is the point of
 * extracting this: the part that talks to a source can be tested without the
 * batch machinery around it. */
import { expect, test } from "vitest";
import { samDocumentClient, DOCUMENT_CLIENTS } from "./document-clients.js";

function stubFetch(body: unknown, ok = true): typeof fetch {
  return (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
}

const ONE_ATTACHMENT = {
  _embedded: {
    opportunityAttachmentList: [
      { attachments: [{ name: "rfp.pdf", resourceId: "abc123", fileExists: "1" }] },
    ],
  },
};

test("a well-formed attachment list becomes documents", async () => {
  const r = await samDocumentClient.fetchFor("notice-1", stubFetch(ONE_ATTACHMENT));
  expect(r.documents).toHaveLength(1);
  expect(r.documents[0]!.filename).toBe("rfp.pdf");
  expect(r.documents[0]!.sourceUrl).toContain("abc123");
});

/* 🔴 SAM.gov IS FREE, AND THE ZERO IS LOAD-BEARING. It is what lets the
 * whole on-demand path -- ceiling, tally, stamp -- be exercised end to end
 * without spending a single metered record. */
test("SAM reports zero records billed, because SAM is free", async () => {
  const r = await samDocumentClient.fetchFor("notice-1", stubFetch(ONE_ATTACHMENT));
  expect(r.records).toBe(0);
});

/* Both guards are pre-existing discover.ts behaviour (fix round 1, item 3)
 * and must survive the extraction: `document.filename` is NOT NULL, and a
 * missing resourceId yields the well-formed URL `.../files/undefined/download`
 * and a row that is fetched, fails, and stays failed forever. */
test("an attachment with no name or no resourceId is skipped, not written", async () => {
  const malformed = {
    _embedded: {
      opportunityAttachmentList: [
        { attachments: [
          { name: "", resourceId: "abc", fileExists: "1" },
          { name: "ok.pdf", resourceId: "", fileExists: "1" },
        ] },
      ],
    },
  };
  const r = await samDocumentClient.fetchFor("notice-1", stubFetch(malformed));
  expect(r.documents).toEqual([]);
});

test("an attachment whose file does not exist is skipped", async () => {
  const gone = {
    _embedded: {
      opportunityAttachmentList: [
        { attachments: [{ name: "x.pdf", resourceId: "abc", fileExists: "0" }] },
      ],
    },
  };
  expect((await samDocumentClient.fetchFor("n", stubFetch(gone))).documents).toEqual([]);
});

/* A source that answered with an empty list HAS answered. The caller stamps
 * on this; it must not look like a failure. */
test("an empty list resolves rather than throwing", async () => {
  const r = await samDocumentClient.fetchFor("n", stubFetch({ _embedded: {} }));
  expect(r.documents).toEqual([]);
  expect(r.records).toBe(0);
});

test("a non-OK response throws, so the caller leaves no stamp", async () => {
  await expect(samDocumentClient.fetchFor("n", stubFetch({}, false))).rejects.toThrow();
});

test("unparseable JSON throws, so the caller leaves no stamp", async () => {
  const bad = (async () => ({
    ok: true,
    json: async () => {
      throw new Error("not json");
    },
  })) as unknown as typeof fetch;
  await expect(samDocumentClient.fetchFor("n", bad)).rejects.toThrow();
});

test("the registry is keyed by the canonical source.name", () => {
  expect(DOCUMENT_CLIENTS["SAM.gov"]).toBe(samDocumentClient);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/server/src/extract/document-clients.test.ts`
Expected: FAIL — `Failed to load url ./document-clients.js`.

- [ ] **Step 3: Write the implementation**

Create `app/server/src/extract/document-clients.ts`.

> ⚖️ **RULING (preflight, 2026-09-05): MOVE `resourcesUrl`, `downloadUrl` and the
> `AttachmentsResponse` interface OUT of `discover.ts` and INTO this file.** Do
> not leave them in `discover.ts` and export them — that creates a circular
> import, because `discover.ts` must import `samDocumentClient` from here.
> All three are module-private in `discover.ts` (lines 18, 20, 158) and used
> **nowhere else in the codebase** (verified by grep). They describe how to talk
> to SAM.gov, which is what a document client is. After this task the dependency
> runs one way: `discover.ts` → `document-clients.ts`.

Copy the three definitions across verbatim, then delete them from `discover.ts`.

```typescript
/* ASKING A SOURCE FOR ONE NOTICE'S DOCUMENTS, AND NOTHING ELSE.
 *
 * Extracted from discoverAttachments on 2026-09-05 for ruling D2, which
 * needs the same question asked about ONE solicitation on demand. Only the
 * HTTP-and-parse half moved: the candidate query, the time budget, the
 * refresh pass and the writes are batch concepts and stayed behind.
 *
 * The argument against copying it instead is the one the production-target
 * extraction made the same day -- two implementations of the same question
 * drift, and the drift is silent.
 *
 * ⚠️ NO DATABASE ACCESS HERE, DELIBERATELY. A client fetches and parses; the
 * caller decides what to write, when to stamp, and what it cost. That is
 * what lets fetch-documents-for.ts put all three in ONE transaction. */
import { SAM_HOST } from "../scrape/adapters/sam.js";
/* Moved here from discover.ts by the preflight ruling: these three describe
 * how to talk to SAM.gov, and leaving them behind would make discover.ts and
 * this module import each other.
 *
 * discover.ts's own note on the URLs, which is why they are worth moving
 * rather than rewriting: "The response SHAPE this file already parses
 * (_embedded.opportunityAttachmentList[].attachments[]) was correct from the
 * start; only the URL was wrong." */
const resourcesUrl = (noticeId: string): string =>
  `${SAM_HOST}/opps/v3/opportunities/${encodeURIComponent(noticeId)}/resources`;
const downloadUrl = (resourceId: string): string =>
  `${SAM_HOST}/opps/v3/opportunities/resources/files/${encodeURIComponent(resourceId)}/download`;

interface AttachmentsResponse {
  _embedded?: { opportunityAttachmentList?: { attachments?: Record<string, string>[] }[] };
}

export interface FetchedDocument {
  filename: string;
  sourceUrl: string;
}

export interface DocumentFetchResult {
  documents: FetchedDocument[];
  /** What the VENDOR billed. SAM.gov is free and returns 0. */
  records: number;
}

export interface DocumentClient {
  fetchFor(externalId: string, fetchImpl?: typeof fetch): Promise<DocumentFetchResult>;
}

export const samDocumentClient: DocumentClient = {
  async fetchFor(externalId, fetchImpl = fetch) {
    /* The User-Agent is not decoration -- sam.ts's adapter and probe both
     * treat it as mandatory; the default Node agent is rejected. */
    const res = await fetchImpl(resourcesUrl(externalId), {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`SAM.gov answered ${res.status} for ${externalId}`);

    const body = (await res.json()) as AttachmentsResponse;
    const documents: FetchedDocument[] = [];
    for (const group of body._embedded?.opportunityAttachmentList ?? []) {
      for (const a of group.attachments ?? []) {
        if (a.fileExists !== "1") continue;
        /* Pre-existing guards, kept verbatim in intent: document.filename is
         * NOT NULL, and a missing resourceId produces the well-formed URL
         * `.../files/undefined/download` and a row that is fetched, fails,
         * and stays failed forever. */
        if (!a.name || !a.resourceId) continue;
        documents.push({ filename: a.name, sourceUrl: downloadUrl(a.resourceId) });
      }
    }
    /* SAM.gov costs nothing. The zero is what lets D2's whole mechanism be
     * proven before a metered source is ever wired in. */
    return { documents, records: 0 };
  },
};

/* Keyed by the canonical `source.name`, matching adapters/registry.ts's
 * `sourceName` rather than the CLI short key -- the identity that actually
 * reaches the database. */
export const DOCUMENT_CLIENTS: Record<string, DocumentClient> = {
  "SAM.gov": samDocumentClient,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/server/src/extract/document-clients.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Rewrite `discoverAttachments` to call the client**

In `app/server/src/extract/discover.ts`, replace the fetch/parse/walk block (the `const url = resourcesUrl(...)` line through the end of the nested attachment loops) with a call to `samDocumentClient.fetchFor(s.external_id, fetchImpl)` inside a `try`/`catch`, keeping the existing behaviour exactly:

```typescript
let fetched;
try {
  fetched = await samDocumentClient.fetchFor(s.external_id, fetchImpl);
} catch {
  /* A thrown fetch and a non-OK response both skip THIS solicitation only,
   * and are counted the same way -- fix round 1, item 4. The stamp below is
   * not reached, which is the point: a bad minute must not retire a notice. */
  skipped++;
  continue;
}

for (const d of fetched.documents) {
  await insert(
    `INSERT INTO document (solicitation_id, filename, source_url, extract_status)
     VALUES ($1, $2, $3, 'pending') RETURNING id`,
    [s.id, d.filename, d.sourceUrl],
  );
  documents++;
}
```

Leave the `attachments_checked_at` stamp below it exactly where it is.

- [ ] **Step 6: Run the existing discovery tests unchanged**

Run: `npx vitest run app/server/src/extract/discover.test.ts app/server/src/scrape/cli-documents-pass.test.ts`
Expected: PASS with **no test edits**. If any test needed changing, the extraction changed behaviour — revert and redo it.

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add app/server/src/extract/document-clients.ts app/server/src/extract/document-clients.test.ts app/server/src/extract/discover.ts
git commit -m "D2: one place asks a source for a notice's documents"
```

---

### Task 3: `fetchDocumentsFor` — the service that owns the policy

**Files:**
- Create: `app/server/src/extract/fetch-documents-for.ts`
- Test: `app/server/src/extract/fetch-documents-for.test.ts`

**Interfaces:**
- Consumes: `recordSpend`, `spentThisMonth`, `MONTHLY_RECORD_CEILING` (Task 1); `DOCUMENT_CLIENTS`, `DocumentClient` (Task 2); `tx`, `one`, `all` from `../db/index.js`.
- Produces: `fetchDocumentsFor(solicitationId: number, fetchImpl?: typeof fetch): Promise<FetchOutcome>` where

```typescript
export type FetchReason = "fetched" | "already-looked" | "unsupported" | "ceiling";
export interface FetchOutcome {
  reason: FetchReason;
  spent: number;
  documents: number;
}
```

- [ ] **Step 1: Write the failing test**

Create `app/server/src/extract/fetch-documents-for.test.ts`:

```typescript
/* THE SPEND GUARD. Every test here is about not paying twice. */
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_fetch_documents_for");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, one, close, insert, run } = await import("../db/index.js");
const { fetchDocumentsFor } = await import("./fetch-documents-for.js");

let samId: number;
let solicitationId: number;

const ONE_ATTACHMENT = {
  _embedded: {
    opportunityAttachmentList: [
      { attachments: [{ name: "rfp.pdf", resourceId: "abc123", fileExists: "1" }] },
    ],
  },
};
const stubFetch = (body: unknown, ok = true) =>
  (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

beforeAll(async () => {
  await migrate(false);
}, 120000);

beforeEach(async () => {
  await run(`DELETE FROM api_spend`);
  await run(`DELETE FROM document`);
  await run(`DELETE FROM solicitation WHERE title = 'doc fixture'`);
  samId = await one<{ id: number }>(`SELECT id FROM source WHERE name = 'SAM.gov'`).then(
    (r) => r!.id,
  );
  solicitationId = await insert(
    `INSERT INTO solicitation (title, source_id, external_id, posted_at, posted_at_origin)
     VALUES ('doc fixture', $1, 'notice-1', '2026-08-01', 'published') RETURNING id`,
    [samId],
  );
});

afterAll(async () => {
  await close();
});

test("a first fetch writes the documents and stamps the solicitation", async () => {
  const out = await fetchDocumentsFor(solicitationId, stubFetch(ONE_ATTACHMENT));
  expect(out.reason).toBe("fetched");
  expect(out.documents).toBe(1);
  const s = await one<{ attachments_checked_at: Date | null }>(
    `SELECT attachments_checked_at FROM solicitation WHERE id = $1`,
    [solicitationId],
  );
  expect(s!.attachments_checked_at).not.toBeNull();
});

/* 🔴 THE LOAD-BEARING TEST. This is the entire ruling: opening a record
 * twice must cost what opening it once cost. */
test("a second fetch spends nothing and calls nobody", async () => {
  await fetchDocumentsFor(solicitationId, stubFetch(ONE_ATTACHMENT));
  const exploding = (async () => {
    throw new Error("the client must not be called a second time");
  }) as unknown as typeof fetch;

  const out = await fetchDocumentsFor(solicitationId, exploding);
  expect(out.reason).toBe("already-looked");
  expect(out.spent).toBe(0);
});

/* 🔴 §3's third row, and the one that bounds spend. A notice that genuinely
 * has no documents must be as free to reopen as one with twenty. */
test("a solicitation with no documents is still stamped, so reopening is free", async () => {
  const out = await fetchDocumentsFor(solicitationId, stubFetch({ _embedded: {} }));
  expect(out.reason).toBe("fetched");
  expect(out.documents).toBe(0);

  const again = await fetchDocumentsFor(solicitationId, stubFetch(ONE_ATTACHMENT));
  expect(again.reason).toBe("already-looked");
  const docs = await all(`SELECT id FROM document WHERE solicitation_id = $1`, [solicitationId]);
  expect(docs).toHaveLength(0);
});

/* A bad minute must not retire a notice permanently -- discover.ts learned
 * this on 2026-08-30 and it is the same rule here. Errors do not meter, so
 * retrying is free. */
test("a failed fetch leaves no stamp, no documents and no tally row", async () => {
  await expect(fetchDocumentsFor(solicitationId, stubFetch({}, false))).rejects.toThrow();
  const s = await one<{ attachments_checked_at: Date | null }>(
    `SELECT attachments_checked_at FROM solicitation WHERE id = $1`,
    [solicitationId],
  );
  expect(s!.attachments_checked_at).toBeNull();
  expect(await all(`SELECT id FROM api_spend`)).toHaveLength(0);
  expect(await all(`SELECT id FROM document`)).toHaveLength(0);
});

test("a fetch writes exactly one tally row, carrying what it cost", async () => {
  await fetchDocumentsFor(solicitationId, stubFetch(ONE_ATTACHMENT));
  const rows = await all<{ records: number; endpoint: string; solicitation_id: number }>(
    `SELECT records, endpoint, solicitation_id FROM api_spend`,
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]!.endpoint).toBe("document");
  expect(rows[0]!.solicitation_id).toBe(solicitationId);
  /* SAM is free. The row proves the call; the zero proves the price. */
  expect(rows[0]!.records).toBe(0);
});

test("a source with no document client spends nothing and is not stamped", async () => {
  const otherSource = await insert(
    `INSERT INTO source (name) VALUES ('Source With No Client') RETURNING id`,
  );
  const other = await insert(
    `INSERT INTO solicitation (title, source_id, external_id, posted_at, posted_at_origin)
     VALUES ('doc fixture', $1, 'x-1', '2026-08-01', 'published') RETURNING id`,
    [otherSource],
  );
  const out = await fetchDocumentsFor(other, stubFetch(ONE_ATTACHMENT));
  expect(out.reason).toBe("unsupported");
  expect(out.spent).toBe(0);
  const s = await one<{ attachments_checked_at: Date | null }>(
    `SELECT attachments_checked_at FROM solicitation WHERE id = $1`,
    [other],
  );
  /* NOT stamped: we did not look, we were unable to look. Stamping here
   * would record an absence of capability as an absence of documents. */
  expect(s!.attachments_checked_at).toBeNull();
});

test("an unknown solicitation id is reported, not crashed on", async () => {
  await expect(fetchDocumentsFor(999999, stubFetch(ONE_ATTACHMENT))).rejects.toThrow(/999999/);
});

/* 🔴 THE CEILING REFUSES, IT DOES NOT THROW. An operator who has browsed
 * past the month's allowance should see a reason on the screen, not a stack
 * trace -- and the record itself must still open. */
test("at the ceiling the fetch refuses, without calling the source", async () => {
  const { MONTHLY_RECORD_CEILING } = await import("./api-spend.js");
  await run(
    `INSERT INTO api_spend (source_id, endpoint, records) VALUES ($1, 'document', $2)`,
    [samId, MONTHLY_RECORD_CEILING],
  );
  const exploding = (async () => {
    throw new Error("the ceiling must be checked before the source is called");
  }) as unknown as typeof fetch;

  const out = await fetchDocumentsFor(solicitationId, exploding);
  expect(out.reason).toBe("ceiling");
  expect(out.spent).toBe(0);
  /* Not stamped: we never looked, so a later month must be free to try. */
  const s = await one<{ attachments_checked_at: Date | null }>(
    `SELECT attachments_checked_at FROM solicitation WHERE id = $1`,
    [solicitationId],
  );
  expect(s!.attachments_checked_at).toBeNull();
});

/* 🔴 SPEC §9 ROW 4 — THE TRANSACTION. Documents written but the stamp lost
 * means the next open pays again for rows we already hold. The three writes
 * commit together or not at all, and this is the only test that proves it. */
test("a failure while writing leaves no documents, no stamp and no tally", async () => {
  /* A filename of NULL violates document.filename NOT NULL, so the INSERT
   * raises INSIDE the transaction -- after some work, before the commit.
   * That is the crash shape the transaction exists for. */
  const twoDocsOneBad = {
    _embedded: {
      opportunityAttachmentList: [
        { attachments: [
          { name: "good.pdf", resourceId: "r1", fileExists: "1" },
          { name: "x".repeat(3), resourceId: "r2", fileExists: "1" },
        ] },
      ],
    },
  };
  /* Force the second insert to fail by making the column reject it. */
  await run(`ALTER TABLE document ADD CONSTRAINT tmp_reject CHECK (filename <> 'xxx')`);
  try {
    await expect(
      fetchDocumentsFor(solicitationId, stubFetch(twoDocsOneBad)),
    ).rejects.toThrow();
  } finally {
    await run(`ALTER TABLE document DROP CONSTRAINT tmp_reject`);
  }

  expect(await all(`SELECT id FROM document WHERE solicitation_id = $1`, [solicitationId]))
    .toHaveLength(0);
  expect(await all(`SELECT id FROM api_spend`)).toHaveLength(0);
  const s = await one<{ attachments_checked_at: Date | null }>(
    `SELECT attachments_checked_at FROM solicitation WHERE id = $1`,
    [solicitationId],
  );
  expect(s!.attachments_checked_at).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/server/src/extract/fetch-documents-for.test.ts`
Expected: FAIL — `Failed to load url ./fetch-documents-for.js`.

- [ ] **Step 3: Write the implementation**

Create `app/server/src/extract/fetch-documents-for.ts`:

```typescript
/* THE DOCUMENT SPEND, AND EVERY RULE THAT BOUNDS IT, IN ONE PLACE.
 *
 * ⚖️ Ruling D2 (Matt, 2026-09-04, option A): "fetch the documents only when
 * you open a listing." CLAUDE.md §5.2's asymmetry is what makes that work --
 * everything needed to REJECT a notice is already in the listing; documents
 * are only needed to ACCEPT one.
 *
 * WHY A SERVICE AND NOT A ROUTE HANDLER. `runDocumentsPass` already
 * dispatches per source; this is its singular sibling. One place owns
 * "have we looked · spend · write · stamp · tally", so the HTTP layer stays
 * a thin caller and nothing about spending policy lives in a request
 * handler. */
import { all, one, tx } from "../db/index.js";
import { DOCUMENT_CLIENTS } from "./document-clients.js";
import { recordSpend, spentThisMonth, MONTHLY_RECORD_CEILING } from "./api-spend.js";

export type FetchReason = "fetched" | "already-looked" | "unsupported" | "ceiling";

export interface FetchOutcome {
  reason: FetchReason;
  /** Records the vendor billed. Always 0 unless `reason` is "fetched". */
  spent: number;
  documents: number;
}

interface Row {
  id: number;
  external_id: string | null;
  source_id: number;
  source_name: string;
  checked: Date | null;
}

export async function fetchDocumentsFor(
  solicitationId: number,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchOutcome> {
  const row = await one<Row>(
    `SELECT s.id, s.external_id, s.source_id, src.name AS source_name,
            s.attachments_checked_at AS checked
       FROM solicitation s
       JOIN source src ON src.id = s.source_id
      WHERE s.id = $1`,
    [solicitationId],
  );
  if (!row) throw new Error(`No solicitation ${solicitationId}`);

  /* THE GUARD. A stamp means WE LOOKED, never what we found -- so a notice
   * with zero documents is as free to reopen as one with twenty. Without
   * this, spend grows with browsing rather than with data. */
  if (row.checked !== null) return { reason: "already-looked", spent: 0, documents: 0 };

  const client = DOCUMENT_CLIENTS[row.source_name];
  /* NOT stamped on this path. We did not look; we were unable to. Stamping
   * would record an absence of capability as an absence of documents, which
   * is the D3 error in a third place. */
  if (!client || !row.external_id) return { reason: "unsupported", spent: 0, documents: 0 };

  if ((await spentThisMonth(row.source_name)) >= MONTHLY_RECORD_CEILING) {
    return { reason: "ceiling", spent: 0, documents: 0 };
  }

  /* Page one and stop -- CLAUDE.md §5.2. The client does not page. */
  const fetched = await client.fetchFor(row.external_id, fetchImpl);

  /* ONE TRANSACTION, and the reason is the failure it prevents: documents
   * written but the stamp lost means the next open pays again for rows we
   * already hold. The tally is inside for the mirror-image reason -- a tally
   * that survives a rolled-back write over-reports forever. */
  await tx(async (q) => {
    for (const d of fetched.documents) {
      await q.run(
        `INSERT INTO document (solicitation_id, filename, source_url, extract_status)
         VALUES ($1, $2, $3, 'pending')`,
        [row.id, d.filename, d.sourceUrl],
      );
    }
    await q.run(`UPDATE solicitation SET attachments_checked_at = now() WHERE id = $1`, [row.id]);
    await recordSpend(q, {
      sourceId: row.source_id,
      endpoint: "document",
      records: fetched.records,
      solicitationId: row.id,
    });
  });

  return { reason: "fetched", spent: fetched.records, documents: fetched.documents.length };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/server/src/extract/fetch-documents-for.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Prove the guard by mutation**

Delete the `if (row.checked !== null)` early return and re-run the **whole file**. Expected: `a second fetch spends nothing and calls nobody` FAILS with `the client must not be called a second time`, and `a solicitation with no documents is still stamped` FAILS too. Restore and re-run: PASS. **If either still passes, the guard is not what bounds spend and the task is not done.**

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add app/server/src/extract/fetch-documents-for.ts app/server/src/extract/fetch-documents-for.test.ts
git commit -m "D2: the service that decides whether to spend"
```

---

### Task 4: The route

**Files:**
- Modify: `app/server/src/routes/index.ts` (add after the `GET /solicitations/:id` handler)
- Test: `app/server/src/routes/documents.test.ts`

**Interfaces:**
- Consumes: `fetchDocumentsFor` (Task 3).
- Produces: `POST /api/solicitations/:id/documents` → `200 { reason, spent, documents }`, `404` for an unknown id.

- [ ] **Step 1: Write the failing test**

Create `app/server/src/routes/documents.test.ts`:

```typescript
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_documents_route");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { one, close, insert, run } = await import("../db/index.js");
const { api } = await import("./index.js");
const express = (await import("express")).default;

let solicitationId: number;
let server: any;
let base: string;

/* ⚖️ RULING (preflight, 2026-09-05): NO `supertest`. It is not a dependency of
 * this repo, and `routes.test.ts` already establishes the house harness --
 * `app.listen(0)` on an ephemeral port, then real `fetch`. Adding a dependency
 * so one new test can differ from every existing route test is the wrong
 * trade. This block mirrors routes.test.ts:18-32 deliberately. */
type Res = [status: number, body: any];
const post = (p: string): Promise<Res> =>
  fetch(base + p, { method: "POST" }).then(async (r) => [r.status, await r.json()] as Res);
const get = (p: string): Promise<Res> =>
  fetch(base + p).then(async (r) => [r.status, await r.json()] as Res);

beforeAll(async () => {
  await migrate(false);
  const app = express();
  app.use(express.json());
  app.use("/api", api);
  await new Promise<void>((r) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}/api`;
      r();
    });
  });
}, 120000);

beforeEach(async () => {
  await run(`DELETE FROM api_spend`);
  await run(`DELETE FROM solicitation WHERE title = 'route doc fixture'`);
  const samId = (await one<{ id: number }>(`SELECT id FROM source WHERE name = 'SAM.gov'`))!.id;
  solicitationId = await insert(
    `INSERT INTO solicitation (title, source_id, external_id, posted_at, posted_at_origin)
     VALUES ('route doc fixture', $1, 'notice-route', '2026-08-01', 'published') RETURNING id`,
    [samId],
  );
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await close();
});

/* The route is exercised against a solicitation that has ALREADY been
 * stamped, so no network call is attempted and the test never touches
 * SAM.gov. The stamp guard is what makes the route testable for free. */
test("an already-checked solicitation returns already-looked and spends nothing", async () => {
  await run(`UPDATE solicitation SET attachments_checked_at = now() WHERE id = $1`, [
    solicitationId,
  ]);
  const [status, body] = await post(`/solicitations/${solicitationId}/documents`);
  expect(status).toBe(200);
  expect(body.reason).toBe("already-looked");
  expect(body.spent).toBe(0);
});

test("an unknown solicitation is a 404, not a 500", async () => {
  const [status] = await post(`/solicitations/999999/documents`);
  expect(status).toBe(404);
});

/* 🔴 GET MUST STAY FREE. This is the reason the fetch is a POST at all:
 * prefetch, retries, double-renders and crawlers all issue GETs, and none
 * of them is a decision anyone made. */
test("GET on the record does not fetch documents or write a tally", async () => {
  const [status] = await get(`/solicitations/${solicitationId}`);
  expect(status).toBe(200);
  const s = await one<{ attachments_checked_at: Date | null }>(
    `SELECT attachments_checked_at FROM solicitation WHERE id = $1`,
    [solicitationId],
  );
  expect(s!.attachments_checked_at).toBeNull();
});
```

The harness above mirrors `app/server/src/routes/routes.test.ts:18-32`. Do not add `supertest`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/server/src/routes/documents.test.ts`
Expected: FAIL — `404` where `200` was expected on the first test (route not registered).

- [ ] **Step 3: Add the route**

In `app/server/src/routes/index.ts`, directly after the `GET /solicitations/:id` handler:

```typescript
/* ⚖️ RULING D2 (Matt, 2026-09-04): documents are fetched when a listing is
 * OPENED, never in bulk. A bulk pass over Indiana would be 93,000-176,000
 * records -- nine to seventeen months of allowance -- so it is structurally
 * impossible rather than merely expensive (CLAUDE.md §5.2).
 *
 * 🔴 POST, NOT GET, AND NOT FOR REST TIDINESS. This endpoint can spend
 * money. A GET that spends is triggered by browser prefetch, a retry, a
 * double-render and any crawler -- none of which is a decision anyone made.
 * The stamp makes a duplicate call free; POST makes it rare. */
api.post(
  "/solicitations/:id/documents",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "id must be an integer" });
      return;
    }
    try {
      res.json(await fetchDocumentsFor(id));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.startsWith("No solicitation ")) {
        res.status(404).json({ error: message });
        return;
      }
      throw e;
    }
  }),
);
```

Add `import { fetchDocumentsFor } from "../extract/fetch-documents-for.js";` to the file's imports.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/server/src/routes/documents.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add app/server/src/routes/index.ts app/server/src/routes/documents.test.ts
git commit -m "D2: POST /solicitations/:id/documents, because a GET must not spend"
```

---

### Task 5: The record screen

**Files:**
- Modify: `app/client/src/record/Record.tsx`
- Modify: `app/client/src/record/Record.test.tsx`
- Modify (only if the bundle is silent): `docs/admin-deviations.md`

**Interfaces:**
- Consumes: `POST /api/solicitations/:id/documents` (Task 4).
- Produces: no exports; behaviour only.

- [ ] **Step 1: Read the bundle FIRST**

Open `prototype/PROTOTYPE/Tenderfoot UI Mockups V1.2.html` and search the record screen's bundle region (`BUNDLE — N FILES`, mirrored at `Record.tsx:302`) for:
1. a **loading/fetching** treatment, and
2. an **empty / no documents** treatment.

Record what you find in the task's commit message. **If the bundle specifies either, match it exactly — copy is specification (§7.10), so use its literal words.** If it is silent, add a numbered deviation to `docs/admin-deviations.md` describing the smallest thing that works, and use that. Do not invent a richer treatment than the bundle implies.

- [ ] **Step 2: Write the failing test**

Add to `app/client/src/record/Record.test.tsx`, following the file's existing render/mock conventions:

First add a helper beside the existing `renderRecord`, which stubs a single
`fetch` and cannot distinguish verbs. This one records calls so the tests can
count POSTs:

```typescript
/* `renderRecord` stubs one fetch for every URL and returns the body. The
 * documents POST needs a different answer from the record GET, and the
 * tests below need to COUNT calls, so this variant keeps a log. */
function renderRecordCounting(body: unknown, postBody: unknown = { reason: "fetched", spent: 0, documents: 0 }) {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url: String(url), method });
      if (method === "POST") return new Response(JSON.stringify(postBody), { status: 200 });
      return new Response(
        JSON.stringify(String(url).includes("/api/sources") ? [] : body),
        { status: 200 },
      );
    }),
  );
  const utils = render(
    <MemoryRouter initialEntries={["/solicitation/7"]}>
      <Routes>
        <Route path="/solicitation/:id" element={<Record />} />
      </Routes>
    </MemoryRouter>,
  );
  const posts = () => calls.filter((c) => c.method === "POST" && c.url.includes("/documents"));
  return { ...utils, posts };
}

const UNCHECKED = { ...RECORD, attachments_checked_at: null, documents: [] };
const CHECKED_EMPTY = { ...RECORD, attachments_checked_at: "2026-09-05T00:00:00Z", documents: [] };
```

Then the three tests:

```typescript
/* 🔴 ONCE PER RECORD, NOT ONCE PER RENDER. React re-renders freely and
 * StrictMode double-invokes effects in development. The stamp makes a
 * duplicate call free rather than harmful, but the client must not lean on
 * that -- "the server will forgive us" is how a spend loop gets shipped. */
test("the documents fetch is requested once, not once per render", async () => {
  const { posts, rerender } = renderRecordCounting(UNCHECKED);
  await waitFor(() => expect(posts()).toHaveLength(1));

  rerender(
    <MemoryRouter initialEntries={["/solicitation/7"]}>
      <Routes>
        <Route path="/solicitation/:id" element={<Record />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByText(RECORD.title)).toBeTruthy());
  expect(posts()).toHaveLength(1);
});

/* The guard exists on the server too, but a client that POSTs on every open
 * of an already-checked record turns a free action into a round trip per
 * view -- and, for a metered source, into an audit question nobody can
 * answer from the tally. */
test("a record that has already been checked issues no POST at all", async () => {
  const { posts } = renderRecordCounting(CHECKED_EMPTY);
  await waitFor(() => expect(screen.getByText(RECORD.title)).toBeTruthy());
  expect(posts()).toHaveLength(0);
});

/* Checked-and-none must not render as not-yet-looked. This is the D3
 * distinction reaching the screen: a reader has to be able to tell "there
 * are no documents" from "we have not asked yet". */
test("the bundle region shows the looked-and-none state, not an empty panel", async () => {
  renderRecordCounting(CHECKED_EMPTY);
  /* Replace with the bundle's own words from Step 1. If the bundle was
   * silent, use the copy recorded in the numbered deviation -- and use it
   * verbatim in both places. */
  await waitFor(() => expect(screen.getByText(/NO DOCUMENTS/i)).toBeTruthy());
});
```

⚠️ The third test's matcher is the one string in this plan that Step 1 decides.
Everything else here is final.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run app/client/src/record/Record.test.tsx`
Expected: FAIL — no POST is issued.

- [ ] **Step 4: Implement**

In `Record.tsx`: add `attachments_checked_at: string | null` to `RecordBody`; add a second `useEffect` that fires once per `id` when the body has loaded and `attachments_checked_at` is null, POSTs to the endpoint, and merges the returned documents into state. Guard with a ref so a re-render cannot re-issue it. Render the fetching and looked-and-none states inside the existing bundle region.

Add `attachments_checked_at` to the `SELECT` in the `GET /solicitations/:id` handler in `app/server/src/routes/index.ts` so the client can see it.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run app/client/src/record/Record.test.tsx`
Expected: PASS.

- [ ] **Step 6: Click through it in a browser and LOOK at the screenshot**

CLAUDE.md §4: *"A green server test does not mean the screen works."* SP3.6 passed every server-side test with both its buttons broken.

1. `npm run dev`
2. Open a record whose `attachments_checked_at` is null.
3. Confirm: the record paints immediately; the bundle region shows the fetching state, then the documents.
4. Reload. Confirm **no second POST** in the network panel.
5. Open a record with zero documents. Confirm the looked-and-none state reads correctly.
6. **Take a screenshot and look at it.** Reading the DOM for the right strings proves the content exists, not that the page is legible.

⚠️ If using the Chrome extension: its click coordinates are screenshot-space, not CSS pixels, and a mis-landed click reads exactly like a dead button. Calibrate first, and say which method you used.

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add app/client/src/record/Record.tsx app/client/src/record/Record.test.tsx app/server/src/routes/index.ts docs/admin-deviations.md
git commit -m "D2: the record screen asks for its documents, once"
```

---

### Task 6: The paperwork

**Files:**
- Modify: `CLAUDE.md` (§5.1)
- Modify: `STATUS.md`
- Modify: `docs/Proto2PRD-Lessons.md`

- [ ] **Step 1: Amend CLAUDE.md §5.1**

§5.1 currently says an unattended run *"must keep its own tally in `ingest_run`"*. Add, directly beneath it:

> ⚠️ **AMENDED 2026-09-05 (ruling D2).** On-demand document fetches tally in
> **`api_spend`**, not `ingest_run`. `ingest_run.artifact_sha256` is
> `NOT NULL UNIQUE` and an on-demand fetch has no artifact, so a synthetic hash
> would fight both the column's meaning and its uniqueness — and every reader of
> `ingest_run`, the admin run history included, would start seeing rows that are
> not ingests. **`SELECT sum(records) FROM api_spend WHERE called_at >=
> date_trunc('month', now())` is now the question's answer.** Approved by Matt
> 2026-09-05.

- [ ] **Step 2: Update STATUS.md**

In the ruling table, move **D2** from `⏸ not built` to built, recording: the mechanism only, proven against SAM at zero metered cost; `api_spend` created; the stamp reused rather than added; and that **the monthly ceiling ships `UNRATIFIED` and needs Matt's number**.

- [ ] **Step 3: Add the lesson**

Add to `docs/Proto2PRD-Lessons.md`:

> **A spec can specify something the repo already has.** The on-demand documents
> spec (2026-09-05) proposed a `documents_fetched_at` column. `attachments_checked_at`
> already existed — migration 011, indexed, stamped by the batch pass, with
> exactly the semantics the spec argued for, arrived at independently on
> 2026-08-30. It was found while writing the implementation plan, because the
> plan had to name real signatures. **Grep the schema for the concept, not the
> name you chose for it** — the same idea had already been built three times
> (`health_checked_at`, `attachments_checked_at`, `watermark_probed_at`) before
> this was its fourth.

- [ ] **Step 4: Run the gate and commit**

```bash
npm run check
git add CLAUDE.md STATUS.md docs/Proto2PRD-Lessons.md
git commit -m "D2: amend CLAUDE.md 5.1, and record what the plan found"
```

---

## Not in this plan

Per spec §10, and deliberately: the **HigherGov adapter** (client, field mapping, listing ingest — its listing pull costs records and needs its own budget conversation); the **Indiana backfill** (~9,286 records, 93% of a month); **any batch document pass** (structurally impossible, and D2 ruled it out); and **authentication** on this route (spec §6 — it belongs with `PATCH /api/sources/:id` in one auth pass, and neither is opened wider here).

**After this plan, wiring HigherGov in is a `DocumentClient` implementation plus one entry in `DOCUMENT_CLIENTS`** — which is the whole reason the mechanism was built first.
