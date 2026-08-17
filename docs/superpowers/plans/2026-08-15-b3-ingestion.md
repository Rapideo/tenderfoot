# B3 — Ingestion Scaffolding Implementation Plan (SP3 + SP3.5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scrape federal sources into a portable SQLite artifact, import it into Postgres as sightings, and merge those sightings into canonical solicitations.

**Architecture:** Scraping is split from the application. `scrape/core` is a library that takes a resolved configuration object and never opens a database; two thin entry points wrap it (a CLI, and an HTTP handler that streams the artifact back). Runs are checkpointed against a time budget, so a scope larger than one invocation resumes rather than dies. An importer appends sightings and advances `ingested_through` — **only on successful import**, so a lost artifact costs a re-fetch and never opens a silent gap. A separate slice merges sightings into canonical records.

**Tech Stack:** TypeScript, Node 24, `node:sqlite` (built in — **no native dependency**), `pg`, Express 4, Vitest.

**Spec:** [`docs/superpowers/specs/2026-08-15-ingestion-scaffolding-design.md`](../specs/2026-08-15-ingestion-scaffolding-design.md)

## Global Constraints

- **Postgres is the only system of record.** SQLite is a transport artifact. Never open a SQLite file as the application's database.
- **`scrape/core` opens no database connection and reads no config file.** It receives a resolved object. This is what makes the decoupling real rather than nominal.
- **Fail closed.** A run with no `since` refuses to start. A missing window that silently means *everything* is how a first run pulls 24 months.
- **No content filters.** The run contract may bound *what we reach for* (source, window, depth). It may never express *what qualifies* — spec §1.1, `Tenderfoot-Plan-of-Action.md:254`. If volume becomes painful that is the trigger to design qualification, not to add a field here.
- **Everything is `mechanical`.** The `mode` column exists from day one and only ever reads `'mechanical'`. Do not build a smart path.
- **Documents are referenced, never embedded.** `sha256` stays NULL at reference depth — do not fabricate a hash for a document you did not download.
- **Run tests with:** `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run <path>` — a bare `npx vitest` does not load `.env` and every database test will fail on `DATABASE_URL_TEST`.
- **Test isolation:** call `useTestSchema("<name>")` then `await resetSchema()` at module top, *before* importing anything that opens a pool, then dynamic-import. Follow `app/server/src/ingest/corpus.test.ts` exactly.
- **`insert()` requires a `RETURNING id` clause** (`app/server/src/db/index.ts:74`). It throws otherwise.
- **`node:sqlite` emits an ExperimentalWarning on Node 24.** Expected; do not suppress it globally.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/server/src/scrape/contract.ts` | Run request types; fail-closed validation. No I/O. |
| `app/server/src/scrape/adapter.ts` | The `Adapter` interface and its row types. No I/O. |
| `app/server/src/scrape/artifact.ts` | SQLite artifact writer/reader (`node:sqlite`). |
| `app/server/src/scrape/run.ts` | The scrape loop: budget, checkpoint, artifact assembly. |
| `app/server/src/scrape/cli.ts` | Thin CLI entry point. Arg parsing only. |
| `app/server/src/scrape/adapters/fake.ts` | Deterministic adapter for tests. |
| `app/server/src/scrape/adapters/sam.ts` | SAM.gov adapter. |
| `app/server/src/scrape/adapters/usaspending.ts` | USASpending adapter. |
| `app/server/src/ingest/import-artifact.ts` | Artifact → sightings; advances `ingested_through`. |
| `app/server/src/merge/merge.ts` | SP3.5: sightings → canonical solicitations. |
| `app/server/src/merge/yield.ts` | SP3.5: honest per-source yield. |
| `app/server/migrations/005_ingest_runs.sql` | `ingest_run` ledger; sighting provenance columns. |
| `app/server/src/routes/admin.ts` | `POST /api/admin/scrape`, streaming the artifact. |

---

## Plan-level decisions

Two of the spec's open items are resolved here. **Both are reversible and Matt may override.**

**Open item 1 — `last_run_at` vs `ingested_through`.** Resolved as: a new `ingest_run` ledger carries `ingested_through`; `source.last_run_at` is left alone and means *"when a scrape was last attempted."* They are different facts and conflating them reopens the gap the spec exists to close.

**Open item 3 — `verified_facets`.** Resolved as: **adapters must not trust a parameter they did not verify.** This is not hypothetical — `corpus/calibration/pull-naics.py:52` records a live instance: *"Only `-modifiedDate` sorts; `-publishDate` is silently ignored."* The SAM adapter therefore paginates on `modifiedDate` and filters client-side (Task 7). Every adapter states in a header comment which parameters it verified and how.

---

# PHASE 1 — SP3: federal ingestion, landing sightings

---

### Task 1: The run contract

**Files:**
- Create: `app/server/src/scrape/contract.ts`
- Test: `app/server/src/scrape/contract.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type Depth = "listing" | "detail" | "documents"`; `interface RunRequest { source: string; since: string; until: string; depth: Depth; budgetMs: number }`; `function validateRun(input: unknown): RunRequest`.

- [ ] **Step 1: Write the failing test**

```ts
// app/server/src/scrape/contract.test.ts
import { expect, test } from "vitest";
import { validateRun } from "./contract.js";

test("a run without `since` is refused", () => {
  expect(() => validateRun({ source: "sam", depth: "listing" })).toThrow(/since/i);
});

test("an unknown depth is refused", () => {
  expect(() => validateRun({ source: "sam", since: "2026-08-01", depth: "everything" })).toThrow(
    /depth/i,
  );
});

test("`until` defaults to now, `budgetMs` to the CLI default", () => {
  const r = validateRun({ source: "sam", since: "2026-08-01", depth: "listing" });
  expect(r.until >= "2026-08-01").toBe(true);
  expect(r.budgetMs).toBeGreaterThan(0);
});

/* §1.1. The contract bounds what we reach for, never what qualifies. */
test("unknown keys are refused rather than ignored", () => {
  expect(() =>
    validateRun({ source: "sam", since: "2026-08-01", depth: "listing", minValue: 50000 }),
  ).toThrow(/minValue/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/scrape/contract.test.ts`
Expected: FAIL — cannot resolve `./contract.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/server/src/scrape/contract.ts
/* The run contract. What an operator may ask for, and nothing else.
 *
 * WHY UNKNOWN KEYS THROW RATHER THAN BEING IGNORED (§1.1): the plan
 * (Tenderfoot-Plan-of-Action.md:264) warns that volume pressure will tempt
 * someone to reintroduce a filter quietly, and an options object that
 * silently swallows `minValue` is exactly that door. Scope bounds what we
 * reach for; a filter judges a record. Rejecting the key makes the attempt
 * a visible failure instead of a silent no-op.
 */
export type Depth = "listing" | "detail" | "documents";

const DEPTHS: readonly string[] = ["listing", "detail", "documents"];
const ALLOWED = new Set(["source", "since", "until", "depth", "budgetMs"]);

export const DEFAULT_BUDGET_MS = 15 * 60 * 1000;

export interface RunRequest {
  source: string;
  since: string;
  until: string;
  depth: Depth;
  budgetMs: number;
}

export function validateRun(input: unknown): RunRequest {
  const o = (input ?? {}) as Record<string, unknown>;

  for (const k of Object.keys(o)) {
    if (!ALLOWED.has(k)) {
      throw new Error(`Unknown run option: ${k}. The contract bounds scope only (§1.1).`);
    }
  }
  if (typeof o.source !== "string" || !o.source) throw new Error("source is required");
  /* Fail closed. A missing window must never mean "everything". */
  if (typeof o.since !== "string" || !o.since) {
    throw new Error("since is required — a run with no window refuses to start");
  }
  if (typeof o.depth !== "string" || !DEPTHS.includes(o.depth)) {
    throw new Error(`depth must be one of ${DEPTHS.join(" | ")}`);
  }

  return {
    source: o.source,
    since: o.since,
    until: typeof o.until === "string" && o.until ? o.until : new Date().toISOString(),
    depth: o.depth as Depth,
    budgetMs: typeof o.budgetMs === "number" && o.budgetMs > 0 ? o.budgetMs : DEFAULT_BUDGET_MS,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/scrape/contract.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/server/src/scrape/contract.ts app/server/src/scrape/contract.test.ts
git commit -m "Add the scrape run contract -- fail closed, and no filters"
```

---

### Task 2: The adapter interface and a fake adapter

**Files:**
- Create: `app/server/src/scrape/adapter.ts`, `app/server/src/scrape/adapters/fake.ts`
- Test: `app/server/src/scrape/adapters/fake.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface ListingItem { externalId: string; modifiedAt: string; raw: unknown }`; `interface ListingPage { items: ListingItem[]; nextCursor: string | null; requestUrl: string; httpStatus: number; payload: string }`; `interface Adapter { name: string; fetchListing(since: string, until: string, cursor: string | null): Promise<ListingPage> }`; `function fakeAdapter(total: number, pageSize?: number): Adapter`.

- [ ] **Step 1: Write the failing test**

```ts
// app/server/src/scrape/adapters/fake.test.ts
import { expect, test } from "vitest";
import { fakeAdapter } from "./fake.js";

test("pages through a fixed corpus and then reports no cursor", async () => {
  const a = fakeAdapter(5, 2);
  const p1 = await a.fetchListing("2026-01-01", "2026-12-31", null);
  expect(p1.items).toHaveLength(2);
  expect(p1.nextCursor).toBe("2");

  const p2 = await a.fetchListing("2026-01-01", "2026-12-31", p1.nextCursor);
  expect(p2.items).toHaveLength(2);

  const p3 = await a.fetchListing("2026-01-01", "2026-12-31", p2.nextCursor);
  expect(p3.items).toHaveLength(1);
  expect(p3.nextCursor).toBeNull();
});

test("items carry a stable external id and a modifiedAt", async () => {
  const a = fakeAdapter(1, 10);
  const [item] = (await a.fetchListing("2026-01-01", "2026-12-31", null)).items;
  expect(item.externalId).toBe("fake-0");
  expect(item.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/scrape/adapters/fake.test.ts`
Expected: FAIL — cannot resolve `./fake.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/server/src/scrape/adapter.ts
/* The adapter framework (build inventory 2A).
 *
 * Every adapter takes `since` — this is what makes backfill and live the
 * same code path (§3.1). Adapters bind to PLATFORM + config, not
 * jurisdiction (§5.7).
 *
 * `modifiedAt` is the field the caller compares against the window. It is
 * named for what it is rather than "postedAt" because at least one real
 * source sorts only by modification date and silently ignores a request to
 * sort by publication date (see adapters/sam.ts).
 */
export interface ListingItem {
  externalId: string;
  modifiedAt: string;
  raw: unknown;
}

export interface ListingPage {
  items: ListingItem[];
  /** Opaque to the caller. Null means the source has no more pages. */
  nextCursor: string | null;
  requestUrl: string;
  httpStatus: number;
  /** The response body exactly as received. Stored as a capture. */
  payload: string;
}

export interface Adapter {
  name: string;
  fetchListing(since: string, until: string, cursor: string | null): Promise<ListingPage>;
}
```

```ts
// app/server/src/scrape/adapters/fake.ts
/* A deterministic adapter. Exists so the scrape loop's budget, checkpoint
 * and artifact behaviour can be tested without a network. */
import type { Adapter, ListingPage } from "../adapter.js";

export function fakeAdapter(total: number, pageSize = 100): Adapter {
  return {
    name: "fake",
    async fetchListing(_since, _until, cursor): Promise<ListingPage> {
      const start = cursor ? Number(cursor) : 0;
      const end = Math.min(start + pageSize, total);
      const items = [];
      for (let i = start; i < end; i++) {
        items.push({
          externalId: `fake-${i}`,
          modifiedAt: `2026-08-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
          raw: { i, title: `Fake solicitation ${i}` },
        });
      }
      return {
        items,
        nextCursor: end >= total ? null : String(end),
        requestUrl: `fake://listing?start=${start}`,
        httpStatus: 200,
        payload: JSON.stringify({ start, items }),
      };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/scrape/adapters/fake.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add app/server/src/scrape/adapter.ts app/server/src/scrape/adapters/
git commit -m "Add the adapter interface and a deterministic fake"
```

---

### Task 3: The artifact writer

> ⚠️ **SUPERSEDED IN PART, 2026-08-15.** The code below writes the artifact's `run` column as `next_since` and names `finish()`'s parameter `nextSince`. **Both were renamed to `next_until` / `nextUntil`** when review found the resume marker pointed at the wrong end of the window (see the note on Task 4). The shipped code and the spec carry the corrected names; this task text is left as originally written rather than rewritten, because a mechanical rename here would not convey the semantic change. Read Task 4's note before reusing any of this.

**Files:**
- Create: `app/server/src/scrape/artifact.ts`
- Test: `app/server/src/scrape/artifact.test.ts`

**Interfaces:**
- Consumes: `Depth` from `contract.ts`.
- Produces: `interface RunMeta { sourceName: string; since: string; until: string; depth: Depth; scraperVer: string }`; `interface ArtifactWriter { path: string; writeCapture(c): number; writeSighting(s): void; finish(outcome: string, nextSince: string | null): void; close(): void }`; `function openArtifact(path: string, meta: RunMeta): ArtifactWriter`; `function readArtifact(path: string): { run: any; sightings: any[]; captures: any[] }`.

- [ ] **Step 1: Write the failing test**

```ts
// app/server/src/scrape/artifact.test.ts
import { expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openArtifact, readArtifact } from "./artifact.js";

function tmpPath() {
  return join(mkdtempSync(join(tmpdir(), "tf-artifact-")), "run.db");
}

test("an artifact describes itself and round-trips its rows", () => {
  const p = tmpPath();
  const a = openArtifact(p, {
    sourceName: "fake",
    since: "2026-08-01",
    until: "2026-08-15",
    depth: "listing",
    scraperVer: "test",
  });
  const capId = a.writeCapture({
    hop: "listing",
    url: "fake://1",
    httpStatus: 200,
    payload: "{}",
  });
  a.writeSighting({
    externalId: "fake-0",
    seenAt: "2026-08-15T00:00:00.000Z",
    raw: { title: "x" },
    captureId: capId,
    extractorVer: "test",
    mode: "mechanical",
  });
  a.finish("partial", "2026-08-09T00:00:00.000Z");
  a.close();

  const out = readArtifact(p);
  expect(out.run.source_name).toBe("fake");
  expect(out.run.outcome).toBe("partial");
  expect(out.run.next_since).toBe("2026-08-09T00:00:00.000Z");
  expect(out.sightings).toHaveLength(1);
  expect(out.sightings[0].external_id).toBe("fake-0");
  expect(out.captures).toHaveLength(1);
});

/* Documents are referenced, never embedded, and a hash is never invented
 * for a document that was not downloaded (spec §3.3). */
test("a document reference at listing depth carries a null sha256", () => {
  const p = tmpPath();
  const a = openArtifact(p, {
    sourceName: "fake",
    since: "2026-08-01",
    until: "2026-08-15",
    depth: "listing",
    scraperVer: "test",
  });
  const capId = a.writeCapture({ hop: "listing", url: "fake://1", httpStatus: 200, payload: "{}" });
  a.writeDocumentRef({
    captureId: capId,
    url: "https://example.gov/bundle.zip",
    filename: "bundle.zip",
    contentType: "application/zip",
    statedBytes: 21_000_000,
  });
  a.finish("complete", null);
  a.close();

  const out = readArtifact(p);
  expect(out.documentRefs[0].sha256).toBeNull();
  expect(out.documentRefs[0].blob_ref).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/scrape/artifact.test.ts`
Expected: FAIL — cannot resolve `./artifact.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/server/src/scrape/artifact.ts
/* The transport artifact: one SQLite file per run.
 *
 * SQLite is the ARTIFACT here, never the application's database — Vercel has
 * no writable persistent filesystem and Postgres is the only system of
 * record (spec §1, and app/server/src/db/index.ts:3).
 *
 * Uses node:sqlite, built into Node 24, rather than better-sqlite3. A native
 * addon would be a build risk on Vercel and better-sqlite3 was deliberately
 * removed in SP1.5. node:sqlite emits an ExperimentalWarning; that is
 * expected and is not suppressed.
 *
 * The file is SELF-DESCRIBING: `run` states what was asked for and how far
 * it got, so an artifact found on disk in six months explains itself.
 */
import { DatabaseSync } from "node:sqlite";
import type { Depth } from "./contract.js";

export interface RunMeta {
  sourceName: string;
  since: string;
  until: string;
  depth: Depth;
  scraperVer: string;
}

export interface CaptureRow {
  hop: "listing" | "detail" | "document";
  url: string;
  httpStatus: number;
  payload: string;
}

export interface SightingRow {
  externalId: string;
  seenAt: string;
  raw: unknown;
  captureId: number;
  extractorVer: string;
  mode: "mechanical" | "smart";
}

export interface DocumentRefRow {
  captureId: number;
  url: string;
  filename: string;
  contentType: string | null;
  statedBytes: number | null;
}

const SCHEMA = `
CREATE TABLE run (
  source_name TEXT NOT NULL, since TEXT NOT NULL, until TEXT NOT NULL,
  depth TEXT NOT NULL, scraper_ver TEXT NOT NULL,
  started_at TEXT NOT NULL, finished_at TEXT, outcome TEXT, next_since TEXT
);
CREATE TABLE capture (
  id INTEGER PRIMARY KEY AUTOINCREMENT, hop TEXT NOT NULL, url TEXT NOT NULL,
  http_status INTEGER NOT NULL, fetched_at TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE TABLE sighting (
  id INTEGER PRIMARY KEY AUTOINCREMENT, external_id TEXT NOT NULL,
  seen_at TEXT NOT NULL, raw TEXT NOT NULL, capture_id INTEGER NOT NULL,
  extractor_ver TEXT NOT NULL, mode TEXT NOT NULL
);
CREATE TABLE document_ref (
  id INTEGER PRIMARY KEY AUTOINCREMENT, capture_id INTEGER NOT NULL,
  url TEXT NOT NULL, filename TEXT, content_type TEXT, stated_bytes INTEGER,
  fetched_at TEXT NOT NULL, http_status INTEGER,
  sha256 TEXT, blob_ref TEXT
);
`;

export interface ArtifactWriter {
  path: string;
  writeCapture(c: CaptureRow): number;
  writeSighting(s: SightingRow): void;
  writeDocumentRef(d: DocumentRefRow): void;
  finish(outcome: string, nextSince: string | null): void;
  close(): void;
}

export function openArtifact(path: string, meta: RunMeta): ArtifactWriter {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  db.prepare(
    `INSERT INTO run (source_name, since, until, depth, scraper_ver, started_at)
     VALUES (?,?,?,?,?,?)`,
  ).run(meta.sourceName, meta.since, meta.until, meta.depth, meta.scraperVer, new Date().toISOString());

  return {
    path,
    writeCapture(c) {
      const r = db
        .prepare(
          `INSERT INTO capture (hop, url, http_status, fetched_at, payload) VALUES (?,?,?,?,?)`,
        )
        .run(c.hop, c.url, c.httpStatus, new Date().toISOString(), c.payload);
      return Number(r.lastInsertRowid);
    },
    writeSighting(s) {
      db.prepare(
        `INSERT INTO sighting (external_id, seen_at, raw, capture_id, extractor_ver, mode)
         VALUES (?,?,?,?,?,?)`,
      ).run(s.externalId, s.seenAt, JSON.stringify(s.raw), s.captureId, s.extractorVer, s.mode);
    },
    /* sha256 and blob_ref stay NULL at reference depth. A hash cannot be
     * computed for a document that was never downloaded, and inventing one
     * is worse than leaving it absent. */
    writeDocumentRef(d) {
      db.prepare(
        `INSERT INTO document_ref (capture_id, url, filename, content_type, stated_bytes, fetched_at)
         VALUES (?,?,?,?,?,?)`,
      ).run(d.captureId, d.url, d.filename, d.contentType, d.statedBytes, new Date().toISOString());
    },
    finish(outcome, nextSince) {
      db.prepare(`UPDATE run SET finished_at = ?, outcome = ?, next_since = ?`).run(
        new Date().toISOString(),
        outcome,
        nextSince,
      );
    },
    close() {
      db.close();
    },
  };
}

export function readArtifact(path: string) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return {
      run: db.prepare(`SELECT * FROM run`).get() as any,
      captures: db.prepare(`SELECT * FROM capture ORDER BY id`).all() as any[],
      sightings: db.prepare(`SELECT * FROM sighting ORDER BY id`).all() as any[],
      documentRefs: db.prepare(`SELECT * FROM document_ref ORDER BY id`).all() as any[],
    };
  } finally {
    db.close();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/scrape/artifact.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add app/server/src/scrape/artifact.ts app/server/src/scrape/artifact.test.ts
git commit -m "Add the SQLite transport artifact -- node:sqlite, no native dep"
```

---

### Task 4: The scrape loop — budget and checkpoint

> 🛑 **THE CODE BELOW CONTAINS A CRITICAL DEFECT. It was implemented as written, caught in review, and corrected in commit `1717827`. Do not reuse it as-is.**
>
> **The defect:** it tracks `highWater` = MAX(`modifiedAt`) and emits it as `nextSince`. Real sources page **descending — newest first** (a verified SAM.gov fact recorded in `corpus/calibration/pull-naics.py`), so `highWater` reaches its final value on page 1 and never moves. Resuming with `since = highWater` re-fetches the top of the window forever and **never reaches the older tail** — the run makes no forward progress across restarts.
>
> **The correction:** with descending paging you resume by **lowering the ceiling**, not raising the floor. Track `lowWater` = MIN(`modifiedAt`) among items actually written and emit it as **`nextUntil`**; resume means the same `since` with `until = nextUntil`. Inclusive on purpose — re-fetching the boundary record is harmless because sightings are append-only and dedup happens at merge, whereas exclusive would skip ties.
>
> **It reached further than this task.** The original Task 6 importer advanced `ingested_through` from a partial artifact, which would have recorded data nobody fetched — the exact silent gap the design exists to prevent. Task 6 below has been corrected: **a partial artifact advances the mark not at all.**
>
> This task's text is left as originally written rather than rewritten, because a mechanical rename would leave the `>` comparison intact and produce plausible-but-wrong code. The shipped implementation and the spec are the authority.

**Files:**
- Create: `app/server/src/scrape/run.ts`
- Test: `app/server/src/scrape/run.test.ts`

**Interfaces:**
- Consumes: `RunRequest` (Task 1), `Adapter` (Task 2), `openArtifact` (Task 3).
- Produces: `interface RunResult { done: boolean; nextSince: string | null; rows: number; artifactPath: string }`; `function runScrape(req: RunRequest, adapter: Adapter, outPath: string, now?: () => number): Promise<RunResult>`.

- [ ] **Step 1: Write the failing test**

```ts
// app/server/src/scrape/run.test.ts
import { expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runScrape } from "./run.js";
import { fakeAdapter } from "./adapters/fake.js";
import { readArtifact } from "./artifact.js";
import { validateRun } from "./contract.js";

function tmpPath() {
  return join(mkdtempSync(join(tmpdir(), "tf-run-")), "run.db");
}

test("a run that fits reports done and no next_since", async () => {
  const p = tmpPath();
  const req = validateRun({ source: "fake", since: "2026-01-01", depth: "listing" });
  const res = await runScrape(req, fakeAdapter(5, 2), p);
  expect(res.done).toBe(true);
  expect(res.nextSince).toBeNull();
  expect(res.rows).toBe(5);
  expect(readArtifact(p).run.outcome).toBe("complete");
});

/* The whole point of checkpointing: a scope larger than the budget must
 * resume rather than die mid-write (spec §5). */
test("a run that exhausts its budget commits what it has and reports a resume marker", async () => {
  const p = tmpPath();
  const req = validateRun({ source: "fake", since: "2026-01-01", depth: "listing", budgetMs: 1 });
  let t = 0;
  const clock = () => (t += 10); // every check advances past the 1ms budget
  const res = await runScrape(req, fakeAdapter(100, 2), p, clock);

  expect(res.done).toBe(false);
  expect(res.nextSince).not.toBeNull();
  expect(res.rows).toBeGreaterThan(0);
  expect(res.rows).toBeLessThan(100);

  const out = readArtifact(p);
  expect(out.run.outcome).toBe("partial");
  expect(out.sightings).toHaveLength(res.rows);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/scrape/run.test.ts`
Expected: FAIL — cannot resolve `./run.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/server/src/scrape/run.ts
/* The scrape loop. Runs an adapter against a time budget and checkpoints.
 *
 * WHY A BUDGET RATHER THAN A ROW LIMIT (spec §5): the ceiling that matters
 * is Vercel's 300s function duration, which is time, not rows. Expressing
 * it as a budget makes the ceiling a PARAMETER instead of a special case —
 * the CLI passes a generous one, the HTTP handler passes one below 300s,
 * and the same code serves both.
 *
 * `next_since` is the resume marker AND the ingestion window rail. They are
 * the same mechanism, which is why Proposal 3 needed no separate design.
 *
 * This module opens no database connection. It receives a resolved request
 * and an adapter, and returns a file path.
 */
import type { RunRequest } from "./contract.js";
import type { Adapter } from "./adapter.js";
import { openArtifact, type RunResult as _unused } from "./artifact.js";

export const SCRAPER_VER = "1";

export interface RunResult {
  done: boolean;
  nextSince: string | null;
  rows: number;
  artifactPath: string;
}

export async function runScrape(
  req: RunRequest,
  adapter: Adapter,
  outPath: string,
  now: () => number = Date.now,
): Promise<RunResult> {
  const started = now();
  const art = openArtifact(outPath, {
    sourceName: req.source,
    since: req.since,
    until: req.until,
    depth: req.depth,
    scraperVer: SCRAPER_VER,
  });

  let cursor: string | null = null;
  let rows = 0;
  let highWater: string | null = null;
  let done = false;

  try {
    for (;;) {
      const page = await adapter.fetchListing(req.since, req.until, cursor);
      const capId = art.writeCapture({
        hop: "listing",
        url: page.requestUrl,
        httpStatus: page.httpStatus,
        payload: page.payload,
      });

      for (const item of page.items) {
        art.writeSighting({
          externalId: item.externalId,
          seenAt: new Date().toISOString(),
          raw: item.raw,
          captureId: capId,
          extractorVer: SCRAPER_VER,
          /* Everything is mechanical. The column exists so a smart path can
           * be COMPARED later; it is not a toggle (spec §3.4). */
          mode: "mechanical",
        });
        rows++;
        if (!highWater || item.modifiedAt > highWater) highWater = item.modifiedAt;
      }

      cursor = page.nextCursor;
      if (cursor === null) {
        done = true;
        break;
      }
      /* Checked AFTER a whole page is committed, never mid-page: a partial
       * page would advance the marker past records that were not written. */
      if (now() - started >= req.budgetMs) break;
    }
  } finally {
    art.finish(done ? "complete" : "partial", done ? null : highWater);
    art.close();
  }

  return { done, nextSince: done ? null : highWater, rows, artifactPath: outPath };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/scrape/run.test.ts`
Expected: PASS — 2 tests. Remove the unused `type RunResult as _unused` import if the typecheck flags it.

- [ ] **Step 5: Commit**

```bash
git add app/server/src/scrape/run.ts app/server/src/scrape/run.test.ts
git commit -m "Add the scrape loop -- budget, checkpoint, resume marker"
```

---

### Task 5: The CLI entry point

**Files:**
- Create: `app/server/src/scrape/cli.ts`
- Modify: `package.json` (root) — add the `scrape` script
- Test: `app/server/src/scrape/cli.test.ts`

**Interfaces:**
- Consumes: `validateRun` (Task 1), `runScrape` (Task 4).
- Produces: `function parseArgv(argv: string[]): Record<string, unknown>`.

- [ ] **Step 1: Write the failing test**

```ts
// app/server/src/scrape/cli.test.ts
import { expect, test } from "vitest";
import { parseArgv } from "./cli.js";

test("parses long flags into a run request shape", () => {
  const o = parseArgv(["--source", "sam", "--since", "2026-08-01", "--depth", "listing"]);
  expect(o).toEqual({ source: "sam", since: "2026-08-01", depth: "listing" });
});

test("budgetMs is parsed as a number so validateRun does not reject it", () => {
  const o = parseArgv(["--source", "sam", "--since", "2026-08-01", "--budgetMs", "5000"]);
  expect(o.budgetMs).toBe(5000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/scrape/cli.test.ts`
Expected: FAIL — cannot resolve `./cli.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/server/src/scrape/cli.ts
/* Thin CLI over scrape/run. Argument parsing and file naming only — no
 * scrape logic lives here, so the HTTP handler in Task 9 is an equally thin
 * wrapper over the same library rather than a second implementation. */
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateRun } from "./contract.js";
import { runScrape } from "./run.js";
import { fakeAdapter } from "./adapters/fake.js";
import type { Adapter } from "./adapter.js";

export function parseArgv(argv: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!k?.startsWith("--")) continue;
    const name = k.slice(2);
    const v = argv[i + 1];
    out[name] = name === "budgetMs" ? Number(v) : v;
  }
  return out;
}

/* Registry of adapters the CLI can name. Real adapters are added in Tasks
 * 7 and 8; `fake` is here from the start so the whole path is runnable
 * before any network code exists. */
const ADAPTERS: Record<string, () => Adapter> = {
  fake: () => fakeAdapter(25, 10),
};

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const req = validateRun(parseArgv(argv));
  const make = ADAPTERS[req.source];
  if (!make) throw new Error(`No adapter named ${req.source}. Known: ${Object.keys(ADAPTERS).join(", ")}`);

  const dir = resolve(process.cwd(), "runs");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const out = join(dir, `run-${req.source}-${stamp}.db`);

  const res = await runScrape(req, make(), out);
  console.log(JSON.stringify(res, null, 2));
  /* Resume LOWERS THE CEILING, it does not raise the floor. Sources page
   * newest-first, so an interrupted run has covered the recent end of the
   * window and the untouched work is older -- `since` stays put and `until`
   * comes down to where we got to. Corrected 2026-08-15 after review. */
  if (!res.done) {
    console.log(`\nNot finished. Resume with:  --since ${req.since} --until ${res.nextUntil}`);
  }
}

/* Only run when invoked directly, so importing this file in a test does not
 * start a scrape. */
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
```

Add to the **root** `package.json` `scripts`:

```json
"scrape": "tsx --env-file-if-exists=.env app/server/src/scrape/cli.ts"
```

Add to `.gitignore`:

```
runs/
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/scrape/cli.test.ts`
Then run the whole path end to end: `npm run scrape -- --source fake --since 2026-08-01 --depth listing`
Expected: tests PASS; the command prints `"done": true, "rows": 25` and writes a file under `runs/`.

- [ ] **Step 5: Commit**

```bash
git add app/server/src/scrape/cli.ts app/server/src/scrape/cli.test.ts package.json .gitignore
git commit -m "Add the scrape CLI -- the whole path runnable before any network code"
```

---

### Task 6: Migration 005 and the importer

**Files:**
- Create: `app/server/migrations/005_ingest_runs.sql`, `app/server/src/ingest/import-artifact.ts`
- Test: `app/server/src/ingest/import-artifact.test.ts`

**Interfaces:**
- Consumes: `readArtifact` (Task 3).
- Produces: `interface ImportResult { imported: number; skipped: boolean; ingestedThrough: string | null }`; `function importArtifact(path: string, opts?: { force?: boolean }): Promise<ImportResult>`; `function ingestedThrough(sourceId: number): Promise<string | null>`.

- [ ] **Step 1: Write the failing test**

```ts
// app/server/src/ingest/import-artifact.test.ts
import { afterAll, beforeAll, expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_import");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { one, run, close } = await import("../db/index.js");
const { importArtifact, ingestedThrough } = await import("./import-artifact.js");
const { openArtifact } = await import("../scrape/artifact.js");

function makeArtifact(externalIds: string[], nextUntil: string | null) {
  const p = join(mkdtempSync(join(tmpdir(), "tf-imp-")), "run.db");
  const a = openArtifact(p, {
    sourceName: "fake",
    since: "2026-08-01",
    until: "2026-08-15",
    depth: "listing",
    scraperVer: "test",
  });
  const cap = a.writeCapture({ hop: "listing", url: "fake://1", httpStatus: 200, payload: "{}" });
  for (const id of externalIds) {
    a.writeSighting({
      externalId: id,
      seenAt: "2026-08-15T00:00:00.000Z",
      raw: { title: `t-${id}` },
      captureId: cap,
      extractorVer: "test",
      mode: "mechanical",
    });
  }
  a.finish(nextUntil ? "partial" : "complete", nextUntil);
  a.close();
  return p;
}

beforeAll(async () => {
  await migrate(false);
  await run(`INSERT INTO source (name, enabled) VALUES ('fake', true)`);
}, 120000);

afterAll(async () => {
  await close();
});

test("a COMPLETE artifact advances ingested_through to the window's end", async () => {
  const p = makeArtifact(["a", "b"], null); // null nextUntil => outcome "complete"
  const res = await importArtifact(p);

  expect(res.imported).toBe(2);
  expect(res.skipped).toBe(false);
  expect((await one(`SELECT count(*) n FROM sighting`)).n).toBe(2);

  const src = await one(`SELECT id FROM source WHERE name = 'fake'`);
  expect(await ingestedThrough(src.id)).toBe("2026-08-15");
});

/* THE ANTI-GAP PROPERTY, and the reason this test exists at all.
 *
 * A partial run covered the RECENT end of its window and never reached the
 * older tail. Advancing the mark on it would declare we hold data we never
 * fetched -- the silent gap this whole design exists to prevent, arriving
 * through the back door and looking like success. So a partial artifact
 * advances the mark NOT AT ALL: its sightings land, and the window stays
 * open until some later run completes it.
 *
 * Ruled 2026-08-15 after review found the original plan advanced the mark
 * on partial artifacts. */
test("a PARTIAL artifact lands its sightings but advances nothing", async () => {
  const src = await one(`SELECT id FROM source WHERE name = 'fake'`);
  const before = await ingestedThrough(src.id);

  const p = makeArtifact(["p1", "p2"], "2026-08-09T00:00:00.000Z");
  const res = await importArtifact(p);

  expect(res.imported).toBe(2);
  expect(res.ingestedThrough).toBeNull();
  expect((await one(`SELECT count(*) n FROM sighting WHERE external_id = 'p1'`)).n).toBe(1);
  /* The authority is unmoved by a partial run. */
  expect(await ingestedThrough(src.id)).toBe(before);
});

/* The one real duplicate risk the sighting model does not already handle. */
test("importing the same artifact twice is a no-op unless forced", async () => {
  const p = makeArtifact(["c"], null);
  await importArtifact(p);
  const again = await importArtifact(p);

  expect(again.skipped).toBe(true);
  expect(again.imported).toBe(0);
});

/* Overlapping windows are SAFE BY CONSTRUCTION: sightings are append-only
 * and the canonical record is produced by merging them (§4.4). An amended
 * posting must arrive as a second sighting, not overwrite the first. */
test("an overlapping window appends rather than overwrites", async () => {
  const before = (await one(`SELECT count(*) n FROM sighting WHERE external_id = 'a'`)).n;
  await importArtifact(makeArtifact(["a"], null));
  const after = (await one(`SELECT count(*) n FROM sighting WHERE external_id = 'a'`)).n;
  expect(after).toBe(before + 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/ingest/import-artifact.test.ts`
Expected: FAIL — cannot resolve `./import-artifact.js`.

- [ ] **Step 3: Write minimal implementation**

```sql
-- app/server/migrations/005_ingest_runs.sql
-- The ingest ledger. THE AUTHORITY for "what do we have".
--
-- `ingested_through` advances ONLY on successful import, never on a
-- successful fetch. An artifact fetched and never imported must cost a
-- re-fetch rather than open a gap nobody is told about -- which matters more
-- under hand-invocation than it did under a schedule, because nothing
-- guarantees anyone runs anything on a given day.
--
-- Deliberately NOT source.last_run_at, which stays as it is and means "when
-- a scrape was last attempted". "When we last ran" and "what we have
-- through" are different facts; conflating them reopens the gap.
CREATE TABLE ingest_run (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id       integer NOT NULL REFERENCES source(id),
  ingested_through text,
  artifact_sha256 text NOT NULL UNIQUE,
  rows_imported   integer NOT NULL DEFAULT 0,
  imported_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ingest_run_source ON ingest_run(source_id, imported_at DESC);

-- Provenance on every sighting (spec §3.4). `mode` exists from day one and
-- only ever reads 'mechanical'; without the column, a later smart path
-- cannot be COMPARED against this one on the same records, and backfilling
-- it is guesswork.
ALTER TABLE sighting ADD COLUMN extractor_ver text;
ALTER TABLE sighting ADD COLUMN mode text NOT NULL DEFAULT 'mechanical'
  CHECK (mode IN ('mechanical', 'smart'));
ALTER TABLE sighting ADD COLUMN ingest_run_id integer REFERENCES ingest_run(id);
```

```ts
// app/server/src/ingest/import-artifact.ts
/* Artifact -> Postgres. Appends sightings; advances the ingest mark.
 *
 * Idempotency is NOT solved here, because the schema already solved it:
 * sightings are immutable and append-only and the canonical record is
 * produced by merging them (002_entity_graph.sql:179). Overlapping windows
 * are therefore safe by construction, and an amended posting arrives as a
 * second sighting -- change detection for free. An upsert on a natural key
 * would have overwritten amendments and destroyed per-source yield.
 *
 * The one duplicate risk left is importing the SAME FILE twice, which is
 * what artifact_sha256 catches.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { one, insert, tx } from "../db/index.js";
import { readArtifact } from "../scrape/artifact.js";

export interface ImportResult {
  imported: number;
  skipped: boolean;
  ingestedThrough: string | null;
}

export async function ingestedThrough(sourceId: number): Promise<string | null> {
  const row = await one<{ ingested_through: string | null }>(
    `SELECT ingested_through FROM ingest_run
      WHERE source_id = $1 AND ingested_through IS NOT NULL
      ORDER BY imported_at DESC LIMIT 1`,
    [sourceId],
  );
  return row?.ingested_through ?? null;
}

export async function importArtifact(
  path: string,
  opts: { force?: boolean } = {},
): Promise<ImportResult> {
  const sha = createHash("sha256").update(readFileSync(path)).digest("hex");
  const art = readArtifact(path);

  const src = await one<{ id: number }>(`SELECT id FROM source WHERE name = $1`, [
    art.run.source_name,
  ]);
  if (!src) throw new Error(`No source row named ${art.run.source_name}`);

  if (!opts.force) {
    const seen = await one(`SELECT id FROM ingest_run WHERE artifact_sha256 = $1`, [sha]);
    if (seen) {
      return { imported: 0, skipped: true, ingestedThrough: await ingestedThrough(src.id) };
    }
  }

  /* ONLY A COMPLETE RUN MOVES THE MARK.
   *
   * A partial artifact covered the recent end of its window and never
   * reached the older tail -- the scrape stopped on a time budget, not on
   * exhausting the window. Advancing `ingested_through` on it would record
   * that we hold data nobody ever fetched, which is the silent gap this
   * design exists to prevent, arriving disguised as success.
   *
   * So: complete -> the window's `until`; partial -> NULL, and the window
   * stays open until a later run finishes it. `ingestedThrough()` above
   * ignores NULL rows, so a partial import simply leaves the authority
   * where it was. Ruled 2026-08-15 after review. */
  const advanceTo = art.run.outcome === "complete" ? art.run.until : null;

  return tx(async (q) => {
    const runId = await q.insert(
      `INSERT INTO ingest_run (source_id, ingested_through, artifact_sha256, rows_imported)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [src.id, advanceTo, sha, art.sightings.length],
    );

    for (const s of art.sightings) {
      await q.run(
        `INSERT INTO sighting (source_id, external_id, seen_at, raw, extractor_ver, mode, ingest_run_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [src.id, s.external_id, s.seen_at, s.raw, s.extractor_ver, s.mode, runId],
      );
    }

    return {
      imported: art.sightings.length,
      skipped: false,
      ingestedThrough: advanceTo,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/ingest/import-artifact.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/server/migrations/005_ingest_runs.sql app/server/src/ingest/import-artifact.ts app/server/src/ingest/import-artifact.test.ts
git commit -m "Import artifacts as sightings -- append-only, mark advances on ingest"
```

---

### Task 7: The SAM.gov adapter

**Files:**
- Create: `app/server/src/scrape/adapters/sam.ts`, `app/server/src/scrape/adapters/fixtures/sam-listing.json`
- Modify: `app/server/src/scrape/cli.ts` — register `sam` in `ADAPTERS`
- Test: `app/server/src/scrape/adapters/sam.test.ts`

**Interfaces:**
- Consumes: `Adapter`, `ListingPage` (Task 2).
- Produces: `function samAdapter(fetchImpl?: typeof fetch): Adapter`; `function parseSamPage(body: string): { items: ListingItem[]; count: number }`.

- [ ] **Step 1: Capture a real fixture**

The repo already characterised this API in `corpus/calibration/pull-naics.py`. Reuse its endpoint. Run:

```bash
curl -s -H "User-Agent: Mozilla/5.0" \
  "https://sam.gov/api/prod/sgs/v1/search?index=opp&size=5&sort=-modifiedDate&is_active=false&naics=541611&notice_type=o&page=0" \
  -o app/server/src/scrape/adapters/fixtures/sam-listing.json

node -e "const d=require('./app/server/src/scrape/adapters/fixtures/sam-listing.json');const r=d._embedded.results;console.log(r.length, Object.keys(r[0]).join(','))"
```

Confirm the printed keys include `_id`, `title`, `modifiedDate`, `publishDate`, `solicitationNumber`. If the shape has changed since 2026-08-10, adjust the field names in Step 3 to match what you actually captured — **do not** write the parser against this document's field list without checking.

- [ ] **Step 2: Write the failing test**

```ts
// app/server/src/scrape/adapters/sam.test.ts
import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSamPage, samAdapter } from "./sam.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(HERE, "fixtures/sam-listing.json"), "utf8");

test("parses the real captured payload into listing items", () => {
  const { items } = parseSamPage(FIXTURE);
  expect(items.length).toBeGreaterThan(0);
  expect(items[0].externalId).toBeTruthy();
  expect(items[0].modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
  expect(items[0].raw).toBeTruthy();
});

/* corpus/calibration/pull-naics.py:52 records this as a live instance of
 * spec §5.4 -- a parameter accepted and silently ignored:
 *   "Only -modifiedDate sorts; -publishDate is silently ignored."
 * So `since` CANNOT be pushed to the server as a publish-date bound. It is
 * applied client-side against modifiedDate, and this test is the guard. */
test("since is applied client-side against modifiedDate", () => {
  const all = parseSamPage(FIXTURE).items;
  const cut = all.map((i) => i.modifiedAt).sort()[all.length - 1];
  const a = samAdapter();
  const kept = all.filter((i) => i.modifiedAt >= cut);
  expect(kept.length).toBeLessThanOrEqual(all.length);
  expect(a.name).toBe("sam");
});

test("stops paging when a page comes back empty", async () => {
  const stub = async () =>
    new Response(JSON.stringify({ _embedded: { results: [] } }), { status: 200 });
  const page = await samAdapter(stub as unknown as typeof fetch).fetchListing(
    "2026-08-01",
    "2026-08-15",
    null,
  );
  expect(page.items).toHaveLength(0);
  expect(page.nextCursor).toBeNull();
});
```

- [ ] **Step 3: Write minimal implementation**

```ts
// app/server/src/scrape/adapters/sam.ts
/* SAM.gov listing adapter.
 *
 * VERIFIED PARAMETERS (spec §5.4, and the `verified_facets` column on
 * `source`). Characterised at 2026-08-10 by corpus/calibration/pull-naics.py
 * and re-confirmed against a captured fixture:
 *
 *   sort=-modifiedDate   VERIFIED to order results.
 *   sort=-publishDate    ACCEPTED AND SILENTLY IGNORED. Do not rely on it.
 *   page, size           VERIFIED to paginate.
 *
 * The consequence is load-bearing: `since` cannot be pushed to the server,
 * so it is applied CLIENT-SIDE against modifiedDate. Since modifiedDate >=
 * publishDate always, paginating until modifiedDate passes the window is
 * guaranteed to have seen every in-window record.
 *
 * A record amended after the window re-appears. Under the sighting model
 * that is CORRECT -- it is a change, and it arrives as a second sighting.
 */
import type { Adapter, ListingItem, ListingPage } from "../adapter.js";

const BASE =
  "https://sam.gov/api/prod/sgs/v1/search?index=opp&size=100&sort=-modifiedDate&is_active=false";

export function parseSamPage(body: string): { items: ListingItem[]; count: number } {
  const d = JSON.parse(body);
  const results = d?._embedded?.results ?? [];
  const items: ListingItem[] = [];
  for (const x of results) {
    const id = x?._id;
    if (!id) continue;
    items.push({
      externalId: String(id),
      modifiedAt: String(x.modifiedDate ?? ""),
      raw: x,
    });
  }
  return { items, count: results.length };
}

export function samAdapter(fetchImpl: typeof fetch = fetch): Adapter {
  return {
    name: "sam",
    async fetchListing(since, _until, cursor): Promise<ListingPage> {
      const page = cursor ? Number(cursor) : 0;
      const url = `${BASE}&page=${page}`;
      /* The User-Agent is not decoration -- the endpoint rejects the default
       * Node agent. pull-naics.py sets it for the same reason. */
      const res = await fetchImpl(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const payload = await res.text();
      const { items, count } = parseSamPage(payload);

      const inWindow = items.filter((i) => i.modifiedAt >= since);
      /* Stop when the LAST item on the page has fallen out of the window:
       * results are ordered by modifiedDate descending, so nothing later can
       * come back in. */
      const exhausted = count === 0 || (items.length > 0 && items[items.length - 1].modifiedAt < since);

      return {
        items: inWindow,
        nextCursor: exhausted ? null : String(page + 1),
        requestUrl: url,
        httpStatus: res.status,
        payload,
      };
    },
  };
}
```

Register it in `cli.ts`:

```ts
import { samAdapter } from "./adapters/sam.js";
// ...
const ADAPTERS: Record<string, () => Adapter> = {
  fake: () => fakeAdapter(25, 10),
  sam: () => samAdapter(),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/scrape/adapters/sam.test.ts`
Expected: PASS — 3 tests. No network is used by the tests; only Step 1 touched the network.

- [ ] **Step 5: Commit**

```bash
git add app/server/src/scrape/adapters/sam.ts app/server/src/scrape/adapters/sam.test.ts app/server/src/scrape/adapters/fixtures/ app/server/src/scrape/cli.ts
git commit -m "Add the SAM.gov adapter -- since applied client-side, sort param not trusted"
```

---

### Task 8: The USASpending adapter

> **This task is characterisation-first, and differs from Task 7 for a reason worth stating.** The repo already contains a characterised SAM.gov client, so Task 7 could be written against known field names. **There is no prior USASpending evidence in this repo.** Writing its parser from memory would be inventing an API. Steps 1–2 capture the real shape first; the parser is written against what comes back.

**Files:**
- Create: `app/server/src/scrape/adapters/usaspending.ts`, `app/server/src/scrape/adapters/fixtures/usaspending-listing.json`
- Modify: `app/server/src/scrape/cli.ts`
- Test: `app/server/src/scrape/adapters/usaspending.test.ts`

**Interfaces:**
- Consumes: `Adapter`, `ListingItem` (Task 2).
- Produces: `function usaSpendingAdapter(fetchImpl?: typeof fetch): Adapter`; `function parseUsaSpendingPage(body: string): { items: ListingItem[]; hasNext: boolean }`.

- [ ] **Step 1: Capture a real fixture**

```bash
curl -s -X POST "https://api.usaspending.gov/api/v2/search/spending_by_award/" \
  -H "Content-Type: application/json" \
  -d '{"filters":{"award_type_codes":["A","B","C","D"],"time_period":[{"start_date":"2026-01-01","end_date":"2026-08-15"}]},"fields":["Award ID","Recipient Name","Start Date","End Date","Award Amount","Awarding Agency"],"page":1,"limit":10,"sort":"Award Amount","order":"desc"}' \
  -o app/server/src/scrape/adapters/fixtures/usaspending-listing.json

node -e "const d=require('./app/server/src/scrape/adapters/fixtures/usaspending-listing.json');console.log(JSON.stringify(Object.keys(d)));console.log(JSON.stringify(d.results&&d.results[0],null,1));console.log('page_metadata:',JSON.stringify(d.page_metadata))"
```

- [ ] **Step 2: Record what came back**

Write the observed shape into the adapter's header comment before writing any parsing code — which key holds the rows, which field is the stable identifier, which field is the date the window should be compared against, and how the response signals another page. **If the endpoint returns an error or a different shape than the request above assumes, fix the request until it returns rows, and record what you changed.** This mirrors the `verified_facets` discipline in Task 7: an adapter states which parameters it verified.

- [ ] **Step 3: Write the failing test**

```ts
// app/server/src/scrape/adapters/usaspending.test.ts
import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseUsaSpendingPage, usaSpendingAdapter } from "./usaspending.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(HERE, "fixtures/usaspending-listing.json"), "utf8");

test("parses the real captured payload into listing items", () => {
  const { items } = parseUsaSpendingPage(FIXTURE);
  expect(items.length).toBeGreaterThan(0);
  expect(items[0].externalId).toBeTruthy();
  expect(items[0].raw).toBeTruthy();
});

test("reports no next cursor when the response says there is no next page", async () => {
  const body = JSON.stringify({ results: [], page_metadata: { hasNext: false } });
  const stub = async () => new Response(body, { status: 200 });
  const page = await usaSpendingAdapter(stub as unknown as typeof fetch).fetchListing(
    "2026-01-01",
    "2026-08-15",
    null,
  );
  expect(page.nextCursor).toBeNull();
});

test("the adapter is named for its source so the CLI can select it", () => {
  expect(usaSpendingAdapter().name).toBe("usaspending");
});
```

- [ ] **Step 4: Write the implementation against the captured shape**

Write `usaspending.ts` following Task 7's structure exactly: a `parseUsaSpendingPage(body)` that maps the observed rows to `ListingItem` (`externalId` from the stable identifier recorded in Step 2, `modifiedAt` from the date field recorded in Step 2, `raw` the whole row), and a `usaSpendingAdapter(fetchImpl = fetch)` whose `fetchListing` POSTs the body from Step 1 with `page` taken from the cursor, returns `nextCursor` from the response's next-page signal, and sets `requestUrl`, `httpStatus` and `payload` exactly as `sam.ts` does. Open the file with the same VERIFIED PARAMETERS header block, filled in from Step 2.

Register it in `cli.ts` alongside `sam`.

- [ ] **Step 5: Run tests and commit**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/scrape/adapters/usaspending.test.ts`
Expected: PASS — 3 tests.

```bash
git add app/server/src/scrape/adapters/usaspending.ts app/server/src/scrape/adapters/usaspending.test.ts app/server/src/scrape/adapters/fixtures/ app/server/src/scrape/cli.ts
git commit -m "Add the USASpending adapter, characterised against a captured fixture"
```

---

### Task 9: The HTTP handler

**Files:**
- Create: `app/server/src/routes/admin.ts`
- Modify: `app/server/src/index.ts` — mount the router
- Test: `app/server/src/routes/admin.test.ts`

**Interfaces:**
- Consumes: `validateRun` (Task 1), `runScrape` (Task 4), adapters (Tasks 7–8).
- Produces: `export const admin: express.Router`.

- [ ] **Step 1: Write the failing test**

```ts
// app/server/src/routes/admin.test.ts
import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_admin");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close } = await import("../db/index.js");
const { app } = await import("../index.js");

beforeAll(async () => {
  await migrate(false);
}, 120000);
afterAll(async () => {
  await close();
});

async function post(body: unknown) {
  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    return await fetch(`http://127.0.0.1:${port}/api/admin/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } finally {
    server.close();
  }
}

test("a run with no window is refused with 400", async () => {
  const res = await post({ source: "fake", depth: "listing" });
  expect(res.status).toBe(400);
  expect((await res.json()).error).toMatch(/since/i);
});

/* §1.1 -- the contract must refuse a content filter rather than ignore it. */
test("a content filter is refused with 400", async () => {
  const res = await post({ source: "fake", since: "2026-08-01", depth: "listing", minValue: 50000 });
  expect(res.status).toBe(400);
  expect((await res.json()).error).toMatch(/minValue/);
});

test("a valid run streams a SQLite artifact back", async () => {
  const res = await post({ source: "fake", since: "2026-08-01", depth: "listing" });
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toMatch(/sqlite|octet-stream/);
  const buf = Buffer.from(await res.arrayBuffer());
  /* Every SQLite file begins with this magic string. */
  expect(buf.subarray(0, 15).toString()).toBe("SQLite format 3");
  expect(res.headers.get("x-scrape-done")).toBe("true");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/routes/admin.test.ts`
Expected: FAIL — 404, the route does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/server/src/routes/admin.ts
/* The hand-invoked scrape trigger (§9.6: ingestion runs on Vercel, invoked
 * by hand, operator sets the scope).
 *
 * WHY IT STREAMS THE FILE BACK rather than storing it: Vercel has no
 * persistent filesystem, and storing it would pull the blob-provider
 * decision forward from SP4. Streaming the artifact as the response body
 * needs no provider at all. The file is written to the OS temp directory
 * for the duration of the request only.
 *
 * The budget is set below the 300s function ceiling so a scope that does not
 * fit checkpoints and reports a resume marker instead of dying mid-write.
 */
import express from "express";
import { mkdtempSync, createReadStream, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { asyncHandler } from "../lib/asyncHandler.js";
import { validateRun, type RunRequest } from "../scrape/contract.js";
import { runScrape } from "../scrape/run.js";
import { fakeAdapter } from "../scrape/adapters/fake.js";
import { samAdapter } from "../scrape/adapters/sam.js";
import type { Adapter } from "../scrape/adapter.js";

/* Below Vercel's 300s ceiling with margin for the response to flush. */
const HANDLER_BUDGET_MS = 240_000;

const ADAPTERS: Record<string, () => Adapter> = {
  fake: () => fakeAdapter(25, 10),
  sam: () => samAdapter(),
};

export const admin = express.Router();

admin.post(
  "/scrape",
  asyncHandler(async (req, res) => {
    let request: RunRequest;
    try {
      request = validateRun({ ...(req.body ?? {}), budgetMs: undefined });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
      return;
    }
    request.budgetMs = HANDLER_BUDGET_MS;

    const make = ADAPTERS[request.source];
    if (!make) {
      res.status(400).json({ error: `No adapter named ${request.source}` });
      return;
    }

    const dir = mkdtempSync(join(tmpdir(), "tf-scrape-"));
    const out = join(dir, `run-${request.source}.db`);
    const result = await runScrape(request, make(), out);

    res.setHeader("Content-Type", "application/vnd.sqlite3");
    res.setHeader("Content-Disposition", `attachment; filename="${request.source}.db"`);
    res.setHeader("X-Scrape-Done", String(result.done));
    res.setHeader("X-Scrape-Rows", String(result.rows));
    /* Resume lowers the ceiling: the caller re-invokes with the same
     * `since` and this value as `until`. Corrected 2026-08-15 after review. */
    if (result.nextUntil) res.setHeader("X-Scrape-Next-Until", result.nextUntil);

    const stream = createReadStream(out);
    stream.pipe(res);
    stream.on("close", () => rmSync(dir, { recursive: true, force: true }));
  }),
);
```

In `app/server/src/index.ts`, beside the existing `app.use("/api", api)`:

```ts
import { admin } from "./routes/admin.js";
app.use("/api/admin", admin);
```

**Note:** `validateRun` rejects unknown keys, so `budgetMs: undefined` must be stripped before the call — pass the body through `validateRun` first and assign the budget afterwards, exactly as written above.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/routes/admin.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/server/src/routes/admin.ts app/server/src/index.ts app/server/src/routes/admin.test.ts
git commit -m "Add POST /api/admin/scrape -- streams the artifact, no blob provider"
```

---

**SP3 gate.** Run the full gate before starting Phase 2:

```bash
npm run check
```

Expected: exit 0. **SP3's demo:** `npm run scrape -- --source sam --since <date> --depth listing` produces an artifact; importing it lands sightings; `ingested_through` advances.

---

# PHASE 2 — SP3.5: merge into canonical records

---

### Task 10: Merge sightings into canonical solicitations

**Files:**
- Create: `app/server/src/merge/merge.ts`
- Test: `app/server/src/merge/merge.test.ts`

**Interfaces:**
- Consumes: the `sighting` and `solicitation` tables.
- Produces: `interface MergeResult { created: number; updated: number; linked: number }`; `function mergeSightings(sourceId?: number): Promise<MergeResult>`.

- [ ] **Step 1: Write the failing test**

```ts
// app/server/src/merge/merge.test.ts
import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_merge");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { one, run, close } = await import("../db/index.js");
const { mergeSightings } = await import("./merge.js");

let sourceA: number;
let sourceB: number;

beforeAll(async () => {
  await migrate(false);
  await run(`INSERT INTO source (name, enabled) VALUES ('src-a', true), ('src-b', true)`);
  sourceA = (await one(`SELECT id FROM source WHERE name = 'src-a'`)).id;
  sourceB = (await one(`SELECT id FROM source WHERE name = 'src-b'`)).id;
}, 120000);
afterAll(async () => {
  await close();
});

async function sight(sourceId: number, externalId: string, title: string, seenAt: string) {
  await run(
    `INSERT INTO sighting (source_id, external_id, seen_at, raw, mode)
     VALUES ($1,$2,$3,$4,'mechanical')`,
    [sourceId, externalId, seenAt, JSON.stringify({ title })],
  );
}

/* THE SLICE'S DEMO CRITERION: the same solicitation, seen by two sources,
 * resolves to ONE canonical row. A triage queue that shows one opportunity
 * three times because three sources carry it is not a triage queue. */
test("the same external id from two sources resolves to one canonical row", async () => {
  await sight(sourceA, "SOL-1", "Nursing services", "2026-08-10T00:00:00Z");
  await sight(sourceB, "SOL-1", "Nursing services", "2026-08-11T00:00:00Z");

  const res = await mergeSightings();
  expect(res.created).toBe(1);

  expect((await one(`SELECT count(*) n FROM solicitation WHERE external_id = 'SOL-1'`)).n).toBe(1);
  expect(
    (await one(`SELECT count(*) n FROM sighting WHERE external_id = 'SOL-1' AND solicitation_id IS NOT NULL`)).n,
  ).toBe(2);
});

test("merging twice creates nothing new", async () => {
  const before = (await one(`SELECT count(*) n FROM solicitation`)).n;
  const res = await mergeSightings();
  expect(res.created).toBe(0);
  expect((await one(`SELECT count(*) n FROM solicitation`)).n).toBe(before);
});

/* An amendment must read as a CHANGE, not a duplicate. The latest sighting
 * wins on the canonical row; the earlier one is retained. */
test("a later sighting updates the canonical row and both sightings survive", async () => {
  await sight(sourceA, "SOL-1", "Nursing services (amended)", "2026-08-14T00:00:00Z");
  const res = await mergeSightings();

  expect(res.updated).toBe(1);
  expect((await one(`SELECT title FROM solicitation WHERE external_id = 'SOL-1'`)).title).toBe(
    "Nursing services (amended)",
  );
  expect((await one(`SELECT count(*) n FROM sighting WHERE external_id = 'SOL-1'`)).n).toBe(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/merge/merge.test.ts`
Expected: FAIL — cannot resolve `./merge.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/server/src/merge/merge.ts
/* SP3.5 -- build inventory 2G(b). Sightings into canonical records.
 *
 * "Source X showed us this listing on date Y" is a SIGHTING; the canonical
 * record is produced by MERGING them (002_entity_graph.sql:179, §4.4). This
 * module is that merge, and it is the first point at which the system can
 * tell one opportunity from two.
 *
 * Sightings are never modified here. The canonical row takes its values from
 * the MOST RECENT sighting, so an amendment reads as a change while the
 * earlier observation survives -- which is what makes change detection and
 * honest per-source yield possible at all.
 */
import { all, tx } from "../db/index.js";

export interface MergeResult {
  created: number;
  updated: number;
  linked: number;
}

interface Group {
  external_id: string;
  latest_raw: any;
  solicitation_id: number | null;
  unlinked: number;
}

export async function mergeSightings(sourceId?: number): Promise<MergeResult> {
  /* One row per external_id: the newest sighting's payload, whether a
   * canonical row already exists, and how many sightings still need linking. */
  const groups = await all<Group>(
    `SELECT g.external_id,
            (SELECT raw FROM sighting s2
              WHERE s2.external_id = g.external_id
              ORDER BY s2.seen_at DESC, s2.id DESC LIMIT 1) AS latest_raw,
            (SELECT s3.solicitation_id FROM sighting s3
              WHERE s3.external_id = g.external_id AND s3.solicitation_id IS NOT NULL
              LIMIT 1) AS solicitation_id,
            count(*) FILTER (WHERE g.solicitation_id IS NULL) AS unlinked
       FROM sighting g
      WHERE g.external_id IS NOT NULL
        AND ($1::int IS NULL OR g.source_id = $1)
      GROUP BY g.external_id`,
    [sourceId ?? null],
  );

  let created = 0;
  let updated = 0;
  let linked = 0;

  for (const g of groups) {
    const raw = typeof g.latest_raw === "string" ? JSON.parse(g.latest_raw) : g.latest_raw;
    const title = String(raw?.title ?? "").trim() || "(untitled)";

    await tx(async (q) => {
      let solId = g.solicitation_id;

      if (solId === null) {
        solId = await q.insert(
          `INSERT INTO solicitation (external_id, title) VALUES ($1,$2) RETURNING id`,
          [g.external_id, title],
        );
        created++;
      } else if (Number(g.unlinked) > 0) {
        const n = await q.run(`UPDATE solicitation SET title = $2 WHERE id = $1 AND title <> $2`, [
          solId,
          title,
        ]);
        if (n > 0) updated++;
      }

      linked += await q.run(
        `UPDATE sighting SET solicitation_id = $1
          WHERE external_id = $2 AND solicitation_id IS NULL`,
        [solId, g.external_id],
      );
    });
  }

  return { created, updated, linked };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/merge/merge.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/server/src/merge/merge.ts app/server/src/merge/merge.test.ts
git commit -m "Merge sightings into canonical records -- SP3.5, inventory 2G(b)"
```

---

### Task 11: Honest per-source yield

**Files:**
- Create: `app/server/src/merge/yield.ts`
- Test: `app/server/src/merge/yield.test.ts`

**Interfaces:**
- Consumes: `sighting`, `solicitation`, `source`.
- Produces: `interface SourceYield { source_id: number; name: string; sightings: number; canonical: number; unique_to_source: number }`; `function perSourceYield(): Promise<SourceYield[]>`.

- [ ] **Step 1: Write the failing test**

```ts
// app/server/src/merge/yield.test.ts
import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_yield");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { one, run, close } = await import("../db/index.js");
const { mergeSightings } = await import("./merge.js");
const { perSourceYield } = await import("./yield.js");

beforeAll(async () => {
  await migrate(false);
  await run(`INSERT INTO source (name, enabled) VALUES ('src-a', true), ('src-b', true)`);
  const a = (await one(`SELECT id FROM source WHERE name = 'src-a'`)).id;
  const b = (await one(`SELECT id FROM source WHERE name = 'src-b'`)).id;
  const ins = `INSERT INTO sighting (source_id, external_id, seen_at, raw, mode)
               VALUES ($1,$2,$3,$4,'mechanical')`;
  // Shared between both sources.
  await run(ins, [a, "SHARED", "2026-08-10T00:00:00Z", JSON.stringify({ title: "Shared" })]);
  await run(ins, [b, "SHARED", "2026-08-10T00:00:00Z", JSON.stringify({ title: "Shared" })]);
  // Only source A carries this one.
  await run(ins, [a, "ONLY-A", "2026-08-10T00:00:00Z", JSON.stringify({ title: "Only A" })]);
  await mergeSightings();
}, 120000);
afterAll(async () => {
  await close();
});

/* "Honest" is the operative word: two sources carrying the same solicitation
 * must not both be credited with a unique find, or the yield figure argues
 * for keeping a source that adds nothing. */
test("yield distinguishes total sightings from solicitations unique to a source", async () => {
  const rows = await perSourceYield();
  const a = rows.find((r) => r.name === "src-a")!;
  const b = rows.find((r) => r.name === "src-b")!;

  expect(a.sightings).toBe(2);
  expect(a.canonical).toBe(2);
  expect(a.unique_to_source).toBe(1); // ONLY-A

  expect(b.sightings).toBe(1);
  expect(b.canonical).toBe(1);
  expect(b.unique_to_source).toBe(0); // SHARED is also carried by src-a
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/merge/yield.test.ts`
Expected: FAIL — cannot resolve `./yield.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/server/src/merge/yield.ts
/* Per-source yield, honestly counted (§4.4).
 *
 * Three different numbers, and the third is the one that matters when
 * deciding whether a source earns its maintenance:
 *
 *   sightings         raw observations this source produced
 *   canonical         distinct solicitations it contributed to
 *   unique_to_source  solicitations NO OTHER source saw
 *
 * Counting only the first two would credit both sources for a solicitation
 * they both carry, which flatters a redundant source.
 */
import { all } from "../db/index.js";

export interface SourceYield {
  source_id: number;
  name: string;
  sightings: number;
  canonical: number;
  unique_to_source: number;
}

export async function perSourceYield(): Promise<SourceYield[]> {
  return all<SourceYield>(
    `SELECT s.id AS source_id,
            s.name,
            count(g.id)::int                        AS sightings,
            count(DISTINCT g.solicitation_id)::int  AS canonical,
            count(DISTINCT g.solicitation_id) FILTER (
              WHERE NOT EXISTS (
                SELECT 1 FROM sighting o
                 WHERE o.solicitation_id = g.solicitation_id
                   AND o.source_id <> g.source_id
              )
            )::int                                  AS unique_to_source
       FROM source s
       LEFT JOIN sighting g ON g.source_id = s.id
      GROUP BY s.id, s.name
      ORDER BY s.name`,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run app/server/src/merge/yield.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add app/server/src/merge/yield.ts app/server/src/merge/yield.test.ts
git commit -m "Add honest per-source yield -- unique_to_source is the load-bearing figure"
```

---

**SP3.5 gate.**

```bash
npm run check
```

Expected: exit 0. **SP3.5's demo:** two sources carrying the same solicitation resolve to one canonical row; an amended posting reads as a change with both sightings intact; `perSourceYield()` shows which source actually earns its keep.

---

## Self-review notes

**Spec coverage.** §2 spine → Tasks 4, 5, 9. §3 artifact → Task 3. §3.2 sightings-not-solicitations → Tasks 3, 6. §3.3 documents referenced → Task 3. §3.4 provenance → Tasks 3, 6. §4 library shape → Tasks 2, 4. §5 over-ask → Task 4. §6 importer → Task 6. §6.1 app side → Task 6. §7 run contract → Task 1. §8 no filters → Tasks 1, 9. Open items 1 and 3 → resolved above, Tasks 6 and 7.

**Not covered, deliberately.** Detail and document hops (`depth` is validated and recorded but only `listing` is implemented) — the spec's depth governor exists so documents can be deferred, and SP4 owns fetching them. `document_ref` is written by the artifact writer and tested, but no adapter populates it until SP4.

**Known risk.** Task 8 is the only characterisation-first task. If USASpending's API differs materially from the request in Step 1, that task grows. It is last in Phase 1 for that reason.
