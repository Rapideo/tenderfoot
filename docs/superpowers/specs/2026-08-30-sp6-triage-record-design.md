# Triage and record — design (SP6)

**Written 2026-08-30. Brainstormed with Matt the same day; every ruling below was made by him in that session and is recorded with its reasoning.**

This designs the slice §6 places last before the gate — and it **is** the gate. Components **4A, 4B, 4D, 5A, 5B, 5C**: *everything from active sources, read and decided in the app*. §6 states the question it answers: **does reading everything from active sources surface work KP would pursue and had not otherwise seen?** It produces **discovery and volume, not precision** (§6), and it carries two bullets of SP4's own demo criterion, deferred into it by ruling because they need a record view this slice owns (`2026-08-28-sp4-fetch-extraction-design.md` §10.1).

It is also the first slice that produces screens a person outside the project would recognise, and the first place Matt's judgment enters the project since A2 was retired (Plan of Action §6, "the adjudication session").

**Status: designed, not built.** No implementation plan yet — that is the next step.

---

## 0. What this settles, in one paragraph

The queue returns **everything**, ordered **deadline-soonest-first**, and never ranks — §1.1 is untouched. The gate's measurement is not taken by triaging the queue but by triaging a **materialised per-source random sample**, drawn as an explicit operator action that records its own population size, so *Interested-per-hundred* has a denominator that is a stored fact rather than a recomputation. Decisions are **append-only**: a change writes a new `pursuit` row and the old one survives, because the data the GO/NO-GO number is computed from is the last place in this project that should discard evidence. The record view shows every extracted field with its value, confidence and quoted passage, and shows conflicts **beneath the winner** rather than resolving them away — which is SP4's deferred headline finally becoming readable. The Brief and Saved Views are out: the Brief's live half is parked qualification and its inert half is already carried by three other nodes.

---

## 1. The seven rulings this rests on

| # | Ruling | Consequence |
|---|---|---|
| 1 | **The gate triages a per-source random sample**, not the queue as far as a day reaches. | *Interested-per-hundred* is a rate with a correct denominator. Sampling is a measurement protocol; **no filter enters the product.** |
| 2 | **Scope is queue + record, judgment-free.** Shell, `View 1.1`, `1.3`, `2.3`, `2.4`, `2.5`, and the gate instrumentation. | **`View 2.1 : Brief` and `View 1.2 : Saved Views` are out.** §2.2 names what dies. |
| 3 | **Default order is deadline-soonest-first, nulls last**, with an explicit and visible sample mode. | The SVRC's ratified `AMBIGUITY FIRST` default is **not implementable** without a scorer. Deviation **D15**. |
| 4 | **Decisions are append-only.** Undo writes a reversal; nothing is overwritten. | Reads take the latest row per solicitation. A revised decision stays visible. |
| 5 | **The sample is materialised** — migration 012. | The denominator is recorded at draw time. The number is reconstructable years later. |
| 6 | **The score strip does not render on the composed card.** | Resolves a standing conflict between two dated rulings. Deviation **D12**. |
| 7 | **The pursuit-cost panel renders empty and says so.** | None of its four facts are extracted. The gap is shown, not hidden. Deviation **D14**. |

Rulings 1–5 were made in sequence in the 2026-08-30 brainstorm. Rulings 6 and 7 arose from findings surfaced while reading the primitives against the reference, and are recorded in §2.3 and §2.4 with the conflicts they settle.

---

## 2. What this slice is, and what it deliberately is not

### 2.1 No judgment, anywhere

Nothing here scores, ranks, gates or filters. V1 returns everything (design spec §1.1), and the standing guard holds unchanged: **a rendered control may never become a live filter or score until qualification is designed — artifact permitted, data flow forbidden.** The sampling in §4.3 is not an exception: it selects *what a human reads in order to measure*, never *what the product shows*. The queue's own membership and order are unaffected by it.

### 2.2 The Brief is out, and what dies with it

`View 2.1 : Brief` is defined by the SVRC as *"what it is, **why it fits**, what is missing and would need a partner, key dates, key risks, the pursuit-cost fact panel, and a **recommended posture**."* *Why it fits* and *recommended posture* are fit judgments against the Firm Profile — the same substance as `View 2.2 : Scores and Evidence`, which is **PARKED**, delivered as prose instead of as a number. Building it would be the back-door reintroduction §6 warns against, and would breach the guard above.

Strip those two out and what remains — what it is, key dates, key risks, the cost panel — is already carried by `Region 1.1.1`, `Region 1.1.3` and `View 2.3`, all built in this slice. The SVRC half-concedes this itself: *"this node got quieter and Screen 1 did not."*

**What dies:** the record has no single narrative surface. A person reading an opportunity assembles it from the card, the fields and the timeline rather than being handed a paragraph. That is a real loss of legibility at exactly the gate that judges legibility, and it is accepted because the alternative is shipping a judgment surface the project has parked.

**`View 1.2 : Saved Views` is out** by Ruling 1: it exists to carve the firehose, and sampling now does the carving for the only session that needs it. Its `Imp 4` / `Pri 4` scores stand; it is not re-scored, only unbuilt.

### 2.3 The score strip conflict, resolved on the record

Two dated rulings disagreed, and the disagreement would have been rediscovered the moment a card was composed:

- **SVRC `Region 1.1.2` (2026-08-11):** *"V1 has no scores, so this region does not render… Nothing takes its place in the card… The row is shorter in V1, which is the honest consequence."*
- **STATUS (2026-08-13):** the intelligence chrome is *"constructed and rendered, none wired,"* because a build omitting it *"would not be a subset of the product but a different one, with holes where screens were composed around content."*

**Matt ruled for the SVRC: the strip does not render on the card.** The 08-13 ruling's own stated reason is *holes where screens were composed around content* — and the SVRC says explicitly that nothing takes the strip's place and the row is simply shorter, so there is no hole to leave. On the card specifically, a panel captioned *MACHINE SCORES — A READING AID* showing four dashes is worse than absence during a ten-second decision: it reads as *the machine scored this and found nothing*.

**A stale claim is corrected by the same ruling.** STATUS says *"how 'vestigial' should look is undesigned and stays that way until Matt specifies it."* It is not undesigned — **SP2 built it**, among the sixteen primitives signed off on 2026-08-14. `ScoreBar` takes `value: number | null`, renders `—` with no fill under a `score-bar--empty` class, and its own comment records *"null is the V1 case (assessment table empty by design, spec §1.1)."* The primitive stays on `/dev/gallery`, fully built, and is not composed into a product screen by this slice.

### 2.4 The pursuit-cost panel has no data, and shows that

`Region 1.1.3` names four facts: number of required forms, whether a pre-proposal conference is mandatory, how many references are demanded, whether anything needs notarizing. SP4 extracts six fields — `closes_at`, `qa_closes_at`, `prebid_at`, `prebid_required`, `set_aside`, `value_cents` — and the last three sit in `NOT_EXTRACTED` in `fields.ts` with no extraction logic at all. **Zero of the panel's four facts exist.**

This matters more than a missing panel usually would. The SVRC's revised argument for the whole screen is that *"V1's triage queue earns its login on the pursuit-cost panel, the extracted facts, and being a system of record"* — and one of those three legs is empty at the gate that judges the argument.

**Ruled: render it empty and label it honestly.** `FactPanel` already carries a populated/empty split (`hasFacts`). The empty state says these facts are not yet extracted — the same *we looked / we have not looked* distinction `View 2.3` enforces on fields. Extending extraction to produce them was considered and rejected for this slice: it reopens SP4's cue-vocabulary work, which is **parked** with the labelling task, and its accuracy would be unmeasured at the moment the gate read it. **If the gate session repeatedly wants a fact this panel cannot give, that is a finding the gate should produce** rather than one the slice should pre-empt.

---

## 3. Data model — migration 012

Three changes. Nothing else in the schema moves.

### 3.1 The sample store — new

```sql
CREATE TABLE triage_sample (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id       integer NOT NULL REFERENCES source(id),
  drawn_at        timestamptz NOT NULL DEFAULT now(),
  seed            text NOT NULL,
  n_requested     integer NOT NULL,
  -- Eligible rows AT DRAW TIME. THE DENOMINATOR, recorded as a fact.
  population_size integer NOT NULL,
  note            text
);

CREATE TABLE triage_sample_item (
  sample_id       integer NOT NULL REFERENCES triage_sample(id),
  solicitation_id integer NOT NULL REFERENCES solicitation(id),
  position        integer NOT NULL,
  PRIMARY KEY (sample_id, solicitation_id)
);
```

**Why a table rather than a seed.** `ORDER BY md5(id || seed)` is a deterministic permutation of *the eligible set*, and eligibility is *"not closed and not yet decided"* — a set that moves underneath the session as deadlines pass and ingests land. A re-seeded draw is reproducible only against a population that no longer exists. The gate's number outlives the gate session; six months on, *"Interested-per-hundred was 3.2 for SAM.gov"* needs a denominator someone can reconstruct.

This is the discipline `corpus/calibration/README.md` already imposes on every other number in this project, and the discipline two failures this month came from lacking: the **12.5% recall figure**, whose base rate is wrong by construction, and the **`test` credential rotation**, which could only be asserted because the old value was overwritten before capture.

**`n_requested` is stored separately from the item count on purpose.** A source with 40 eligible rows and `n = 100` draws 40. Those are different facts and a single number cannot carry both.

### 3.2 `pursuit` needs no migration, only an index

The existing `pursuit_solicitation` is a **plain index, not a unique constraint**, so more than one row per solicitation is already legal. Append-only history costs nothing in the schema. What it costs is a read, and that gets an index:

```sql
CREATE INDEX pursuit_latest ON pursuit(solicitation_id, created_at DESC, id DESC);
```

**Ordering is by `created_at`, not `decided_at`.** `decided_at` is a `text` column in migration 002 and cannot be sorted reliably; `created_at` is `timestamptz NOT NULL DEFAULT now()`. `id DESC` breaks a same-millisecond tie.

### 3.3 What is NOT added

**No `queue` table, no session table, no decision-history table.** The queue is a query; a decision's history is the `pursuit` rows themselves. Adding a state machine to hold what `ORDER BY` and `INSERT` already express is the kind of structure that has to be migrated later for no gain.

---

## 4. The queue

### 4.1 Membership

A solicitation is in the queue when **it has no decision yet** — no `pursuit` row, or a latest row in state `New` — **and it has not closed**.

**Items with no `closes_at` at all still enter.** A missing deadline is not a reason to hide an opportunity; production carries thousands of rows and not every one has a date. They sort **last**, not first: sorting unknown-as-urgent is how a null becomes a false alarm.

### 4.2 Order — deadline soonest first

`closes_at ASC NULLS LAST`. This is already what `GET /api/solicitations` defaults to.

**Deviation D15, and it is a departure from a ratified decision rather than from silence.** The SVRC closed its ordering gap on 2026-08-12 by adopting the prototype: `ORDER · AMBIGUITY FIRST` as the default, switchable between *ambiguity first / score, highest first / deadline, soonest first*, and it ratified switchability as the point. **Two of the three orderings require a scorer.** Ambiguity is a property of a borderline score; with the assessment table empty by design there is no ambiguity signal to sort on. Only *deadline, soonest first* survives, so the default is re-decided here and the switch has nothing left to switch between. **When qualification is designed, this node's ratified answer returns intact** — nothing here argues against it.

### 4.3 Sample mode

Drawing a sample is an explicit, gated operator action: source, `n`, optional seed. The draw counts the eligible population, records it, selects `n` rows by seeded permutation, and writes the header and items in **one transaction via `UNNEST`** — the established pattern from the SP3.5 ingestion fix, which collapses both the round trips and the bind parameters.

**Sample mode is visible on screen and never implied.** The queue reads `SAMPLE · 100 of 4,812 · SAM.gov`, so a sampled queue cannot be mistaken for the whole queue. The seed and the population size are shown with it, because a number whose conditions are not on screen is a number that gets misquoted later.

The session is resumable across a refresh, a reload, or a second day: the drawn list is in the database, and progress is the `pursuit` rows against it.

---

## 5. Decisions

### 5.1 Append-only

Every decision `INSERT`s a `pursuit` row. Current state is the latest row per solicitation. **Undo appends a reversal; it never deletes.** The queue offers undo on the last decision with no time limit — it is simply *decide it again*.

**This is the rule the rest of the system already runs on.** `precedence.ts` keeps rejected values on the ground that *"a rejection you cannot inspect is a bug you will never find"*; conflicts are rows rather than a flag; gated items are filed rather than deleted. A decision that silently overwrote its predecessor would be the one place this project discards evidence — and it would do it to the data the GO/NO-GO number is computed from.

It also makes a real question answerable: *was this Interested reversed to Pass on second look?* Append-only can answer it. Mutation cannot even be asked.

**The cost, named:** every read needs latest-row-per-solicitation, which is a `DISTINCT ON (solicitation_id)` query and is the kind of thing that is wrong silently. It gets its own test (§11).

### 5.2 Reason capture

**Free text. Mandatory on Pass by default, optional on Interested, and `requireReasonOnPass` is switchable** — exactly as the SVRC settled on 2026-08-12. Chips are parked with qualification; the accumulating free text is the corpus a chip vocabulary is eventually derived from.

The setting says plainly what turning it off gives up, per the SVRC's own instruction.

### 5.3 The decision bar is gated

`POST /api/solicitations/:id/decision` sits behind `requireAdminSecret`, following the established rule in `routes/index.ts`: **writes are gated, reads are not.** Reads stay open so the screens load without turning a shared bearer token into a login, which design spec §7 says it is not.

**This is not ceremony.** Production is public by decision (§5). A stranger clicking Pass would corrupt the gate's own measurement, and the gate is what decides whether the project continues.

`decided_by` is set once per session and stored on every row. Two people scoring cannot be merged into one ground truth without knowing whose is whose (migration 002).

---

## 6. The record — Screen 2

Reached from the queue by `Enter`, and addressable at `/solicitation/:id`.

### 6.1 `View 2.3 : Extracted Fields`

Six field rows. Each carries **value, confidence, origin, and the quoted passage it came from.** The three states the SVRC insists on are honoured and visually distinct: **found with a confidence**, **absent** (*"we looked and it is not there"*), and **not yet looked for**. Collapsing the last two into one low number is how a missing ceiling quietly becomes a guessed one.

**Conflicts render beneath the winner, with their origin, unresolved.** `resolveField` already returns `{value, origin, conflicts}` and is applied at read time so the precedence rule can change without re-extraction.

**This view is where SP4's deferred bullets 2 and 3 land** (`2026-08-28-sp4-fetch-extraction-design.md` §10.1). Until it exists, SP4 proves a citation is *stored*, never that it is *readable*, and the FSSA near-miss stays theoretical inside the product.

### 6.2 `View 2.4 : Documents` — deviation D11

The SVRC specifies *"the bundle inline, with extraction highlights pointing back into the source."* **That is not buildable.** SP4 ruled the opposite and migration 008 records it: documents are *"fetched, parsed and DISCARDED — a citation quotes the extracted passage, so there are no bytes to keep."*

What is built instead, per document: filename, media type, `extract_status`, a **link out to `source_url`**, and the stored `extracted_text` with the cited passages marked. The deviation says plainly that the bytes are gone and why, so a future reader does not conclude the viewer was forgotten.

### 6.3 `View 2.5 : Timeline`

Every sighting in order — source name and `seen_at` — **and what the system decided about the record**, which is the scope the SVRC widened to on 2026-08-12: the merge's organisation resolution, rendered as an event. Entity resolution is *"the least visible thing the system does and the easiest to get silently wrong,"* and this is the only place a person watches it happen.

**Not built: the addendum diff.** The SVRC's known gap stands — *"the timeline shows a diff, not a summary-of-changes, and the diffing does not exist yet."* It still does not. Addenda are shown as sightings with their payloads; nothing here claims to diff them.

---

## 7. The shell

**`Region A.1 : Main Header`** — `HeaderLockup` (already built, no props), primary nav, and `A.1.3` the queue counter, which decrements as decisions land.

**Routes, made explicit because the current ones do not leave room.** The queue is the daily driver and takes `/`; the record is `/solicitation/:id`; `/admin` is unchanged. **The existing client `Health` page moves from `/` to `/health`.** `GET /api/health` — the endpoint production verification actually calls — is untouched, and nothing about that move changes what a deployment check reads.

**`Region A.2 : Status Bar`** — the `Pri 4` node that has been waiting on a shell to live in. `StatusBar` was built at SP2 taking exactly `{sources, failing, rotSuspected, lastRun}`, which is precisely what `A.2.1 Source Health Indicator` and `A.2.2 Last Run` specify. SP3.6 built the data — `source.health`, `last_run_at` — and put it on the registry card because there was no shell. **This is now props-wiring off `GET /api/sources`, not a subsystem.**

It matters at the gate for the reason §6.4 A3 gave: known risks now record **five** silent-failure instances across three source platforms — four when A3 was written, and the fifth, found 2026-08-16, was ours — and *a GO / NO-GO measured during a window in which a source was silently dead is not a measurement of the market; it is a measurement of an outage.*

**The queue uses the shell reduced**, per the SVRC — nav collapses while triaging, because the queue wants full width and no competing affordances. Built as specified; the reference invites this assumption to be challenged and nothing found here challenges it.

**`View 1.3 : Queue Cleared` — deviation D13.** The SVRC calls its content undesigned, so it gets the smallest build and a number: `ShortcutCard` offering *draw another sample*, *metrics*, *admin*. It exists to keep the session alive rather than dead-end it, which is the one thing the SVRC does say about it.

---

## 8. The gate's two numbers

§6.-1 requires both, and nothing else in the project can produce them.

### 8.1 Volume per source per week — computed on `posted_at`, never `seen_at`

**`sighting.seen_at` is when *we* saw a row, not when the market produced it.** Nothing ingests unless a human asks it to (known risk, 2026-08-15), so sightings cluster on the days somebody ran a scrape. A weekly series built on `seen_at` measures **operator behaviour**, and would show a source surging or dying when all that changed was who was at the laptop.

The series is built on `solicitation.posted_at`. **Rows with no `posted_at` are excluded, and the exclusion is reported with the number** — count and percentage, never silently dropped. A series with an unstated exclusion is the same class of error as a rate with the wrong denominator.

### 8.2 Interested-per-hundred per source

Computed against the materialised sample, per source, counting solicitations at their **latest** pursuit state — so an Interested later reversed to Pass counts as Pass, and the reversal is still inspectable.

**Three numbers ship together, because any one alone misleads:** `population_size` (what the sample represents), items **drawn**, and items **decided**. A half-triaged sample then reads as a half-triaged sample rather than as a rate.

`perSourceYield()` in `merge/yield.ts` computes sightings, canonical and unique-to-source per source. ⚠️ **Corrected 2026-08-31: this line claimed it "is reused rather than reimplemented" by the metrics work. It is not** — `triage/metrics.ts` imports nothing from it, and yield is printed only by `npm run merge`. The claim was written into this spec and never checked against the build. Whether the gate's numbers SHOULD draw on it is still worth deciding; what is recorded here is only that they do not.

---

## 9. API surface

| Endpoint | Gate | Returns |
|---|---|---|
| `GET /api/queue?source=&sample=&cursor=&limit=` | open | Mode (`all` \| `sample`), the sample header when sampled, `total`, `remaining`, and the items the card needs |
| `POST /api/triage/samples` | **gated** | Draws and stores a sample; returns its header including `population_size` |
| `GET /api/triage/samples` | open | Lists samples, so a session is findable after a reload |
| `POST /api/solicitations/:id/decision` | **gated** | Appends a `pursuit` row; returns the new row and the resulting latest state |
| `GET /api/solicitations/:id` | open | **Extended, not replaced** — adds resolved fields with conflicts, and the timeline |
| `GET /api/triage/metrics` | open | §8's two numbers, with the `posted_at` exclusion reported |

**Five new server modules**, each small enough to hold in one file: `triage/queue.ts` (membership and order), `triage/sample.ts` (the draw), `triage/decide.ts` (the append, and mandatory-on-Pass), `triage/latest.ts` (the `DISTINCT ON` current-state query, used by both the queue and the metrics), `triage/metrics.ts`.

**One targeted fix folded in.** `GET /api/solicitations` currently returns **every** row unbounded — 9,883 today, on a deliberately-public production. It gains `limit` (default 200, max 1000) and `offset`. The queue does not use it, but leaving an unbounded endpoint beside a new one that pages properly is worse than fixing it.

**Deadline conflict on the card is computed, not stored.** `solicitation.closes_at` is the merged canonical value; `extracted_field` holds the `listing` and `document` rows. The card resolves that one field per row to flag disagreement — `Region 1.1.1`'s rule, *show the disagreement rather than silently picking a winner*, which **currently carries the FSSA near-miss risk alone** because `Region 1.1.5 : Gated Items Drawer` is parked.

---

## 10. Error handling and the honest edges

Named here so they are built, not discovered.

| Edge | Behaviour |
|---|---|
| Source has fewer eligible rows than `n` | Draw all of them. `n_requested` and the actual count are both stored and visibly differ |
| Item decided from the record rather than the queue | Counts. The sample is a set of ids, not a mode-locked queue |
| An item's deadline passes mid-session | **Stays in the sample**, marked closed. Dropping it would move the denominator — the exact failure the materialised draw exists to prevent |
| Pass submitted with an empty reason | `400`, and the key is blocked client-side before the request is made |
| Undo with nothing to undo | No-op |
| A second draw for the same source | Allowed, and it is a **new sample** with its own population size. Samples are never edited |
| Automation and CDP | The queue must seed `sessionStorage['tenderfoot.adminSecret']` **before** navigating. `getAdminSecret` falls back to `window.prompt`, which deadlocks CDP (STATUS §2) |

---

## 11. Testing

Per-module tests in the project's established idiom, plus four that carry more weight than the rest:

1. **Sample stability.** Inserting new solicitations after a draw must not change that sample's membership. This is the single property the whole migration exists to provide, and it is the one that fails silently.
2. **Append-only survives.** A second decision creates a second row; the first is still there; the latest wins. And the reversal case: Interested then Pass counts once, as Pass.
3. **Queue constancy.** Five items and twenty-five items must issue the **same statement count** — the `merge.ts` precedent, where the test asserts constancy rather than smallness, because no per-row implementation can satisfy it.
4. **Metrics exclusions are reported.** A source with rows lacking `posted_at` returns the count of what it excluded, not just a series.

Membership and ordering get their own coverage: decided rows excluded, closed rows excluded, null-deadline rows **included and sorted last**. Client tests for the shell, queue and record follow `Admin.test.tsx`'s pattern.

The gate is `npm run check`, currently green at **430 tests / 58 files**.

---

## 12. Deviations

Numbered into the continuous series in `docs/admin-deviations.md`, where D10 is current.

| # | What |
|---|---|
| **D11** | `View 2.4` shows stored extracted text and a link out, not the bundle inline. The bytes were discarded by SP4's ruling |
| **D12** | The score strip does not render on the composed queue card. Resolves the 2026-08-11 SVRC parking against the 2026-08-13 chrome ruling, and corrects STATUS's stale *"how vestigial should look is undesigned"* |
| **D13** | `View 1.3 : Queue Cleared` content, invented because the SVRC calls it undesigned |
| **D14** | `Region 1.1.3` renders empty and says why. None of its four facts are extracted |
| **D15** | Default order is deadline-soonest-first. The ratified `AMBIGUITY FIRST` default is not implementable without a scorer |

---

## 13. What this deliberately does not do

- **No scoring, ranking, filtering or gating.** §1.1 stands. Sampling selects what a human reads to measure, never what the product shows.
- **No Brief** (§2.2), **no Saved Views** (Ruling 1), **no Score Strip on a product screen** (§2.3), **no Gated Items Drawer** — V1 has no gates, so nothing is gated.
- **No addendum diffing.** The SVRC's `View 2.5` gap stands.
- **No chips.** Free text only, until a vocabulary can be derived from accumulated reasons rather than invented ahead of them.
- **No document viewer.** There are no bytes to view.
- **No authentication.** The decision write is gated by the existing shared secret, which is not a login and is not claimed to be one. Auth in V1 remains open on Matt's list.

---

## 14. Demo criterion

**Draw a per-source sample on production, triage it keyboard-only in a real browser, and read one solicitation's fields with their citations and a visible conflict — then get both gate numbers out.**

It passes when:

1. `POST /api/triage/samples` records a `triage_sample` row whose `population_size` and `seed` are stored, and `triage_sample_item` holds the drawn ids.
2. The queue runs in sample mode, says so on screen with its denominator, and is resumable across a page reload.
3. Decisions are made **from the keyboard** and land as `pursuit` rows.
4. **Undo is exercised:** both rows survive, and the latest wins.
5. A record shows a field's **value, its confidence, and the quoted passage** — SP4 criterion bullet 2.
6. A **disagreement is visible on the record**, both values with their origins, not resolved away — SP4 criterion bullet 3.
7. `GET /api/triage/metrics` returns volume per source per week and Interested-per-hundred per source, with the `posted_at` exclusion reported.

⚠️ **The click-through is part of this criterion, not a follow-up to it.** SP3.6 passed every server-side test while both of its buttons were broken in a browser, and SP4's §10 restated the lesson. Endpoints exercised by `curl` do not discharge bullets 2–6.

---

## 15. One sequencing prerequisite

**Production holds 9,883 solicitations and zero documents.** The 79 extracted documents with cited fields are on the `test` branch. Criterion bullets 5 and 6 have nothing to show on production until **Discover runs there** — which is SP4's one unrun, non-deferred criterion bullet and is already on Matt's list.

Either Discover runs on production before SP6's demo, or the record half of the demo is taken on `test` and **the criterion says which**. What must not happen is the demo being taken on `test` and reported as production.

⚠️ **The first Discover click on production writes `document` rows into a database that has none.**
