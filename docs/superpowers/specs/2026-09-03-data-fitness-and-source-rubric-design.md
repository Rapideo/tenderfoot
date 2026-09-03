# Data fitness and the source rubric — design

**Written 2026-09-03.** Produced by three rulings Matt made the same day, on the
decision sheet at `https://claude.ai/code/artifact/f1049cb5-9c75-4604-9917-758c40fe33c8`.

| | Ruling | What it settles |
|---|---|---|
| **1A** | The contract corpus is **evidence toward a qualification design that does not yet exist** | Ingest proceeds. **Nothing scores, nothing filters, no control is wired.** §7.10 clause 2 stays intact |
| **2C** | The fitness statement carries **both the floor and the target**, one spec in two parts | The gap between them *is* the roadmap |
| **3A** | **Effort moves to data; triage stays live.** No new UI slices | Sample 2 keeps running as the detector |

**Standing instruction, same day:** *"we should always do scraping locally unless
otherwise specified."* Recorded here because it changes where the work in §6 runs.

---

## 1. The shape: three views of one list

The single most useful thing this spec does is notice that the floor, the target
and the rubric are **not three documents. They are three readings of one list of
data properties.**

```
        THE PROPERTY LIST  (§2)
        what "good data" consists of
                  |
     +------------+------------+
     |            |            |
   FLOOR        TARGET       RUBRIC
   (§3)          (§4)         (§5)
     |            |            |
  scores        defines      scores
  OUR           the full     A SOURCE
  HOLDINGS      set          on how much
                             it can supply
```

- **The property list** is the vocabulary. Nothing else introduces a property.
- **The floor** asks: *of these properties, which do we hold enough of that a gate
  decision can be trusted?* It scores **us**.
- **The target** is the whole list, unconstrained by what is currently obtainable.
  It scores **nobody** — it is the definition.
- **The rubric** asks: *how much of the list can this source supply, at what cost,
  under what legal posture?* It scores **a source**.

**Consequence worth stating plainly:** a property may never appear in the rubric
without appearing in §2 first. That is what stops the rubric drifting into a
scorer for opportunities.

---

## 2. The property list

Each property carries a **measurement** — how it is read from a source or from our
own holdings — because a property that cannot be measured cannot be scored, and
this project has already paid for the difference between a fact and a measurement.

| | Property | Measurement | Why it is on the list |
|---|---|---|---|
| **P1** | **Source plurality** | count of sources with ≥1 successful `ingest_run` | D27: *a layer is only proven source-agnostic by a second source.* An elegant abstraction at N=1 is a hypothesis |
| **P2** | **Jurisdictional reach** | distinct `jurisdiction` among ingested sources, against the Firm Profile's `geography` | Primary is `IN`; secondary `IL, OH, KY`; federal true |
| **P3** | **Archive depth** | how far back closed/awarded records are retained | §5.1 promoted this to a primary selection criterion. It is the difference between a source you can backtest and one you can only accumulate |
| **P4** | **Coverage continuity** | consecutive periods with ingestion, no gaps | Plan of Action §6.4: *a GO/NO-GO measured during a window in which a source was silently dead is a measurement of an outage* |
| **P5** | **Deadline integrity** | rows whose deadline is usable — present, or absent and known to be | The 62-notice recall loss. Now handled; the property stays, because the class of defect recurs |
| **P6** | **Description sufficiency** | median and p10 description length on biddable rows | Sample 2's median is 515 chars with 6 of 25 under 200. A triage decision needs something to read |
| **P7** | **Document reachability** | for rows whose description defers to a document, the share where we hold it | Thin descriptions say *"see SOW and additional items list"* — the list we do not have |
| **P8** | **Value presence on OPEN notices** | share of open biddable rows with a value | §8.5 asks for discovery **weighted by value**. Without it the gate's own measure is uncomputable |
| **P9** | **Decision volume** | count of real triage decisions | Interested-per-hundred cannot be computed by any amount of engineering. Only a person produces it |
| **P10** | **Sub-state coverage** | presence of city / county / school-district buyers | The one thing no scraper strategy fixes cheaply |
| **P11** | **Capture latency** | captured-at minus posted-at | Median lead time is 11 days, p25 = 7. Three days late spends a quarter of the window |
| **P12** | **Filter honesty** | §5.4's vary-a-parameter test | Four instances across three platforms of a parameter accepted and ignored |
| **P13** | **Incremental resumability** | is there a watermark that permits resuming rather than re-paging? | `since = last successful run` is the rule; a source without a watermark forces full re-reads |
| **P14** | **Contract / award history** | depth of awarded work with vendor, value and end date | The expiration radar, incumbency, and the only route to real values |
| **P15** | **Own bid history** | KP's own past bids and outcomes | **Currently empty by decision.** `firm_profile.past_performance` is NULL — *"records not accessible (§7.3). Stays empty by decision."* `negative_profile` lost its last source 2026-08-11 |

> ⚠️ **P15 is on the list precisely because it is empty.** *"Refine the methodology
> based on past bids"* cannot mean KP's past bids today. The Indiana register
> supplies **the market's** history, not KP's. Conflating the two would put a score
> on the wrong ground truth, and naming P15 separately is what prevents that.

---

## 3. Part 1 — The Floor

### 3.1 The floor is BINDING, with one release valve

**Ruled 2026-09-03.**

> **No GO / NO-GO adjudication may be taken while a floor predicate fails.**
>
> **The valve:** every predicate must name what would make it achievable. A
> predicate that proves **structurally unachievable from any available source** is
> promoted into the Target (§4) rather than vetoing indefinitely.

**Why binding.** An advisory floor is a list of regrets. The whole reason this
exists is that "our data doesn't feel robust" was a feeling for weeks; the floor's
job is to make it a verdict.

**Why the valve.** Without it, P8 alone would block the gate forever — SAM
publishes no estimate for open notices, and no amount of work changes that. The
valve is what makes a binding rule honest rather than a permanent veto.

**Worked example of the valve, and it is a real one.** P8 (value on open notices)
was a floor candidate. Settled 2026-09-01 by payload audit: SAM publishes
`award.amount` on 361 of 1,724 sampled rows, tracking Award Notices almost
exactly — *it is what somebody already won.* **P8 is therefore promoted to the
Target.** It returns to the floor only if a source is admitted that supplies it.

### 3.2 The predicates

> ⚠️ **The predicates are the design. The thresholds are a RULING and are marked
> `proposed` below.** A floor with unratified thresholds is not yet binding.
> Matt rules the numbers; nothing here presumes them.

| | Predicate | Property | Threshold | Measured 2026-09-02 | Verdict |
|---|---|---|---|---|---|
| **F1** | ≥ N sources have completed a real ingest | P1 | `proposed: 2` | **1** — SAM.gov, alone, for the system's entire life | 🔴 **FAIL** |
| **F2** | The Profile's **primary** geography is represented | P2 | `proposed: ≥1 ingested source with jurisdiction = IN` | **0 Indiana rows.** Two Indiana sources sit healthy, enabled=no, never run | 🔴 **FAIL** |
| **F3** | No silent recall loss from unusable deadlines | P5 | `0 rows dropped without surfacing` | **Held.** `EFFECTIVE_CLOSES_AT` treats impossible as unknown; `DEADLINE_UNRELIABLE` tells the client. Shipped `7964047` | ✅ **PASS** |
| **F4** | Coverage is continuous over the adjudication window | P4 | `proposed: no gap > 7 days across the window` | **3 usable weeks** (08-10, -17, -24). Earlier weeks read 1–3 rows — our scrape history, not the market | 🔴 **FAIL** |
| **F5** | Enough decisions to compute Interested-per-hundred | P9 | `proposed: 100` | **3** (sample 1). Sample 2 drawn at 100, decided 0 | 🔴 **FAIL** |
| **F6** | Biddable rows carry a readable description | P6 | `proposed: p10 ≥ 200 chars` | **8,484 of 9,883** carry any. Sample 2: 100/100 present, median 515, **6 of 25 under 200** | 🟡 **MARGINAL** |
| **F7** | Where a description defers to a document, we hold it | P7 | `proposed: ≥ 80%` | **12 documents across 9,883 solicitations** | 🔴 **FAIL** |

### 3.3 What the floor says today

**Five fail, one is marginal, one passes.** The honest reading:

> **No GO / NO-GO can be adjudicated today**, and the two decisive failures are
> not about volume. **F1 and F2 say the same thing in two ways: the system has
> only ever read one federal source, and KP's home state has contributed nothing.**
> Any verdict taken now would be a verdict on federal SAM.gov alone, and should
> say so in exactly those words.

`docs/2026-09-01-gate-measurements.md` already reached that conclusion in prose.
**The floor's contribution is to make it a rule instead of an observation** — and
to make F3 visible as the one thing that has actually been closed.

---

## 4. Part 2 — The Target

The full property list, unconstrained by what is obtainable today. **The target
does not fail. It defines the gap.**

| Property | Target state | Gap today | Nearest route |
|---|---|---|---|
| P1 Source plurality | 3+ ingested, ≥2 platforms | 1 | Indiana EDS register; Illinois BidBuy |
| P2 Jurisdictional reach | `IN` + federal at minimum; `IL/OH/KY` present | federal only | as above |
| P3 Archive depth | a backtestable archive in the primary geography | none in `IN` for solicitations | **Indiana has no solicitation archive.** Its Phase 0 runs on contracts instead (§5.8) |
| P8 **Value on open notices** | present on a majority of biddable rows | **0 of 9,883** | *Promoted here by the §3.1 valve.* Document extraction, the Indiana register's `amount`, or a paid feed |
| P10 Sub-state coverage | Indiana cities, counties, districts | none | No cheap scraper route. Indianapolis alone was 9 rows, mid-migration to OpenGov. **This is what a paid aggregator would be bought for** |
| P11 Capture latency | < 24h behind posting | unmeasured | HigherGov's SLED endpoint claims a 20–30 min refresh — *our own notes disagree on which* |
| P14 Contract/award history | vendor, value and end date at depth | `contract` has never held a row | **Indiana EDS: ~205k records, a PDF each** |
| P15 Own bid history | KP's bids and outcomes | **empty by decision** | Not a source problem. Requires a decision to reopen §7.3 |

> ⚠️ **P14's value field is a trap already documented.** Indiana's `amount` is EDS
> form field 6 — a **per-amendment delta that goes negative**. It is not a contract
> value. The running total is field 7 and exists **only inside the PDF**. A target
> that says "Indiana supplies values" without this caveat is wrong.

**The gap between §3 and §4 is the roadmap** — which is what ruling 2C bought.

---

## 5. Part 3 — The Rubric

### 5.1 Scope, stated first because it is the thing that will drift

> **The rubric scores SOURCES. It never scores opportunities.**
>
> §7.10 clause 2: *"A rendered control may never become an active filter, ranking,
> or score without qualification being designed first."* Ruling 1A keeps
> qualification undesigned. **A rubric that begins ranking which contracts are good
> is the parked design under another name** — and calibration data is precisely
> what makes that commit tempting.
>
> **Test:** every rubric dimension must take a *source* as its subject. If a
> dimension's sentence reads naturally with a solicitation as its subject, it does
> not belong here.

### 5.2 The registry is already this rubric's data model

Six of the nine dimensions score columns that **already exist** on `source`. The
rubric is a scoring function over metadata the project has been collecting since
SP1 — not a new metadata regime.

| | Dimension | Source of truth | Status |
|---|---|---|---|
| **R1** | Legal posture | `source.legal_posture` | ✅ exists — **a GATE, not a score.** `out` disqualifies outright |
| **R2** | Archive depth (P3) | `source.archive_depth` | ✅ exists |
| **R3** | Adapter tier / cost to build | `source.adapter_tier` | ✅ exists |
| **R4** | Filter honesty (P12) | `source.verified_facets` | ✅ exists |
| **R5** | Platform leverage | derived from `source.platform` | ✅ derivable — §5.7: one Periscope adapter also reaches AR and MT |
| **R6** | Jurisdictional relevance (P2) | `source.jurisdiction` × `firm_profile.geography` | ✅ derivable |
| **R7** | Field completeness | P6, P7, P8, P11, P14 measured against the source | 🔴 **no column** |
| **R8** | **Cost** | — | 🔴 **NO COLUMN EXISTS.** Every source to date has been free |
| **R9** | Incremental resumability (P13) | — | 🔴 no column |

**R8 is the notable one.** HigherGov would be the **first source that costs money**
($500/yr), and BidNet Direct is now known to be $500–$2,000/yr (Matt, 2026-09-03 —
the first pricing datum this project has ever held). **A rubric without a cost
dimension cannot rank a paid source against a free one**, which is the exact
comparison about to be run.

*Three small migrations, then — R7, R8, R9. They are not part of this spec's
scope decision; they are named so the plan can size them.*

### 5.3 Scoring

**Ordinal, not numeric, and deliberately.** Each dimension resolves to one of
`strong` / `adequate` / `weak` / `unknown`, with `unknown` a first-class value.

**Why not a weighted number.** A single score invites exactly the arithmetic this
project has ruled against elsewhere — it would let a strong archive silently
compensate for a failing legal posture, and it would make the rubric look like a
qualification engine. **R1 is a gate; the rest are a profile.** A source is
described, then judged by a person.

**`unknown` is not `weak`.** Kentucky's registry row reads *"INFERRED FROM
PLATFORM, not tested."* Ohio's archive depth is *"Unknown — not reachable to
test."* Recording those as `weak` would convert an absence of evidence into
evidence of absence, which is §5.4's silent-failure argument applied to our own
paperwork.

### 5.4 The acceptance test

The rubric is calibrated only if, run cold, it reproduces judgements already made:

1. **It must reject `Indiana IDOA solicitations`** — 71 open rows, no archive, no
   history. Red-flagged 2026-09-02 *after* a full adapter slice was built against
   it (673 tests, unmerged). **That slice is the cost of not having this rubric**,
   and reproducing the rejection is the minimum bar.
2. **It must rank `Indiana EDS contract register` highly** — full archive, tier 1
   API, `in` posture, primary geography, ~205k records.
3. **It must rank `GovWin IQ`, `BidNet Direct`, `BidPrime` as disqualified on R1
   alone**, without reaching any other dimension.
4. **Once `docs/2026-09-03-platform-comparison.md` is filled in, the rubric's
   ranking of HigherGov must agree with the measured result.** If it does not, the
   rubric is wrong, not the measurement.

---

## 6. The assessment procedure

**Two passes. The first one's blanks are the second one's work list.**

**Pass 1 — score from recorded evidence only.** Twelve subjects: the eleven
registry rows plus HigherGov. No probing, no network. Where the registry records a
fact, score it; where it does not, record `unknown`.

> **Expect this pass to return mostly `unknown`, and treat that as the finding.**
> Kentucky is inferred, never tested. Ohio is unreachable. USASpending has never
> been probed. Illinois has a verified archive depth and no adapter. **Pass 1's
> real output is a map of how little has actually been measured.**

**Pass 2 — probe to close the blanks.** Ordered by cost, and constrained by two
standing rules:

- **R1 first, always.** No probe is constructed for an `out` or `manual-only` row.
  That is enforced in `eligibility.ts` and asserted in `check.test.ts`, and the
  rubric does not get to relax it.
- **Scraping runs LOCALLY** (Matt, 2026-09-03), against the `test` branch — local
  `DATABASE_URL` has pointed there since 2026-08-28, with production behind the
  explicit `DATABASE_URL_PRODUCTION`. **This supersedes the 2026-08-15 ruling that
  long ingestion runs on Vercel.**

> **For the Indiana register this is a requirement, not a preference.**
> `RUN_HANDLER_BUDGET_MS` is 180s against a 300s platform ceiling. 204,991 rows is
> thousands of requests and tens of minutes. **It cannot run in a function.**

**Where an assessment lands.** On the `source` row, not only in a document —
`source_note` and `legal_note`, with the date and the reading applied (§5.5.1).
*A decision nobody wrote down is indistinguishable from one nobody made.*

---

## 7. What this spec does not do

- **It does not design qualification.** Ruling 1A keeps it parked. No dimension
  here scores an opportunity, and §5.1 is the test that keeps it that way.
- **It does not rank sources for purchase.** It describes them. The buy decision is
  Matt's, informed by the comparison sheet.
- **It does not change the queue, the card, or any screen.** Ruling 3A: no new UI
  slices. The floor is measured by query, not by a dashboard — **the Status
  Dashboard stays parked** (`docs/Pinned-Status-Dashboard.md`).
- **It does not re-open the three `out` aggregators.** §5.5.1 says documented
  permission moves a source to `in`; none has been obtained. The rows stand.

---

## 8. Open questions, carried rather than resolved

1. **The thresholds in §3.2 are proposals.** F1 = 2 sources, F5 = 100 decisions,
   F6 = p10 ≥ 200 chars, F7 = 80%. Each needs a ruling.
2. **What is the adjudication window F4 measures continuity over?** The floor
   cannot say "no gaps" without saying "over what."
3. **Does a failing floor block the *contract* work too, or only the GO/NO-GO?**
   Reading here: **only the GO/NO-GO.** The contract ingest is how F1 and F2 get
   fixed, so blocking it on them would be circular. Stated for confirmation.
4. **R7/R8/R9 need columns.** Three small migrations, unsized.
5. **P15 — KP's own bid history — is empty by decision (§7.3).** Nothing here
   proposes reopening it. It is on the list so that "calibrate against past bids"
   is never read as available when it is not.
