# The sub-state answer key — the segment HigherGov was bought for

**Design spec, 2026-09-07.** Brainstormed with Matt the same day, after ruling D12
named the buyers and the exploration found the volumes that changed the shape.

> **⚖️ FIDELITY MANDATE (CLAUDE.md §1) — NOT APPLICABLE, and named so a future
> reader knows it was considered.** This slice builds no UI: one parser, one
> registry, two schema changes and a measurement path. CLAUDE.md §3 records that
> SP6 went wrong because neither its spec nor its plan mentioned the mandate
> once; naming it here is the cheap insurance against repeating that.

---

## 1. What this fixes, and why the coverage test does not work without it

`npm run recall` grades **weakest-segment-wins** across two segments,
`state_agency` and `sub_state`. Only the first exists. `idoaKeyFrom` hardcodes
`segment: "state_agency"`, so the sub-state segment has never had a single row.

**That means every verdict the tool can currently produce is about Indiana state
agencies — and HigherGov was bought for sub-state coverage.** Ruling ③ (spec
2026-09-06 §2) exists precisely to stop this test producing a confident number
about the wrong segment; until this slice lands, that is exactly what it does.

---

## 2. What the exploration found, because it changed the design twice

Four facts, each verified rather than assumed, in the order they mattered.

### 2.1 The join key works, and this repo already half-knew it

Allen County's live bid IDs on 2026-09-07 are `126, 132, 133, 134, 135`.
Migration 022, written 2026-09-03, records: *"Allen County, arriving through
HigherGov, publishes external ids `132`, `134`, `135`."*

**Same notices, same ids, four days apart.** HigherGov's `source_id` for a
sub-state buyer *is* that buyer's own `bidID`. The comparison this slice depends
on is possible, and that is now measured rather than hoped.

### 2.2 Four of the named buyers share one platform, and so do two more

`Bids.aspx` on **CivicEngage** (CivicPlus), with a `bidID` query parameter, is
the same page shape at every one of:

| Buyer | Host | Confirmed |
|---|---|---|
| Allen County | `allencounty.in.gov` | 5 open, ids to ~135 |
| City of Fort Wayne | `cityoffortwayne.in.gov` | 0 open; sorts by bid number |
| Tippecanoe County | `tippecanoe.in.gov` | 0 open, ids to ~27 |
| Town of Zionsville | `zionsville-in.gov` | 2 open, ids to ~57 |
| City of Carmel | `carmel.in.gov` | CivicEngage confirmed |
| City of Noblesville | `noblesville.in.gov` | CivicEngage confirmed |

**This is the finding that made the slice affordable.** "Three parsers for three
buyers" was the wrong frame — CivicEngage is a *platform*, so it is **one parser
plus a registry of hosts**, and a seventh buyer costs a row rather than a
rewrite.

> ⚠️ **R4 says sub-state coverage is "the property no scraper strategy fixes",**
> citing Indianapolis as 9 rows on a bespoke `indy.gov` table, shelved as
> disposable. **That judgement is amended, not overturned: no BESPOKE-PER-BUYER
> strategy fixes it.** A platform strategy is a different proposition and this
> slice is its first real test.

### 2.3 🔴 The volumes make a prospective census impossible

Open bids across the named buyers at one moment: **5, 2, 0, 0.** Historical id
ceilings of ~135, ~57 and ~27 imply each buyer posts on the order of **10–25
notices a year**.

Six buyers at that rate is **one to two new sub-state notices per week.** A
cohort of 100 — the floor Matt ruled in D9 — would take **over a year.**

**Building the parsers to watch for new notices would have produced a segment
that reports `unknown` indefinitely.** Four scrapers, no verdict.

### 2.4 …but the archive is free and enumerable, which rescues it

`bidID` is **sequential per buyer**, closed postings are retained behind a
*"Show Closed/Awarded/Cancelled Bids:"* control, and Hamilton County's own URL
exposes the query form directly:

```
Bids.aspx?CatID=showStatus&txtSort=Category&showAllBids=on&Status=open
```

So the history is reachable **by URL, at zero cost** — no form postback, and no
metered call, because the buyer's own site is free.

**The census therefore runs BACKWARDS, not forwards.** A few hundred historical
notices are available immediately, against a HigherGov archive reaching 2013.
C1 (was it carried at all) answers directly. C2 answers too: `captured_date` and
the deadline are both historical facts and neither decays.

---

## 3. Two defects this slice must fix before it adds a single row

Both were found by the whole-branch review of the coverage slice and deferred as
theoretical. **Section 2.1's measurement makes both concrete.**

### 3.1 🔴 The cohort floor is global; the verdict is per-segment

`measure.ts` computes `bigEnough` from the **total** settled cohort, while
`scoreSegment` scores **any** segment holding one or more rows. Nothing requires
a segment to be large enough before it sets the grade.

**Concretely: 100 IDOA notices plus 5 sub-state notices clears C4, and then one
miss among those five reads as 80% recall, fails C1, and un-shelves the adapter
backlog.**

That is D9's own granularity argument arriving through a door the floor does not
cover — and D9's reasoning applies *per segment*, because the arithmetic it
described ("at n=30 one notice moves recall 3.3 points") is a property of the
segment that sets the verdict, not of the total.

**Fix: the floor becomes per-segment, at the same ratified value.** A segment
below `minCohortSize` cannot set C1 or C2. It is reported explicitly as
`below floor (n=…)`, never omitted — the final review of the coverage slice
already established that an unmeasured segment must be visible rather than
inferred from an absence.

**C4 keeps reporting the TOTAL settled cohort and gains a per-segment line.**
It does not become a per-segment predicate. Two reasons: the total is still the
honest answer to "how much have we measured", and splitting C4 into two
predicates would renumber a family Matt has already ratified. So C4's `measured`
is unchanged and its `detail` names each segment's size against the floor —
which is also where a reader learns that a segment exists but cannot yet grade.

⚠️ **Same value, per segment — not a new number.** `minCohortSize` is ratified
at 100 (D9) and is reused unchanged. This spec introduces **no new threshold**
and therefore nothing new for Matt to ratify; it changes only *what the ratified
number is measured against*, which D9's own granularity argument already assumed
it was.

⚠️ **This makes the tool HARDER to satisfy, and that is the point.** Both
segments must reach 100 before a binding verdict exists. Sub-state gets there
via §2.4's retrospective census; without that, this fix alone would freeze the
verdict at `unknown` forever.

### 3.2 🔴 `coverage_item`'s key has no buyer namespace

The primary key is `(run_id, external_id)`. Sub-state `bidID`s are **small
sequential integers** — Allen County is at 132, Zionsville at 57, Tippecanoe at
27. Collisions are not unlikely; they are close to guaranteed once a second
buyer is added.

A collision rejects the insert **mid-write, after the records were spent** —
which is money lost to a schema constraint.

`source.external_id_scope` (migration 022) exists for exactly this: sub-state
ids are `local`, not `global`, and migration 022 cites these very buyers.

**Fix: migration 032 makes the key `(run_id, key_origin, external_id)`**, and
`gradedItems()`'s `DISTINCT ON` and `run.ts`'s settled-set query group by the
same pair. `external_id` keeps holding the **vendor's raw id**, unprefixed,
because that is the value the HigherGov lookup sends.

---

## 4. 🔴 The hazard this slice creates, and it has no verified answer yet

Sub-state ids are local. So **`fetchBySourceId("132")` may return Allen County's
notice, or a different agency's notice that happens to also be numbered 132.**

A false positive here is worse than a miss: it records `carried` for a notice
HigherGov never had, inflating C1 in the flattering direction, on the segment the
whole purchase rests on.

**The disambiguator is `agency_key`.** R1 lists it among `/opportunity/`'s twelve
accepted parameters, so it is a real filter. What is **not** verified is the
field's name and shape *in the response*, or the `agency_key` value for any of
the six buyers.

**Binding requirement: the probe must verify the returned notice belongs to the
buyer it was asked about, and that verification must be built from one observed
real response — never a guessed field name.** Until that response is observed,
this slice does not run against sub-state ids at all.

Discovering the six `agency_key` values costs records and needs its own proposal
under CLAUDE.md §5.1. It is deliberately **out of this spec's scope**: this spec
builds the free half and stops at the point where money starts.

---

## 5. What gets built

| File | Responsibility |
|---|---|
| `app/server/migrations/032_coverage_item_origin_key.sql` | The composite key (§3.2) |
| `app/server/src/coverage/civicengage.ts` | One parser: a CivicEngage `Bids.aspx` page → key entries |
| `app/server/src/coverage/substate-buyers.ts` | The registry: six buyers, host, label, archive URL |
| `app/server/src/coverage/answer-key.ts` | Gains `subStateKeyFrom`; `idoaKeyFrom` unchanged |
| `app/server/src/coverage/measure.ts` | The per-segment floor (§3.1) |
| `app/server/src/coverage/run.ts` | Origin-aware settled set and `gradedItems` |

**Not built here, and named so it is not assumed:** the HigherGov `agency_key`
discovery (§4), any change to `maxRecordsPerRun`, and any live call.

### 5.1 The parser is free and offline-testable

`parseCivicEngagePage(html, origin)` is pure — HTML in, `KeyEntry[]` out, exactly
the shape `parseIdoaPage` set. Fixtures are captured from the six real pages and
committed, so the whole parser is tested without a network.

Each entry carries `segment: "sub_state"` and `keyOrigin` = the buyer's host, so
§3.2's key is populated from the parse rather than assembled at the call site.

### 5.2 The deadline parser needs one new dispatch case, not a new parser

`closesAt(sourceName, raw)` dispatches on a source-name string. CivicEngage
renders closings as `9/15/2026 9:00 AM` — **US month/day/year, but with a space
before AM/PM and no seconds**, which IDOA's regex deliberately refuses (its own
header explains why a partial match must return null rather than guess).

**A new case is added to `closes-at.ts` for the CivicEngage shape**, keeping its
existing discipline: the full shape or null, never a lenient parse. Writing a
second date parser inside `civicengage.ts` is forbidden for the reason
`answer-key.ts` already records — two implementations of one question drift, and
the drift is silent.

---

## 6. Cost

**The free half is genuinely free.** Six buyers × one archive page each, plus
per-notice detail pages if the listing lacks a deadline: municipal sites, no
meter, no key.

**The metered half is one id lookup per sub-state notice** — free when HigherGov
does not carry it, one record when it does (CLAUDE.md §5.1: the meter counts
records *returned*).

| | Records |
|---|---:|
| A ~150-notice retrospective census, worst case | **~150** |
| Against `MONTHLY_RECORD_CEILING` (ratified 1,000) | 15% |
| Against `maxRecordsPerRun` (**40, unratified**) | **~4 runs** |

⚖️ **`maxRecordsPerRun` STAYS AT 40 — ruled by Matt, 2026-09-07.** The census
takes about four runs instead of one. It costs patience and nothing else: the
`unchecked` state and the accumulating cohort were built for exactly this, and
leaving a money cap where he put it is worth more than a faster first answer.

---

## 7. Testing

- **The parser is pinned against committed fixtures from all six real pages** —
  not one, because the whole premise is that the platform renders identically
  and that claim deserves six witnesses rather than an assumption.
- **A fixture with zero open bids is required** (Fort Wayne and Tippecanoe were
  both empty when captured). An empty listing must yield an empty key, never a
  parse error — and never a silent zero that reads as a real census.
- **The per-segment floor gets a mutation test**: a 5-row sub-state segment
  beside a 100-row state segment must NOT set the verdict. Delete the per-segment
  check and that test must fail.
- **The composite key gets a collision test**: two buyers, same `external_id`,
  both rows must persist.
- **`closesAt`'s CivicEngage case is pinned to exact values**, not just to the
  ISO shape — the coverage slice's review found a format-only assertion that a
  constant date offset would have passed.
- **No test may make a live API call**, and none needs to: every path in this
  slice is either pure or reads a committed fixture.

---

## 8. What Matt still owns

1. **The `agency_key` discovery (§4)** — it costs records, so it is proposed
   separately with a count, per CLAUDE.md §5.1.
2. **Whether six buyers is the final list.** Hamilton County is confirmed on the
   same platform and is not in the six; adding it costs one registry row.
3. **`maxRecordsPerRun`** remains unratified. §6 assumes it stays 40.

---

## 9. Out of scope, named rather than assumed

- **Fishers.** Dropped from v1 by Matt's ruling, 2026-09-07, reversing his own
  D12 pick. It migrated off CivicEngage to WordPress and returned **403 to an
  automated fetch** — one observation, not a verdict, but it is the one named
  buyer needing bespoke work and the least likely to repay it.
- **Any live HigherGov call**, including the `agency_key` discovery.
- **Ingesting sub-state notices.** Same rule the coverage slice set: the answer
  key is a measurement, never a holding. Nothing here writes `solicitation` or
  `sighting`.
- **The forward-looking census.** §2.3 shows it cannot grade this segment on any
  useful timescale. Once the retrospective census lands, new notices accumulate
  through the existing mechanism at no extra cost.
