# Platform comparison — the scoresheet

**Created 2026-09-03. HIGHERGOV WAS RUN THE SAME DAY — see [RESULTS](#results--the-run-happened-2026-09-03).**

This file is both the instrument and the record: the answer key, the protocol, the
scoresheet, and what came back. The protocol below still stands unrun for the other
three candidates, which remain `out` by their own terms.

> **▶ If you are here for the outcome, skip to `RESULTS`.**
> Headline: **coverage recall 69/70 (99%), relevance recall 5/5**, Indiana archive
> back to **2013** where IDOA publishes none at all, **34/100 sub-state buyers**,
> and the quota confirmed to count records *returned* — and a **leaked API key**
> whose handling rules are in §R0 and bind any code we write against this API.
>
> **Read §R11 before quoting any fill rate.** The headline 69/69 figures describe
> IDOA-matched state notices; feed-wide, only **66%** of rows carry a description
> at all, and **42%** for the sub-state buyers this is being bought for.

**Fill it in AS YOU GO.** A comparison reconstructed after the fact is an
impression, and an impression is exactly what this exercise exists to replace.

---

## Why this exists

Matt, 2026-09-03:

> *"I am going to create a Trial Account with HigherGov, and then manually run
> some tests with it and the other platforms, and see, with the same parameters,
> if they are all yielding similar quality results."*

The registry holds four paid candidates, and **three of them are `out` by their
own terms** — GovWin IQ, BidNet Direct, BidPrime (§5.5, §5.5.1). Only HigherGov
has the documented permission §5.5.1 requires (Matt's attorney cleared storing
their data in our own store). **That is the whole reason it is the live candidate
— not price, and not the API.**

**First pricing datum this project has ever held for a paid aggregator:** Matt,
2026-09-03, **BidNet Direct is $500–$2,000/yr.** That puts it in HigherGov's
range ($500/yr), so **price is not the discriminator. API access and coverage
are** — which is what this sheet measures.

> ⚠️ **Buying a subscription is not the same act as scraping.** §5.5's finding is
> that these three *prohibit scraping*; §5.5.1's rule is symmetric and says
> documented permission moves a source to `in`. If a licensed API plus permission
> is obtained for any of them, the exclusion is revisitable. **Until then the
> `out` rows stand and the health checker must never issue a request to them** —
> that guard is enforced in `eligibility.ts` and asserted in `check.test.ts`.

---

## The answer key, and where it came from

**71 Indiana solicitations, captured 2026-09-02** from the IDOA current-business-
opportunities page. Parsed here with the project's own `parseIdoaPage`, and the
counts reconcile exactly with the IDOA slice's ledger: **71 items, 70 of 71 with
a 15-digit Event ID, 66 of 71 with a Bid Documents link.**

> 🔴 **THE KEY IS FRAGILE, WHICH IS WHY IT IS COPIED IN FULL BELOW.**
> `idoa-listing.html` exists **only on the unmerged `idoa-adapter` branch**
> (`8eba870`); `main`'s fixtures directory holds only `sam-listing.json` and
> `usaspending-listing.json`. The live capture `runs/idoa-live-1917.html` is in an
> **untracked** directory — on one laptop and nowhere else. **The table below is
> the durable copy.** If the branch is ever discarded, this file is the ground
> truth.

### Three properties that change how the key must be read

**1. It decays. As of 2026-09-03, one of the 71 is already past its due date**
(item 1, due 8/26). Every other date parses and is still in the future. **Run the
comparison this week**; by October the key measures history, not coverage.

**2. It is not all Indiana. Item 1 is a State of NEW YORK solicitation**
(Office of General Services, "RFP 23420 Group 71022 — Business Consulting
Services"), advertised on Indiana's page — almost certainly a cooperative or
piggyback contract. It is also the one row without a 15-digit Event ID.
**A platform scoped to Indiana that misses it has not failed.** Score it
separately or exclude it; do not count it as a miss.

**3. It is heavily skewed, so recall against it measures BREADTH, not FIT.**
Nineteen distinct agencies, but **36 of 71 — over half — are Natural Resources**,
mostly small facilities and equipment work. The rows closest to KP's actual market
are the two **FSSA Medicaid Policy & Plan** items and a handful of consulting-shaped
notices.

> **Therefore score two numbers, not one.**
> **Coverage recall** — how many of the 70 Indiana items does the platform have?
> **Relevance recall** — how many of the KP-shaped subset does it have?
> A platform can win the first and lose the second, and the second is the one that
> decides whether $500 buys anything.

### The KP-shaped subset, named so it is not re-argued each time

Judged against the Firm Profile's capabilities and NAICS
(`541611 541612 541618 541690 541720 611430`). **Four core, two edge cases.**

| # | Agency | Event name | Why |
|---|---|---|---|
| **29** | FSSA Medicaid Policy & Plan | External Quality Reviews for MCO Programs | **The bullseye.** Program evaluation + managed care operations. `corpus/FINDINGS.md` calls it *"the closest thing to a bullseye in the whole corpus"* — and it is the same notice that carries the three-PDFs-two-deadlines finding |
| **71** | FSSA Medicaid Policy & Plan | Indiana Medicaid Managed Care Organizations | Managed care operations, squarely in profile |
| **26** | FSSA Mental Health & Addiction | CMHW Case Management System (Tobi) | Care-management workflow redesign — though procured as a *system*, so partly IT |
| **14** | Family & Social Svcs Admin | Community Supports IT Systems | Adjacent; IT-shaped but in KP's agency and domain |
| *1* | *(New York)* | *Business Consulting Services* | *Exactly the service, wrong jurisdiction. Edge case — see property 2 above* |
| *63* | *Correction* | *RFP DOC Correctional Health Services* | *Clinical delivery rather than advisory. Probably not KP; judge it once and record the call* |

> ⚠️ **Relevance recall is directional, not statistical.** With a denominator of
> four, one miss is 25%. **Coverage recall is the number with power**; relevance
> recall is the number that tells you whether the coverage is pointed anywhere
> useful. Report both, and do not dress the second up as a rate.

**Note the ratio, because it is the real finding.** Four to six genuinely
KP-shaped notices out of 71 is **6–8%** of Indiana's open state solicitations —
against **≈1.1%** of the federal firehose carrying a KP PSC code. The haystack is
proportionally friendlier at state level, and it is still mostly hay.

---

## The protocol

**Same parameters everywhere.** Indiana, state and local, open solicitations,
no keyword filter on the first pass. Then repeat with KP's NAICS codes
(`541611 541612 541618 541690 541720 611430`) applied.

### ⚠️ The check that must not be skipped — §5.4

**This project has caught four separate instances, across three platforms, of a
filter being accepted and silently ignored.** SAM.gov accepted four spellings of a
date parameter and ignored all of them. Michigan returned byte-identical result
sets for three different `Show Me` values. **A paid feed gets no exemption — if
anything the stakes are higher, because you will trust the output more.**

**On every platform, for every filter you use:**

1. Note the unfiltered count.
2. Apply the filter. **Confirm the count MOVES.**
3. Confirm a known-excluded item is **genuinely absent**, not merely unshown.

A filter that does not move the count is being ignored. Record the result in the
`§5.4 filters honoured?` row of the summary table — **an unfilled cell there
invalidates every number above it**, because a platform that silently ignores the
state filter is being scored on a national result set.

### One trial-account warning — ✅ OVERTAKEN 2026-09-03

~~**Free HigherGov accounts appear not to include API access.**~~ **A trial key
DID carry API access**, obtained and exercised the same day. The rest of this
warning is kept because one half of it is still live:

A UI trial would not have answered the make-or-break unknown — whether
server-side filtering means only *matches* count against the 10,000/month quota,
or whether the quota dies on the first pull. **That question is STILL OPEN**, and
§R5 says why: the quota counter is not observable from any API response. It is
settled by reading the account dashboard, not by another call.

Their pricing page (10,000/month) and API README ("no data limits") still
disagree.

> ✅ **SETTLED 2026-09-03 — it is 20 minutes.** Their own docs give opportunity
> refresh as 20 minutes and contract/grant/awardee as daily. The line below
> recorded the disagreement; this line closes it. `progress.md:288` is wrong.
>
> ⚠️ **One more disagreement, and it is OURS, not theirs.** The SLED refresh
> interval is recorded as **20 minutes** at `2026-09-02-idoa-adapter/progress.md:218`
> and as **30 minutes** at `:288` — same file, seventy lines apart. Settle it
> during the trial before either number is quoted as fact.

**Ask for API trial access explicitly.** And in the same email, ask the two
questions that would change the ranking on their own:

- **Do SLED records carry an estimated value on OPEN notices?**
- **Do they carry document / attachment URLs?**

---

## What to score, and why each one is on the list

Each dimension maps to a hole this project can name and measure today.

| # | Dimension | Why it is here — the number it would fix |
|---|---|---|
| 1 | **Coverage recall** | of the 70 Indiana items. The headline |
| 2 | **Relevance recall** | of the KP-shaped subset. The one that decides the purchase |
| 3 | **Value on OPEN notices** | `value_cents` is **0 of 9,883**. SAM publishes an amount only on notices somebody already won. This blocks §8.5's value-weighting outright — if one platform carries estimates, that alone may decide it |
| 4 | **Documents / attachments** | we hold **12 documents across 9,883 solicitations**. Thin descriptions usually say *"see SOW and additional items list"* — the list we do not have |
| 5 | **Description completeness** | sample 2's median description is **515 characters, with 6 of 25 under 200**. Compare the SAME notice across platforms |
| 6 | **Sub-state coverage** | cities, counties, school districts. **This is the thing no scraper strategy fixes** — Indianapolis alone was 9 rows and mid-migration to OpenGov |
| 7 | **Capture latency** | captured-at vs. posted-at. Our own median lead time is **11 days, p25 = 7** — a platform three days behind has spent a quarter of the window |

---

## Summary sheet — fill this in

Leave a cell blank rather than guessing. A blank is information; a guess is not.

| | HigherGov | BidNet Direct | BidPrime | GovWin IQ |
|---|---|---|---|---|
| Price observed | $500/yr (recorded 09-02, unverified) | **$500–$2,000/yr** (Matt, 09-03) | | |
| API at this tier? | **YES — tested 2026-09-03** | | | |
| Legal posture today | **`in`** — attorney sign-off | `out` | `out` | `out` |
| **1. Coverage recall** /70 | **69 / 70 — 99%** | | | |
| **2. Relevance recall** | **5 / 5** | | | |
| 3. Value on open notices | **92/92 on real notices** (0/8 on forecasts) — ⚠️ inferred bands, not published | | | |
| 4. Attachments present | **69/69** carry `document_path` | | | |
| 5. Median description chars | **930** on IDOA-matched rows; **feed-wide only 66% carry one at all** — 42% for sub-state buyers (see R11) | | | |
| 6. Sub-state coverage | **34/100**, 33 distinct agencies | | | |
| 7. Capture latency | posted 2026-09-03 seen same day | | | |
| **§5.4 filters honoured?** | **MIXED — `source_type` yes, `pop_state`/`state`/`place_of_performance_state` SILENTLY IGNORED** | | | |
| Verdict | **Buy** — see the results section below | | | |

> **The three `out` columns are for the record only.** Filling them in requires a
> licensed subscription, not a scrape. If a column gets filled, §5.5.1 says the
> posture is revisitable **and the evidence goes on the registry row** — a
> decision nobody wrote down is indistinguishable from one nobody made.

---

---

# RESULTS — the run happened, 2026-09-03

**Trial key obtained and tested the same day. ~260 records of the 10,000/month
allowance spent.** Everything below is measured, not quoted from documentation.

> ⚠️ **A CREDENTIAL WAS LEAKED AND ROTATED DURING THIS RUN. Read §R0 first** —
> it is the most reusable thing on this page.

---

## R0. The API key is a URL parameter, and that leaked it

**HigherGov authenticates by query string — `?api_key=...` — not by header.**
Worse, **the `document_path` field in every opportunity response contains the key
in plaintext**, because it is a pre-signed call-back URL into the Document
endpoint.

**What happened.** Claude wrote a `scrub()` helper, applied it to every error
path, and then printed response field *values* raw — thinking of the key as
something in the REQUEST, not something that comes back in the RESPONSE. The live
key printed in full into a session transcript.

**Rotated the same hour, and the revocation was PROVED, not asserted:** the burned
key now returns `403 {"detail":"Please provide a valid API key"}` where a live key
returns `400` on parameter validation. *(Contrast the `test`-branch rotation of
2026-08-14, which could only ever be asserted because the old string was
overwritten before it was captured. Lesson §2.16 holds: a revocation is proved by
the OLD key failing.)*

### The rules this buys, and they are binding on any HigherGov code

1. **Scrub at the boundary, never at the call site.** One recursive redactor that
   walks every value before anything is printed. A per-branch scrub is how half a
   secret escapes.
2. **`document_path` is a CREDENTIAL, not a URL.** It must never be logged,
   printed, or written to the database as-is. If documents are ingested, the path
   is used and discarded inside the request.
3. **Never build the URL inline in a shell command.** `curl` with the key in the
   argument list puts it in shell history and process listings. Build the URL
   inside a script from `process.env`.

---

## R1. §5.4 caught something, on a paid API

| Parameter | HTTP | count for `captured_date=2026-09-02` |
|---|---|---|
| *(none — baseline)* | 200 | **5,266** |
| `pop_state=IN` | 200 | **5,266** ← unchanged |
| `state=IN` | 200 | **5,266** ← unchanged |
| `place_of_performance_state=IN` | 200 | **5,266** ← unchanged |
| `source_type=bogus_value` | 200 | **0** ← the positive control |

**Three state parameters accepted and silently ignored.** The bogus `source_type`
returning `0` is what proves the method rather than the plumbing: an ignored
parameter returns the full 5,266, so `source_type` *is* honoured while the state
filters are not.

**This is the FIFTH instance in this project, across FOUR platforms, and the first
on a PAID API.** A subscription buys no exemption from the check.

**Confirmed from their own OpenAPI schema** at
`https://www.highergov.com/api-external/schema/` (JSON only with an
`accept: application/json` header; `curl` gets YAML). `/opportunity/` takes
exactly twelve parameters and **none is a location**:

```
agency_key · api_key · captured_date · opp_key · ordering · page_number
page_size · posted_date · search_id · source_id · source_type · version_key
```

So the guesses were not unlucky. **There is no state filter by query parameter —
only through a saved search**, whose full (undocumented-on-the-docs-page)
support list is:

> Active, Applicant Type (Grant Only), Agency, CAGE Code, Date Due, Date Posted,
> Exclude Sole Source, Funding Category, Funding Instrument, Grant Program,
> Keywords, NAICS, NSN, Place of Performance (Federal Contracts Only), PSC,
> Set Aside, **State (State and Local Only)**, and Value Range

### ⚠️ The UI offers filters the API does not support

Matt's screenshot of the UI filter menu (2026-09-03) lists six fields absent from
that support list: **Agency Distribution, Agency Type, Match, Product/Service,
Exclude No Bid, My Favorites.**

Their wording is *"currently supported"*, which implies unsupported fields are
**silently dropped when the saved search is used through the API** — the same
silent-ignore behaviour as `pop_state`, one level up and much harder to notice.
A search narrowed in the UI to 40 rows could return thousands through the API,
with a 200 and no warning.

**UNVERIFIED. Verify before any saved search we depend on uses those fields.**

> 🚫 **`Match` MUST NOT be used as a filter.** It is HigherGov's own fit score.
> Wiring it into an ingest imports someone else's qualification engine wholesale —
> exactly what design spec §7.10 clause 2 and ruling 1A keep parked. Fine to look
> at; never a filter.

---

## R2. The comparison, against the 71-item answer key

**Method: exact `source_id` lookup, one call per item.** HigherGov's `source_id`
for Indiana records **IS IDOA's own 15-digit Event ID** — verified on four items
before the run, which turned a fuzzy title match into an exact test and cost ~70
records instead of a 300-record sweep.

**This method bypasses `search_id` entirely, so these two numbers are unaffected
by whatever the saved search contains.**

| | |
|---|---|
| **Coverage recall** | **69 / 70 — 99%** |
| **Relevance recall** | **5 / 5** |
| Only miss | *"2-year Contract for Locksmith/Safe Services"*, Motor Vehicles Comm |

The single miss is a genuine absence, not an artifact, and is not KP-shaped.

### Indiana fill rates, n = 69 — the earlier caveat is now closed

*(The first fill-rate sample had no Indiana rows in it — CT/MS/WA/CA/NY/TX/LA.
These are Indiana.)*

| Field | HigherGov (Indiana) | Tenderfoot production |
|---|---|---|
| `description_text` | **69/69** · p10 **436** · median **930** · min 110 | 8,484 of 9,883; sample-2 median 515, **6 of 25 under 200** |
| `val_est_low` / `val_est_high` | **69/69, every one > 0** | **0 of 9,883** |
| `document_path` | **69/69** | **12 of 9,883** |
| `due_date` | 69/69 | — |
| `set_aside` | 69/69 | — |
| `ai_summary` | 65/69 | — |

**Their p10 description is more than double the floor threshold proposed for F6
(200 chars).** Ours has six rows under 200 in a sample of twenty-five.

---

## R3. 🔴 INDIANA HAS A SOLICITATION ARCHIVE AFTER ALL — and three documents say otherwise

The saved search returns **9,286 Indiana records reaching back to 2013**,
continuous from 2017. IDOA itself publishes **71 open notices and no archive of
any kind**.

**Three places now hold a superseded claim and need amending:**

1. `003_seed_source_registry.sql`, the `Indiana IDOA solicitations` row —
   *"NONE. Closed solicitations are not published -- Indiana cannot be backtested
   on the solicitation side (§8.2)."*
2. Design spec **§5.8** and the §5.7 platform table — *"**No.** Closed
   solicitations are not published."*
3. Design spec **§10.2** — *"Indiana remains the exception — no solicitation
   archive, which is why its Phase 0 runs on contract data."*

Each is **still true of IDOA** and **no longer true of Indiana**. The correction
is that the archive exists at an aggregator, not at the source.

> **This is the same shape of finding as Illinois BidBuy on 2026-08-12**, which
> the spec still calls "THE FIND OF 2026-08-12" for overturning *"solicitation-side
> backtesting is federal-only."* **Indiana Phase 0 no longer has to run on
> contract data.**

---

## R4. Sub-state coverage — the property no scraper strategy fixes

**100 most recent Indiana records: 34 distinct agencies, ≥32 of them sub-state.**

> Allen County · Tippecanoe County · City of Fort Wayne · City of Fishers ·
> City of Columbus · Town of Zionsville · Indianapolis Airport Authority ·
> Indianapolis Department of Public Works · Ivy Tech Community College ·
> University of Indiana

For contrast, the direct route to one of those: **Indianapolis alone was 9 rows on
a bespoke `indy.gov` HTML table, mid-migration to OpenGov, and was shelved as
disposable** (STATUS, 2026-09-02). Here it arrives inside a feed already being
pulled for the state.

**Also found: `sled_forecast` is a real `source_type`** — 8 of those 100 — and it
is **not in the documented enum** (`sam, dibbs, sbir, grant, sled`). That is the
pre-RFP / forecast layer design spec §4.6 asks for, arriving without being asked
for. Another doc-versus-reality gap, in our favour this time.

---

## R5. Volume and the quota

**One day, all states, unfiltered — `captured_date=2026-09-02`: 5,266 records.**

| `source_type` | count |
|---|---:|
| `sam` | 2,282 |
| `dibbs` | 1,525 |
| **`sled`** | **1,317** |
| `sbir` | ~124 |
| `grant` | 18 |

SLED alone is ~40,000/month against a **10,000/month** allowance — **4× over**.
Filtering is mandatory, not a convenience.

**Filtered, it is comfortable:** `search_id` + `captured_date=2026-09-02` returned
**5** Indiana records for that day. A full Indiana backfill is ~9,286 — roughly
**93% of one month's allowance, once** — and the steady state is single digits per
day.

> ⚠️ **The quota counter is NOT observable from the API.** `meta` carries only
> `{pagination: {page, pages, count}}`. Whether the allowance counts records
> RETURNED or records MATCHED cannot be read from a response. **Check the account
> dashboard against this run's ~260 records** — if it reads ~260, filtering is
> quota-safe and the arithmetic above holds. If it reads thousands, it does not.
> **This is the last unverified assumption in the buy case.**

---

## R6. What is wrong with the data, recorded now rather than discovered later

- **`val_est_low`/`val_est_high` are INFERRED BANDS, not published figures.** Ten
  records returned only **six distinct** `val_est_low` values — `1500000` three
  times, `250000` and `350000` twice each. SAM publishes no estimate for open
  notices (settled by our own payload audit), so HigherGov cannot be reporting
  one; it is modelling it. **Useful for §8.5, which asks for weighting rather than
  accounting — but it is DERIVED data and must carry its own origin.** Writing it
  into `value_cents` beside sourced facts is exactly the provenance error
  `extracted_field.origin` and `precedence.ts` exist to prevent.
- **Titles carry a scraping artifact.** `"300 SP Salamonie Sludge and WW
  RemovalBid Documents"` — the anchor text is glued onto the title. Our own
  `parseIdoaPage` handles this correctly by taking the first anchor's text, so we
  can detect and repair it.
- **Duplicate records.** Several `source_id` lookups returned `count=2`. Versioning
  (`version_key`), and it needs a dedup rule before ingest.
- **`captured_date` is documented for `/sl-contract/` and rejected by it** —
  `400 "At least one valid parameter must be included."` `start_date` works. The
  documented parameter set and the real one differ.
- **Refresh cadence settled: 20 minutes** for opportunities, daily for
  contract/grant/awardee. *This resolves our own internal disagreement —
  `2026-09-02-idoa-adapter/progress.md` said 20 minutes at line 218 and 30 at line
  288. Twenty is right.*

---

## R7. 🔑 THE OTHER FIND — `/api-external/sl-contract/`

Not looked for; turned up in the schema. **State and local CONTRACTS**, live and
tested:

```
state_abr · source_id · solicitation_key · highergov_key · agency_raw ·
awarding_agency · awardee_raw · awardee · awardee_parent · awardee_hq_state ·
awardee_hq_city · description · award_amount · start_date · end_date ·
captured_date · po_flag · award_type · url · contact_*
```

**That is the expiration radar as an API, across every state** — the roadmap idea
Matt raised the same morning (`docs/Pinned-Expiration-Radar.md`). Three reasons it
matters:

1. **It maps almost one-to-one onto the empty `contract` table.** `external_id` ←
   `source_id`, `vendor_id` ← `awardee_raw`, `org_id` ← `agency_raw`, `starts_at` ←
   `start_date`, `ends_at` ← `end_date`, `value_cents` ← `award_amount`.
2. **`award_amount` is a published fact, not a band.** Unlike `val_est_*` on open
   notices — and unlike Indiana's EDS register, where `amount` is a per-amendment
   delta that goes negative and the running total lives only inside the PDF.
3. **`solicitation_key` links a contract back to the solicitation that produced
   it** — design spec §4.3's Solicitation → Award → Contract chain, pre-built.

**It does not retire the Indiana EDS register** (204,991 rows, a PDF each, back to
2006). It covers four states instead of one and hands over the value field the
register makes you open a PDF to find. **Worth its own assessment.**

---

## R8. What this does to the floor

Three predicates in
[`the fitness spec`](superpowers/specs/2026-09-03-data-fitness-and-source-rubric-design.md)
become achievable in a single move:

| | Predicate | Today | With HigherGov |
|---|---|---|---|
| **F1** | ≥2 sources ingested | 🔴 1 | ✅ a second source exists and is legally `in` |
| **F2** | Primary geography represented | 🔴 0 Indiana rows | ✅ 9,286 available |
| **F7** | Documents where a description defers | 🔴 12 of 9,883 | ✅ `document_path` on 69/69 |

And **P8 (value on open notices) may come off the Target and back to the Floor** —
with the §R6 caveat that what returns is an estimate, and must be marked as one.

---

## R9. ✅ RESOLVED — the keyword filter changed nothing, and the quota is confirmed

The saved search was rebuilt state-only on 2026-09-03 and **both numbers were
re-taken against it.**

| | before (keyword ✓) | after (state only) |
|---|---|---|
| Indiana archive total | 9,286 | **9,286 — identical** |
| Oldest record | 2013-06-19 | **2013-06-19 — identical** |
| Sub-state buyers per 100 | 32 | **34** |
| `pop_state` of all 100 rows | IN | **IN — filter still holding** |

So the keyword filter was inert with respect to the API result. **9,286 is the
total, not a floor**, and R3 and R4 stand as measured.

### ✅ And the quota question is CLOSED

**The account dashboard read exactly 260** after a run this file independently
tallied at ~260. **The allowance counts records RETURNED, not records MATCHED.**

That was the last unverified assumption in the buy case, and it holds:

- a full Indiana backfill costs **~9,286 — about 93% of one month, once**
- steady state is **single digits per day** (5 Indiana records on 2026-09-02)
- **filtering genuinely protects the allowance**

---

## R11. 🔴 CORRECTION — the fill rates in R2 do not describe the whole feed

**R2's `69/69` figures are real but narrow.** They describe notices matched by
`source_id` against the IDOA answer key — i.e. **state-agency notices that IDOA
itself publishes.** Across the broader Indiana feed, including the sub-state
buyers that are the whole reason to buy, **description coverage is much worse.**

**100 most recent Indiana records, broken out:**

| Segment | n | `description_text` | `val_est_low` | `document_path` | `due_date` | median desc |
|---|---:|---:|---:|---:|---:|---:|
| **ALL** | 100 | **66** | 92 | **100** | **100** | 815 |
| `sled` (real notices) | 92 | 58 (63%) | 92 | 92 | 92 | 680 |
| `sled_forecast` | 8 | 8 | **0** | 8 | 8 | 1,313 |
| …state agency | 66 | 47 (**71%**) | 66 | 66 | 66 | 716 |
| …**sub-state buyer** | 26 | 11 (**42%**) | 26 | 26 | 26 | 579 |

### What this actually means, because it cuts both ways

**It is a PRESENCE problem, not a LENGTH problem.** Where a description exists it
is healthy — median 579–815 characters against our own sample-2 median of 515.
Rows either have a real description or none at all.

**Descriptions are thinnest exactly where the new coverage is.** Sub-state buyers
— counties, cities, airport authorities — carry a description **42%** of the
time. That is the segment HigherGov is being bought for.

**But `document_path` is 100/100, and that is the redeeming fact.** It is present
on every single row, including every row with no description at all. **That is the
exact inverse of our SAM position**, where descriptions are 86% present and
documents are **12 of 9,883**. With HigherGov the document is always reachable
even when the listing text is empty.

> ### The consequence for what gets built
> **The document pass stops being optional.** `docs/Pinned-Scraping-Console.md`
> and STATUS park it as "the next real slice for triage quality"; on this feed it
> is a **precondition for triaging sub-state work at all**, because for 58% of
> those rows the listing carries no text to read.
>
> The good news is that it becomes possible rather than merely desirable: a
> reachable `document_path` on 100% of rows is a far better starting position than
> SAM's 12 documents, where the pass had nothing to fetch.

**Also note `val_est_low` is 0/8 on `sled_forecast`.** Forecasts carry no estimate,
which is consistent — but it means the "92/92" value figure is over real notices
only, and any ingest must not read a missing forecast estimate as a zero.

---

## R10. The verdict

**Buy it**, subject to the dashboard check in §R5.

$500/yr buys, in the segment where Tenderfoot currently holds **zero rows**:

- an **Indiana solicitation archive back to 2013** that does not otherwise exist
- **sub-state coverage** no adapter strategy delivers at any reasonable cost
- **~100% fill on descriptions, deadlines, documents and values**
- a **pre-RFP forecast feed** nobody asked for
- and a **state-and-local contract endpoint** that lands on the expiration radar

**What it changes elsewhere.** The `idoa-adapter` branch is clearly not worth
merging *for IDOA's sake* — 673 tests against a source whose entire public output
is 71 rows an aggregator already carries at 99%. **The framework underneath it
still is**: two source shapes, date provenance, the shape-aware run contract.

**What it does not do.** It does not replace the Indiana EDS contract register,
and it does not fill `firm_profile.past_performance` — KP's own bid history stays
empty by decision (§7.3), and no aggregator can supply it.

---

## The answer key — 71 items, captured 2026-09-02

`Docs` = a Bid Documents link was present. The four right-hand columns are for
ticking off per platform as you go.

| # | Event ID | Agency | Event name | Response due by | Docs | HG | BidNet | BidPrime | GovWin |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `rfp-23420-group-71022-business-consulting-services` | State of New York Executive Department - Office of General Services | RFP 23420 Group 71022 - Business Consulting Services | 8/26/2026 at 1:30PM | n |  |  |  |  |
| 2 | `003000000088067` | Natural Resources | 300 SP Salamonie Sludge and WW Removal | 09/03/2026 10:00:00AM EST | Y |  |  |  |  |
| 3 | `003000000087986` | Natural Resources | CNC Router for Tri-County FWA 157969 | 09/04/2026 11:00:00AM EST | Y |  |  |  |  |
| 4 | `001000000088090` | State Police | KINETIC PERFORMANCE DOG FOOD ACTIVE 26K (5 SKIDS) | 09/05/2026 1:30:00PM EST | Y |  |  |  |  |
| 5 | `003000000088191` | Natural Resources | 300 FW Fingerling Walleye Lake Stock Purchase | 09/07/2026 10:00:00AM EST | Y |  |  |  |  |
| 6 | `003000000088044` | Natural Resources | 300 FW Goose Creek Farm Lease | 09/07/2026 10:00:00AM EST | Y |  |  |  |  |
| 7 | `003000000088030` | Natural Resources | 300 FW Boone's Pond Mowing and Trash Pick-Up | 09/07/2026 10:00:00AM EST | Y |  |  |  |  |
| 8 | `003000000087945` | Natural Resources | 300 FW Williams Dam Mowing, Trimming, Trash | 09/08/2026 10:00:00AM EST | Y |  |  |  |  |
| 9 | `003000000088036` | Natural Resources | Parts for Fecon BH074 SS3 Atterbury158130 | 09/08/2026 11:00:00AM EST | Y |  |  |  |  |
| 10 | `003000000088015` | Natural Resources | Stone for Public Access Sites 158095 | 09/08/2026 11:00:00AM EST | Y |  |  |  |  |
| 11 | `001000000088108` | State Police | BROTHER BRAND THERMAL PAPER | 09/08/2026 12:45:00PM EST | Y |  |  |  |  |
| 12 | `003000000088038` | Natural Resources | Pre-fab shed for Brookville Lake 158177 | 09/09/2026 11:00:00AM EST | Y |  |  |  |  |
| 13 | `003000000088037` | Natural Resources | Cutter and Welder for Ferdinand/Pike SF 158164 | 09/09/2026 11:00:00AM EST | Y |  |  |  |  |
| 14 | `004050000086378` | Family & Social Svcs Admin | Community Supports IT Systems | 09/10/2026 3:00:00PM EST | Y |  |  |  |  |
| 15 | `001000000088091` | State Police | FORENSIC LAB SUPPLIES | 09/11/2026 1:30:00PM EST | Y |  |  |  |  |
| 16 | `000670000088099` | Ofc of Technology | 00067-Data Center Cleaning Services | 09/13/2026 2:00:00PM EST | Y |  |  |  |  |
| 17 | `003000000088291` | Natural Resources | 300 FW Jasper Pulaski FWA 4-Yr Farm Land Lease | 09/14/2026 2:00:00PM EST | Y |  |  |  |  |
| 18 | `003000000087960` | Natural Resources | Tractor Tires for Hovey Lake FWA 157767 | 09/15/2026 11:00:00AM EST | Y |  |  |  |  |
| 19 | `003000000087962` | Natural Resources | Sunflower seed, herbicide Brookville Lake 157953 | 09/15/2026 11:00:00AM EST | Y |  |  |  |  |
| 20 | `001030000088097` | Law Enforcement Training Brd | Force on Force Ammunition-9mm-Gen 2 | 09/15/2026 12:00:00PM EST | Y |  |  |  |  |
| 21 | `003000000088287` | Natural Resources | 300 Glendale FWA 2-year Concession Campground | 09/16/2026 10:00:00AM EST | Y |  |  |  |  |
| 22 | `003000000088285` | Natural Resources | 300 FW Roush FWA Shooting Range Concession | 09/16/2026 10:00:00AM EST | Y |  |  |  |  |
| 23 | `003000000088060` | Natural Resources | Seed for NP Hobart Marsh 157972 | 09/16/2026 11:00:00AM EST | Y |  |  |  |  |
| 24 | `003000000088057` | Natural Resources | 300 FR Stone for Pike State Forest 158259 | 09/16/2026 11:00:00AM EST | Y |  |  |  |  |
| 25 | `001000000085295` | State Police | Automated Fingerprint Identification System | 09/16/2026 3:00:00PM EST | Y |  |  |  |  |
| 26 | `004100000086873` | FSSA Mental Health & Addiction | CMHW Case Management System (Tobi) | 09/16/2026 3:00:00PM EST | Y |  |  |  |  |
| 27 | `003000000088088` | Natural Resources | Sand for Lincoln SP 158244 | 09/17/2026 11:00:00AM EST | Y |  |  |  |  |
| 28 | `005150000088280` | Correctional Industries | STEEL SHEETS | 09/17/2026 2:29:00PM EST | Y |  |  |  |  |
| 29 | `005030000087847` | FSSA Medicaid Policy & Plan | External Quality Reviews for MCO Programs - FSSA | 09/17/2026 3:00:00PM EST | Y |  |  |  |  |
| 30 | `003000000088095` | Natural Resources | Egg sorter for Bodine Fish Hatchery 157770 | 09/18/2026 11:00:00AM EST | Y |  |  |  |  |
| 31 | `003000000088094` | Natural Resources | Stone for Morgan Monroe State Forest 158240 | 09/18/2026 11:00:00AM EST | Y |  |  |  |  |
| 32 | `003000000088337` | Natural Resources | 300 SP Pokagon Recycling New 2-Yr Bid | 09/21/2026 10:00:00AM EST | Y |  |  |  |  |
| 33 | `005700000088311` | Veterans Home | Wound Care Physician | 09/21/2026 2:00:00PM EST | Y |  |  |  |  |
| 34 | `004950000088329` | Environmental Management | Tower Relocation | 09/21/2026 2:00:00PM EST | Y |  |  |  |  |
| 35 | `005150000088276` | Correctional Industries | Alodized Aluminum Sheets | 09/22/2026 7:30:00AM EST | Y |  |  |  |  |
| 36 | `003000000088367` | Natural Resources | 300 FW Jasper-Pulaski FWA/Range 2-Yr Trash Bid | 09/22/2026 10:00:00AM EST | Y |  |  |  |  |
| 37 | `003000000088336` | Natural Resources | 300 FW Mixsawbah State Fish Hatchery Trash Service | 09/22/2026 10:00:00AM EST | Y |  |  |  |  |
| 38 | `003000000088315` | Natural Resources | 300 SP Pokagon State Park Water Testing | 09/23/2026 10:00:00AM EST | Y |  |  |  |  |
| 39 | `003000000088360` | Natural Resources | 300 SP Deam Lake SRA Trash Services | 09/23/2026 10:00:00AM EST | Y |  |  |  |  |
| 40 | `003000000088059` | Natural Resources | 300 FR Stone for Jackson Washington SF 158317 | 09/23/2026 11:00:00AM EST | Y |  |  |  |  |
| 41 | `000380000088397` | Lieutenant Governor's Office | Stellar Pathways Workshop Design and Delivery | 09/23/2026 4:00:00PM EST | Y |  |  |  |  |
| 42 | `004950000088400` | Environmental Management | AMB 28942 TOC Gas Gen | 09/24/2026 11:12:00AM EST | n |  |  |  |  |
| 43 | `004950000088393` | Environmental Management | AMB 28521 (103) BV Tree Trim | 09/25/2026 9:00:00AM EST | n |  |  |  |  |
| 44 | `004950000088402` | Environmental Management | AMB 28917 (105) SR UV Mont | 09/25/2026 11:46:00AM EST | n |  |  |  |  |
| 45 | `006300000088445` | Pendleton Corr | Masonry supplies | 09/28/2026 3:00:00PM EST | Y |  |  |  |  |
| 46 | `006150000088444` | Correction | Picnic Table Construction | 09/28/2026 3:00:00PM EST | Y |  |  |  |  |
| 47 | `005150000088301` | Correctional Industries | 2 PLY TOILET PAPER | 09/28/2026 3:30:00PM EST | Y |  |  |  |  |
| 48 | `001000000088392` | State Police | Aviation Fuel Trailer | 09/29/2026 11:00:00AM EST | Y |  |  |  |  |
| 49 | `003000000088433` | Natural Resources | Lot of RIP RAP for Public Access South 158727 | 09/29/2026 11:00:00AM EST | Y |  |  |  |  |
| 50 | `003000000088281` | Natural Resources | Seed mix for Deer Creek FWA 158450 | 09/29/2026 11:00:00AM EST | Y |  |  |  |  |
| 51 | `003000000088432` | Natural Resources | Entryway system for office of Hovey Lake 158448 | 09/29/2026 11:00:00AM EST | Y |  |  |  |  |
| 52 | `000610000088009` | Dept of Administration | Ammunition | 09/29/2026 3:00:00PM EST | Y |  |  |  |  |
| 53 | `003000000088390` | Natural Resources | 300 FW Wilbur Wright FWA 4-year Tenant Farm Lease | 09/30/2026 10:00:00AM EST | Y |  |  |  |  |
| 54 | `004950000088357` | Environmental Management | Liebert Preventive Maintenance | 09/30/2026 2:00:00PM EST | Y |  |  |  |  |
| 55 | `003000000088274` | Natural Resources | DNR Fish Feed | 09/30/2026 3:00:00PM EST | Y |  |  |  |  |
| 56 | `000610000088277` | Dept of Administration | NB 27-88277 Grounds Maintenance and Snow Removal | 09/30/2026 3:00:00PM EST | Y |  |  |  |  |
| 57 | `000620000088111` | IN Archives & Records Admin | RFQ 27-88111 Large Format Scanner | 09/30/2026 3:00:00PM EST | Y |  |  |  |  |
| 58 | `003000000088461` | Natural Resources | Trailer for Yellowwood SF 158766 | 10/01/2026 11:00:00AM EST | Y |  |  |  |  |
| 59 | `003000000088460` | Natural Resources | Target board for Roush FWA 158768 | 10/01/2026 11:00:00AM EST | Y |  |  |  |  |
| 60 | `005150000088372` | Correctional Industries | Elite Cameron CC100 Manual Core Cutter | 10/02/2026 8:30:00AM EST | Y |  |  |  |  |
| 61 | `003000000088448` | Natural Resources | 300 FW Driftwood 2-year Trash Service Contract | 10/02/2026 10:00:00AM EST | n |  |  |  |  |
| 62 | `000610000087809` | Dept of Administration | ERP Modernization Strategy RFI | 10/02/2026 3:00:00PM EST | Y |  |  |  |  |
| 63 | `006150000087787` | Correction | RFP DOC Correctional Health Services | 10/05/2026 3:00:00PM EST | Y |  |  |  |  |
| 64 | `003400000088450` | Motor Vehicles Comm | 2-year Contract for Locksmith/Safe Services | 10/05/2026 3:00:00PM EST | Y |  |  |  |  |
| 65 | `007000000088362` | Education | IDEA Dispute Resolution State Mediation and Facili | 10/07/2026 2:00:00AM EST | Y |  |  |  |  |
| 66 | `002350000088102` | Motor Vehicles | Ride Safe IN Training Motorcycles | 10/07/2026 3:00:00PM EST | Y |  |  |  |  |
| 67 | `005150000088428` | Correctional Industries | 2 TOILET PAPER | 10/09/2026 4:00:00PM EST | Y |  |  |  |  |
| 68 | `005150000088452` | Correctional Industries | 2 PLY TOILET PAPER | 10/12/2026 3:30:00PM EST | Y |  |  |  |  |
| 69 | `003000000088029` | Natural Resources | 300 SP Concession Opportunity Interlake/Redbird | 11/02/2026 4:00:00PM EST | Y |  |  |  |  |
| 70 | `003000000087995` | Natural Resources | 300 SP Concession Opportunity Wyandotte Caves SRA | 11/02/2026 4:00:00PM EST | Y |  |  |  |  |
| 71 | `005030000088343` | FSSA Medicaid Policy & Plan | Indiana Medicaid Managed Care Organizations | 11/06/2026 3:00:00PM EST | Y |  |  |  |  |

---

## Where this goes when it is done

1. **The verdict lands on the registry row**, not only here — `source.source_note`
   and `legal_note`, with the date and the reading applied (§5.5.1). A finding
   that lives only in a doc is one refactor away from being lost.
2. **If HigherGov wins, it becomes the first source that costs money — and the
   registry has no cost field.** That is a small migration and a real one, and
   the source rubric Matt proposed needs a cost dimension to match.
3. **If nothing wins, that is a finding too.** It would mean the scraper route is
   the only route, and the adapter backlog is the roadmap rather than a stopgap.
4. **Either way this file stays.** It is the only durable copy of the 71-item key.
