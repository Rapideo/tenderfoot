# SP4 — Fetch and extraction: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch each live solicitation's attachments, parse them mechanically, and record every extracted field with its confidence and the passage it came from — keeping disagreements rather than resolving them away.

**Architecture:** Two operator-invoked, time-boxed, resumable phases behind `/admin`. *Discover* calls SAM.gov's attachment endpoint and inserts `document` rows as `pending`. *Extract* downloads each pending document to a temp file, parses it by media type, writes `extracted_text` and `extracted_field` rows, and marks the row `extracted` / `absent` / `failed`. Bytes are never retained. Both phases walk solicitations nearest-live-deadline-first, commit **per document**, and stop cleanly on a time budget reporting what remains.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Express, Postgres via `pg`, Vitest. Parsers: `unpdf` (PDF), `mammoth` (DOCX), **SheetJS pinned from `cdn.sheetjs.com`** (XLSX), `jszip` (bundles).

**Spec:** `docs/superpowers/specs/2026-08-28-sp4-fetch-extraction-design.md`

## Global Constraints

- **Gate is `npm run check` from the repo root.** It must exit 0 at the end of every task. Baseline entering this plan: **314 tests / 45 files**.
- **TDD, without exception.** Write the failing test, run it, watch it fail *for the stated reason*, then implement. A test that passes on first run is testing something that already worked.
- **`CEILING_MS` comes from `scrape/import-budget.ts`.** It is derived from `vercel.json`'s `maxDuration` and asserted against it by test. **Never write a second copy of that number** — doing so cost a day on 2026-08-27.
- **Commit per document. Never wrap a batch in one transaction.** A batch killed at the ceiling must keep everything it finished.
- **Never mark `extracted` without text.** Fail closed.
- **`produced_by` is `'mechanical'`** on every row this slice writes. No model is used.
- **Nothing is silently skipped.** An unsupported type is a `failed` row with the reason in `source_note`.
- **No network in tests.** `corpus/` holds 110 real files; SAM.gov calls are stubbed.
- **ESM import specifiers end in `.js`** even for TypeScript sources, matching the existing codebase.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/server/migrations/008_extraction.sql` | `document.source_url`, `document.parent_document_id`, `extracted_field` table |
| `app/server/src/extract/parse.ts` | Media type → parser dispatch; returns a discriminated `ParseResult` |
| `app/server/src/extract/parsers/pdf.ts` | `unpdf` |
| `app/server/src/extract/parsers/docx.ts` | `mammoth.convertToHtml` — structure preserved |
| `app/server/src/extract/parsers/xlsx.ts` | SheetJS; computed populated range; cached-formula detection |
| `app/server/src/extract/parsers/zip.ts` | Bundle expansion, depth 1 |
| `app/server/src/extract/fields.ts` | Mechanical field extraction from text, with quotes |
| `app/server/src/extract/precedence.ts` | Read-time precedence + conflict view + accuracy query |
| `app/server/src/extract/discover.ts` | SAM.gov attachment list → `document` rows |
| `app/server/src/extract/run-extract.ts` | The batch orchestrator: time-boxed, per-document commit |
| `app/server/src/routes/admin.ts` | Two new endpoints (modify) |
| `app/client/src/admin/Admin.tsx` | Two new controls (modify) |

**Decision D8 (recorded here because the spec is silent):** **nested zips are not traversed.** A `.zip` inside a `.zip` becomes a `document` row marked `failed` with `source_note = 'nested archive not traversed'`. The spike hit exactly this (`Att L - Bidders Library.zip` inside `docs.zip`) and skipped it silently; this makes the same limit visible instead. Add to `docs/admin-deviations.md` in Task 6.

---

### Task 1: Dependencies and migration 008

**Files:**
- Modify: `app/server/package.json`
- Create: `app/server/migrations/008_extraction.sql`
- Test: `app/server/src/db/schema.test.ts` (append)

**Interfaces:**
- Consumes: nothing
- Produces: `document.source_url text`, `document.parent_document_id integer`, table `extracted_field`

- [ ] **Step 1: Install the parsers**

SheetJS is **not** on npm — it ships only from its own CDN. If `0.20.3` 404s, take the current version listed at `https://cdn.sheetjs.com` and record which you used in the commit message.

```bash
cd app/server
npm i mammoth unpdf jszip
npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

- [ ] **Step 2: Write the failing schema test**

Append to `app/server/src/db/schema.test.ts`:

```ts
test("document carries a fetch target and a bundle parent", async () => {
  const cols = await all<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'document'`,
  );
  const names = cols.map((c) => c.column_name);
  expect(names).toContain("source_url");
  expect(names).toContain("parent_document_id");
});

test("extracted_field keeps losing values instead of discarding them", async () => {
  const sol = await insert(
    `INSERT INTO solicitation (title) VALUES ('conflict fixture') RETURNING id`,
  );
  await dbRun(
    `INSERT INTO extracted_field (solicitation_id, field_name, value_text, origin, produced_by)
     VALUES ($1, 'closes_at', '2026-09-17', 'listing', 'mechanical')`,
    [sol],
  );
  await dbRun(
    `INSERT INTO extracted_field (solicitation_id, field_name, value_text, origin, quote, produced_by)
     VALUES ($1, 'closes_at', '2026-08-26', 'document', 'proposals due August 26, 2026', 'mechanical')`,
    [sol],
  );
  const rows = await all<{ origin: string }>(
    `SELECT origin FROM extracted_field WHERE solicitation_id = $1 AND field_name = 'closes_at'`,
    [sol],
  );
  /* Both survive. The conflict IS the two rows. */
  expect(rows).toHaveLength(2);
});

test("origin is constrained to the two it may be", async () => {
  const sol = await insert(`INSERT INTO solicitation (title) VALUES ('x') RETURNING id`);
  await expect(
    dbRun(
      `INSERT INTO extracted_field (solicitation_id, field_name, origin) VALUES ($1, 'closes_at', 'guess')`,
      [sol],
    ),
  ).rejects.toThrow();
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
cd app/server && npx vitest run src/db/schema.test.ts -t "carries a fetch target"
```
Expected: FAIL — `column_name` list has no `source_url` (the migration does not exist yet).

- [ ] **Step 4: Write migration 008**

Create `app/server/migrations/008_extraction.sql`:

```sql
-- SP4. Documents are fetched, parsed and DISCARDED: a citation quotes the
-- extracted passage, so there are no bytes to keep. `path` (a filesystem
-- path from the pre-Vercel design) is left alone rather than dropped --
-- dropping a column is a claim about rows that may yet mean something by it.
ALTER TABLE document ADD COLUMN source_url         text;
ALTER TABLE document ADD COLUMN parent_document_id integer REFERENCES document(id);

-- Every extracted field carries its confidence AND the passage it came from.
-- `assessment.evidence` is the right shape but belongs to scoring, parked.
--
-- CONFLICTS ARE ROWS, NOT A FLAG. One solicitation may hold a 'listing' row
-- and several 'document' rows for the same field_name with different values.
-- Precedence is applied at READ time, so the rule can change without
-- re-extraction and nothing is discarded at ingest.
--
-- value_text NULL = looked for and ABSENT. No row at all = never looked for.
-- The same three-state distinction extract_status already enforces.
CREATE TABLE extracted_field (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitation_id integer NOT NULL REFERENCES solicitation(id),
  field_name      text NOT NULL,
  value_text      text,
  origin          text NOT NULL CHECK (origin IN ('listing','document')),
  document_id     integer REFERENCES document(id),
  quote           text,
  confidence      double precision,
  produced_by     text CHECK (produced_by IN ('mechanical','smart') OR produced_by IS NULL),
  -- Carries what a value cannot: chiefly that a spreadsheet total is a CACHED
  -- value replayed by SheetJS rather than one computed now. A stale cache is
  -- indistinguishable from a fresh one.
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX extracted_field_solicitation ON extracted_field(solicitation_id, field_name);
```

- [ ] **Step 5: Run the gate**

```bash
npm run check
```
Expected: exit 0, 317 tests / 45 files.

- [ ] **Step 6: Commit**

```bash
git add app/server/package.json app/server/package-lock.json app/server/migrations/008_extraction.sql app/server/src/db/schema.test.ts
git commit -m "Add migration 008 and the extraction dependencies"
```

---

### Task 2: Parser dispatch

**Files:**
- Create: `app/server/src/extract/parse.ts`
- Test: `app/server/src/extract/parse.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
```ts
export type ParseResult =
  | { kind: "text"; text: string; notes: string[] }
  | { kind: "members"; members: { filename: string; bytes: Buffer }[] }
  | { kind: "unsupported"; reason: string };
export function parserFor(mediaType: string, filename: string): "pdf" | "docx" | "xlsx" | "zip" | null;
```

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { parserFor } from "./parse.js";

test("dispatches the four types the corpus actually contains", () => {
  expect(parserFor("application/pdf", "a.pdf")).toBe("pdf");
  expect(parserFor("", "a.docx")).toBe("docx");
  expect(parserFor("", "a.xlsx")).toBe("xlsx");
  expect(parserFor("", "bundle.zip")).toBe("zip");
});

test("an unknown type returns null rather than a guess", () => {
  /* .pptx has no maintained Node library (spike, 2026-08-18). Returning null
   * makes it a recorded `failed` row; guessing would make it a silent one. */
  expect(parserFor("", "deck.pptx")).toBeNull();
  expect(parserFor("", "notes.txt")).toBeNull();
});

test("the extension WINS when the two signals disagree", () => {
  /* This is the case that actually proves precedence. octet-stream alone does
   * not: it matches neither branch, so extension-first and media-type-first
   * both fall through to the extension and the test cannot tell them apart. */
  expect(parserFor("application/pdf", "a.docx")).toBe("docx");
  expect(parserFor("application/octet-stream", "RFP.pdf")).toBe("pdf");
});

test("xlsm is treated as a spreadsheet", () => {
  expect(parserFor("", "macro-enabled.xlsm")).toBe("xlsx");
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd app/server && npx vitest run src/extract/parse.test.ts
```
Expected: FAIL — `Failed to load url ./parse.js`.

- [ ] **Step 3: Implement**

```ts
export type ParseResult =
  | { kind: "text"; text: string; notes: string[] }
  | { kind: "members"; members: { filename: string; bytes: Buffer }[] }
  | { kind: "unsupported"; reason: string };

const BY_EXTENSION: Record<string, "pdf" | "docx" | "xlsx" | "zip"> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  xlsm: "xlsx",
  zip: "zip",
};

/* Extension first, media type second. SAM.gov's attachment list often gives
 * `application/octet-stream` for everything, so the type is the weaker signal. */
export function parserFor(mediaType: string, filename: string): "pdf" | "docx" | "xlsx" | "zip" | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (BY_EXTENSION[ext]) return BY_EXTENSION[ext];
  if (mediaType === "application/pdf") return "pdf";
  return null;
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd app/server && npx vitest run src/extract/parse.test.ts
```
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/server/src/extract/parse.ts app/server/src/extract/parse.test.ts
git commit -m "Dispatch parsers by extension first, media type second"
```

---

### Task 3: PDF parser

**Files:**
- Create: `app/server/src/extract/parsers/pdf.ts`
- Test: `app/server/src/extract/parsers/pdf.test.ts`

**Interfaces:**
- Consumes: `ParseResult` from Task 2
- Produces: `export async function parsePdf(bytes: Buffer): Promise<ParseResult>`

- [ ] **Step 1: Write the failing test against a real corpus file**

```ts
import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { parsePdf } from "./pdf.js";

const FIXTURE = new URL(
  "../../../../../corpus/federal/HPLRFI2026/HPL RFI 2026_07_30.pdf",
  import.meta.url,
);

test("reads text out of a real corpus PDF", async () => {
  const r = await parsePdf(Buffer.from(readFileSync(FIXTURE)));
  expect(r.kind).toBe("text");
  if (r.kind !== "text") return;
  expect(r.text.length).toBeGreaterThan(500);
});

test("records that a PDF carries no table structure", async () => {
  /* The format has no table structure to preserve -- geometry is present,
   * reconstruction is not provided (spike part two). Saying so in `notes`
   * keeps it from being mistaken for a parser limitation later. */
  const r = await parsePdf(Buffer.from(readFileSync(FIXTURE)));
  if (r.kind !== "text") throw new Error("expected text");
  expect(r.notes.join(" ")).toMatch(/no table structure/i);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd app/server && npx vitest run src/extract/parsers/pdf.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { extractText, getDocumentProxy } from "unpdf";
import type { ParseResult } from "../parse.js";

export async function parsePdf(bytes: Buffer): Promise<ParseResult> {
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(doc, { mergePages: true });
  return {
    kind: "text",
    text: Array.isArray(text) ? text.join("\n") : text,
    notes: ["pdf: no table structure available; geometry is present, reconstruction is not"],
  };
}
```

- [ ] **Step 4: Run it and watch it pass**

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add app/server/src/extract/parsers/pdf.ts app/server/src/extract/parsers/pdf.test.ts
git commit -m "Parse PDFs with unpdf, and say plainly that tables do not survive"
```

---

### Task 4: DOCX parser — structure preserved

**Files:**
- Create: `app/server/src/extract/parsers/docx.ts`
- Test: `app/server/src/extract/parsers/docx.test.ts`

**Interfaces:**
- Produces: `export async function parseDocx(bytes: Buffer): Promise<ParseResult>`

- [ ] **Step 1: Write the failing test**

Pick any `.docx` in `corpus/indiana/**` that contains a table; the test asserts structure, not a specific document's wording.

```ts
import { expect, test } from "vitest";
import { readFileSync, globSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import JSZip from "jszip";
import { parseDocx } from "./docx.js";

const CORPUS = fileURLToPath(new URL("../../../../../corpus/", import.meta.url));

/* A .docx is a ZIP, and word/document.xml inside it is DEFLATE-compressed --
 * so the literal string `w:tbl` NEVER appears in the raw file bytes. An
 * earlier version of this helper searched the raw bytes and matched nothing
 * across all 52 corpus documents, which looked exactly like "the corpus has no
 * tables". It has plenty; the search was wrong.
 *
 * Detection decompresses with JSZip DELIBERATELY, not with mammoth. mammoth is
 * the thing under test here; if it also chose its own fixture the test would be
 * circular -- "find a file mammoth renders as a table, then assert mammoth
 * renders it as a table" asserts nothing at all. */
async function firstDocxWithTable(): Promise<Buffer> {
  const files = globSync("**/*.docx", { cwd: CORPUS });
  for (const f of files) {
    const bytes = Buffer.from(readFileSync(join(CORPUS, f)));
    const xml = await (await JSZip.loadAsync(bytes)).file("word/document.xml")?.async("string");
    if (xml?.includes("<w:tbl")) return bytes;
  }
  throw new Error("no .docx with a table in corpus/ -- the corpus is not what the spike measured");
}

test("uses convertToHtml so table structure survives", async () => {
  /* THE REQUIREMENT, from the spike: raw text collapses a table into a wall
   * of words. 244/244 tables and 758/758 rows survive convertToHtml. */
  const r = await parseDocx(await firstDocxWithTable());
  expect(r.kind).toBe("text");
  if (r.kind !== "text") return;
  expect(r.text).toMatch(/<table>/);
  expect(r.text).toMatch(/<tr>/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import mammoth from "mammoth";
import type { ParseResult } from "../parse.js";

/* convertToHtml, NOT extractRawText. The spike measured 244/244 tables and
 * 758/758 rows preserved this way; raw text loses every cell boundary, and a
 * cost-proposal table is exactly the thing this slice exists to read. The
 * 64-cell shortfall in the spike was vertical-merge continuation -- correct
 * rowspan, not loss. */
export async function parseDocx(bytes: Buffer): Promise<ParseResult> {
  const { value, messages } = await mammoth.convertToHtml({ buffer: bytes });
  return {
    kind: "text",
    text: value,
    notes: messages.map((m) => `docx: ${m.type}: ${m.message}`),
  };
}
```

- [ ] **Step 4: Run it and watch it pass**

- [ ] **Step 5: Commit**

```bash
git add app/server/src/extract/parsers/docx.ts app/server/src/extract/parsers/docx.test.ts
git commit -m "Parse DOCX with convertToHtml so tables survive"
```

---

### Task 5: XLSX parser — the two traps

**Files:**
- Create: `app/server/src/extract/parsers/xlsx.ts`
- Test: `app/server/src/extract/parsers/xlsx.test.ts`

**Interfaces:**
- Produces: `export async function parseXlsx(bytes: Buffer): Promise<ParseResult>`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import * as XLSX from "xlsx";
import { parseXlsx } from "./xlsx.js";

/* Built here rather than taken from corpus/ so the two traps are unambiguous:
 * a declared range far larger than the populated one, and a formula cell whose
 * cached value is stale. */
function workbook(): Buffer {
  const ws: XLSX.WorkSheet = {
    A1: { t: "s", v: "Item" },
    B1: { t: "s", v: "Cost" },
    A2: { t: "s", v: "Widget" },
    B2: { t: "n", v: 10 },
    B3: { t: "n", v: 999, f: "SUM(B2:B2)" }, // cached 999, would compute 10
    "!ref": "A1:Z5000",                       // fiction
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

test("computes the populated range instead of trusting !ref", async () => {
  /* Declared dimensions are fiction: 89-99% phantom rows in the corpus. */
  const r = await parseXlsx(workbook());
  if (r.kind !== "text") throw new Error("expected text");
  expect(r.text.split("\n").length).toBeLessThan(20);
});

test("records that a total is a CACHED value, not a computed one", async () => {
  /* SheetJS replays Excel's cached result. A workbook saved without
   * recalculation yields a stale total with no signal -- and with no scores in
   * V1, extraction accuracy is the only thing the system can be wrong about. */
  const r = await parseXlsx(workbook());
  if (r.kind !== "text") throw new Error("expected text");
  expect(r.notes.join(" ")).toMatch(/cached/i);
  expect(r.notes.join(" ")).toMatch(/B3/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import * as XLSX from "xlsx";
import type { ParseResult } from "../parse.js";

export async function parseXlsx(bytes: Buffer): Promise<ParseResult> {
  const wb = XLSX.read(bytes, { type: "buffer", cellFormula: true });
  const notes: string[] = [];
  const chunks: string[] = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;

    /* TRAP 1: `!ref` is a DECLARED range and is routinely fiction. Recompute
     * it from the cells that actually exist. */
    const addresses = Object.keys(ws).filter((k) => !k.startsWith("!"));
    if (addresses.length === 0) continue;
    const populated = addresses.reduce(
      (acc, a) => {
        const { r, c } = XLSX.utils.decode_cell(a);
        return {
          s: { r: Math.min(acc.s.r, r), c: Math.min(acc.s.c, c) },
          e: { r: Math.max(acc.e.r, r), c: Math.max(acc.e.c, c) },
        };
      },
      { s: { r: Infinity, c: Infinity }, e: { r: -1, c: -1 } },
    );
    const range = XLSX.utils.encode_range(populated);

    /* TRAP 2: a formula cell carries `f` AND a cached `v`. SheetJS replays the
     * cache; it does not evaluate. Record every one, by address. */
    for (const a of addresses) {
      const cell = ws[a] as XLSX.CellObject & { f?: string };
      if (cell?.f !== undefined) {
        notes.push(`xlsx: ${name}!${a} is a CACHED formula value (=${cell.f}), not computed now`);
      }
    }

    /* Assigning !ref rather than passing { range } is NOT a style choice.
     * sheet_to_csv IGNORES opts.range in xlsx 0.20.3 -- it reads
     * sheet["!ref"] unconditionally, and only sheet_to_json honours the
     * option. Passing it would compute the honest range and then silently
     * discard it: trap 1 defeating itself. Mutation is safe here -- the
     * workbook is parsed fresh from bytes on every call and never reused. */
    ws["!ref"] = range;

    chunks.push(`# ${name}`);
    chunks.push(XLSX.utils.sheet_to_csv(ws, { FS: "\t" }));
  }

  return { kind: "text", text: chunks.join("\n"), notes };
}
```

- [ ] **Step 4: Run it and watch it pass**

- [ ] **Step 5: Commit**

```bash
git add app/server/src/extract/parsers/xlsx.ts app/server/src/extract/parsers/xlsx.test.ts
git commit -m "Parse XLSX against its two traps: phantom ranges and cached totals"
```

---

### Task 6: Bundle expansion, depth 1 — and D8

**Files:**
- Create: `app/server/src/extract/parsers/zip.ts`
- Test: `app/server/src/extract/parsers/zip.test.ts`
- Modify: `docs/admin-deviations.md`

**Interfaces:**
- Produces: `export async function parseZip(bytes: Buffer): Promise<ParseResult>` returning `kind: "members"`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import JSZip from "jszip";
import { parseZip } from "./zip.js";

async function bundle(): Promise<Buffer> {
  const z = new JSZip();
  z.file("RFP.pdf", "%PDF-1.4 fake");
  z.file("Pricing.xlsx", "fake");
  const inner = new JSZip();
  inner.file("deep.pdf", "%PDF-1.4 deeper");
  z.file("Bidders Library.zip", await inner.generateAsync({ type: "nodebuffer" }));
  return z.generateAsync({ type: "nodebuffer" });
}

test("expands a bundle into its members", async () => {
  const r = await parseZip(await bundle());
  expect(r.kind).toBe("members");
  if (r.kind !== "members") return;
  expect(r.members.map((m) => m.filename)).toContain("RFP.pdf");
  expect(r.members.map((m) => m.filename)).toContain("Pricing.xlsx");
});

test("a nested archive is surfaced as a member, not silently dropped", async () => {
  /* D8. The spike skipped `Att L - Bidders Library.zip` inside `docs.zip` and
   * said nothing. Depth 1 is still the limit -- but the member becomes a row
   * that Task 10 marks `failed` with a reason, so the limit is visible. */
  const r = await parseZip(await bundle());
  if (r.kind !== "members") throw new Error("expected members");
  expect(r.members.map((m) => m.filename)).toContain("Bidders Library.zip");
});
```

- [ ] **Step 2: Run it and watch it fail**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import JSZip from "jszip";
import type { ParseResult } from "../parse.js";

/* DEPTH 1 ONLY -- D8. A nested archive is returned as a member so that the
 * caller records it as `failed` with a reason. The spike traversed one level
 * and skipped the rest in silence; the limit is the same, the silence is not. */
export async function parseZip(bytes: Buffer): Promise<ParseResult> {
  const zip = await JSZip.loadAsync(bytes);
  const members: { filename: string; bytes: Buffer }[] = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    members.push({
      filename: path.split("/").pop() ?? path,
      bytes: Buffer.from(await entry.async("nodebuffer")),
    });
  }
  return { kind: "members", members };
}
```

- [ ] **Step 4: Run it and watch it pass**

- [ ] **Step 5: Record D8**

Append to `docs/admin-deviations.md`:

```markdown
## D8 — nested archives are not traversed, and now say so

A `.zip` inside a `.zip` becomes a `document` row marked `failed` with
`source_note = 'nested archive not traversed'`. Depth 1 is the same limit the
2026-08-18 spike had — it skipped `Att L - Bidders Library.zip` inside
`docs.zip` — but the spike skipped it **silently**, which made a missing
document indistinguishable from a document that contained nothing. A recorded
failure is queryable; a silent skip is not. Traversal is deferred rather than
refused: nothing here prevents depth 2 later.
```

- [ ] **Step 6: Commit**

```bash
git add app/server/src/extract/parsers/zip.ts app/server/src/extract/parsers/zip.test.ts docs/admin-deviations.md
git commit -m "Expand bundles one level, and record the nested-archive limit as D8"
```

---

### Task 7: Mechanical field extraction

**Files:**
- Create: `app/server/src/extract/fields.ts`
- Test: `app/server/src/extract/fields.test.ts`

**Interfaces:**
- Produces:
```ts
export interface FieldDraft {
  field_name: "closes_at" | "qa_closes_at" | "prebid_at" | "prebid_required" | "set_aside" | "value_cents";
  value_text: string | null;
  quote: string | null;
  confidence: number;
  note?: string;
}
export function extractFields(text: string): FieldDraft[];
```

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { extractFields } from "./fields.js";

test("finds a close date and quotes the passage it came from", () => {
  const f = extractFields("Sealed proposals are due September 17, 2026 at 3:00 PM.");
  const closes = f.find((x) => x.field_name === "closes_at");
  expect(closes?.value_text).toBe("2026-09-17");
  /* The citation IS the quote -- Matt's ruling. A value without its passage
   * cannot be checked by the person who has to trust it. */
  expect(closes?.quote).toMatch(/September 17, 2026/);
});

test("distinguishes the Q&A deadline from the close date", () => {
  /* migration 002: qa_closes_at is "often earlier and more binding". */
  const f = extractFields(
    "Questions must be submitted by August 5, 2026. Proposals are due September 17, 2026.",
  );
  expect(f.find((x) => x.field_name === "qa_closes_at")?.value_text).toBe("2026-08-05");
  expect(f.find((x) => x.field_name === "closes_at")?.value_text).toBe("2026-09-17");
});

test("absence is recorded as looked-for, not omitted", () => {
  /* value_text NULL means we looked and it is not there. No row would mean we
   * never looked -- a different fact, and migration 002 insists on it. */
  const f = extractFields("This document contains no dates whatsoever.");
  const closes = f.find((x) => x.field_name === "closes_at");
  expect(closes).toBeDefined();
  expect(closes?.value_text).toBeNull();
});
```

- [ ] **Step 2: Run it and watch it fail**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
export interface FieldDraft {
  field_name:
    | "closes_at" | "qa_closes_at" | "prebid_at"
    | "prebid_required" | "set_aside" | "value_cents";
  value_text: string | null;
  quote: string | null;
  confidence: number;
  note?: string;
}

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

const DATE = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),\s*(\d{4})/gi;

/* Cue words decide WHICH date a match is. Nearest preceding cue within 120
 * characters wins; no cue means no field. Deliberately conservative -- a
 * wrong deadline is a missed bid (Plan of Action §6.2). */
const CUES: { field: FieldDraft["field_name"]; re: RegExp }[] = [
  { field: "qa_closes_at", re: /question|inquir|clarification/i },
  { field: "prebid_at", re: /pre-?bid|pre-?proposal|site visit/i },
  { field: "closes_at", re: /due|deadline|closing|submitted by|received by/i },
];

function iso(m: RegExpExecArray): string {
  return `${m[3]}-${MONTHS[m[1]!.toLowerCase()]}-${String(m[2]).padStart(2, "0")}`;
}

export function extractFields(text: string): FieldDraft[] {
  const found = new Map<string, FieldDraft>();

  for (const m of text.matchAll(DATE)) {
    const at = m.index ?? 0;
    const before = text.slice(Math.max(0, at - 120), at);
    for (const { field, re } of CUES) {
      if (!re.test(before)) continue;
      if (found.has(field)) break;
      found.set(field, {
        field_name: field,
        value_text: iso(m as RegExpExecArray),
        quote: text.slice(Math.max(0, at - 80), at + m[0].length + 20).replace(/\s+/g, " ").trim(),
        confidence: 0.6,
      });
      break;
    }
  }

  /* Every field in scope gets a row. A missing one is ABSENT, not omitted. */
  const ALL: FieldDraft["field_name"][] = [
    "closes_at", "qa_closes_at", "prebid_at", "prebid_required", "set_aside", "value_cents",
  ];
  return ALL.map(
    (f) => found.get(f) ?? { field_name: f, value_text: null, quote: null, confidence: 0 },
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

- [ ] **Step 5: Commit**

```bash
git add app/server/src/extract/fields.ts app/server/src/extract/fields.test.ts
git commit -m "Extract dates mechanically, with the passage each one came from"
```

---

### Task 8: Precedence, conflicts, and the accuracy query

**Files:**
- Create: `app/server/src/extract/precedence.ts`
- Test: `app/server/src/extract/precedence.test.ts`

**Interfaces:**
- Produces:
```ts
export interface FieldRow { value_text: string | null; origin: "listing" | "document"; quote: string | null; document_id: number | null; }
export interface Resolved { value: string | null; origin: "listing" | "document" | null; conflicts: FieldRow[]; }
export function resolveField(rows: FieldRow[]): Resolved;
export async function accuracyByField(): Promise<{ field_name: string; agreed: number; disagreed: number }[]>;
```

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { resolveField } from "./precedence.js";

/* The FSSA bundle, 26-87847. Three boilerplate PDFs, two deadlines, and the
 * CORRECT date in the file with the LEAST specific name. Every obvious
 * heuristic picks wrong; the portal listing was right. */
const FSSA = [
  { value_text: "2026-09-17", origin: "listing" as const, quote: null, document_id: null },
  { value_text: "2026-08-26", origin: "document" as const, quote: "due August 26, 2026", document_id: 1 },
  { value_text: "2026-09-17", origin: "document" as const, quote: "due September 17, 2026", document_id: 2 },
  { value_text: "2026-08-26", origin: "document" as const, quote: "due August 26, 2026", document_id: 3 },
];

test("listing metadata outranks document text", () => {
  expect(resolveField(FSSA).value).toBe("2026-09-17");
});

test("the disagreement survives instead of being resolved away", () => {
  /* Fed 26 August, a deadline-passed gate would have silently eliminated the
   * best-fit opportunity in the corpus three weeks early. The conflict is the
   * only thing that makes that inspectable. */
  const r = resolveField(FSSA);
  expect(r.conflicts.map((c) => c.value_text)).toContain("2026-08-26");
  expect(r.conflicts.every((c) => c.origin === "document")).toBe(true);
});

test("documents decide when the listing has nothing to say", () => {
  /* qa_closes_at is document-only; the listing does not carry it. */
  const r = resolveField([
    { value_text: "2026-08-05", origin: "document", quote: "questions by August 5", document_id: 9 },
  ]);
  expect(r.value).toBe("2026-08-05");
  expect(r.origin).toBe("document");
});

test("looked-for-and-absent is not a conflict", () => {
  const r = resolveField([
    { value_text: "2026-09-17", origin: "listing", quote: null, document_id: null },
    { value_text: null, origin: "document", quote: null, document_id: 4 },
  ]);
  expect(r.value).toBe("2026-09-17");
  expect(r.conflicts).toHaveLength(0);
});
```

- [ ] **Step 2: Run it and watch it fail**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { all } from "../db/index.js";

export interface FieldRow {
  value_text: string | null;
  origin: "listing" | "document";
  quote: string | null;
  document_id: number | null;
}
export interface Resolved {
  value: string | null;
  origin: "listing" | "document" | null;
  conflicts: FieldRow[];
}

/* PRECEDENCE AT READ TIME. corpus/FINDINGS.md §1 establishes that the portal's
 * structured field was right where all three documents were unreliable. Doing
 * this here rather than at write time means the rule can change without
 * re-extraction, and nothing is discarded at ingest. */
export function resolveField(rows: FieldRow[]): Resolved {
  const stated = rows.filter((r) => r.value_text !== null);
  if (stated.length === 0) return { value: null, origin: null, conflicts: [] };

  const listing = stated.find((r) => r.origin === "listing");
  const winner = listing ?? stated[0]!;

  /* A conflict is a STATED value that disagrees. Absence never conflicts --
   * "we looked and it is not there" contradicts nothing. */
  const conflicts = stated.filter((r) => r !== winner && r.value_text !== winner.value_text);
  return { value: winner.value_text, origin: winner.origin, conflicts };
}

/* §8.4's measurement, and it is a query rather than a harness: the listing is
 * ground truth for the fields it carries, so agreement counts itself. */
export async function accuracyByField(): Promise<
  { field_name: string; agreed: number; disagreed: number }[]
> {
  return all(
    `SELECT d.field_name,
            count(*) FILTER (WHERE d.value_text IS NOT DISTINCT FROM l.value_text) AS agreed,
            count(*) FILTER (WHERE d.value_text IS DISTINCT FROM l.value_text)     AS disagreed
       FROM extracted_field d
       JOIN extracted_field l
         ON l.solicitation_id = d.solicitation_id
        AND l.field_name      = d.field_name
        AND l.origin          = 'listing'
      WHERE d.origin = 'document' AND d.value_text IS NOT NULL
      GROUP BY d.field_name
      ORDER BY d.field_name`,
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

- [ ] **Step 5: Commit**

```bash
git add app/server/src/extract/precedence.ts app/server/src/extract/precedence.test.ts
git commit -m "Apply precedence at read time, and keep the disagreement"
```

---

### Task 9: Discover — attachments into document rows

**Files:**
- Create: `app/server/src/extract/discover.ts`
- Test: `app/server/src/extract/discover.test.ts`

**Interfaces:**
- Produces: `export async function discoverAttachments(limit: number, fetchImpl?: typeof fetch): Promise<{ solicitations: number; documents: number }>`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test, vi } from "vitest";
import { discoverAttachments } from "./discover.js";
import { useTestSchema, resetSchema } from "../db/testdb.js";
import { all, insert } from "../db/index.js";

useTestSchema("discover");

const SAM_RESPONSE = {
  _embedded: {
    opportunityAttachmentList: [
      {
        attachments: [
          { name: "RFP.pdf", resourceId: "r1", type: "file", fileExists: "1" },
          { name: "Pricing.xlsx", resourceId: "r2", type: "file", fileExists: "1" },
          { name: "Gone.pdf", resourceId: "r3", type: "file", fileExists: "0" },
        ],
      },
    ],
  },
};

test("inserts one pending document per existing attachment", async () => {
  await resetSchema();
  await insert(
    `INSERT INTO solicitation (title, external_id, closes_at)
     VALUES ('live one', 'abc123', $1) RETURNING id`,
    [new Date(Date.now() + 86_400_000).toISOString()],
  );
  const stub = vi.fn(async () => new Response(JSON.stringify(SAM_RESPONSE), { status: 200 }));

  const r = await discoverAttachments(10, stub as unknown as typeof fetch);

  expect(r.documents).toBe(2); // fileExists "0" is not a document
  const docs = await all<{ filename: string; extract_status: string; source_url: string }>(
    `SELECT filename, extract_status, source_url FROM document ORDER BY filename`,
  );
  expect(docs.map((d) => d.filename)).toEqual(["Pricing.xlsx", "RFP.pdf"]);
  expect(docs.every((d) => d.extract_status === "pending")).toBe(true);
  expect(docs.every((d) => d.source_url.length > 0)).toBe(true);
});

test("writes the portal's own values as listing rows", async () => {
  /* WITHOUT THIS, NOTHING EVER WRITES origin='listing'. The accuracy query in
   * Task 8 self-joins on it, so it would return zero rows forever, and the
   * spec's whole ground-truth argument -- "the portal listing doubles as
   * ground truth ... Accuracy is a query" -- would be unbuildable. */
  await resetSchema();
  await insert(
    `INSERT INTO solicitation (title, external_id, closes_at, set_aside, kind)
     VALUES ('live one', 'abc123', $1, 'SBA', 'RFP') RETURNING id`,
    [new Date(Date.now() + 86_400_000).toISOString()],
  );
  const stub = vi.fn(async () => new Response(JSON.stringify(SAM_RESPONSE), { status: 200 }));

  await discoverAttachments(10, stub as unknown as typeof fetch);

  const listing = await all<{ field_name: string; value_text: string | null }>(
    `SELECT field_name, value_text FROM extracted_field
      WHERE origin = 'listing' ORDER BY field_name`,
  );
  const byName = Object.fromEntries(listing.map((r) => [r.field_name, r.value_text]));
  expect(byName["set_aside"]).toBe("SBA");
  expect(byName["closes_at"]).not.toBeNull();
  /* A field the portal does not carry is ABSENT, not omitted -- the same
   * three-state discipline the document side uses. */
  expect(byName).toHaveProperty("qa_closes_at", null);
});

test("does not duplicate listing rows when run twice", async () => {
  /* Discover skips solicitations that already have documents, but a
   * solicitation with NO attachments would be revisited. */
  await resetSchema();
  await insert(
    `INSERT INTO solicitation (title, external_id, closes_at) VALUES ('s', 'abc123', $1) RETURNING id`,
    [new Date(Date.now() + 86_400_000).toISOString()],
  );
  const stub = vi.fn(async () => new Response(JSON.stringify(SAM_RESPONSE), { status: 200 }));
  await discoverAttachments(10, stub as unknown as typeof fetch);
  await discoverAttachments(10, stub as unknown as typeof fetch);
  const rows = await all<{ c: string }>(
    `SELECT count(*) AS c FROM extracted_field WHERE origin = 'listing' AND field_name = 'closes_at'`,
  );
  expect(Number(rows[0]?.c)).toBe(1);
});

test("skips solicitations whose deadline has passed", async () => {
  await resetSchema();
  await insert(
    `INSERT INTO solicitation (title, external_id, closes_at) VALUES ('closed', 'old', '2020-01-01') RETURNING id`,
  );
  const stub = vi.fn(async () => new Response("{}", { status: 200 }));
  const r = await discoverAttachments(10, stub as unknown as typeof fetch);
  expect(r.solicitations).toBe(0);
  expect(stub).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it and watch it fail**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { all, one, insert } from "../db/index.js";

const SAM_RESOURCES = "https://api.sam.gov/prod/opportunity/v1/api/";

/* Nearest LIVE deadline first; closed solicitations are skipped entirely.
 * Production holds ~9,900 solicitations and most are closed, so this makes
 * the first batch the useful batch. */
const CANDIDATES = `
  SELECT s.id, s.external_id, s.closes_at, s.set_aside, s.kind, s.value_cents
    FROM solicitation s
   WHERE s.external_id IS NOT NULL
     AND left(s.closes_at, 10) >= to_char(now(), 'YYYY-MM-DD')
     AND NOT EXISTS (SELECT 1 FROM document d WHERE d.solicitation_id = s.id)
   ORDER BY s.closes_at ASC
   LIMIT $1`;

/* The six fields SP4 extracts. The portal carries four of them; the other two
 * exist only in documents, and get an ABSENT listing row so that "the portal
 * does not carry this" is a recorded fact rather than a gap. */
const LISTING_FIELDS = [
  "closes_at", "set_aside", "kind", "value_cents", "qa_closes_at", "prebid_at",
] as const;

interface Candidate {
  id: number;
  external_id: string;
  closes_at: string | null;
  set_aside: string | null;
  kind: string | null;
  value_cents: string | null;
}

/* THE GROUND TRUTH ROWS. corpus/FINDINGS.md §1 established that the portal's
 * structured field was right where all three documents were unreliable, so the
 * listing is what document extraction is measured AGAINST. Nothing else in this
 * slice writes origin='listing'; without this, Task 8's accuracy query joins
 * against an empty set forever. */
async function writeListingRows(c: Candidate): Promise<void> {
  const already = await one<{ c: string }>(
    `SELECT count(*) AS c FROM extracted_field WHERE solicitation_id = $1 AND origin = 'listing'`,
    [c.id],
  );
  if (Number(already?.c ?? 0) > 0) return;

  const value: Record<string, string | null> = {
    closes_at: c.closes_at,
    set_aside: c.set_aside,
    kind: c.kind,
    value_cents: c.value_cents === null ? null : String(c.value_cents),
    qa_closes_at: null,
    prebid_at: null,
  };
  for (const f of LISTING_FIELDS) {
    await insert(
      `INSERT INTO extracted_field
         (solicitation_id, field_name, value_text, origin, confidence, produced_by)
       VALUES ($1, $2, $3, 'listing', 1.0, 'mechanical') RETURNING id`,
      [c.id, f, value[f] ?? null],
    );
  }
}

export async function discoverAttachments(
  limit: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ solicitations: number; documents: number }> {
  const rows = await all<Candidate>(CANDIDATES, [limit]);
  let documents = 0;

  for (const s of rows) {
    await writeListingRows(s);
    const url = `${SAM_RESOURCES}${encodeURIComponent(s.external_id)}/resources`;
    const res = await fetchImpl(url);
    if (!res.ok) continue;
    const body = (await res.json()) as {
      _embedded?: { opportunityAttachmentList?: { attachments?: Record<string, string>[] }[] };
    };
    const list = body._embedded?.opportunityAttachmentList ?? [];
    for (const group of list) {
      for (const a of group.attachments ?? []) {
        if (a.fileExists !== "1") continue;
        await insert(
          `INSERT INTO document (solicitation_id, filename, source_url, extract_status)
           VALUES ($1, $2, $3, 'pending') RETURNING id`,
          [s.id, a.name, `${SAM_RESOURCES}core/download?token=${a.resourceId}`],
        );
        documents++;
      }
    }
  }
  return { solicitations: rows.length, documents };
}
```

- [ ] **Step 4: Run it and watch it pass**

- [ ] **Step 5: Commit**

```bash
git add app/server/src/extract/discover.ts app/server/src/extract/discover.test.ts
git commit -m "Discover attachments into pending document rows, nearest deadline first"
```

---

### Task 10: The extract orchestrator

**Files:**
- Create: `app/server/src/extract/run-extract.ts`
- Test: `app/server/src/extract/run-extract.test.ts`

**Interfaces:**
- Produces: `export async function runExtract(opts: { limit: number; budgetMs: number; fetchImpl?: typeof fetch }): Promise<{ processed: number; failed: number; remaining: number }>`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test, vi } from "vitest";
import { runExtract } from "./run-extract.js";
import { useTestSchema, resetSchema } from "../db/testdb.js";
import { all, insert } from "../db/index.js";

useTestSchema("run_extract");

async function pending(filename: string): Promise<number> {
  const sol = await insert(
    `INSERT INTO solicitation (title, closes_at) VALUES ('s', $1) RETURNING id`,
    [new Date(Date.now() + 86_400_000).toISOString()],
  );
  return insert(
    `INSERT INTO document (solicitation_id, filename, source_url, extract_status)
     VALUES ($1, $2, 'https://example.test/f', 'pending') RETURNING id`,
    [sol, filename],
  );
}

test("an unsupported type is a recorded failure, never a silent skip", async () => {
  await resetSchema();
  await pending("deck.pptx");
  const stub = vi.fn(async () => new Response(Buffer.from("x"), { status: 200 }));

  const r = await runExtract({ limit: 5, budgetMs: 10_000, fetchImpl: stub as unknown as typeof fetch });

  expect(r.failed).toBe(1);
  const [doc] = await all<{ extract_status: string; source_note: string }>(
    `SELECT extract_status, source_note FROM document`,
  );
  expect(doc?.extract_status).toBe("failed");
  expect(doc?.source_note).toMatch(/pptx/i);
});

test("one bad document does not kill the batch", async () => {
  await resetSchema();
  await pending("bad.pptx");
  await pending("also-bad.txt");
  const stub = vi.fn(async () => new Response(Buffer.from("x"), { status: 200 }));
  const r = await runExtract({ limit: 5, budgetMs: 10_000, fetchImpl: stub as unknown as typeof fetch });
  expect(r.processed).toBe(2);
});

test("stops on the budget and reports what remains", async () => {
  await resetSchema();
  for (let i = 0; i < 3; i++) await pending(`f${i}.pptx`);
  const stub = vi.fn(async () => new Response(Buffer.from("x"), { status: 200 }));

  /* A zero budget means the loop stops before the first document. Nothing is
   * half-written, because each document commits on its own. */
  const r = await runExtract({ limit: 5, budgetMs: 0, fetchImpl: stub as unknown as typeof fetch });

  expect(r.processed).toBe(0);
  expect(r.remaining).toBe(3);
  const still = await all<{ c: string }>(
    `SELECT count(*) AS c FROM document WHERE extract_status = 'pending'`,
  );
  expect(Number(still[0]?.c)).toBe(3);
});
```

- [ ] **Step 2: Run it and watch it fail**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { all, one, run as dbRun, insert } from "../db/index.js";
import { parserFor } from "./parse.js";
import { parsePdf } from "./parsers/pdf.js";
import { parseDocx } from "./parsers/docx.js";
import { parseXlsx } from "./parsers/xlsx.js";
import { parseZip } from "./parsers/zip.js";
import { extractFields } from "./fields.js";

const NEXT = `
  SELECT d.id, d.filename, d.source_url, d.solicitation_id
    FROM document d
    JOIN solicitation s ON s.id = d.solicitation_id
   WHERE d.extract_status = 'pending'
   ORDER BY s.closes_at ASC
   LIMIT $1`;

/* NO TRANSACTION AROUND THE BATCH, deliberately. 2026-08-27: one large
 * transaction killed at the function ceiling rolled back ~9,000 rows and
 * recorded nothing -- recoverable only by sequence forensics. extract_status
 * is already a checkpoint; wrapping the batch is the only way to waste it. */
export async function runExtract(opts: {
  limit: number;
  budgetMs: number;
  fetchImpl?: typeof fetch;
}): Promise<{ processed: number; failed: number; remaining: number }> {
  const doFetch = opts.fetchImpl ?? fetch;
  const started = Date.now();
  const queue = await all<{ id: number; filename: string; source_url: string; solicitation_id: number }>(
    NEXT,
    [opts.limit],
  );

  let processed = 0;
  let failed = 0;

  for (const doc of queue) {
    if (Date.now() - started >= opts.budgetMs) break;

    const fail = async (why: string) => {
      await dbRun(`UPDATE document SET extract_status = 'failed', source_note = $2 WHERE id = $1`, [
        doc.id,
        why,
      ]);
      failed++;
      processed++;
    };

    const kind = parserFor("", doc.filename);
    if (kind === null) {
      await fail(`unsupported type: ${doc.filename.split(".").pop() ?? "unknown"}`);
      continue;
    }

    let bytes: Buffer;
    try {
      const res = await doFetch(doc.source_url);
      if (!res.ok) {
        await fail(`download failed: HTTP ${res.status}`);
        continue;
      }
      bytes = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      await fail(`download failed: ${(err as Error).message}`);
      continue;
    }

    try {
      const parsed =
        kind === "pdf" ? await parsePdf(bytes)
        : kind === "docx" ? await parseDocx(bytes)
        : kind === "xlsx" ? await parseXlsx(bytes)
        : await parseZip(bytes);

      if (parsed.kind === "members") {
        for (const m of parsed.members) {
          /* D8: a nested archive becomes a row that fails with a reason. */
          const nested = m.filename.toLowerCase().endsWith(".zip");
          await insert(
            `INSERT INTO document (solicitation_id, filename, parent_document_id, extract_status, source_note)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [
              doc.solicitation_id,
              m.filename,
              doc.id,
              nested ? "failed" : "pending",
              nested ? "nested archive not traversed" : null,
            ],
          );
        }
        await dbRun(`UPDATE document SET extract_status = 'extracted' WHERE id = $1`, [doc.id]);
        processed++;
        continue;
      }

      if (parsed.kind === "unsupported" || parsed.text.trim() === "") {
        /* FAIL CLOSED: never mark `extracted` without text. */
        await fail("parsed but produced no text");
        continue;
      }

      await dbRun(
        `UPDATE document SET extracted_text = $2, extract_status = 'extracted', produced_by = 'mechanical' WHERE id = $1`,
        [doc.id, parsed.text],
      );

      for (const f of extractFields(parsed.text)) {
        await insert(
          `INSERT INTO extracted_field
             (solicitation_id, field_name, value_text, origin, document_id, quote, confidence, produced_by, note)
           VALUES ($1, $2, $3, 'document', $4, $5, $6, 'mechanical', $7) RETURNING id`,
          [
            doc.solicitation_id,
            f.field_name,
            f.value_text,
            doc.id,
            f.quote,
            f.confidence,
            parsed.notes.join(" | ") || null,
          ],
        );
      }
      processed++;
    } catch (err) {
      await fail(`parse failed: ${(err as Error).message}`);
    }
  }

  const left = await one<{ c: string }>(
    `SELECT count(*) AS c FROM document WHERE extract_status = 'pending'`,
  );
  return { processed, failed, remaining: Number(left?.c ?? 0) };
}
```

- [ ] **Step 4: Run it and watch it pass**

- [ ] **Step 5: Run the gate**

```bash
npm run check
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/server/src/extract/run-extract.ts app/server/src/extract/run-extract.test.ts
git commit -m "Extract in bounded batches, committing per document"
```

---

### Task 11: The two endpoints

**Files:**
- Modify: `app/server/src/routes/admin.ts`
- Test: `app/server/src/routes/admin.test.ts` (append)

**Interfaces:**
- Consumes: `discoverAttachments`, `runExtract`, `RUN_HANDLER_BUDGET_MS`, `CEILING_MS`
- Produces: `POST /api/admin/discover?limit=N`, `POST /api/admin/extract?limit=N`

- [ ] **Step 1: Write the failing test**

Use the file's existing `post(body, headers, path)` helper — it boots `app` on port 0 and `fetch`es it. **There is no supertest in this repo.**

```ts
test("discover requires the admin secret", async () => {
  const res = await post({}, {}, "/api/admin/discover");
  expect(res.status).toBe(401);
});

test("extract requires the admin secret", async () => {
  const res = await post({}, {}, "/api/admin/extract");
  expect(res.status).toBe(401);
});

test("extract reports what it did and what remains", async () => {
  await resetSchema();
  const res = await post({}, undefined, "/api/admin/extract?limit=5");
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("processed");
  expect(body).toHaveProperty("remaining");
});

test("an operator-supplied limit is clamped, not trusted", async () => {
  /* A limit that outruns the ceiling is the 2026-08-27 failure with a
   * different trigger. MAX_BATCH is the clamp. */
  const res = await post({}, undefined, "/api/admin/extract?limit=99999");
  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Run it and watch it fail**

Expected: FAIL — 404, the routes do not exist.

- [ ] **Step 3: Implement**

Add to `app/server/src/routes/admin.ts`, after the `/run` handler:

```ts
const MAX_BATCH = 50;

admin.post(
  "/discover",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 10) || 10, MAX_BATCH);
    const result = await discoverAttachments(limit);
    res.json(result);
  }),
);

admin.post(
  "/extract",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 10) || 10, MAX_BATCH);
    /* Same budget the scrape phase uses, and for the same reason: the work
     * after it -- writing text and fields -- still has to fit under CEILING_MS. */
    const result = await runExtract({ limit, budgetMs: RUN_HANDLER_BUDGET_MS });
    res.json(result);
  }),
);
```

Add the imports at the top of the file:

```ts
import { discoverAttachments } from "../extract/discover.js";
import { runExtract } from "../extract/run-extract.js";
```

- [ ] **Step 4: Run it and watch it pass**

- [ ] **Step 5: Commit**

```bash
git add app/server/src/routes/admin.ts app/server/src/routes/admin.test.ts
git commit -m "Expose discover and extract as gated, clamped endpoints"
```

---

### Task 12: The screen, and the seam test

**Files:**
- Modify: `app/client/src/admin/Admin.tsx`
- Test: `app/client/src/admin/Admin.test.tsx` (append)
- Test: `app/server/src/extract/seam.test.ts` (create)

**Interfaces:**
- Consumes: the two endpoints from Task 11

- [ ] **Step 1: Write the failing seam test**

This is the regression test for the documented near-miss.

```ts
import { expect, test } from "vitest";
import { readFileSync, globSync } from "node:fs";
import { parsePdf } from "./parsers/pdf.js";
import { extractFields } from "./fields.js";
import { resolveField, type FieldRow } from "./precedence.js";

const BUNDLE = new URL("../../../../corpus/indiana/005030000087847/", import.meta.url);

test("the FSSA bundle's three PDFs are all recorded, and the listing still wins", async () => {
  /* corpus/FINDINGS.md §1: three boilerplate PDFs, two deadlines, and the
   * CORRECT date in the file with the LEAST specific name. Fed 26 August, a
   * deadline-passed gate would have eliminated the best-fit opportunity in
   * the corpus three weeks early. */
  const pdfs = globSync("*.pdf", { cwd: BUNDLE });
  expect(pdfs.length).toBeGreaterThanOrEqual(3);

  const rows: FieldRow[] = [
    { value_text: "2026-09-17", origin: "listing", quote: null, document_id: null },
  ];
  for (const [i, name] of pdfs.entries()) {
    const parsed = await parsePdf(Buffer.from(readFileSync(new URL(name, BUNDLE))));
    if (parsed.kind !== "text") continue;
    const closes = extractFields(parsed.text).find((f) => f.field_name === "closes_at");
    rows.push({
      value_text: closes?.value_text ?? null,
      origin: "document",
      quote: closes?.quote ?? null,
      document_id: i + 1,
    });
  }

  const resolved = resolveField(rows);
  expect(resolved.value).toBe("2026-09-17");
  expect(resolved.origin).toBe("listing");
  /* The stale date is KEPT, with its evidence. A rejection you cannot inspect
   * is a bug you will never find. */
  expect(resolved.conflicts.length).toBeGreaterThan(0);
  expect(resolved.conflicts.every((c) => c.quote !== null)).toBe(true);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd app/server && npx vitest run src/extract/seam.test.ts
```
Expected: FAIL — module not found on first run; after Tasks 3/7/8 exist it must fail only if extraction is wrong.

- [ ] **Step 3: Add the controls**

These are screen-level controls, not per-row ones, so they get their own state rather than joining the row `busy`/`errors` maps. Add inside `Admin()`, above the return:

```tsx
const [batchBusy, setBatchBusy] = useState(false);
const [batchError, setBatchError] = useState("");
const [batchResult, setBatchResult] = useState("");

/* Same shape as checkHealth/runSource, including D7's rejection guard: a
 * `fetch` that REJECTS must clear busy and report, or the control freezes
 * with nothing said. */
async function callBatch(path: string) {
  const secret = getAdminSecret();
  if (!secret) return;
  setBatchBusy(true);
  setBatchError("");
  let r: Response;
  try {
    r = await fetch(path, { method: "POST", headers: adminHeaders(secret) });
  } catch (err) {
    setBatchBusy(false);
    setBatchError(`Request failed — ${(err as Error).message}`);
    return;
  }
  if (r.status === 401) clearAdminSecret();
  const data = await r.json().catch(() => ({}));
  setBatchBusy(false);
  if (!r.ok) {
    setBatchError(data.error ?? `Request failed (${r.status})`);
    return;
  }
  setBatchResult(
    `processed ${data.processed ?? data.documents ?? 0}, remaining ${data.remaining ?? 0}`,
  );
  await load();
}
```

Then the controls and their output, beside the existing Check and Run:

```tsx
<button
  type="button"
  className="admin-check-btn"
  disabled={busy}
  aria-label="Discover attachments"
  onClick={() => callBatch("/api/admin/discover?limit=10")}
>
  Discover
</button>
<button
  type="button"
  className="admin-run-btn"
  disabled={busy}
  aria-label="Extract documents"
  onClick={() => callBatch("/api/admin/extract?limit=10")}
>
  Extract
</button>
{batchResult ? <p className="admin-batch">{batchResult}</p> : null}
{batchError ? <p className="admin-error" role="alert">{batchError}</p> : null}
```

- [ ] **Step 4: Write the client test**

```tsx
test("Extract POSTs with the admin secret and reports what remains", async () => {
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return { ok: true, status: 200, json: async () => ({ processed: 3, failed: 0, remaining: 41 }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => (String(url).includes("/api/sources") ? [{ ...baseSource }] : PROFILE),
      };
    }) as unknown as typeof fetch,
  );

  render(<Admin />);
  const btn = await screen.findByRole("button", { name: /extract documents/i });
  btn.click();

  expect(await screen.findByText(/41/)).toBeTruthy();
});
```

- [ ] **Step 5: Run the gate**

```bash
npm run check
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/client/src/admin/Admin.tsx app/client/src/admin/Admin.test.tsx app/server/src/extract/seam.test.ts
git commit -m "Add Discover and Extract controls, and the FSSA seam test"
```

---

## Demo criterion — run it in a browser, not just in tests

⚠️ **Built-and-gate-green is not the same claim as demoed.** SP3.6's server half passed every test while both buttons above it were broken in a real browser. The click-through is part of this criterion, not a follow-up to it.

- [ ] Deploy to production and confirm the bundle hash changed
- [ ] Click **Discover** on `/admin`; confirm `document` rows appear with `source_url`
- [ ] Click **Extract**; confirm rows move to `extracted` / `absent` / `failed` and none stay `pending` among those processed
- [ ] Open one solicitation and confirm a field shows its value, its confidence, **and the quoted passage**
- [ ] Confirm a real listing-vs-document disagreement is visible on the record
- [ ] Run `accuracyByField()` and record the numbers in STATUS — as a measurement, not a pass/fail
