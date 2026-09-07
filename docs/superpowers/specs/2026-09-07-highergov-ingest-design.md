# HigherGov ingest — turning a purchase into opportunities

**Design spec, 2026-09-07.** Brainstormed with Matt the same day. Three rulings
were taken in that conversation and are recorded in §2.

> **⚖️ FIDELITY MANDATE (CLAUDE.md §1) — NOT APPLICABLE, named rather than
> forgotten.** This slice builds no UI: an adapter, a document client, one
> vocabulary addition and a change to one fitness predicate. CLAUDE.md §3
> records that SP6 went wrong because neither its spec nor its plan named the
> mandate once.

---

## 1. What this fixes

**HigherGov has a `source` registry row and nothing else.** Checked, not
assumed: no entry in `ADAPTERS`, no entry in `DOCUMENT_CLIENTS`, not one row in
the store.

It was bought 2026-09-03 and proved at **99% coverage recall** against a 71-item
answer key. D2 then built on-demand documents **against SAM.gov instead**,
deliberately, so the mechanism could be proven for free. The coverage slice
built a harness to *measure* it. **In four days of work it has never put a
single opportunity in front of anyone.**

That is the whole gap between a $500/yr purchase and real Indiana work, and
every other piece is already built.

**The legal precondition is already cleared.** Migration 019's seed records that
storing HigherGov data in our own store is permitted — this slice does not open
that question, it relies on an answer already given.

---

## 2. The three rulings this design is built on

| | Question | Ruled | What was given up |
|---|---|---|---|
| **①** | F6 falls from 57 to ~0 when a source with 34% empty descriptions is ingested. What should the floor do? | **Let it fall — but split "unreadable" from "not yet looked at"** | Leaving F6 untouched (honest but punishing), measuring it per-source (needs D4 reopened), and refusing description-less rows (discards the sub-state notices the source was bought for) |
| **②** | What should the first ingest pull? | **Live, plus a bounded 90-day backfill** | Live-only (cheapest, no usable pipeline on day one) and the full 2013 archive (~9,286 records, **nine times** the ratified ceiling) |
| **③** | What about `sled_forecast` rows, ~8 in every 100? | **Ingest them, keep them out of the biddable queue** | Dropping them (loses the pre-RFP layer §4.6 asks for) and queuing them as ordinary solicitations (recreates the unbiddable-queue defect this project already fixed once) |

### ⚠️ Ruling ① reverses a claim this project has been carrying

The coverage spec (2026-09-06 §5.1) argued that ingesting HigherGov would move
**F6 and F7 in the passing direction**, and that was its stated reason for
keeping HigherGov's rows out of holdings.

**Half of that was wrong.** F7 improves enormously — `document_path` on 100/100
rows against our current 3-of-979. But **F6 gets materially worse**: it is
`percentile_cont(0.1)` of description length across all biddable rows, and R11
measured HigherGov's Indiana feed at **66/100 carrying a description, 63% among
real notices**. Adding ~9,286 rows with a third of them empty puts well over 10%
of the population at length zero, which drags the 10th percentile to **0**. It
reads 57 today.

**F6 punishes breadth.** The floor would not congratulate itself on new data; it
would fail harder, and be right to, because we would be holding more of the real
market including its thin part.

---

## 3. Architecture

### 3.1 One client, not two

`coverage/highergov-client.ts` already knows how to talk to this API: it builds
the URL from the environment, refuses to run unscoped, throws under `VITEST`
rather than billing a test, and drops `document_path` at parse time.

**The ingest reuses it.** Writing a second client would mean two places that
handle a credential, and the 2026-09-03 leak is what one place is worth.

**One change is required.** `FeedNotice` keeps only four fields and discards the
rest, which is right for coverage measurement and useless for ingest. It gains
`raw` — the full record **with `document_path` removed**, so the adapter can map
descriptions, deadlines, agencies and set-asides. The removal stays at parse
time: the field must never exist in an object a caller could persist.

### 3.2 A windowed adapter over `captured_date`

`captured_date` is HigherGov's own watermark (R9) and is already recorded as
such on the registry row. So this is a `WindowedAdapter` — `fetchListing(since,
until, cursor)` — which is what makes backfill and live operation the same code
path, exactly as `scrape/adapter.ts`'s header intends.

Everything downstream is unchanged: `scrape → import → merge`, the same three
commands every other source uses.

---

## 4. 🔴 The constraint that dominates this slice

**The scrape path writes the raw payload as an artifact and hashes it.**
`ingest_run.artifact_sha256` is `NOT NULL UNIQUE` — that hash is how a completed
run is proven to have happened.

**HigherGov puts `document_path` on every row, and `document_path` embeds the
api_key.** So writing that payload naively would persist a live credential into
storage: permanently, hashed, immutable, and in the one place that is hardest to
retract.

This is the 2026-09-03 leak again, in a worse location. That leak happened
because a `scrub()` helper covered every *error* path while field *values*
printed raw — the key was thought of as something in the request, not something
that comes back.

**Binding requirement: the payload is scrubbed BEFORE it becomes an artifact,
at the adapter boundary, using the existing `redact()`.** Not after. Not at the
call site. A test asserts that no artifact this adapter produces can contain the
key, and that test uses a fixture whose every row carries a key-shaped
`document_path`.

> ⚠️ **And the scrub must be idempotent against the hash.** The artifact's
> sha256 is computed from the scrubbed bytes. If scrubbing were applied
> inconsistently — once here, once somewhere downstream — two runs over
> identical data would produce different hashes and the `UNIQUE` constraint's
> meaning would quietly change. Scrub once, at the boundary, and hash what was
> scrubbed.

---

## 5. Forecasts use the vocabulary that already exists

`sled_forecast` is a real `source_type` (R4 found 8 in 100) and is **not in the
vendor's documented enum** — another doc-versus-reality gap, this one in our
favour, since it is the pre-RFP layer design spec §4.6 asks for.

They carry **no deadline and no value estimate** (`val_est` 0 of 8). Queuing them
would put unbiddable rows in front of a triager.

**Mapping: `source_type: 'sled_forecast'` → `kind: 'forecast'`, and `'forecast'`
joins `NOT_BIDDABLE` in `triage/eligibility.ts`.** No new flag, no new column —
`kind` is already the biddability discriminator and `NOT_BIDDABLE` is already
the list of what a person cannot bid on.

> ⚠️ **This is a narrower exclusion than it looks, and deliberately so.**
> `eligibility.ts`'s own header keeps *presolicitation* notices in the queue on
> the grounds that "they are the earliest signal a requirement exists, and lead
> time is worth more to a small firm than to a large one." A forecast is
> excluded not for being early but for being **unbiddable today** — no deadline
> to sort by, no value to weigh. The early-signal principle is untouched.

---

## 6. F6's population changes, and only F6's

Ruling ① in code: **a row whose description is empty AND whose
`attachments_checked_at` is NULL is excluded from F6's population.**

The reasoning is the three-state discipline this project uses everywhere else —
`document.extract_status`, `source.health`, `coverage_item.carried`. "We looked
and there is nothing to read" is a different fact from "we have not looked yet",
and only the first is evidence about our holdings.

`attachments_checked_at` (migration 011, reused by D2) is exactly the stamp that
tells them apart, and it already exists.

**Consequences, stated rather than discovered:**

- F6 measures **what we have actually examined**, so its number stops moving
  merely because we ingested more.
- **It can still fall**, and should — a row we fetched documents for and still
  cannot read is a real failure, and stays in the population.
- **F5, F7 and the rest are untouched.** F7 in particular must keep counting
  every document-deferring row, because the share of rows we can reach is the
  whole point of it.

⚠️ **This changes a predicate Matt ratified in D4.** It changes the *population*,
not the threshold, and it makes F6 harder to satisfy by accident rather than
easier — but it is a change to a ratified predicate and is recorded as one.

---

## 7. Cost, and the dry run that comes first

R5 measured **5 Indiana records for one day**. At that rate:

| | Records |
|---|---:|
| 90-day backfill | **~450** |
| Remainder of month one, live | ~150 |
| **Month one total** | **~600** against a ratified ceiling of 1,000 |

⚠️ **That 5/day is ONE OBSERVATION ON ONE DAY** — `Proto2PRD-Lessons` §2.15
exactly. At 15/day a 90-day backfill is 1,350 records and the ceiling refuses
the run partway through, leaving a half-loaded window.

**So the backfill is preceded by a costed dry run: pull one day, count it,
extrapolate, and only then commit to a window.** It costs about 5 records and
converts a guess into a measurement. If the extrapolation exceeds the remaining
monthly allowance, the run reports the number and **refuses to start** rather
than discovering it halfway.

**The dry run also answers a free question:** whether `captured_date` accepts a
range or only a single date. R5 only ever sent one date. If single-day only, a
90-day backfill is 90 calls — which sits just under `maxCallsPerRun` (100). The
record cost is identical either way; only the run count changes.

---

## 8. Carried from standing rulings, not re-decided here

- **`val_est` is NOT written to `value_cents`.** R6 established these are
  **inferred bands, not published figures** — ten records returned six distinct
  values — and migration 019's note forbids them sitting beside sourced facts.
  They may be held with their own origin; they may not be laundered into a
  sourced column.
- **Documents are fetched on open, never in bulk.** D2's ruling, unchanged.
  Wiring HigherGov is one entry in `DOCUMENT_CLIENTS` plus a `DocumentClient`
  implementation. At ~11 records per open and a 1,000 ceiling shared with this
  ingest, roughly 90 opens a month — worth knowing before anyone browses hard.
- **Titles carry a scraping artifact.** R6: `"…RemovalBid Documents"` — the
  anchor text glued on. ~~`parseIdoaPage` already handles this correctly and the
  mapper repairs it the same way.~~

  > ⚖️ **CORRECTED 2026-09-07, final review. Both halves of the struck sentence
  > were false, and together they meant nothing repaired anything.**
  >
  > `parseIdoaPage` does **not** repair this. `scrape/adapters/idoa.ts:207-211`
  > takes the **first** anchor's text as the event name, so a later
  > `Bid Documents` anchor never enters the title at all — it **avoids** the
  > problem structurally, and there is **no repair function to reuse.** And the
  > HigherGov adapter had **no title handling whatever**: the vendor's string
  > flowed straight through into `sighting.raw` and out to the queue card.
  >
  > **What shipped:** the repair lives in **`merge/title.ts`**, source-scoped
  > to HigherGov, and strips a trailing `Bid Documents` **only where it is
  > glued to a non-space character** — the shape observed in R6 and in the
  > adapter's own fixture. `"Removal Bid Documents"`, spaced, is left alone:
  > that is a phrase a buyer could legitimately have typed, and
  > over-repairing deletes their words invisibly.
  >
  > **Why the merge and not the adapter.** `sighting.raw` is specified as "the
  > payload as received, unmodified" (`002_entity_graph.sql:191`), and the
  > adapter's items go verbatim into the hashed artifact and then into
  > Postgres. `org-chain.ts`'s header records the same choice for the same
  > reason. Deriving at merge time also lets the rule be corrected **without a
  > re-scrape** — which matters more here than anywhere else, because
  > re-scraping this source costs metered records (CLAUDE.md §5.1).
- **Duplicates exist.** R6 found several `source_id` lookups returning two rows,
  via `version_key`. The importer needs a dedup rule; `dedupBySourceId` in
  `coverage/compare.ts` already encodes the earliest-capture-wins choice.

---

## 9. Blocked on, and open

1. ⛔ **`HIGHERGOV_SEARCH_ID` is not in `.env`.** `/opportunity/` has no location
   parameter (R1), so the saved search is the only Indiana filter and the client
   throws without it — by design, since a missing scope means a national pull
   billed in full. **Nothing in this slice can run until Matt supplies it.** The
   value almost certainly exists already from the 2026-09-03 testing.
2. **Does `captured_date` accept a range?** Answered free by the dry run (§7).
3. **The response field for agency.** Needed to attribute sub-state notices to a
   buyer. `agency_key` is an accepted *parameter* (R1); its response shape is
   unverified. Not blocking — the ingest can store the raw agency string the
   feed returns — but it must be observed rather than guessed.

---

## 10. Out of scope, named so it is not assumed

- **The full 2013 archive.** ~9,286 records, nine times the ratified ceiling.
  Ruling ② deferred it as its own act in its own billing period, per CLAUDE.md
  §5.2. It stays on the board; it is not dropped.
- **The sub-state answer key.** Specced 2026-09-07 and ruled unbuilt the same
  day. Unrelated to this slice, and its two parked defects stay parked.
- **Any change to `maxRecordsPerRun` or `MONTHLY_RECORD_CEILING`.**
- **Unattended scheduling.** Still deferred to SP7. This ingest is operator-run,
  like every other.
