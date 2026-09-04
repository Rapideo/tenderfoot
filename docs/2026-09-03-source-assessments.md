# Pass 1 — what the registry actually knows

**Run 2026-09-03 against PRODUCTION, read-only, with `npm run fitness`.**
Fourteen sources scored from recorded evidence alone. **No source was probed and
no API call was made to produce this file** — that is what makes it pass 1.

Data-fitness spec §6 predicted the shape of the result:

> *Expect this pass to return mostly `unknown`, and treat that as the finding…
> Pass 1's real output is a map of how little has actually been measured.*

It was right, and the map is more specific than that.

---

## The matrix

`S` strong · `a` adequate · `w` weak · `?` unknown

| Source | R1 legal | R2 archive | R3 tier | R4 filters ✏️ | R5 platform | R6 geo | R7 fields ✏️ | R8 cost | R9 watermark ✏️ | ? |
|---|---|---|---|---|---|---|---|---|---|---|
| **HigherGov** | S | **S** | **S** | a | a | a | ~~a~~ **?** | a | **S** | ~~0~~ 1 |
| **Indiana EDS contract register** | S | **S** | **S** | a | a | **S** | ~~?~~ **S** | **S** | **S** | ~~1~~ **0** |
| SAM.gov | S | a | **S** | a | a | a | ~~?~~ **w** | **S** | **S** | ~~1~~ **0** |
| Illinois BidBuy | S | **S** | w | **S** | a | a | ? | **S** | ? ✔ | 2 |
| Indiana IDOA solicitations | S | w | w | a | a | **S** | ? | **S** | ? | 2 |
| Kentucky eMARS VSS | S | w | w | a | a | a | ? | **S** | ? | 2 |
| USASpending | S | a | **S** | ~~?~~ **S** | a | a | ? | **S** | ~~?~~ **S** | ~~3~~ **1** |
| Michigan SIGMA VSS | S | w | w | ? | a | **w** | ? | **S** | ? | 3 |
| Corpus import — Indiana open | S | a | w | ? | a | a | ? | **S** | ? | 3 |
| Corpus import — federal calibration | S | a | w | ? | a | a | ~~?~~ **w** | **S** | ? | ~~3~~ 2 |
| **GovWin IQ** · **BidNet Direct** · **BidPrime** · **Ohio OhioBuys** | — | — | — | — | — | — | — | — | — | **DISQUALIFIED on R1** |

> ### ✏️ R7 AMENDED 2026-09-04 — measured, and it moved four rows
>
> Migration 026 records the first field-completeness measurement this project
> has ever taken. Read finding 2 below for what changed and why one of the
> movements is a **correction rather than a downgrade**.
>
> **⚠️ HigherGov's `a` was never a measurement.** R7 graded `adequate` for any
> non-null value, and HigherGov's row held prose no grader could read. It now
> reads `?` — which is what "nobody has translated this into the rubric's
> vocabulary" has always actually meant. Its underlying numbers are unchanged
> and remain the best we hold on any source.
>
> **⚠️ `Corpus import — Indiana open` stays `?` and that is now a MEASURED
> answer.** 61 rows is below the population floor of 100; spec §5.3 forbids
> recording too-small as `weak`. Its row records the measurement anyway, so the
> next reader does not repeat the work.

---

## Four findings, in the order they matter

### 1. ✅ RESOLVED THE SAME DAY — the best-scoring free source has now been run

**Indiana EDS contract register: five STRONGs — more than any other source,
including the one we are about to pay for.** Full archive to 2005, tier-1 API,
the Profile's **primary** geography, a verified watermark, and no recurring cost.

**It is also exactly the fix for the two floor predicates that block everything:**
F1 (one source has ever ingested) and F2 (zero ingested sources in Indiana).

~~It has never been ingested.~~ **It was ingested hours after this was written**:
204,920 contracts, 86 seconds, two requests, merged as `bd80e45`. **F1 and F2
both flipped to PASS** — see `docs/2026-09-03-eds-ingest-run.md`.

The line below is kept because it was the point: the cost of holding it was two
failing floor predicates, and that is what the run bought back.

> **This is the single most actionable line in the file.** Not a
> recommendation to jump the sequence — a note that the cost of holding it is
> two failing floor predicates, and that whoever picks up step ④ should start
> here.

### 2. ✅ CLOSED 2026-09-04 for everything we hold data for — and it found a defect in R7 itself

**~~R7 is unknown for NINE of ten scored sources~~ — measured, migration 026.**
Three rows now carry a grade, one records a measurement too small to grade, and
the remaining sources hold nothing on production, so there is nothing to measure
without a probe. The section below is kept as written; the corrections follow it.

> #### 🔴 RECORDING THE NUMBERS WOULD HAVE MADE THE MATRIX WORSE, NOT BETTER
>
> R7 was `field_completeness === null ? unknown : adequate` — **a null check, not
> a grade.** Writing SAM.gov's real numbers under that rule would have graded it
> `adequate` on a p10 of 84 characters, **0 of 7,070 rows carrying a value**, and
> 3 of 979 document-deferring rows readable — level with HigherGov on the one
> dimension where they differ most. §5.3 forbids collapsing `unknown` into
> `weak` because that turns absence of evidence into evidence of absence; this
> was **the same error inverted**, and it flattered every source it touched.
>
> R7 now grades the measurement and takes the **weakest** property, so a rich
> description cannot compensate for an absent value. Thresholds live in
> `fitness/thresholds.ts`, every one marked `UNRATIFIED`, on the same footing as
> the floor's.
>
> #### 📌 SAM.gov's p10 IS 84, WHERE F6 REPORTS 57 — AND BOTH ARE RIGHT
>
> F6 measures **our holdings**: every biddable row from every source, 7,271 of
> them. R7 measures **a source**: SAM.gov's own 7,070. The 201-row difference is
> the two corpus imports, which carry **no descriptions at all**, and they drag
> the global tenth percentile from 84 down to 57. `floor.ts`'s header insists the
> two readings must not be conflated — this is what that looks like in numbers.
> Neither figure is comfortable, but **the published 57 is a blend, not SAM's
> number.**
>
> #### 🔴 AND THE FIRST RUN GRADED THE EDS REGISTER `weak` ON A DELIBERATE DECISION
>
> P14 measured vendor presence as `vendor_id IS NOT NULL`. The register's ingest
> lands the raw vendor name in `source_note` and leaves `vendor_id` NULL on
> **all 204,920 rows**, by a documented v1 ruling — normalising TIMOTHY WARRICK
> against Timothy Warrick, Inc. is its own slice. So the measurement punished a
> decision the project had made on purpose, and would have recorded it as fact.
> Fixed before anything was written; the 204,920 unresolved names are kept as
> evidence, because incumbency means **grouping** a vendor's contracts and nobody
> can group by a name no one has normalised.

<details>
<summary>The original finding, as written 2026-09-03</summary>

**Field completeness has never been measured for anything except HigherGov** —
and HigherGov only because it was measured yesterday, by hand, against a live
key.

**We know more about a source we have not bought than about the one we have been
ingesting for a month.** SAM.gov has produced 9,883 solicitations and its
`field_completeness` is null. F6 and F7 — p10 description of 57 characters, 3 of
979 documents held — are exactly the facts that column exists to hold, and they
live in a floor report rather than on the row.

**This is the cheapest gap on the page to close.** It requires no probe and no
network: the numbers are already in the database.

</details>

**It was the cheapest gap, and the framing was still incomplete.** "The numbers
are already in the database" was true of the *data* and not of the
*measurements* — F6 and F7 aggregate the whole table with no `source_id` at all,
so a per-source reading had to be written. **No API call was made, and none is
needed.**

### 3. R9 is unknown for seven of ten, and two of those are wrong rather than unmeasured

Migration 021 fixed SAM.gov and the Indiana register after the rubric's first run
exposed them — both had a watermark verified in their own `verified_facets` and
never recorded in a column that did not exist until migration 018.

**The remaining seven are genuinely unknown**, and that matters more than it
reads: a source with no watermark forces a full re-read every run. On a free
source that is inefficiency. **On a metered source it is a bill.**

### 4. Michigan is outside the firm profile entirely

`R6 WEAK` — the Profile is `IN` primary, `IL/OH/KY` secondary. **Michigan is in
neither.**

Real work went into it: a legal clearance on the vendor-account reading, a
platform characterisation, a documented silent-failure instance, and the finding
that its totals are withheld so §5.4's check cannot run there at all. The
rubric's flat verdict is that it is a weak source for work we do not cover.

**Worth knowing before anyone budgets a CGI Advantage adapter** — and the same
reasoning reaches Kentucky, whose entire row is Michigan's behaviour assumed to
repeat.

---

## The probe list — pass 2

Ordered by cost. **Two standing constraints bind every line:**

- **R1 first, always.** No probe is constructed for an `out` or `manual-only`
  row. Enforced in `eligibility.ts`, asserted in `check.test.ts`.
- **Scraping runs LOCALLY**, against the `test` branch (Matt, 2026-09-03).
  ⚠️ **And no HigherGov call at all without approval** — CLAUDE.md §5.1, with a
  standing budget of 500 records.

| | What | Cost | Closes |
|---|---|---|---|
| ~~**P1**~~ | ~~Measure `field_completeness` for SAM.gov from data already held~~ **✅ DONE 2026-09-04, migration 026. R7 = `weak`** — p10 84 chars, **0 of 7,070 rows valued**, 3 of 979 documents reachable | **zero, as costed** | ✅ R7 closed for the source we actually run |
| ~~**P2**~~ | ~~Same for the two corpus imports~~ **◐ ONE CLOSED, ONE CANNOT BE.** Federal calibration (140 rows) = `weak`: not one description in the set. Indiana open holds **61 rows — below the population floor**, so §5.3 keeps it `unknown` and the measurement is recorded saying so | **zero, as costed** | ◐ R7 ×1. The second is a measured `unknown`, not an unmeasured one |
| ~~**P3**~~ | ~~Record USASpending's watermark and run §5.4's vary-a-parameter check~~ **✅ DONE 2026-09-04, migration 027. BOTH CLOSE — and it is the best-behaved source we have measured.** §5.4 passed *with a control*; `last_modified_date` is a true watermark | **zero**, as costed | ✅ **R4 STRONG + R9 STRONG** |
| ~~**P4**~~ | ~~Illinois BidBuy: confirm a watermark exists on the Periscope search~~ **✅ DONE 2026-09-04, migration 027 — and the answer is NO.** Neither the filter surface nor the sort surface exposes a modification time | **zero**, as costed | ⚖️ **R9 stays `unknown` — now by measurement.** R4 was already closed |
| ~~**P5**~~ | ~~Indiana EDS register: measure field completeness on a small page~~ **✅ DONE 2026-09-04, and it was FREE — no probe.** The register's 204,920 rows are already ingested on `test`, so this was a query over the whole corpus rather than a sample of one page. **R7 = `strong`** | ~~one probe~~ **zero** | ✅ R7 on the highest-scoring source |
| **P6** | ~~HigherGov: `field_completeness` is `adequate` on a **2026-09-03 measurement of 100 records**~~ **⚖️ NEEDS A RULING, NOT A PROBE — see below.** Its measurement is rich and real; nobody has translated it into the rubric's vocabulary, and doing so from prose would decide something about a $500/yr purchase | **zero** to translate; **≤300 records**, needs approval, to re-measure | R7, once Matt rules |
| — | **Kentucky eMARS** | — | ⚠️ **Do not probe to close R2.** Its row says "INFERRED FROM PLATFORM, not tested". Verifying it costs a tier-3 adapter against a source **outside the firm profile** — see finding 4. The honest action is to leave it `unknown` |
| — | **Michigan SIGMA** | — | ⚠️ **R4 cannot be closed at all.** Totals are withheld, so §5.4's vary-a-parameter check has no number to watch move. `unknown` is the permanent and correct answer here, not a gap |

---

### ✅ P3 AND P4 RAN 2026-09-04 — and they returned opposite answers

**Both free, both local, no API key involved. Migration 027 records them.**

#### USASpending passes §5.4 *with a control*, and it is the first source that does

| | contracts, FY2025 |
|---|---|
| no location filter | **5,782,489** |
| `place_of_performance` state = `IN` | **28,958** |
| state = `ZZ` — **the control** | **0** |

**The control is the part that matters.** A silently-ignored filter returns the
*baseline* for a nonsense value. This returned zero, so the parameter is
genuinely applied and not merely accepted. Every previous §5.4 run in this
project measured a filter that was accepted and ignored — **five instances
across four platforms**, HigherGov included.

**🔴 And a bogus enum is REJECTED, not swallowed.** `date_type=bogus_date_type`
returns **HTTP 400** naming the valid values. Nothing else in this registry has
been shown to fail loudly, and a source that does is worth more than one that
does not.

**R9 closes with a real watermark.** `last_modified_date` works *both* ways —
it is a `date_type` the search filters on, and it is exposed per row as
`Last Modified Date` with timestamp precision:

| `date_type` | Indiana contracts, Jan 2025 |
|---|---|
| *omitted* | 5,828 |
| `action_date` | 2,018 |
| **`last_modified_date`** | **1,826** |
| `date_signed` | 1,865 |

> ⚠️ **The omitted default matches NONE of the three named types.** Whatever it
> means, it is not one of the documented values. **An adapter must pass
> `date_type` explicitly** — omitting it filters on semantics nobody here has
> established.

**📌 `probe_url` is not the endpoint the probe used**, and that was checked
before writing: `/search/spending_by_award_count/` is POST-only and answers GET
with **405**, so recording it would have made the health prober report this
source `failing` forever. It carries `/api/v2/awards/last_updated/` instead,
which returns `{"last_updated":"09/04/2026"}` — **a stale value there is itself
the §5.4 rot signal**, which is better than a reachability ping.

#### Illinois BidBuy has no watermark, and `openingDateFrom` is the trap

The advanced search offers **exactly two date controls** — `Opening Date From`
and `Opening Date To` — and *"modified"* appears **0 times in 263,822 bytes**.
The results-grid sort is equally complete and equally unhelpful: Bid
Solicitation #, Organization Name, Buyer, Description, Bid Opening Date, Status,
Alternate Id.

**⚖️ `openingDateFrom` was ruled out before the probe ran** (Matt, 2026-09-04).
It is already in this row's verified `works` list, so writing it into
`watermark_field` would cost nothing and would grade **R9 `strong`**. **An
opening date is not a modified date.** A run resuming on it collects
newly-opened solicitations and **silently misses every amendment** — addenda,
deadline changes, cancellations — which is exactly the quiet loss §5.4 exists to
catch. A column that makes the rubric say `strong` about a resume that loses
data is worse than a null.

> #### 🔴 AND THAT EXPOSES THE SAME DEFECT R7 HAD, ONE DIMENSION OVER
>
> R9 reads `watermark_field IS NULL ? unknown : strong` — **a null check.** So
> BidBuy, where we have now *established* no watermark exists, is graded
> identically to Kentucky eMARS, which nobody has ever looked at. **Measured
> absence and never-looked are not the same fact**, and R7 carried exactly this
> defect until 2026-09-04.
>
> **Not fixed here, deliberately** — it is a second dimension's grading rule and
> was not in the approved scope of these probes. Flagged rather than folded in.

---

### ⚖️ THE ONE THING THIS PASS WOULD NOT DECIDE — HigherGov's R7

**Added 2026-09-04.** Migration 026 records four sources and deliberately leaves
HigherGov alone. Its row holds a real measurement; what it does not hold is a
property map a grader can read. Translating it is **free and needs no API call**
— and two of the three judgements change what a paid source looks like:

| | The arithmetic | Why it is not mine to make |
|---|---|---|
| **P6** | **34 of 100 feed rows carry no description**, so the feed's tenth percentile is **0 characters** and P6 grades `weak` | Not in doubt as arithmetic. But migration 019's own comment forbids the flattering alternative — quoting the answer-key subset's p10 of 436 as if it described the feed is *"the error this column exists to prevent"* |
| **P8** | `val_est` present on **92 of 100** → `strong` | 019's caveat: `val_est_low/high` are **INFERRED BANDS, not published figures**, and *"must never be written into value_cents beside sourced facts"*. Grading a modelled value as value presence launders derived data into a measured fact |
| **P7** | `document_path` on **100 of 100** → the source can reach a document for every row | Reachable at **~11 records per fetch**. Whether "supplies a route" counts as document reachability is a definition question, not a measurement |

**Under weakest-wins those produce R7 `weak` for HigherGov.** That may well be
the truth — the missing-description rate **is** the open question STATUS carries
as *"the description ruling"* — but it is a judgement about a $500/yr purchase,
read out of prose. CLAUDE.md is explicit that a conflict of this shape is
surfaced for Matt rather than resolved quietly in either direction, so R7 stays
`unknown` until he rules. **`unknown` blocks; it does not flatter.**

---

**Note what the last two rows are doing.** A probe list that tried to turn every
`?` into a grade would spend real effort on sources the rubric has already graded
weak, for work outside the Profile. **`unknown` is sometimes the finished
answer**, and saying so is the difference between a work list and a wish list.

---

## What pass 1 does NOT say

- **It does not rank sources for purchase.** It describes them. §5.1: the rubric
  scores sources, never opportunities, and it produces no aggregate.
- **It does not re-open the four disqualified rows.** GovWin IQ, BidNet Direct
  and BidPrime are `out` by their own terms; Ohio OhioBuys is CAPTCHA-gated and
  `manual-only`. §5.5.1 says documented permission moves a source, and none has
  been obtained. *(HigherGov is the standing proof that the door works — it moved
  on an attorney's clearance, recorded on the row.)*
- **It does not measure our holdings.** That is the floor's job, and the floor
  currently fails five of seven predicates and blocks adjudication by rule.
