# Ingestion scaffolding — design

**Written 2026-08-15. Brainstormed with Matt the same day; every decision below was ruled by him in that session and is recorded with its reasoning.**

This is the design that unblocks **B3 for SP3**. It implements the §9.6 ruling (*ingestion runs on Vercel, invoked by hand, operator sets the scope*) and closes the brainstorm pinned in `docs/Pinned-Ingestion-Scaffolding.md` on 2026-08-12.

**Status: designed, not built.** No implementation plan yet — that is the next step.

---

## 0. What this settles, in one paragraph

Scraping is split from the application. A scrape produces a **SQLite file** — a transport artifact, not a database the app runs on — which an importer loads into Postgres. The scraper is a **library** with two thin entry points: a CLI for now and an HTTP handler for SP7. Runs are **checkpointed**, so a scope larger than one invocation resumes rather than dies. The mark that says how far we have got advances **on ingest, not on fetch**, so a lost artifact costs a re-fetch and never opens a silent gap.

---

## 1. Why a transport artifact at all

Matt's framing: *"this splits up our scraping goals from our business-goal application level goals."*

Ingestion has a different shape from the application — slow, bursty, failure-prone, and something you want to re-run without touching anything a user sees. Coupling them means a scraper fix requires an application deploy.

> **The idea was first proposed as SQLite becoming the app's database again — a file dropped in a folder that the app picks up.** That form was rejected, and the reason is already recorded in the file that would have had to change, `app/server/src/db/index.ts:3`: *"Vercel has no writable persistent filesystem, so a SQLite file does not survive a request there. The hosting choice decided the database."* It would also have unwound SP1.5 (23 commits, `better-sqlite3` removed, `pg` hard-wired) and quietly reversed §9.6.
>
> **What survived is the instinct, not the mechanism.** SQLite is an excellent *artifact* — single file, typed, queryable, inspectable with any tool, far better than JSON at 8,000 records. It is a poor *system of record* on this platform. Moving it from one role to the other keeps every property Matt asked for and costs nothing.

**Postgres/Neon remains the app's only system of record.** This design does not change that.

---

## 2. The spine

```
scrape/core/            the library — no I/O assumptions, no database access
   ├── cli.ts           npm run scrape            (transport phase)
   └── handler.ts       POST /api/admin/scrape    (streams the .db back)
                              │
                              ▼
              run-idoa-2026-08-15T2140.db      ← the transport artifact
                              │
                              ▼
                    import   (CLI now, admin upload later)
                              │
                              ▼
                    Postgres / Neon   ← the app's only system of record
```

**Both entry points are built in this slice.** Ruled by Matt: SP7 should inherit a finished surface rather than a library it still has to wrap.

> **The cost of that was named and accepted.** Building the HTTP path now means designing the over-ask behaviour now (§5), because the 300 s ceiling only exists there. It would also normally pull the blob-provider decision forward from SP4 — **that one is designed away rather than paid**: the handler streams the `.db` as its response body, so there is no storage provider, no `/tmp` lifetime question, and nothing borrowed from SP4.

---

## 3. The transport artifact

A single SQLite file per run, carrying **two layers**.

```sql
run                    -- exactly one row; the file describes itself
  source_id, since, until, depth, scraper_ver
  started_at, finished_at, outcome, next_since

capture                -- raw, replayable
  id, hop (listing|detail|document)
  url, http_status, fetched_at, sha256, payload

sighting               -- derived; the per-source observation
  external_id, seen_at, raw
  capture_id, extractor_ver, mode

document_ref           -- references only, never embedded (§3.3)
  capture_id, url, filename, content_type
  stated_bytes, fetched_at, http_status
  sha256    NULL       -- only populated at document depth
  blob_ref  NULL       -- reserved; SP4 fills this in
```

The file is **self-describing**: `run` states what was asked for and how far it actually got, so an artifact found on disk in six months explains itself without surrounding context.

### 3.1 Why both layers

Raw captures alone would have been the tidier choice, and it was offered. Matt chose both, for a reason that holds: **the immediate goal is real data to build the application against**, and a file you can open and read finished rows out of serves that directly, while replay stays available.

The accepted cost is roughly double the file size and two layers that can disagree.

### 3.2 The derived layer is `sighting`, not `solicitation`

**This corrects the first draft of this design, which had the artifact carrying solicitations.** `002_entity_graph.sql:179` already defines the right shape, and its own comment is the argument:

> *"Source X showed us this listing on date Y." Raw, unmerged, immutable. A solicitation is the canonical record produced by MERGING sightings. Deliberately no unique constraint on solicitation_id: many sightings, one canonical row. This separation buys dedup, change detection, and honest per-source yield.*

A scrape produces **per-source observations**. Merging them into canonical records needs the whole corpus and is an application concern. Putting solicitations in the artifact would have made the scraper responsible for a judgment it has no standing to make.

**This is also the entire answer to idempotency** — see §6.

### 3.3 Documents are referenced, never embedded

Ruled by Matt. Three reasons, in ascending order of weight:

1. **Size.** Bundles reach 21 MB. Embedding them ends transportability, which was the point of a file.
2. **It preserves Proposal 2.** *Counts before documents* was what replaced the depth governor that died when the scorer was parked. Reference-by-default keeps that governor alive as a depth setting.
3. **Legal posture.** The registry tracks `legal_posture` per source with ToS evidence. An artifact that *embeds* source documents is a materially different object to pass around than one that *points* at them.

> **A reference is only replayable while it stays resolvable**, so `document_ref` carries enough to re-fetch and to notice drift. **`sha256` is honestly null at reference depth** — you cannot hash what you did not download, and a fabricated or omitted-but-implied hash is worse than an absent one. `blob_ref` sits null now so that the day SP4 picks a provider, documents become retrievable **without a schema change**.

### 3.4 Provenance on every derived row

Every row in the derived layer carries `capture_id`, `extractor_ver`, and `mode`.

Because both layers exist and can disagree, the importer **trusts the derived rows** (fast, and it is what gets real data into the app today) while stamping them well enough that disagreement is **detectable rather than prevented**. A later replay regenerates from captures and diffs against the stamps, yielding *"these 412 rows are stale, and here is which extractor produced them."*

> **`mode` exists from day one even though it will only ever read `mechanical` for a while.** This is the condition the pinned doc puts on Proposal 4 in as many words: *"the mode must be recorded in the data, not merely set in configuration… Without that, this is a preference toggle. With it, it is an experiment."* The column costs nothing now. Backfilling it later is guesswork, because nothing would record which rows predate the smart path.

---

## 4. The scraper

`scrape/core` is a **library**: it takes a resolved configuration object and returns results. It opens no database connection and reads no configuration file. Both entry points resolve configuration themselves and pass it in.

That is what keeps the decoupling real rather than nominal — a scraper that reaches into the application's database to find out what to do is coupled to it whatever directory it lives in.

**Everything is mechanical.** Ruled by Matt: *"initially, all would be mechanical. We can then build out the 'smart' filtering when we have a smaller collection of candidates, which helps with token efficiency."* Smart mode is not built here; only the `mode` column that makes it comparable later.

---

## 5. Over-ask: checkpoint and resume

§9.6 handed this question to the brainstorm in these terms — *bound the inputs, or stop gracefully; not a 300-second death mid-write.*

**Ruled: checkpoint and resume.**

The scraper runs against a **time budget**. When the budget is nearly spent it commits what it has, writes `next_since`, and returns:

```json
{ "done": false, "next_since": "2026-08-09T14:22Z", "rows": 1840 }
```

The operator re-invokes to continue. The CLI's budget is generous; the handler's sits below the 300 s ceiling.

> **This makes the ceiling a parameter rather than a special case.** Same code, different budget. The 8,000-record register becomes N invocations instead of impossible, and no partial run is ever lost. Measured basis: ~7 rows/sec, so ~2,100 rows per 300 s invocation.
>
> **It also collapses Proposal 3 into the same mechanism.** The resume marker and *`since` = last successful run* are the same idea, so the safety rail with a deadline attached — *"the ingestion window must exist, in code at minimum, before the first real scrape runs"* — falls out of the over-ask answer rather than needing its own design.

**Fail closed.** A source with no window configured refuses to run. A missing configuration that silently means *everything* is how a first run pulls 24 months of Indiana.

---

## 6. The importer, and why idempotency is already solved

The importer reads the derived layer, appends **sightings**, and advances the mark.

**Overlapping windows are safe by construction.** Sightings are immutable and append-only; the canonical solicitation is produced by merging them on `external_id`. Re-scraping an overlapping window appends observations rather than overwriting anything, and an amended posting arrives as a *second sighting* — change detection for free.

> **This is strictly better than the natural-key upsert this design originally proposed**, which would have overwritten amendments and destroyed the per-source yield figures the schema comment calls out. The existing schema had already solved the problem; the first draft of this spec had not read it closely enough. Recorded because it is the second time today that checking the repository beat reasoning from memory.

**The one real duplicate risk is importing the same artifact twice**, which is caught by `artifact_sha256`: skipped by default, `--force` to override.

### 6.1 The app side

```sql
runs          -- the authority for "what do we have"
  source_id, ingested_through, imported_at, artifact_sha256
```

A new scrape asks this table where to start. **`ingested_through` advances only on successful import.**

> **Ruled deliberately, against the simpler alternative.** Advancing on *fetch* would have kept the scraper entirely free of application state — the cleanest decoupling available — but it relocates the silent gap rather than removing it: an artifact fetched and never imported would leave the mark past data the application never received. Under hand-invocation, where nothing guarantees anyone runs anything on a given day, that failure is likelier than it was under a schedule, not less.

---

## 7. The run contract — what an operator may specify

```
source     one or more enabled sources          (never "all sources" implicitly)
since      window start; required, no default   (fail closed)
until      window end; defaults to now
depth      listing | detail | documents         (Proposal 2's governor)
budget     time budget for this invocation
```

That is the whole vocabulary. **The admin screen that composes it is T12–T15's**, per §9.6; this document defines what the screen may say, not how it looks.

---

## 8. What the contract deliberately CANNOT express

**No content filters. Not now, not as a convenience, not as a scrape option.**

`Tenderfoot-Plan-of-Action.md:254` — *"The application returns all results from every active source — no ranking, no scoring, no filtering."* And :264 anticipates exactly this door:

> *It is not, however, a reason to quietly reintroduce a filter; if volume forces the issue, that is the trigger to design qualification properly, not to bolt on a threshold.*

**The distinction that keeps this honest:** the contract in §7 bounds *what we reach for* — which sources, which window, how deep. A filter decides *what qualifies* once we have it. Scope is legitimate; qualification is parked (spec §1.1) and undesigned.

> **Worth stating because it will be asked in good faith.** "Only pull contracts over $50k" and "only pull the last week" feel like the same kind of setting in a form. They are not. One is a judgment about a record and belongs to a qualification design that does not exist; the other is a bound on the search and makes no judgment about anything. **If volume becomes painful, that is the signal to design qualification — not to add a field here.**

---

## 9. What this defers

| Deferred | To | Note |
|---|---|---|
| Unattended scheduling | **SP7** | §9.6; Vercel Cron unexercised in V1 |
| Blob provider | **SP4** | designed away here via response streaming |
| Extraction runtime | **SP4** | **replayable captures are the hedge** — re-decide without re-scraping |
| Smart mode | later | `mode` column exists; only ever `mechanical` for now |
| Qualification / filtering | **undesigned** | spec §1.1, parked 2026-08-11 |

---

## 10. Open items

**1. `source.last_run_at` versus `ingested_through`.** `last_run_at` already exists on the `source` table, but this design advances the mark on ingest, not on run. *"When we last ran"* and *"what we have through"* are different facts, and conflating them is how the gap reopens. **Recommendation: add `ingested_through` rather than redefine `last_run_at`.** Not yet ruled.

**2. ~~The merge step is out of scope here and does not exist yet.~~ ✅ RESOLVED 2026-08-15 — it is now its own slice, `SP3.5`.** Ruled by Matt on reading this item. See Plan of Action §6.5. This design still lands only sightings, which is unchanged; what changed is that turning them into canonical records now has an owner, a position in the sequence, and a demo criterion of its own. **The work was not absent from the plan so much as hidden inside SP3's criterion** — *"dedup works; per-source yield visible"* described the merge, not the ingestion, and both clauses have moved to SP3.5.

**3. `verified_facets` is unused by this design.** The `source` table records which query parameters were *verified* to filter, against §5.4's four confirmed instances of a parameter accepted and silently ignored. A scraper that passes `since` to a source that ignores it will silently over-fetch. **Whether the scraper must consult `verified_facets` before trusting `since` is unsettled**, and it is the kind of gap that shows up as an inexplicable volume figure rather than an error.

---

## 11. Decisions ruled in this session

| # | Decision | Alternative rejected |
|---|---|---|
| 1 | SQLite is **transport only**; Postgres stays the system of record | SQLite as the app's database — impossible on Vercel, would unwind SP1.5 |
| 2 | The artifact carries **both** raw captures and derived rows | Captures only (tidier); derived only (not replayable) |
| 3 | Derived rows are authoritative on import, **stamped** with provenance | Regenerate from captures; or copy unstamped |
| 4 | **Both entry points** built now — CLI and HTTP handler | CLI only, deferring the handler to SP7 |
| 5 | Over-ask **checkpoints and resumes** | Bound the inputs up front; or both |
| 6 | The mark advances on **ingest**, not fetch | Fetch (cleaner decoupling, relocates the gap); explicit-only (no self-healing) |
| 7 | Documents **referenced, never embedded** | Embed at document depth |
| 8 | Idempotency via the existing **`sighting`** model | A natural-key upsert — would have destroyed amendments |
| 9 | Source config stays in the existing **`source`** table | A config file — a second home for configuration that already has one |
