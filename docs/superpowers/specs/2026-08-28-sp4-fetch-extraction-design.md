# Fetch and extraction — design (SP4)

**Written 2026-08-28. Brainstormed with Matt the same day; every ruling below was made by him in that session and is recorded with its reasoning.**

This designs the slice §6 places after source health and before SP6: **2H, 2I, 5D** — *documents pulled and parsed; every field carries confidence + a source pointer; accuracy measured*. It is the slice §6.1 describes as proving **the contents get read correctly**, and it owns the seam §6.2 names as one of the two places Tenderfoot fails silently: **dates and eligibility extraction, where a wrong deadline is a missed bid.**

**Status: designed, not built.** No implementation plan yet — that is the next step.

---

## 0. What this settles, in one paragraph

Documents are **fetched, parsed, and discarded**. Their text and the fields extracted from it are kept; the bytes are not, because Matt ruled that a citation quotes the extracted passage rather than opening the original. That single ruling closes the blob-provider question SP3.6 deliberately left parked and removes storage from this slice entirely. Extraction runs **mechanically** — no model — in two operator-invoked phases bounded by time, processing live solicitations in **nearest-deadline-first** order. Where the portal listing and the documents disagree, **both are recorded**, the listing wins at read time, and the disagreement stays visible. The portal listing doubles as **ground truth** for the fields it carries, which is what makes §8.4's accuracy measurement computable without a hand-labelled set that does not exist.

---

## 1. The five rulings this rests on

| # | Ruling | Consequence |
|---|---|---|
| 1 | **A citation quotes the extracted text.** Not the original file, not a portal deep-link. | No document retention. **No blob provider. No storage decision at all.** |
| 2 | **Conflicts are recorded and shown.** | Losing values are kept with their evidence, not discarded. |
| 3 | **Portal metadata is ground truth** for the fields it carries. | Accuracy is computable today, on every ingested solicitation, for free. |
| 4 | **SheetJS is pinned from `cdn.sheetjs.com`.** | Not the npm package with unfixable advisories; not a Python sidecar. |
| 5 | **Bounded operator-invoked batches**, nearest deadline first. | No scheduled runs; §9.6's "the operator sets the scope" holds. |

Rulings 1–3 were made in the 2026-08-28 brainstorm. Ruling 4 was the open SP4 question the extraction spike left with Matt. Ruling 5 chose between three pipeline shapes; the rejected two are recorded in §9.

---

## 2. What extraction means here, and what it deliberately does not

**Mechanical only.** Regex, structure, and position — no model. The spike's recommendation stands: *"smart mode stays available and unbuilt … the corpus gave it nothing to fix, which is the honest reason not to build it yet."* `document.produced_by` and `extracted_field.produced_by` record `'mechanical'` on every row written by this slice, so that the day a smart mode exists the two are comparable on the same set rather than retrofitted into a schema that never distinguished them.

**Not a judgment.** Nothing here scores, gates, or filters. V1 returns everything (spec §1.1). Extraction populates fields; it does not decide what they mean.

**Not complete coverage.** A field this slice cannot find is recorded as *looked for and absent*, which is a different fact from *never looked for*. Migration 002 already insists on that distinction for `extract_status`; §3 extends it to field values.

---

## 3. Data model — migration 008

### 3.1 `document` gains two columns

```sql
ALTER TABLE document ADD COLUMN source_url         text;
ALTER TABLE document ADD COLUMN parent_document_id integer REFERENCES document(id);
```

**`source_url`, because there is nowhere to put the fetch target.** `document` was written in migration 002 with `path` — a *filesystem* path, under a comment reading *"Bytes live on the FILESYSTEM, path here"*. That predates the move to Vercel, where there is no persistent filesystem, and it predates ruling 1, which means there are no bytes to keep. `path` is left in place rather than dropped: it costs nothing, and dropping a column is a claim about rows that may yet mean something by it.

**`parent_document_id`, because bundles are real.** The spike opened nine `.zip` bundles and reached 86 members. A zip expands into child rows and is itself marked `extracted` with no text of its own.

### 3.2 `extracted_field` — new

Nothing in the schema holds a cited field. `assessment.evidence` is the right shape (*"quoted text + document pointer per score"*) but belongs to scoring, which is parked.

```sql
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
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX extracted_field_solicitation ON extracted_field(solicitation_id, field_name);
```

**Fields in scope:** `closes_at`, `qa_closes_at`, `prebid_at`, `prebid_required`, `set_aside`, `value_cents`. `qa_closes_at` is called out in migration 002 as *"often earlier and more binding"* than the close date, and it is a document-only field — the listing does not carry it.

**`value_text` NULL means looked-for-and-absent. No row means not looked for.** The same three-state discipline `extract_status` already enforces.

**`note` carries what a value cannot.** Specifically the spike's third requirement: that a spreadsheet total is a **cached** value replayed by SheetJS rather than one computed now. A stale cache is indistinguishable from a fresh one, and §8.4 makes that the only thing V1 can be wrong about.

### 3.3 Conflicts are rows, not a flag

**This is the design decision to look hardest at.** The FSSA bundle (§5) produces four `closes_at` rows: one `listing` (17 Sep) and three `document` (26 Aug, 17 Sep, 26 Aug), each with its quote and its `document_id`.

Three properties follow, none of which needed to be designed for:

1. **Precedence applies at read time, not write time.** Nothing is discarded at ingest, so the rule can change without re-extraction.
2. **We never decide in advance which disagreements are worth keeping.** They all are, because they are all evidence.
3. **Accuracy is a query.** Comparing `document` rows against the `listing` row for the same `field_name` *is* the §8.4 measurement — no separate harness, no labelled set.

---

## 4. The two phases

Both are operator-invoked, both bounded, both resumable. They mirror Check and Run on `/admin`, which is the control surface §9.6 assigns this work to.

### 4.1 Discover — `POST /api/admin/discover?limit=N`

For each in-scope solicitation with no `document` rows: call SAM.gov's `opportunityAttachmentList`, insert one `pending` row per attachment carrying `filename`, `media_type`, `bytes`, `source_url`.

**The adapter does not capture attachment links today** — verified 2026-08-28. The corpus's `resources.json` files came from this endpoint, fetched by hand during corpus gathering. This is genuinely new fetching, which is why the slice is *Fetch **and** extraction*.

Cheap per solicitation: one API call, no downloads.

### 4.2 Extract — `POST /api/admin/extract?limit=N`

For each `pending` document in priority order: download to a temp file, parse by media type, write `extracted_text` and `extracted_field` rows, mark `extracted` / `absent` / `failed`.

**The temp file dies with the request**, in a `finally`, exactly as SP3.6's scrape artifact does — and for the same reason, now permanent rather than provisional: there is nothing to keep.

### 4.3 Priority order — both phases

```sql
WHERE closes_at >= now() ORDER BY closes_at ASC
```

**Nearest live deadline first; closed solicitations skipped entirely.** Production holds 9,883 solicitations, most of them closed. This makes the first batch the useful batch and lets the operator stop the moment it stops paying. It costs one `ORDER BY`.

### 4.4 Bounding is time-boxed, not row-counted

`importFitsInBudget` (added 2026-08-28) estimates from row count because import cost tracks rows. **Download cost does not** — bundles reach 21 MB. Extract therefore loops until elapsed reaches its budget, stops cleanly, and reports `remaining`: the same shape as `scrape/run.ts`'s `if (now() - started >= req.budgetMs) break`.

The ceiling is `CEILING_MS`, derived from `vercel.json` and asserted against it by test. **Do not write a second copy of that number here** — that mistake cost a day on 2026-08-27.

---

## 5. Parsers, and the three requirements that are not optional

| Type | Library | Requirement |
|---|---|---|
| `.pdf` | `unpdf` | Cleared 37/37. The format has no table structure to preserve; geometry is present, reconstruction is not provided. |
| `.docx` | `mammoth` | **Use `convertToHtml`, not raw text**, where structure matters. 244/244 tables and 758/758 rows survive; the 64-cell gap is vertical-merge continuation, i.e. correct `rowspan`. |
| `.xlsx` | **SheetJS, pinned from `cdn.sheetjs.com`** | **Compute the populated range; do not trust `!ref`** (89–99% phantom rows). **Record that a total is a cached value**, not a computed one. |
| `.zip` | — | Expand into child rows; parent marked `extracted` with no text. |
| anything else | — | `failed`, with the type in `source_note`. Nothing is silently skipped. |

⚠️ **Node clearing *this* corpus rules Node in for *these* files.** The spike's own caveat holds: re-run the harness against the first bundle that looks unlike the corpus rather than treating the question as closed.

---

## 6. Precedence, and the failure it exists to prevent

**Listing metadata outranks document text for dates.** `corpus/FINDINGS.md` §1 establishes this and notes the rule is not yet in the spec. It is now.

The FSSA *External Quality Reviews* RFP (26-87847, event `005030000087847`) — the closest thing to a bullseye in the corpus — ships three boilerplate PDFs carrying two different submission deadlines. The **correct** date (17 Sep, matching the portal) lives in the file with the **least specific name**; the file named with the actual solicitation number carries the **stale** one. Every obvious heuristic picks wrong.

**Why it matters beyond tidiness:** §6.1 Stage 0 includes a deterministic hard gate for *deadline passed*. Fed 26 August, that gate would have silently eliminated the best-fit opportunity in the corpus on 27 August — three weeks before it actually closed. That is the silent-recall failure the system exists to prevent, and it is documented, not hypothetical.

**Nothing in V1 gates on the date**, so this slice cannot cause that failure today. It is designed so that the slice which *does* gate inherits the evidence rather than the guess.

---

## 7. Error handling

**Commit per document. Never wrap a batch in one transaction.** This is the load-bearing decision, and it is the direct lesson of 2026-08-27: one large transaction, killed at the function ceiling, rolled back ~9,000 rows and recorded nothing — recoverable only by sequence forensics. `extract_status` is already a checkpoint; the only way to waste it is to make the batch atomic. A batch killed mid-flight keeps everything it finished and leaves the rest `pending`.

**One bad document must not kill a batch.** Download failure, parse failure, unsupported type — mark that row `failed`, record why in `source_note`, continue. `failed` is queryable, so *"what didn't we read?"* has an answer.

**Never mark `extracted` without text.** Fail closed, the posture `requireAdminSecret` takes: an empty extraction claiming success is worse than a recorded failure.

**A 429 stops the batch cleanly** and reports `remaining` rather than retrying harder. This project has already burst-probed a host into a defensive posture once — Vercel Attack Challenge Mode, 2026-08-19, recorded in STATUS.md §5.

---

## 8. Testing

**The fixtures already exist.** 110 real documents sit in `corpus/`, so parsing is tested against real files rather than synthetic ones. **No network in tests**; SAM.gov calls are stubbed.

| What | How |
|---|---|
| Parser dispatch | Media type → library, including the unsupported-type path |
| `.xlsx` populated range | A workbook whose `!ref` overstates; assert the computed range, not `!ref` |
| Cached-formula detection | A workbook with a formula cell; assert `note` records the value as cached |
| `.docx` structure | `convertToHtml` on a corpus file with tables; assert rows and cells survive |
| Precedence | Listing and document disagree; assert the listing value is the one read back |
| Conflict visibility | Assert the losing rows still exist, with quotes and `document_id` |
| **The seam** | **`corpus/indiana/005030000087847`**: assert all three document values are recorded with quotes, the listing wins, and the disagreement is visible |
| Resumability | Kill a batch mid-way; assert finished documents stay `extracted` and the rest stay `pending` |

**The seam test is the documented near-miss turned into a regression test.** §6.2 names dates-and-eligibility as one of the two places this system fails silently; this is that test.

**Accuracy is measured, not asserted.** The comparison query reports a number per field. The build does **not** fail on it: no threshold has been ruled, and inventing one would be a design decision made by omission.

---

## 9. What this deliberately does not do

**No document storage, and no blob provider.** Ruling 1 removes it. SP3.6 kept its scrape artifact alive only inside its request specifically to leave this parked; the park is now closed by decision rather than deferred again.

**No smart mode.** Available and unbuilt, per the spike. The schema records which mode produced every value so the comparison is possible later.

**No scheduled extraction.** Operator-invoked, per §9.6. Scheduling belongs to SP7, on GO.

**Two pipeline shapes were considered and rejected:**

- **Extend `/run`** — scrape → import → merge → fetch → extract in one request. Rejected: 9,096 rows alone consumed 77.6s of a 300s ceiling on 2026-08-28. Adding thousands of downloads guarantees the mid-transaction death that day was spent diagnosing.
- **Lazy extraction at triage time** — extract only what SP6 opens. Rejected: it puts a multi-second download-and-parse in front of a UI interaction, and SP6 is the GO/NO-GO gate. Measuring discovery through a laggy screen muddies the result the gate exists to produce. Its good idea — do the useful work first — was kept as §4.3's priority ordering.

**No accuracy threshold.** §8 measures; it does not judge. Setting the bar is Matt's, and it should be set against a real number rather than in advance of one.

---

## 10. Demo criterion

**Fetch attachments for the ten soonest-closing live solicitations, extract them, and show one solicitation's fields with their citations on screen — including a real conflict.**

It passes when:

1. `document` rows exist with `source_url`, and their `extract_status` is `extracted`, `absent` or `failed` — never `pending` for what was processed.
2. A field displays its value, its confidence, and **the quoted passage it came from**.
3. A disagreement between listing and documents is **visible on the record**, not resolved away.
4. The accuracy query returns a number per field, comparing `document` values against `listing` values.

⚠️ **Built-and-gate-green is not the same claim as demoed.** SP3.6 learned this the hard way: its server half passed every test while both buttons above it were broken in a browser. **The click-through is part of this criterion, not a follow-up to it.**
