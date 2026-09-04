# Indiana EDS contract register — ingest design

**Written 2026-09-03.** The first ingest of awarded contracts, and the first row
this project will ever write to the `contract` table.

**Every parameter fact below was MEASURED against the live API on 2026-09-03**,
not read from documentation. The measurements changed the design twice, and one
of them would have made the ingest silently wrong.

---

## 1. Purpose, and what it is not

**Purpose:** the historical analysis corpus. Matt, 2026-09-03:

> *"THEN, we capture our historical corpus from 2006, those 200,000 postings or
> whatever, and make that our canonical analysis data set."*

**It also fixes the two floor predicates that block everything.** `F1` (one
source has ever ingested) and `F2` (zero ingested sources in the Profile's
primary geography) both clear on a single free ingest. Nothing else available
does that.

### What this is NOT

- **Not solicitations.** These are AWARDED contracts. A contract must never
  enter the triage queue — there is nothing to decide about work already won —
  and §2's write path makes that structural rather than a filter.
- **Not the expiration radar.** `ends_at` is the radar's whole input, but the
  radar is a screen, and ruling 3A forbids new UI slices. Parked in
  `docs/Pinned-Expiration-Radar.md`.
- **Not qualification.** Ruling 1A: the corpus is evidence toward a design that
  does not yet exist. **Nothing scores, nothing filters, no control is wired.**
- **Not documents.** Ruled metadata-only 2026-09-03 — see §5.

---

## 2. The write path: direct to `contract`

**Contracts do NOT go through `sighting` / `merge`.**

That pipeline answers two questions — *did two sources see the same thing*, and
*which observation is newest*. **Neither applies.** One source has contracts, and
each amendment is its own record with its own identity rather than an update to a
previous one. Routing through it would mean making `sighting` polymorphic — it
carries `solicitation_id integer REFERENCES solicitation(id)` — to gain machinery
that would do nothing.

> **And it makes the queue safe structurally rather than by filter.** Nothing in
> the contract path touches `solicitation`, so a contract cannot reach triage by
> ANY code path. That is a stronger guarantee than remembering to exclude them.

**Reused:** `org-chain.ts`, for `agencyName` → `organization`. Genuine shared
machinery — and the module D27 found had no test file, which it now has.

**Deferred to its own slice: vendor resolution.** `vendor_alias` anticipates that
`TIMOTHY WARRICK` and `Timothy Warrick, Inc.` are one vendor; nothing implements
it, and a vendor name is dirtier than an agency name. **v1 lands the raw
`vendorName` on the row.** A corpus with un-normalised vendors is useful; a
corpus that does not exist is not.

---

## 3. 🔴 `page` IS SILENTLY IGNORED — the finding that determines the design

**Measured 2026-09-03.** Pages 1, 2 and 100 at `pageSize: 50` returned
**identical record sets** — 50 of 50 ids overlapping, same first id
(`A6-6-CO-006`) and same last (`A179-4-IGBWLA-001`).

**This is the SIXTH §5.4 instance in this project and the fourth platform.** It
would have made the obvious design — chunk by page number — pull the same 2,000
records twenty-one times and report success.

### The full vary-a-parameter result

| Parameter | Effect on `totalResults` (baseline **204,991**) | Verdict |
|---|---|---|
| `pageSize` | 100→100 rows, 5000→5000, 25000→25000 | ✅ **honoured** |
| `startDate` + `endDate` range | 2020-01-01..2020-12-31 → **1,334**, all years 2020 | ✅ **honoured** |
| `endDate` alone | → **192,750** | ✅ honoured |
| `businessUnit` | `00110` → **49** | ✅ honoured |
| **`page`** | 204,991, identical rows across pages 1 / 2 / 100 | 🔴 **IGNORED** |
| `vendorName` | 204,991 | 🔴 ignored |
| `agencyName` | 204,991 | 🔴 ignored |
| `bogusParam` **(control)** | 204,991 | — proves "unchanged = ignored" |

**The control row is what makes the rest trustworthy.** A made-up parameter
returns the baseline, and so do `vendorName` and `agencyName` — so those two are
being dropped, not merely misspelled by us.

> **The registry row must be corrected.** `003`'s `verified_facets` for this
> source lists `works: ["businessUnit","endDate","pageSize","sort=-modifiedDate"]`
> and `silently_ignored: ["sort=-publishDate"]`. **`page` belongs in the ignored
> list**, and it is the more dangerous omission of the two.

---

## 4. ~~The fetcher: window-split with a completeness assertion~~ → single-fetch with a completeness assertion

> **⚠️ AMENDED 2026-09-03, after execution. This section describes the design
> BEFORE implementation and is WRONG about the fetch strategy — left struck
> through rather than deleted, per this project's convention that a reader
> meets the correction rather than a silently-changed spec.**
>
> Task 1 measured that `startDate`/`endDate` filters **fully-contained-within**,
> not overlaps-with: a contract's own start AND end must both fall inside the
> query window. Most contracts here cross a calendar-year boundary (76% of a
> 2,000-row sample), so single-year windows are invisible to exactly the
> contracts that span them. Measured recovery: **24,933 of 204,991 — an 88%
> shortfall.** Full measurement: `docs/2026-09-03-eds-window-semantics.md`.
>
> **No date window can tile this register — the GAP branch this section itself
> named as the outcome that would force a redesign (see the original text
> below) fired.** Ruling 3
> (`.superpowers/sdd/2026-09-03-indiana-contract-register/progress.md`)
> abandoned window-splitting entirely. What shipped instead: **one request to
> learn `pagination.totalResults`, then one request for that many rows plus a
> fixed margin**, asserting `results.length === totalResults`. Measured:
> 204,991 of 204,991 rows in 47s at 78 MB, in a single fetch. The completeness
> assertion survives unchanged — it is simpler and strictly stronger now,
> since there is nothing left to tile incorrectly. See
> `app/server/src/contracts/eds-client.ts`, `completeness.ts`, and the real run:
> `docs/2026-09-03-eds-ingest-run.md`.

~~Because `page` lies, the only safe pattern is **request a window whole and assert
you got all of it**:~~

```
~~fetch(window):
    ask { startDate, endDate, pageSize: 25000 }
    if totalResults > results.length  →  split the window in half, recurse
    else                              →  window complete, write it~~
```

~~Start at one window per year, **2004–2027**. Dense years split automatically into
halves, then quarters; sparse years never split. Measured density is uneven —
pages sampled across the register returned start years 2004–2010, while 2020
holds only 1,334 — so automatic splitting is doing real work, not ceremony.~~

**Truncation cannot be silent.** The response states the total; we compare it to
what arrived. *(This sentence still holds — only the mechanism above it does not.)*

### ~~Overlap is harmless; gaps are caught~~

- ~~**Overlap** — a contract appearing in two windows re-inserts against the unique
  key in §6 and is a no-op.~~
- ~~**Gaps** — caught by arithmetic: **distinct rows loaded must equal 204,991.**~~
  **Superseded:** there are no windows to overlap or gap between any more. The
  arithmetic check survives as `assertComplete()` over the single fetch — see
  the amendment callout above.

That is the acceptance test, and it is the exact failure this source has already
produced once: *"Pagination sorted on publishDate silently dropped ~33% of a
window."*

### ⚠️ The first thing implementation must resolve

**RESOLVED, see the amendment callout above.** `startDate`/`endDate` bound on a
fully-contained-within interval, not a single date and not an overlap — full
measurement in `docs/2026-09-03-eds-window-semantics.md`. The resolution is
what made windowing unusable at all, not what fixed it.

**`startDate` and `endDate` were proven to MOVE the count. What they MEAN was not
established.** A contract running 2019→2021 might land in either window, both, or
neither. `endDate: 2027-01-01` alone returned 192,750 rather than 204,991, so
~12,000 contracts end later or carry no end date at all.

**Two or three probes settle it, and they run BEFORE any bulk pull.** If the
filters turn out to bound on one date only, windows key on that date; if they
bound on an interval overlap, the window arithmetic changes. **Do not write the
loop until this is measured.**

---

## 5. Metadata only, and `value_cents` stays NULL

**Ruled by Matt 2026-09-03.** Documents are a later slice.

### Why `value_cents` is not populated

`amount` is EDS form field 6, a per-amendment delta; the running total is field 7
and exists only inside the PDF. So no single row carries a contract's value.

**Summing deltas per contract id is well-supported but NOT verified.** The
strongest evidence is a contract whose amendment adds **$0** while extending the
end date from 2007-04-30 to 2007-09-29 — a *restatement* of zero would be
nonsense; a *delta* of zero is exactly right for a no-cost time extension.

**Against it:** the registry claims `amount` "goes negative", and **zero of
10,000 sampled rows were negative.** Either the note is wrong or negatives are
rare and elsewhere. Unresolved.

> **So: store what the source said, and leave the derived total out of
> `value_cents`.** Writing a computed sum into the column that will later hold
> PUBLISHED figures from HigherGov's `/sl-contract/` is precisely the provenance
> error `extracted_field.origin` and `precedence.ts` exist to prevent. If the sum
> later reconciles against a handful of PDFs, promoting it is a one-line change.
> Going the other way is not.

`amount` lands in its own column, per row, as stated.

---

## 6. Data model

`contract` exists and has never held a row. It is missing three things this
ingest needs.

### The natural key is `(source_id, external_id, amendment)`

**The contract id is not unique.** `A337-6-CWI-104` appears twice — amendment 0
(`New`, $40,000) and amendment 1 (`Amendment`, $70,000). Keying on `external_id`
alone would collapse a contract's history into one row, which is the same class
of error as the `external_id` fusion fixed in migration 022 the same day.

### Migration

| Column | Why |
|---|---|
| `source_id integer REFERENCES source(id)` | **`contract` has no source column at all** — a row today cannot say where it came from |
| `amendment integer` | half the natural key |
| `action_type text` | `New` · `Amendment` · `Renewal` · `Unknown` (**1,583 of 2,000 sampled are `Unknown`** — a real data-quality fact, not a parse failure) |
| `amount_cents bigint` | the per-row delta AS STATED. **Not `value_cents`** |
| unique index on `(source_id, external_id, amendment)` | what makes a re-run idempotent instead of duplicating |

### Field mapping

| API | → column |
|---|---|
| `id` | `external_id` |
| `amendment` | `amendment` |
| `actionType` | `action_type` |
| `vendorName` | `source_note` in v1; `vendor_id` when vendor resolution lands |
| `agencyName` | `org_id` via `org-chain.ts` |
| `startDate` | `starts_at` |
| `endDate` | `ends_at` |
| `amount` | `amount_cents` |
| `pdfUrl` | **not stored in v1** — documents are a later slice |
| — | `value_cents` stays **NULL**. See §5 |

---

## 7. Running it

**Concurrency 1. A fixed delay between requests. A plain identifying
`User-Agent`. Stop on the first non-2xx** rather than retrying into a rate
limiter — a state transparency API is an intended-use resource, and the polite
failure is to stop.

~~At roughly 25 windows the request count is trivial;~~ **⚠️ AMENDED — see §4's
callout: there are no windows.** Ruling 3 replaced the window loop with two
requests total, which is gentler on the API than the ~25-window plan this
sentence described, not less so; **the delay exists for manners, not
throughput** still holds.

~~**One `ingest_run` per window**, so a failure costs one window and progress is
durable.~~ **Superseded:** one `ingest_run` row for the whole fetch — there is
exactly one fetch, not one per window. A failed fetch retries from scratch
(~47s), trading per-window resumability for the simplicity of nothing left to
tile incorrectly. See `app/server/src/contracts/ingest.ts` and the real run:
`docs/2026-09-03-eds-ingest-run.md`.

**Runs LOCALLY**, per Matt's standing ruling of 2026-09-03 — *"we should always
do scraping locally unless otherwise specified"* — which supersedes the
2026-08-15 ruling that long ingestion runs on Vercel. No function ceiling, so a
multi-minute run is unremarkable rather than impossible. Local `DATABASE_URL` points at the `test` branch; reaching production
is a separate deliberate act.

---

## 8. Testing

> **⚠️ AMENDED — see §4.** "Split" and "window" below describe the pre-Ruling-3
> design. What shipped: a short fetch (`results.length < totalResults`) throws
> via `assertComplete()` rather than being silently accepted — no split,
> because there is nothing left to split into. The lesson the test carries is
> unchanged; the mechanism it drives is not.

~~**The test that carries the lesson:** a fake fetch returning
`totalResults: 5000` with 2,000 rows **must trigger a split, not a silent
accept.** Mutation-provable — remove the comparison and it fails.~~ **What
shipped:** a fake fetch returning `totalResults` greater than `results.length`
must throw, not return the short array. Mutation-provable — remove the
comparison in `assertComplete()` and it fails. See `completeness.test.ts` and
`eds-client.test.ts`.

Plus:

- A **committed fixture** from one real window, following the
  `idoa-listing.html` pattern, so parser tests never touch the network.
- ~~**Idempotency:** run the same window twice, row count unchanged.~~
  **Idempotency:** run the same fetch twice, row count unchanged (see
  `import.test.ts`).
- **The natural key:** two rows sharing an `external_id` with different
  `amendment` values must produce **two** contracts, not one.
- **The queue guard:** after a full ingest, the triage queue's row count is
  unchanged. Contracts must not appear, and asserting it is cheaper than trusting
  the table separation.

---

## 9. Success criteria

> **⚠️ AMENDED 2026-09-03, after the real run.** Criteria 1 and 4 below still
> read as originally written — struck through, not deleted — because they
> predate Ruling 3's abandonment of windowing. Results:
> `docs/2026-09-03-eds-ingest-run.md`.

1. ~~**`distinct contracts loaded == 204,991`**, or the shortfall is
   explained.~~ **Result: 204,920 of 204,991 loaded (99.965%). The 71-row
   shortfall IS explained**, not merely allowed for: `(external_id, amendment)`
   turns out not to be unique in the source itself — 71 pairs collide with a
   different row (different amount, dates, vendor, or agency; zero
   byte-identical), and the natural key silently keeps whichever arrived
   first. Accepted as immaterial (0.035%); the cheap fix (extend the key with
   `pdf_url`, which differs on all 71) is named but deferred to its own slice.
   Full analysis: `docs/2026-09-03-eds-ingest-run.md`.
2. **`npm run fitness` shows F1 and F2 PASS** — the point of doing this now.
   **Result: PASS.** F1 3 sources (threshold 2), F2 2 in Indiana (threshold 1).
   Both were FAIL before this ingest.
3. **The triage queue is unchanged**, measured before and after. **Result:
   confirmed** — solicitation/sighting/pursuit counts identical before and
   after (1,970 / 1,996 / 9).
4. ~~**A second run of the same windows writes zero new rows.**~~ There are no
   windows — see §4. **What was actually verified:** a second run of the same
   fetch writes zero new rows; the 71 collisions above are that mechanism
   working as designed, not a defect in it.
5. **`003`'s `verified_facets` records `page` as silently ignored**, so the next
   person meets the finding rather than rediscovering it. **Result: done, via
   migration 024** (and corrected by 025 — see the final-review note in
   `.superpowers/sdd/2026-09-03-indiana-contract-register/progress.md`).

---

## 10. Open questions, carried

1. **What do `startDate` / `endDate` actually filter on?** §4 — blocking, and
   cheap to resolve.
2. **Does summing `amount` reconstruct the true total?** §5 — resolvable only
   against a handful of PDFs, and therefore against the deferred document slice.
3. **Does `amount` ever go negative?** Zero of 10,000 sampled. The registry says
   it does. One of the two is wrong.
4. **Vendor resolution** — deferred, own slice.
5. **What is `actionType: "Unknown"`?** 79% of the sample. Probably an older
   record shape. Worth one look before anyone treats `action_type` as reliable.
