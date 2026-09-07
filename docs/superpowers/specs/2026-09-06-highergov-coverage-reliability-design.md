# HigherGov coverage reliability — step ③, the gate holding the adapter backlog

**Design spec, 2026-09-06.** Brainstormed with Matt the same day; the four
rulings taken in that conversation are recorded in §2 and are the reason this
document has the shape it has.

> **⚖️ FIDELITY MANDATE (CLAUDE.md §1) — NOT APPLICABLE, AND SAID SO DELIBERATELY.**
> CLAUDE.md §3 records that SP6 went wrong because *"neither its spec nor its
> plan referenced §7.10 even once."* The rule that follows is that a slice spec
> must name the mandate. **This slice builds no UI.** It adds one operator
> command in the `npm run fitness` family, and ruling 3A (2026-09-03) forbids new
> UI slices outright. The mandate is named here so that a future reader knows it
> was considered and found inapplicable, rather than forgotten.

---

## 1. What this decides, in one sentence

**Whether the adapter backlog — Illinois, Michigan, Kentucky, Ohio, the OpenGov
municipalities — stays shelved.**

STATUS records the backlog as *"shelved pending a reliability test."* This is
that test. It is step ③ of the sequence Matt set on 2026-09-03: ① field mapping
✅ · ② the floor, measured ✅ · **③ a bounded reliability test** · ④ then the
corpus pulls.

### Why the existing evidence cannot decide it

The buy case rests on a measurement taken **once, on one day**: 69/70 coverage
recall against a 71-item answer key captured 2026-09-02, one 100-row completeness
sample, one day's volume count.

`Proto2PRD-Lessons.md` §2.15 is the governing lesson, and it was written about
this project's own repeated failures:

> **"Neither direction carries reliability, because reliability is a property of
> a distribution and no single report can hold one."**

A 99% recall figure from a single observation is exactly the shape §2.15 warns
about. **Nothing here disputes the buy** — the purchase was correct on the
evidence available. What is missing is the second observation, and the third.

---

## 2. The four rulings this design is built on

Taken with Matt in the 2026-09-06 brainstorm. Each was a real fork; the
alternatives are recorded so a later reader can see what was given up.

| | Question | Ruled | What was given up |
|---|---|---|---|
| **①** | What must the test conclude? | **Coverage decay** — does it keep finding things? | Operational trust (availability, §5.4 silent-ignore over time) and decision quality (completeness drift). Both cheaper; neither is what the $500 bought |
| **②** | How is the observation window obtained? | **Harvest the elapsed window now, then continue forward by hand** | A purely prospective N-day run (tidier, no signal until it closes) and building the scheduler first (durable, but breaches the SP7 deferral) |
| **③** | How is the sub-state segment covered? | **Hand-build a small sub-state answer key** | Using IDOA as a proxy and disclosing the gap; and internal-consistency-only tracking, which can never detect a steady miss rate because it compares HigherGov to itself |
| **④** | What counts as a find? | **A recall floor PLUS a usable-lead-time ceiling** | Recall-only (directly comparable to the original 99%, but passes a source that reliably carries everything two days late) |

### ⚠️ Ruling ③ exists because the free answer key is the wrong segment

IDOA's page is Indiana **state agencies**. HigherGov was bought for **sub-state
buyers** — Allen County, Fort Wayne, Fishers, Zionsville, the airport authority —
and the shelved adapters are other states plus OpenGov municipalities. IDOA is an
answer key for none of that.

**A clean 100% recall against IDOA would be real and would say nothing about the
coverage the money was for.** Ruling ③ is what stops this test from producing a
confident number about the wrong thing.

---

## 3. The method

### 3.1 The asymmetry that makes it affordable

The same asymmetry CLAUDE.md §5.2 is built on, applied to measurement rather than
retrieval:

| | Cost | Why |
|---|---|---|
| **The answer key** | **0 records** | IDOA and the sub-state buyers publish their own pages. `parseIdoaPage` and a registered `idoa` adapter are already on `main` |
| **The comparison cohort** | **~5 records/day** | R5 measured a filtered Indiana day-pull at 5 records |
| **Latency** | **0 records** | `captured_date` rides along on rows already pulled |
| **Sub-state** | **0 extra records** | The Indiana feed already contains sub-state rows — the same pull serves both segments |

### 3.2 The elapsed window, harvested now

**The 71-item key is a frozen census of IDOA's page as of 2026-09-02.** It is a
complete enumeration of that page, not a sample, which is what makes a diff
valid.

A fresh IDOA scrape today is free. Every Event ID on it that is **not** among the
71 is a notice published since the key was frozen — a real new-notice cohort,
with the wall-clock already elapsed. **We were not watching, but the window
passed anyway.**

This yields a reading in the first run rather than after a two-week wait, and it
costs one filtered pull per elapsed day.

> ### 🔴 AMENDED 2026-09-06 — THIS IS NOT WHAT WAS BUILT, AND THE SECTION IS LEFT AS WRITTEN SO A READER MEETS THE CORRECTION
>
> **The diff against the frozen 71-item key was never implemented.** The
> whole-branch review found it: the plan never asked for it, and `coverage-cli.ts`
> passes the **entire current IDOA page** as the cohort. Nothing stores a previous
> census, so there is nothing to diff against on the first run.
>
> **Ruled 2026-09-06: correct this document rather than build the machinery.**
> Two reasons.
>
> **First, the full-page cohort is a legitimate measurement.** With the
> false-miss guard (§3.4) every key entry not in the window feed is looked up by
> id, so C1 answers "of the notices open on IDOA today, how many does HigherGov
> carry" — a real question, and the one the purchase was argued on.
>
> **Second, and this is what makes the amendment cheap: after run one, the
> DATABASE is the baseline.** A notice settled `carried` is never re-asked, so
> every run after the first naturally measures only what is new or still
> unresolved. The spec wanted a diff; it gets one from run two onward. **Only run
> one is a full census.**
>
> ⚠️ **What that costs, stated rather than buried: run one's C2 is INFLATED.**
> Notices that have been open for weeks were captured weeks ago, so their lead
> times are large. **Run one is a census and must not be read as a decay
> measurement.** The CLI says so at runtime when the accumulated cohort is empty.
>
> ⚠️ **And §6's cost table no longer describes run one.** "Elapsed-window harvest
> (~4 days) ≈ 25 records" assumed a small new-notice cohort. A full census is
> ~71 id lookups, capped at 40 records per run — which is why a complete first
> census takes two or three runs.

> ⚠️ **The diff has one blind spot, disclosed rather than discovered later.**
> The key is a census of *open* notices. A notice posted **and closed** between
> two observations appears in neither census and is invisible to the test.
> This biases the measurement **toward flattering HigherGov** — such a notice
> could have been missed entirely and would never be counted as a miss. Short-fuse
> notices are precisely the ones a bidder most needs carried promptly, so the
> bias runs against the property that matters most. It cannot be fixed by
> observing more often, only reduced.

### 3.3 The forward runs

The same operation, run by hand on a cadence Matt sets. Each run:

1. Scrapes the free answer keys (IDOA + the sub-state pages) — **0 records**
2. Diffs against the previous census to find the new-notice cohort
3. Pulls HigherGov for the covered days — **~5 records/day**
4. Records a per-notice verdict
5. Writes the spend to `api_spend`

**The cohort accumulates across runs.** This matters for §4.4: a single 4-day
window is below the cohort floor and grades `unknown`, and the forward runs are
what carry it to a size that can be graded at all.

### 3.4 The join key, and the two hazards it carries

**HigherGov's `source_id` IS IDOA's 15-digit Event ID** (verified 2026-09-03;
it is what made exact-match recall possible in the first place). That is the join.

> 🔴 **HAZARD 1 — versioning produces duplicates.** R6 records that *"several
> `source_id` lookups returned `count=2`"*, via `version_key`. Without a dedup
> rule, one carried notice can count twice and inflate recall. **The comparison
> must dedup on `source_id` before counting**, and record how many duplicates it
> collapsed — a rising duplicate rate is itself a finding.

> 🔴 **HAZARD 2 — the Indiana filter lives in HigherGov's account, not in our
> code.** R1 established that `/opportunity/` takes exactly twelve parameters and
> **none is a location**: three state parameters were accepted and silently
> ignored. State filtering is available *only* through a saved search
> (`search_id`). **That is an external dependency on a mutable object we do not
> version.** If someone edits or deletes the saved search, the cohort changes
> and nothing errors. **Mitigation: record `search_id` and the returned count on
> every run.** A step change in count with no change in our code is the signal.

### 3.5 Lead time is measured against the deadline, not against IDOA

HigherGov scrapes more sources than IDOA and can legitimately carry a notice
**before** IDOA's own page shows it. Measuring lead time as "days after we saw it
on IDOA" would therefore produce negative values that mean nothing.

**Lead time is `deadline − captured_date`: days remaining to bid at the moment
HigherGov first carried it.** That is the quantity a bidder actually experiences,
and it is well-defined regardless of which source published first.

---

## 4. The predicates

A new family, **C**, alongside the floor's `F` and the rubric's `R`.

| | Predicate | Property | Proposed threshold |
|---|---|---|---|
| **C1** | **Coverage recall** — share of answer-key notices HigherGov carried at all | `carried / cohort` | **≥ 0.95** |
| **C2** | **Timely recall** — share carried with at least `minLeadDays` remaining. **This is the gate** | `timely / cohort` | **≥ 0.90** |
| **C3** | **Capture latency** — median days between publication and `captured_date`. Reported, not gating | median days | reported |
| **C4** | **Cohort sufficiency** — is the accumulated cohort large enough to grade? | `cohort size` | **≥ 30** |

`minLeadDays` = **7** (proposed). It is the definition C2 turns on and is
therefore a threshold in its own right, not a constant.

### 4.1 Weakest segment wins

**C1 and C2 are evaluated per segment — state agency and sub-state — and the
verdict takes the WEAKER.**

This mirrors R7, which was rebuilt on 2026-09-04 to *"grade the measurement and
take the WEAKEST property"* on the stated reasoning that **a minimum, unlike an
average, cannot be talked up by adding strengths.** The same argument applies
with more force here: a blended recall figure would let strong state-agency
coverage conceal weak sub-state coverage, which is the exact failure ruling ③
exists to prevent.

### 4.2 The thresholds ship UNRATIFIED

`coverage/thresholds.ts`, mirroring `fitness/thresholds.ts` exactly — including
the mechanism, not just the word:

```ts
export const COVERAGE_RATIFIED = false;
```

**An exported boolean that changes runtime output and is pinned by a test.**
`api-spend.ts` records why this is not optional: its own final review found that
`MONTHLY_RECORD_CEILING` carried only the *word* "UNRATIFIED" in a comment, and
*"delete the word from the comment above and that test stayed green, which means
nothing was actually pinning the claim."* The same trap is avoided here by
construction.

While `COVERAGE_RATIFIED` is false, every verdict carries the caveat, exactly as
`gradeCompleteness` does for R7.

### 4.3 Below the cohort floor, the verdict is `unknown` — never `pass`

Established practice: R7 recorded *"Corpus — Indiana open, 61 rows, below the
population floor of 100, measured and recorded as such."* C4 is the same
discipline. **A 4-day cohort of ~20 notices does not grade — it accumulates.**

> ⚠️ **The proposed floor of 30 is LOWER than R7's 100, and that is a real
> weakening.** It is proposed because a 100-notice cohort of genuinely *new*
> Indiana notices needs roughly three weeks of forward running at observed
> volumes, and Matt asked for a **bounded** test. **This trade is his to accept
> or reject** — see §8.

---

## 5. What gets written, and what deliberately does not

### 5.1 HigherGov's rows are measured and NOT written into holdings

**This is the load-bearing decision of the whole design, and the reason approach
A was chosen over approach B.**

HigherGov carries `document_path` on **100/100** rows and healthy descriptions
where present. Ingesting it into `solicitation`/`sighting` would move **F6**
(description p10) and **F7** (document reachability) — the two predicates that,
with F5, currently block GO/NO-GO — in the passing direction.

**The floor would flip on data from a source we have not decided to keep, during
the test whose purpose is deciding whether to keep it.** That is the gate
unblocking itself with the evidence still under examination.

So the paid rows live in the measurement tables and nowhere else. A NO verdict
requires nothing to be unwound.

### 5.2 The free scrape does not import either

The reliability run **does not** run scrape→import→merge. It reads the free pages
for a census and stops.

This is a deliberate narrowing. Importing IDOA's notices is a legitimate thing to
want — they are free, real, and we have an adapter — but it is a **separate
operator act** with its own existing commands, and folding it in here would mean
a measurement run mutates holdings. `npm run fitness` is safe to point at
production precisely because it does not. This stays in that family.

**Net: the run writes its own two tables and the spend ledger. It touches no
holdings.** That is weaker than "read-only" and is stated that way rather than
rounded up.

### 5.3 Why two new tables, having checked for an existing home

CLAUDE.md and `Proto2PRD-Lessons.md` both record that this project has
independently built *"have we asked this source about this yet"* four times.
Two existing tables were checked before proposing new ones:

| Candidate | Why it cannot serve |
|---|---|
| `triage_sample` / `triage_sample_item` | A frozen, dated, sized cohort — structurally the right idea. But `triage_sample_item.solicitation_id` is **NOT NULL REFERENCES solicitation(id)** |
| `assessment` | Same: `solicitation_id` **NOT NULL** |

**Both forbid the one row this test exists to record.** A miss is a notice we do
*not* hold; neither table can express it. The obstruction is structural, not
stylistic.

`sighting` *can* hold an unlinked observation (`solicitation_id` is nullable) and
is the right shape for a positive sighting — but a miss is the **absence** of a
sighting, and an absence cannot be stored as a row in a table of presences.
Without a recorded cohort, next month nobody can reconstruct which notices were
tested.

### 5.4 Migration 031

```sql
CREATE TABLE coverage_run (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_at        timestamptz NOT NULL DEFAULT now(),
  source_id     integer NOT NULL REFERENCES source(id),
  -- The window this run's cohort was drawn from.
  cohort_from   date NOT NULL,
  cohort_to     date NOT NULL,
  -- HAZARD 2: the Indiana filter lives in HigherGov's account, not our code.
  -- Recorded so a silent change to the saved search is visible as a step
  -- change in `feed_count` with no corresponding change in our source.
  search_id     text,
  feed_count    integer,
  records_spent integer NOT NULL DEFAULT 0,
  duplicates_collapsed integer NOT NULL DEFAULT 0,
  note          text
);

CREATE TABLE coverage_item (
  run_id        integer NOT NULL REFERENCES coverage_run(id),
  -- The answer key's identity for this notice. NOT a solicitation_id: the
  -- whole point is that a MISS is a notice we do not hold, which is exactly
  -- what triage_sample_item and assessment cannot express.
  external_id   text NOT NULL,
  segment       text NOT NULL CHECK (segment IN ('state_agency', 'sub_state')),
  -- WHERE THE KEY CAME FROM. Two columns, because only one of the two answer
  -- keys has a registry row: IDOA is seeded as 'Indiana IDOA solicitations',
  -- while the sub-state buyers (ruling ③) are pages we read and do not ingest.
  -- Seeding a `source` row per municipality would give each one a legal
  -- posture, an adapter tier and a rubric grade it has no business carrying,
  -- and would put buyers we never ingest into the rubric matrix.
  key_source_id integer REFERENCES source(id),   -- nullable, see above
  key_origin    text NOT NULL,                   -- always present, e.g. 'fortwayne.gov/bids'
  key_seen_at   timestamptz NOT NULL,
  deadline      timestamptz,
  -- Three states, not two, and for the reason document.extract_status gives:
  -- "we looked and it is not there" is a different fact from "we have not
  -- looked yet". `unchecked` is written when a run aborts at
  -- MAX_RECORDS_PER_RUN with cohort left unqueried -- those notices are NOT
  -- misses and must never be counted as any.
  carried       text NOT NULL CHECK (carried IN ('carried', 'missing', 'unchecked')),
  captured_date timestamptz,
  lead_days     integer,
  PRIMARY KEY (run_id, external_id)
);
```

### 5.5 A notice enters the cohort once and is re-observed until it settles

The primary key is `(run_id, external_id)`, so **`coverage_item` is an
observation log, not a verdict list.** The rule, stated because it is otherwise
genuinely ambiguous:

- A notice **enters the cohort** on the run that first sees it in a free answer
  key. ~~Its `key_seen_at` never changes afterwards.~~ **⚠️ CORRECTED
  2026-09-06: `key_seen_at` is written as `now()` on every row of every run, so
  it records when THIS run observed the notice, not when it entered the cohort.
  The earliest observation is recoverable by joining to `coverage_run.run_at`,
  so nothing is lost — but the sentence as written was wrong about the column.**
- While it reads `missing` or `unchecked`, **it is re-queried on subsequent
  runs** — a notice carried late is precisely what C2 exists to catch, and a
  single observation would score it as a permanent miss.
- Once it reads `carried`, it is **settled** and costs nothing further.
- A notice still `missing` when its deadline passes is settled as a **miss**.
  Nothing can rescue it: a bidder could not have bid it.

**C1–C4 are computed over DISTINCT `external_id`, taking each notice's latest
observation** — not over rows, which would weight a repeatedly-re-queried miss
more heavily than a notice carried immediately.

---

## 6. Cost, and the hard stop

| | Records |
|---|---:|
| Elapsed-window harvest (~4 days) | ~25 |
| Each forward run (per day covered) | ~5 |
| A 14-day forward window | ~70 |
| Re-observing unsettled notices (§5.5) | **~0** — see below |
| **Total, expected** | **~95–100** |

**Re-observation is very nearly free, and the reason is worth stating.** CLAUDE.md
§5.1 records that *"errors and zero-result calls appear not to count"* — the
meter counts records **returned**. A `source_id` lookup for a notice HigherGov
still does not carry returns nothing, and therefore costs nothing. **A miss is
free to re-check for as long as it stays a miss, and costs exactly one record on
the run where it finally appears** — which is the run where we actually learn
something.

⚠️ The word in that finding is *"appear"*. It was inferred from one dashboard
reading, not from a documented billing rule, so the re-check path is counted in
`api_spend` like everything else rather than assumed to be free.

Against the standing **500-record budget** (CLAUDE.md §5.1, granted 2026-09-03),
this fits with room. Every call is counted and reported in the same breath, as
that budget requires.

> ⚠️ **THE 5-RECORDS-PER-DAY FIGURE IS ITSELF ONE OBSERVATION AT ONE MOMENT** —
> R5, 2026-09-02. **This is the exact error §2.15 exists for, and this spec is
> not exempt from it.** The cost model above is a projection from a single
> sample, and it is load-bearing for a budget that cannot be read back from the
> vendor.

**Two hard stops, because the projection may be wrong:**

1. **`MAX_RECORDS_PER_RUN`** (proposed **40**, UNRATIFIED). The run aborts and
   reports rather than continuing past it. A run that hits this cap is a finding
   about volume, not a failure.
2. **`MONTHLY_RECORD_CEILING`** — the run calls `spentThisMonth('HigherGov')`
   before spending and refuses if the ceiling would be crossed.

Every call writes `api_spend` with `endpoint: 'opportunity'`. The free scrapes
write rows with `records: 0` — migration 030's own comment authorises exactly
this: *"A free source writes 0 — the row still proves the call happened."*

> **This makes `MONTHLY_RECORD_CEILING` load-bearing for the first time.** D2
> shipped it as an unratified proposal of 1,000 governing what the *application*
> spends while somebody browses. This run is a different actor. See §8.

---

## 7. Module layout

```
app/server/src/coverage/
  highergov-client.ts   the minimal client. §5.3-bound (see below)
  answer-key.ts         freeze a census from a free source
  compare.ts            cohort diff, dedup, per-notice verdict
  thresholds.ts         the numbers + COVERAGE_RATIFIED
  measure.ts            predicates C1–C4, weakest segment wins
  coverage-cli.ts       npm run recall
app/server/migrations/031_coverage_run.sql
```

**`npm run recall`, not `npm run coverage`** — "coverage" in a JavaScript repo
means test coverage, and the collision would mislead every future reader. It
also names what is actually measured.

**The module is `coverage/`, not `reliability/`, and the distinction is honest
rather than pedantic.** Ruling ① chose coverage decay and explicitly set aside
operational trust and decision quality. Calling this "the reliability test" would
claim two properties it does not measure.

### 7.1 The client is bound by CLAUDE.md §5.3, and it is the first code that is

The 2026-09-03 leak happened in throwaway scripts. This is the first *committed*
code to call this API, so the three rules bind it in construction:

1. **`document_path` is a credential, not a URL** — it embeds the api_key in
   every response. Never printed, logged, or written to the database.
2. **Scrub at the boundary, never at the call site.** One recursive redactor
   walking every value before anything is printed. The 2026-09-03 leak happened
   because a `scrub()` helper covered every *error* path while field *values*
   printed raw.
3. **Never build the URL inline in a shell command.** Built inside the module
   from `process.env.HIGHERGOV_API_KEY`.

**The client is deliberately NOT registered in `ADAPTERS`.** It is written with a
clean interface so that wrapping it in an `Adapter` later is a small step, but
registering it would make a source we are still testing available to the real
ingest path — which is §5.1's whole argument.

---

## 8. What Matt still has to rule, and one thing to fill in

Nothing here blocks implementation; the thresholds ship as proposals and the run
reports its own provisional status. These are the decisions the verdict will
need before it can be binding.

1. **The four C-thresholds** — `minCoverageRecall: 0.95`, `minTimelyRecall: 0.90`,
   `minLeadDays: 7`, `minCohortSize: 30`. Ratify, amend, or leave provisional
   (the D4/D5 pattern, where the two blocks went different ways).
2. **`minCohortSize: 30` is the one to look at hardest.** It is below R7's
   population floor of 100, traded down to keep the test bounded (§4.3).
3. **`MONTHLY_RECORD_CEILING`** — D2 left it at an unratified 1,000. This design
   makes it load-bearing.
4. **The forward cadence, and when to adjudicate.** Daily? Twice weekly? And does
   the verdict land at a fixed date or at a fixed cohort size?

### 8.1 The sub-state answer key — a fillable template

Ruling ③ needs 3–6 sub-state buyers that publish their own bid pages. **This is
Matt's domain knowledge, not a lookup** — the right buyers are the ones in KP's
actual working geography, and a key built from the wrong ones would measure real
coverage of work nobody would bid.

The four named below are the sub-state buyers HigherGov was *observed* carrying
on 2026-09-03; they are a starting suggestion, not a recommendation.

| Buyer | Bid page URL | In KP's geography? | Keep? |
|---|---|---|---|
| Allen County | | | |
| City of Fort Wayne | | | |
| City of Fishers | | | |
| Indianapolis Airport Authority | | | |
| | | | |
| | | | |

---

## 9. Testing

- **The comparison is pure and unit-tested against fixtures.** `compare.ts` takes
  a census and a feed and returns verdicts; no network, no database.
- **Dedup is pinned by a test built from R6's real finding** — a `source_id`
  returning two rows via `version_key` must count once.
- **Mutation-check the predicates.** CLAUDE.md §4: *"would this still pass if I
  deleted the thing it tests?"* Each of C1–C4 gets a test that fails when its
  threshold comparison is removed, run as a whole file rather than under `-t`.
- **`COVERAGE_RATIFIED` is pinned by a test**, as `R7_RATIFIED` is, so the caveat
  cannot be dropped by paraphrase (§4.2).
- **The client is tested against recorded fixtures, not the live API.** CLAUDE.md
  §5.1 binds testing as explicitly as anything else: no call without approval,
  and a fixture costs nothing.
- **The redactor gets an adversarial test** with a key embedded in a nested
  `document_path`, asserting it never reaches output.

---

## 10. Out of scope, named so it is not assumed

- **The HigherGov `DocumentClient`.** D2 left it deliberately unbuilt. Nothing
  here changes that; this test reads listings, not documents.
- **Registering a HigherGov adapter** (§7.1).
- **Ingesting anything** — free or paid (§5.1, §5.2).
- **The scheduler.** Ruling ② chose hand-runs; unattended ingestion stays
  deferred to SP7.
- **Operational trust and decision quality.** Set aside by ruling ①. Both remain
  measurable later on the same harness.
- **The other-state adapters themselves.** This test adjudicates whether they are
  needed; it does not build them.
