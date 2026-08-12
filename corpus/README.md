# Corpus — real solicitations for the hand-run

**Started:** 2026-08-04
**Purpose:** Phase 0 input #5 (`docs/Proto2PRD.md` §4.2, `docs/Tenderfoot-Plan-of-Action.md` A1)

Real, downloaded solicitations — not invented samples. IMPACT's prototype used realistic-but-
fictional data; Tenderfoot's can be genuine, and should be, because the entire product is about
judging documents. Real RFP titles run 140 characters, real scopes are badly formatted, and
real portals list walleye fingerlings next to Medicaid quality reviews. Invented data is neat,
and neat data hides every problem the extraction layer has to survive.

## What this feeds — four downstream consumers, one collection effort

| Consumer | Component | What it needs from here | V1? |
|---|---|---|---|
| Prototype mock layer | Stage A7 | Realistic records of realistic length and messiness | Yes |
| Extraction accuracy test | 5D | Hand-labeled field values to measure against | **Yes — and it is now the main event** |
| ~~Few-shot example set~~ | ~~3K~~ | ~~Bid/no-bid decisions with reasons, in Matt's words~~ | **No — parked 2026-08-11** |
| Adjudication baseline | 5B / 5C | Ground truth for ~~precision and~~ **discovery** | Yes, narrowed |

> **Revised 2026-08-11 — matching is parked; V1 returns everything** (spec §1.1). Two consumers change.
>
> **The few-shot set has no consumer.** Nothing scores, so nothing takes examples. Reasons are still recorded — they are problem #4, the system of record — but as free text feeding no model.
>
> **Precision leaves the adjudication baseline; discovery stays.** A system that returns everything makes no selection to be judged, so its Interested rate is just the base rate of the sources. Discovery — *would have pursued, had not otherwise seen* — is unaffected by the parking and becomes the whole measure (§8.3).
>
> **Extraction is promoted.** With no scores, extracted fields are the only thing V1 can be right or wrong about, which makes hand-labeled ground truth the most valuable thing this corpus holds.

This is why the hand-run (Stage A2) comes before any code: one pass produces all four.

**How the hand-run is actually run, as of 2026-08-10.** Not by editing `manifest.md` — in a
click-through page covering all 216 rows across the three corpora, keyboard-driven, persisting
to the browser, exporting markdown in `manifest.md`'s format. Two people are scoring
independently and **every export is attributed**, because two judgments cannot be merged into
one ground truth without knowing whose is whose.

**Score the same rows twice where you can.** Inter-rater disagreement is the ceiling on
achievable precision — no scorer beats the rate at which two experienced people disagree — and
the rows they split on are the most valuable few-shot examples in the set. Knowing that number
before the engine exists is worth more than the hour it costs.

> **Still true 2026-08-11, and worth more than before.** V1 has no scorer (spec §1.1), so there
> is no precision ceiling to measure *yet* — but that is exactly why this number should be
> captured now. It is a fact about **KP and the market**, not about any engine, and it does not
> expire. When qualification is eventually designed, the first honest question anyone can ask is
> *how much better than two disagreeing experts does this need to be*, and that answer will
> either exist already or be unobtainable in retrospect.

## The band column is a prediction, not a filter

Every row carries a **band** — my guess at whether KP could plausibly bid it:

- **A — Plausible.** Professional services in or adjacent to KP's stated lines.
- **B — Edge.** Genuinely ambiguous. Could go either way on scope, scale, or eligibility.
- **C — Out.** Commodity goods, construction, clinical staffing, or otherwise categorically not KP.

**The bands are a hypothesis to falsify, not a shortcut.** They exist so Matt spends his time
where the judgment is hard, but the C band still gets spot-checked — because a real fit sitting
in band C is the single most valuable data point the hand-run can produce. It is precisely the
silent-recall failure the whole system is designed to prevent (§6.2).

**Disagreements between the band and the verdict are the most informative rows here.** They are
the training signal.

## Structure

```
corpus/
  README.md            this file
  manifest.md          the index — one row per solicitation, with hand-run columns
  FINDINGS.md          what the real documents taught us
  indiana/             fetched detail + documents
  federal/             fetched detail + documents
  calibration/         24 months of closed federal solicitations, added 2026-08-10
  indiana-contracts/   Indiana's executed-contract register, added 2026-08-10
```

**Three corpora, and they are not interchangeable.** Mixing their samplings would produce
measurements that look rigorous and mean nothing, so each directory states its own regime:

| Directory | What it is | Sampling | May produce a precision figure |
|---|---|---|---|
| this one (`manifest.md`) | Open solicitations, fetched 2026-08-04 | Everything published that day | Yes |
| `calibration/` — enriched | 80 closed federal solicitations | Ranked toward KP's service lines | **No** |
| `calibration/` — unbiased | 60 closed federal solicitations | Seeded random | Yes |
| `indiana-contracts/` | 2,160 contracts expiring within 18 months | All matching agencies in window | N/A — not solicitations |

`indiana-contracts/` is a different *kind* of record: executed contracts, not opportunities. It
feeds the Expiration Radar (§4.6) and Winnability (incumbent identity, whether the work was
competitively bid, incumbent M/WBE status), not the bid/no-bid hand-run.

## Source access notes

Both verified working 2026-08-04, no credentials required:

- **Indiana IDOA** — `in.gov/idoa/procurement/current-business-opportunities/` is
  anonymous-readable HTML. Each event links a `.zip` of bid documents at
  `/idoa/proc/solicitations/files/<eventID>.zip`. Confirms the §5.8 tier-3 assessment.
- **SAM.gov** — `sam.gov/api/prod/sgs/v1/search?index=opp` returns JSON without an API key.
  Richer than expected: NAICS, PSC, set-aside status, place and period of performance,
  evaluation criteria, attachments, and modification history.

**Note the Indiana coverage floor (§5.8):** only solicitations expected to exceed $75,000 are
publicly posted. Everything here is above that line by definition.
