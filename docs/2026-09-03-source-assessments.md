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

| Source | R1 legal | R2 archive | R3 tier | R4 filters | R5 platform | R6 geo | R7 fields | R8 cost | R9 watermark | ? |
|---|---|---|---|---|---|---|---|---|---|---|
| **HigherGov** | S | **S** | **S** | a | a | a | a | a | **S** | **0** |
| **Indiana EDS contract register** | S | **S** | **S** | a | a | **S** | ? | **S** | **S** | 1 |
| SAM.gov | S | a | **S** | a | a | a | ? | **S** | **S** | 1 |
| Illinois BidBuy | S | **S** | w | **S** | a | a | ? | **S** | ? | 2 |
| Indiana IDOA solicitations | S | w | w | a | a | **S** | ? | **S** | ? | 2 |
| Kentucky eMARS VSS | S | w | w | a | a | a | ? | **S** | ? | 2 |
| USASpending | S | a | **S** | ? | a | a | ? | **S** | ? | 3 |
| Michigan SIGMA VSS | S | w | w | ? | a | **w** | ? | **S** | ? | 3 |
| Corpus import — Indiana open | S | a | w | ? | a | a | ? | **S** | ? | 3 |
| Corpus import — federal calibration | S | a | w | ? | a | a | ? | **S** | ? | 3 |
| **GovWin IQ** · **BidNet Direct** · **BidPrime** · **Ohio OhioBuys** | — | — | — | — | — | — | — | — | — | **DISQUALIFIED on R1** |

---

## Four findings, in the order they matter

### 1. 🔴 The best-scoring free source has never been run

**Indiana EDS contract register: five STRONGs — more than any other source,
including the one we are about to pay for.** Full archive to 2005, tier-1 API,
the Profile's **primary** geography, a verified watermark, and no recurring cost.

**It is also exactly the fix for the two floor predicates that block everything:**
F1 (one source has ever ingested) and F2 (zero ingested sources in Indiana).

It has never been ingested. Nothing technical prevents it; it sits at step ④ of
the sequence Matt set on 2026-09-03, behind the reliability test.

> **This is the single most actionable line in the file.** Not a
> recommendation to jump the sequence — a note that the cost of holding it is
> two failing floor predicates, and that whoever picks up step ④ should start
> here.

### 2. R7 is unknown for NINE of ten scored sources

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
| **P1** | Measure `field_completeness` for SAM.gov from data already held | **zero** — a query | R7 for the source we actually run |
| **P2** | Same for the two corpus imports | **zero** | R7 ×2 |
| **P3** | Record USASpending's watermark and run §5.4's vary-a-parameter check | one probe, free source | R4 + R9 |
| **P4** | Illinois BidBuy: confirm a watermark exists on the Periscope search | one probe, free source | R9, and it is the only non-federal solicitation archive we have |
| **P5** | Indiana EDS register: measure field completeness on a small page | one probe, free source | R7 on the highest-scoring source |
| **P6** | HigherGov: `field_completeness` is `adequate` on a **2026-09-03 measurement of 100 records**. Re-measure only if the reliability test runs | **≤300 records**, needs approval | upgrades R7 |
| — | **Kentucky eMARS** | — | ⚠️ **Do not probe to close R2.** Its row says "INFERRED FROM PLATFORM, not tested". Verifying it costs a tier-3 adapter against a source **outside the firm profile** — see finding 4. The honest action is to leave it `unknown` |
| — | **Michigan SIGMA** | — | ⚠️ **R4 cannot be closed at all.** Totals are withheld, so §5.4's vary-a-parameter check has no number to watch move. `unknown` is the permanent and correct answer here, not a gap |

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
