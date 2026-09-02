# The GO / NO-GO gate — first real measurements

**Measured 2026-09-01 against PRODUCTION**, 9,883 solicitations / 11,121 sightings.
Every number below is read-only except where the backfill is called out. This
file exists because these are the first figures the gate has ever produced from
the real corpus, and because **three of the gate's inputs still cannot be
computed at all** — which is a finding, not a delay.

---

## What the gate asks

**Plan of Action §6.-1**, verbatim:

> does reading everything from active sources surface work KP would pursue **and
> had not otherwise seen**?

**Design spec §8.5** names the measure:

> Discovery — qualified opportunities surfaced that would not have been seen,
> **weighted by value** — *"Yes — and it is the whole measure"*

And §6.-1 names the two numbers SP6 must produce because nothing else will:
**volume per source per week**, and **Interested-per-hundred per source**.

---

## ✅ What is now measured

### Volume per source per week — SAM.gov

| | |
|---|---|
| All notices, week of 2026-08-24 | **7,614** |
| Biddable that week (`Solicitation` / `Combined Synopsis/Solicitation` / `RFP`) | **4,549** |

⚠️ **Only three weeks have usable coverage** (2026-08-10, -17, -24), because those
are the windows ingestion actually ran. Weeks before that read 1–3 and that is our
scrape history, not the market. The series is bounded by coverage, not by volume.

### Lead time — and the first version of this number was wrong

| | days |
|---|---|
| posted → closes, p25 | 7 |
| **posted → closes, median** | **11** |
| posted → closes, p75 | 15 |

*(n = 7,670)*

⚠️ **The obvious query gives 8 days and means nothing.** First-*sighting* → deadline
computes to a median of 8, but "first sighting" is when **we scraped**, and
ingestion has run about three times — so it measures our own cadence, not the
market. `posted_at → closes_at` is the real number. Same class of error
`posted-at.ts` was written for, one level along.

**Eleven days is the "finding out too late" pain, quantified.** A quarter of the
market closes within a week of being published.

### The notice mix — 26% of the queue cannot be bid on

| Kind | n | share |
|---|---:|---:|
| Combined Synopsis/Solicitation | 4,215 | 42.6% |
| Solicitation | 2,043 | 20.7% |
| **Award Notice** | **1,875** | **19.0%** |
| **Special Notice** | 576 | 5.8% |
| Presolicitation | 493 | 5.0% |
| Sources Sought | 459 | 4.6% |
| **Justification** | 156 | 1.6% |
| RFP *(corpus import)* | 61 | 0.6% |
| **Sale of Surplus Property** | 4 | 0.0% |

**~26% are Award Notices, Special Notices, Justifications or surplus sales** —
announcements, not opportunities. A further ~10% (Presolicitation, Sources
Sought) are pre-bid. **Ruled 2026-09-01: the queue does not filter them** (spec
§1.1), so the gate's Interested-per-hundred will be computed over a denominator
that includes them, and whoever adjudicates will press Pass on award notices.

### Sizing the haystack — a SIGNAL, never a filter

The firm profile carries PSC codes `R408 R410 R422 R499 B506`, and its own note
says: *"Codes are a SIGNAL, never a filter."* Reported here as sizing only —
nothing filters on it, and this is not a qualification rule.

| One week, posted ≥ 2026-08-24 | n |
|---|---:|
| Biddable | 4,549 |
| …carrying a KP PSC code | **49** |

**≈1.1%.** Roughly **ten a working day** — which is the first evidence that a
triage habit is even physically possible against this firehose.

---

## ❌ What still cannot be computed, and why

### 1. Interested-per-hundred — no data exists

`pursuit` on production is **empty**: 0 rows, 0 distinct solicitations. The
"rate over five decisions" recorded elsewhere was never on production. This
number requires a person triaging a real sample and nothing else can produce it.

### 2. Discovery — "had not otherwise seen" is not captured anywhere

§8.5 calls this **the whole measure**. Nothing in the schema or the UI records
whether an item was already known to KP, so the gate **cannot answer its own
question** no matter how much triaging happens. Designing that capture is a
design decision and is not pre-specified here.

### 3. Value weighting — not available, and this is now settled

§8.5 asks for discovery **weighted by value**. `value_cents` is **0 of 9,883**.
The 2026-09-01 payload audit established this is not a dropped field: SAM
publishes `award.amount`, present on 361 of 1,724 sampled rows and tracking the
359 **Award Notices** almost exactly — it is what somebody already won.
**SAM does not publish an estimate for open notices.** Value weighting cannot be
unblocked from listing metadata; it would need document extraction, which is
parked. Recorded as deviation D-note in `listing-facts.ts`.

---

## ⚠️ The precondition, and it fails

Plan of Action §6.4: *"A GO / NO-GO measured during a window in which a source
was silently dead is not a measurement of the market; it is a measurement of an
outage."*

It is not an outage. **Only one source has ever been ingested.**

| Source | health | enabled | last run |
|---|---|---|---|
| **SAM.gov** | ok | **yes** | 2026-08-28 |
| Indiana IDOA solicitations | ok | no | **never** |
| Indiana EDS contract registry | ok | no | **never** |
| Illinois BidBuy | ok | no | **never** |
| Kentucky eMARS VSS | unknown | no | never |
| Michigan SIGMA VSS | unknown | no | never |
| USASpending | unknown | no | never |
| *(6 others)* | excluded | no | never |

**"Per source" is one federal source.** The Indiana state sources — healthy,
enabled=no, never run — are arguably KP's core ground and have contributed
nothing. Any GO/NO-GO taken today is a verdict on federal SAM.gov alone, and
should say so in those words.

---

## The backfill this required, recorded because it wrote to production

`posted_at` was **140 of 9,883** before today. The fix shipped 2026-08-31 but the
backfill only happens when the merge **runs**, and it had not run on production
since. Volume-per-week — a required gate output — was therefore uncomputable.

`mergeSightings()` run against production 2026-09-01, on Matt's approval:

```
created 0   updated 0   linked 0   orgsAttached 0
postedSet 9682   kindsSet 9682   codesSet 9557   setAsidesSet 5158
```

**Nothing created, nothing relinked, no titles altered** — every one of the
11,121 sightings was already linked, so this could only fill nulls. `posted_at`
140 → 9,822; `kind` 201 → 9,883; `codes` 140 → 9,697; `set_aside` 0 → 5,158.

> 💡 **The general lesson, and it has now cost twice.** A merge-layer fix changes
> nothing until the merge is re-run against the database in question. Shipping
> the code and deploying it is not the same act as backfilling the data, and the
> gap is invisible: production looked fine and simply had no posting dates.

---

## What a GO / NO-GO can honestly say today

**It can say:** the federal firehose is ~4,550 biddable notices a week; the
market closes in a median of 11 days; ~26% of what arrives cannot be bid on; and
about 49 a week — ten a working day — touch KP's own service codes.

**It cannot say:** whether any of it is work KP would pursue (no decisions), nor
whether any of it is work KP **had not otherwise seen** (not captured), nor what
any of it is worth (not published). The first needs a triage session. The second
needs a design decision. The third is closed by evidence.
