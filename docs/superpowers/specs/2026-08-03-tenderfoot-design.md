# Tenderfoot — Design Specification

**Date:** 2026-08-03
**Revised:** 2026-08-04 — objective reframed to utilization (§1, §8), answer key removed
(§8.2), platform-bound adapters and verified source facts added (§5.7–5.8)
**Status:** Design approved
**Author:** Matt Smith, Koehler Partners (with Claude)

---

## 1. Purpose

Tenderfoot finds, evaluates, and tracks contract opportunities for a professional services
firm. Koehler Partners is the first and only customer.

KP is an Indianapolis-based, WBE-certified consulting firm founded in 2010, serving state
and local government, nonprofits, and Medicaid managed care organizations. Service lines
include program evaluation, project management oversight, managed care operations,
training and talent development, custom software development, stakeholder research,
process optimization, and AI governance.

### The problem

Four problems, all present, none currently addressed by any system:

1. **Missing opportunities entirely** — qualified work comes and goes unseen
2. **Finding out too late** — by RFP publication the incumbent has been positioning for months
3. **Noise** — portal alerts are overwhelmingly irrelevant
4. **No system of record** — opportunities live in email and memory; decisions are not captured

### The goal behind the goal

KP's proposal capacity is currently low, and raising it is the point. But the business
question underneath is **utilization**, not headcount: keeping the existing team loaded as
projects wind down. Hires follow won work — some past KP engagements have staffed five or six
people — they are not a precondition for looking.

Tenderfoot's first job is therefore not to alert. It is to answer: **when KP has bench, is
there qualified work on the table that KP is not seeing?**

Two consequences run through the rest of this document. Timing is not one score among four —
it is weighted against KP's actual capacity calendar (§6.3), because an opportunity landing in
a trough is worth more than a larger one landing when the team is full. And Phase 0's question
is *coverage*, not volume (§8.2).

Whether sustained volume eventually justifies a dedicated BD hire is a query over the same
data, answerable later. It is not the design target.

That framing drives the sequencing in §3.1.

---

## 2. Design decisions

Recorded with rationale, because these are the choices that are expensive to revisit.

### 2.1 Built for KP, architected to stay portable

Tenderfoot is a KP tool. It is not a product being built on spec, and there is no plan to
sell it. But it is built so that productizing later remains possible, which costs almost
nothing if adopted from the start and is expensive to retrofit.

Portability means exactly three rules, and nothing more:

1. No fact about Koehler Partners appears in code. All of it lives in a **Firm Profile** record.
2. No source appears in code. Sources are rows in a **Source Registry**.
3. No jurisdiction name is hardcoded in a query.

Explicitly **not** built: multi-tenancy, authentication beyond single-user needs, billing,
self-serve onboarding, or a support surface. Those are built if and when someone offers to
pay, and not before.

### 2.2 Entity-centric data model, reached through an opportunity-centric first pass

Three models were considered:

- **Opportunity-centric** — one table of solicitations. Simplest, fastest to first result.
  But contract expirations, incumbents, and teaming targets are not solicitations, so the
  pre-RFP layer is unreachable and problem #2 stays unsolved.
- **Entity-centric** — organizations, vendors, contracts, and solicitations as related
  objects. Unlocks everything interesting. Costs entity resolution, which is genuinely hard.
- **Document-centric** — everything is a document, structure extracted on demand. Fast to
  start, but deadlines and eligibility thresholds are precisely what LLM extraction handles
  least reliably, and those are the hard gates.

**Decision: entity-centric, built incrementally.** The opportunity table ships first so the
backtest works, but the schema carries `organization_id`, `vendor_id`, and `contract_id` as
real foreign keys from day one — even while those tables hold little more than a name.
Deferring entity *resolution* is cheap. Deferring the *slots* for it means a migration and
a full re-ingest.

Document-centric is rejected as a core model but adopted as a layer: LLM extraction is how
Documents become structured fields.

### 2.3 Machine judgment and human judgment are separated deliberately

The system judges what is in the document. The user judges what is in the firm.

Fit and Value are document-derived. Winnability is mixed. Cost to pursue depends on who is
available, what has already been written, and how badly KP wants a particular client — the
system cannot know any of that and should not pretend to. See §5.3.

### 2.4 The app is the product

Tenderfoot is an application. Email is a notification channel into it, not a substitute for
it. See §6.

---

## 3. System shape

A pipeline over an entity graph:

```
Sources → Sightings → canonical records → Assessments → the app
```

### 3.1 Two modes, one codebase

Every ingestion adapter takes a `since` parameter.

**Backwards (Phase 0).** `since = 24 months ago`. Ingest the archive, score it against the
Firm Profile, and produce a market-sizing report:

> *"63 opportunities you were eligible for. 22 strong fits, combined value $4.1M. Nine of
> them closed during quarters when you had bench."*

This does three things simultaneously: sizes the market against the capacity calendar, builds
a labeled example set through adjudication (§8.2), and requires no scheduler, no
notifications, no uptime, and no dashboard.

It does *not* validate the scorer against known ground truth. There is no bid history to
validate against — see §8.2.

**Forwards (production).** `since = last successful run`, on a schedule. Same adapters, same
scorer, same storage.

There is no throwaway "historical import" system. This is why archive depth is a primary
source-selection criterion rather than a nice-to-have — a source that cannot be run
backwards cannot participate in proving the market.

### 3.2 Build sequencing is not specified here

This document describes the designed system in full. It is deliberately larger than one
implementation effort, and the order in which pieces get built — what ships in Phase 0
versus what waits — is a separate conversation. §2.2 and §3.1 constrain that sequencing in
two places only: the schema carries its entity foreign keys from the first migration, and
ingestion adapters are backfill-capable from the first adapter. Everything else is open.

---

## 4. Data model

Eleven object types, in four groups.

### 4.1 Buyer side

**Organization** — any entity that buys. State agencies, counties, municipalities, school
corporations, health systems, foundations. Hierarchical (*State of Indiana → FSSA →
Division of Medicaid*), so filtering works at any level.

Carries an **alias list**. This is the entity resolution problem in its entirety:
`Indiana Family and Social Services Administration`, `FSSA`, and `IN-FSSA` are one row.

Accumulates behavior over time: how often it competes work, whether it runs an RFI first,
whether incumbents ever lose there.

### 4.2 Seller side

**Vendor** — anyone who sells. Competitors, incumbents, potential primes, and **Koehler
Partners itself**. KP being an ordinary Vendor row with a Profile attached is what keeps the
system portable. Also carries aliases. Win history *infers* capability — you learn who does
Indiana health-policy evaluation work by observing who keeps winning it.

**Firm Profile** — the configuration record attached to KP's Vendor row. The only place
KP-specific facts exist:

- Capabilities and service lines, as free text (this is what carries "Medicaid managed care
  operations")
- Classification codes — NAICS, PSC, UNSPSC, state commodity codes
- Certifications and set-aside status — WBE, MBE, DBE, WOSB/EDWOSB, VOSB, 8(a), HUBZone,
  state equivalents
- Geography served, and whether work is remote-deliverable
- Hard limits — bonding capacity, insurance ceilings, headcount, revenue, registrations held
- Past performance library — the projects that can actually be cited
- Negative profile — what will never be bid, and why
- Capacity — not a single number but a **timeline**: how many pursuits can run at once, plus
  when current engagements are scheduled to end. The same mechanism that reads clients'
  contract end dates to predict re-competes (§4.3), pointed inward, predicts KP's own troughs.
  This is what Timing scores against (§6.3) and what Phase 0's coverage measure compares to
  (§8.2).

**Bootstrap:** the Profile can be largely auto-drafted from KP's website and past proposals,
then corrected by hand. This is also the onboarding flow a future customer would receive.

**Scope configuration.** Geography and sector are Profile settings, not code. KP's initial
scope is Indiana state and local, neighboring Midwest states, federal (SAM.gov), and
foundation/nonprofit solicitations.

### 4.3 The event chain

**Solicitation → Award → Contract**

**Solicitation** — an event published by an Organization: RFP, RFI, RFQ, IFB, sources sought.
Carries type, dates, estimated value, codes, documents, and status. Versioned, because
addenda change it.

**Award** — links a Solicitation to the winning Vendor(s) and value.

**Contract** — what results. Organization, Vendor(s), start and end date, value, renewal
options.

**The contract end date is the highest-value field in the system.** A contract ending in 14
months, held by a beatable vendor, at an agency that competes its work, is a lead that
appears without anyone having published anything. This is the entire answer to problem #2.

Awards and Contracts may exist **without** a corresponding Solicitation, discovered from
spending and transparency data. The chain is a graph, not a required sequence.

### 4.4 The three that get skipped

**Source** — registry entry. Jurisdiction, adapter type, auth requirements, legal posture,
archive depth, refresh cadence, health metrics, yield statistics. Data, not code.

**Sighting** — *"Source X showed us this listing on date Y."* Raw, unmerged, immutable. A
Solicitation is the canonical record produced by merging Sightings.

This separation is nearly free now and expensive later, and it provides three things:
deduplication across sources; **change detection** (a Sighting that disagrees with the
canonical record means an addendum moved something, which is a notification); and honest
**per-source yield metrics** so unproductive sources can be retired.

**Document** — attachments, with raw file, extracted text, and extraction confidence. The
listing page is metadata; the scope of work is in a PDF.

### 4.5 Judgment layer

**Assessment** — the score for a `(Solicitation × Firm Profile)` pair, **versioned by scorer
version**. Required so that changing the scorer can be evaluated against accumulated
adjudications (§8.2) rather than hoped about.

**Pursuit** — the lifecycle record:

```
New → Triaged → Watching → Bid / No-Bid → Submitted → Won / Lost
```

Each transition carries a **reason**. This is the system of record, and every reason is a
labeled training example.

There is no prior history to seed this table with (§8.2) — it starts empty and fills from
Phase 0 adjudications and then from live use. That makes the reason field load-bearing from
the very first decision rather than merely nice to have.

### 4.6 What the model buys

Two of the most valuable features are not features — they are queries:

- **Expiration radar:** contracts ending in 6–18 months, at Organizations matching
  geography, in categories matching the Profile, held by displaceable Vendors.
- **Teaming radar:** solicitations above KP's size with participation goals, cross-referenced
  against Vendors likely to bid. KP's WBE status turns unreachable opportunities into
  outreach targets.

---

## 5. Ingestion

### 5.1 Four adapter tiers, in order of preference

1. **API** — SAM.gov, USASpending, some state portals. Structured, stable, permitted,
   backfillable. Always preferred where it exists.
2. **Email and RSS** — most portals will email notifications matching saved searches. A
   dedicated inbox subscribed to many portals yields more per hour of work than scraping,
   does not break on redesign, has no terms-of-service problem, and needs no scheduler.
   Detail pages still get fetched, but from a *known* URL rather than a discovered one.

   **The trap:** these subscriptions are usually themselves code filters. Indiana matches
   notifications to the bidder's UNSPSC codes (§5.8) — meaning the portal applies exactly the
   filter §6.2 forbids, before the record is ever visible, and invisibly. Two rules follow.
   Register with a **deliberately over-inclusive** code set. And treat email as a
   *change-detection ping*, never as the record source: every email-tier source stays paired
   with a listing adapter that sees everything posted.
3. **HTML scrape** — where neither exists. Accept that these rot.
4. **Manual drop** — paste a URL or forward an email and it ingests. Small feature,
   disproportionate value: the system is never a wall, and opportunities heard about in
   conversation get captured.

### 5.2 Sources yield different record types

- **Solicitation sources** — the portals
- **Award and contract sources** — USASpending, state transparency sites, contract
  registries. These feed the entity chain and the expiration radar, and are often easier to
  obtain than solicitations because transparency law requires publication.
- **Signal sources** — grant awards, board minutes, budget documents. Low structure, long
  lead time.

Award sources are where the lead-time advantage comes from and are what a generic bid
service will not cross-reference.

### 5.3 Three hops, then extraction

**Listing → detail page → attached documents.** Each hop costs more and yields more. Hop one
rejects most items on geography and hard gates alone. **Fetch depth follows score** — only
survivors have their documents pulled and parsed.

Extraction is a separate stage from fetching. It produces: deadline, mandatory pre-bid
conference date, Q&A deadline, contract value and term, incumbent, bonding and insurance
thresholds, set-aside requirements, and evaluation criteria with weights.

Every extracted field carries a **confidence score and a pointer back to its source text**,
so verification takes seconds rather than re-reading the document.

### 5.4 Sources rot; instrument for it

The failure mode that kills these systems is not a crash — it is a scraper that silently
returns zero rows after a site redesign and goes unnoticed for months.

Every source carries expected-volume baselines. A source producing nothing for 30 days
raises a flag and is treated as an incident.

Sources degrade rather than fail: if detail-page parsing breaks but the listing works, keep
the listing and mark the record incomplete.

### 5.5 Legal posture is a column

Robots.txt, terms of service, whether account terms forbid automated access, and rate
limits. GovWin, BidNet, and BidPrime explicitly prohibit scraping. The tier ordering largely
resolves this on its own — APIs and email subscriptions are sources inviting you in.

### 5.6 Coverage grows demand-driven

Not "cover Indiana," but "cover what the Profile actually reaches." Realistically: SAM.gov
and USASpending first (free, structured, and where the entity model gets validated cheaply),
then Indiana's state portal and its largest local buyers, then notification subscriptions
for Midwest states, with manual drop covering the rest. Each new source earns its slot with
yield numbers.

Demand-driven still governs *which* sources get added. But §5.7 changes the growth curve: the
marginal cost of the second jurisdiction on an already-built platform is near zero, so the
ordering should prefer a new state on a known platform over a new state on a new one, all
else equal.

### 5.7 Adapters bind to platforms, not jurisdictions

States do not build procurement portals; most license one of roughly five. Verified or
strongly indicated across the initial scope:

| Portal | Platform | Anonymous browse |
|---|---|---|
| Illinois BidBuy | Periscope S2G (BidSync/Jaggaer) | Verified — public browse, no login |
| Ohio OhioBuys | Ivalua | Unverified; SSO login wall visible |
| Michigan SIGMA VSS | CGI Advantage VSS | Unverified |
| Kentucky eMARS VSS | CGI Advantage VSS — *same as Michigan* | Unverified |
| Indiana IDOA | PeopleSoft supplier portal + static HTML public list | Verified public |

The same platforms recur nationally: Periscope also runs Arkansas and Montana, Ivalua runs
North Dakota, CGI Advantage runs Colorado and Maine.

**Therefore the Source Registry carries a `platform` field, and adapters bind to platform plus
per-deployment configuration rather than to a jurisdiction.** One CGI Advantage adapter covers
Michigan and Kentucky together; one Periscope adapter covers Illinois and several others.

Two limits, so this is not oversold. Deployments differ in enabled fields, URL paths, and
authentication, so this is a *parameterized* adapter, not a free one — much of the work is
shared, not all of it. And the largest states (California, Florida, Texas, Virginia) run
custom systems where the leverage is absent entirely.

This is what turns §2.1's portability claim from an aspiration into arithmetic.

### 5.8 Verified source facts

Established 2026-08-04. Recorded because they constrain the build.

| Source | Finding | Consequence |
|---|---|---|
| Indiana IDOA | Emails solicitations to registered bidders, matched on **UNSPSC code** | Tier 2 viable, with the over-inclusive registration rule in §5.1 |
| Indiana IDOA | Only solicitations expected to exceed **$75,000** are publicly posted | A documented coverage floor, not an unknown |
| Indiana IDOA | Public listing is anonymous-readable — event name, agency, event ID, description, due date, contact. No RSS, API, or bulk download | Tier 3, plain table, low complexity |
| Indiana IDOA | **No solicitation archive.** Closed solicitations are not published | Indiana cannot be backtested on the solicitation side (§8.2) |
| Indiana Transparency Portal / IDOA contract search | Contracts searchable by ID, vendor, agency, amount, type, and date range | Indiana's Phase 0 and expiration radar run here instead |
| SAM.gov | API returns latest active version only; Data Services publishes archived CSVs going back decades, refreshed weekly | Clean split — API for live, bulk CSV for backfill. Validates the `since` design in §3.1 |
| USASpending | FY2008 via Award Data Archive, FY2001 via custom download; period-of-performance dates present | Deep enough for the entity chain |

The Indiana archive gap resolves in a useful direction. The state's *contract* side is well
published even though its *solicitation* side is not — and contract end dates were already the
higher-value signal (§4.3). The gap pushes Phase 0 toward the better data rather than away
from it.

---

## 6. Matching

### 6.1 The funnel

**Stage 0 — Hard gates.** Deterministic, no model. Geography outside profile, deadline
passed, mandatory pre-bid already held, bonding above capacity, insurance above coverage,
registration not held, revenue or headcount floors unmet. Eliminates most volume at zero
cost, fully auditable.

**Stage 1 — Semantic recall.** Embed the solicitation, compare against Profile capability
vectors. Catches opportunities described in vocabulary nobody would have thought to keyword
on. Ranks; never rejects.

**Stage 2 — LLM adjudication.** Survivors only. The model reads the solicitation with the
Firm Profile in context and produces a structured judgment. The brief (§7.3) is a byproduct
of the same call, not a separate feature.

**Stage 3 — Human decision**, which feeds back into Stage 2.

Fetch depth (§5.3) follows this funnel.

### 6.2 Two disciplines

**Hard gates and soft scores never mix.** A model never makes a hard-gate call; a high fit
score never overrides one. But **gated items are filed, not deleted** — *"Rejected: bonding
requirement $500K exceeds $250K capacity"* is useful information, and extraction is
sometimes simply wrong. A rejection that cannot be inspected is a bug that will never be
found.

**Codes are a signal, never a filter.** NAICS, PSC, UNSPSC, and state commodity codes are
frequently missing or wrong in state and local procurement. Codes earn a positive boost on
match; they never gate. Using codes as a filter is the most common way these systems develop a
silent recall problem, and recall is KP's first-named pain.

This rule binds upstream too. Where a source's *own* notification subscription is code-filtered
— as Indiana's is — the discipline is enforced by registering over-inclusively and pairing the
subscription with a listing adapter (§5.1). A filter applied by someone else is still a filter,
and it is worse than one applied here because its losses are invisible.

### 6.3 Four machine scores, one human score

The system produces four components, kept separate and separately visible:

| Component | Question |
|---|---|
| **Fit** | Can we do this work? |
| **Winnability** | Realistic odds — incumbency, field size, evaluation criteria, references held |
| **Value** | Contract size × term × plausible margin |
| **Timing** | Does this land in a capacity trough? Is the response window survivable? |

**Timing carries additional weight**, per §1. Because the objective is utilization rather than
raw volume, an opportunity landing in a trough is worth more than a larger one landing when
the team is full. Timing scores against the Profile's capacity timeline (§4.2), not against
the calendar in the abstract — which means Timing is the one score that changes as KP's
project book changes, without anything about the opportunity changing at all.

Separation permits sorting a single blended number cannot: *high value, low winnability* is
a teaming call, not a no-bid. *Everything strong but a 9-day window* is a lesson about
watching that agency earlier.

Every component cites the specific text that drove it — not for elegance, but because an
explanation is what makes a human correction meaningful.

**Cost to pursue is a human judgment and is not scored by the system.** It depends on staff
availability, existing written content, and appetite for the client. Instead:

- The system **extracts the ingredients**: page limits, required forms and attachments,
  mandatory meetings with dates and locations, references required, submission quirks
  (notarization, hard copies, portal formats), and how much of the scope appears to be
  net-new writing. Facts on a panel — the ten minutes of digging is done, the ten-second
  judgment is the user's.
- The user rates **light / moderate / heavy** at triage.
- After roughly twenty ratings, the brief can surface **recall, not estimation**: *"you
  rated the last three IDOA RFPs as heavy."* Honest, and it costs nothing to begin
  collecting now.

### 6.4 Winnability penalizes wired bids

Explicit negative signals: unusually short response window, qualifications so specific only
one firm holds them, incumbent named in the scope, no preceding RFI, sole-source
justification language. These score as *low winnability*, not *high fit* — the distinction
that prevents three wasted weeks.

### 6.5 Three match modes, one Profile

1. **Should we bid this?** — the funnel above
2. **Who should we call?** — the teaming radar (§4.6)
3. **What's coming?** — the expiration radar (§4.6), scored identically but against a
   predicted solicitation

### 6.6 Feedback loop, and a hard limit

Every Pursuit decision — especially every no-bid reason — becomes a labeled example, fed
into Stage 2's context as few-shot guidance: *here is what this firm bid, here is what they
passed on and why.* Effective from the first decision, fully interpretable.

**The system will not train a model.** At 10–40 pursuits per year, a usable training set
will not exist for many years. Curated examples in context is not a cheap substitute at this
data volume — it is the correct approach, and building an ML pipeline here would be pure
waste.

### 6.7 Calibrate to a rate, not a threshold

Target a **volume** (the top N per period), not a score cutoff. Absolute scores drift as the
scorer and source mix change; a fixed threshold eventually either floods or goes silent, and
both end with the tool being ignored. A thin week shows thin results, which is itself
information.

---

## 7. The application

Tenderfoot is an app. Triage happens in the app.

### 7.1 Triage queue — the daily driver

The fastest thing in the product. One opportunity per screen, keyboard-driven, decision in
under ten seconds. The working habit is **"clear the queue"** — a queue reaching zero is a
stronger habit than a daily email, which becomes wallpaper.

The app earns its login by capturing what email cannot:

- Four scores **with their supporting evidence**
- The **pursuit-cost fact panel**, enabling the light/moderate/heavy judgment on the spot
- The **no-bid reason**, as one tap on a reason chip — the single most valuable training
  signal in the system, and something email can only ever reduce to a binary

Responsive, so ten-second triage decisions work on a phone.

### 7.2 Pipeline board

Pursuits across their states. The system of record; the answer to problem #4.

### 7.3 Opportunity detail

- The **brief** — what it is, why it fits, **which specific past projects to cite**, what is
  missing and would need a partner, key dates, key risks, the pursuit-cost fact panel, and a
  recommended posture. The value is not summarizing the RFP; it is connecting the RFP to
  KP's past performance library, which is the tedious part of every bid/no-bid call.
- Four scores with citations
- Extracted fields with confidence
- Documents inline, with extraction highlights pointing back into the source PDF
- A **timeline** of every Sighting and addendum — what the Sighting table exists for, and
  what makes an extracted deadline trustworthy in seconds

### 7.4 Radars

Expiration and Teaming (§4.6). Browsable and filterable. Pure graph queries with no email
equivalent; they exist only because of the entity model.

### 7.5 Entity browser

Organizations and Vendors with their histories. *This agency competes work every four years
and the incumbent has never lost* is worth knowing before writing anything.

### 7.6 Reports

Phase 0 market sizing as a live view — including the coverage-against-capacity chart (§8.2),
which is the report the whole exercise exists to produce — plus source-yield reporting. Win
rate becomes a report once there is enough history to populate one; it is never a system
objective (§8.6).

### 7.7 Saved views

Persisted custom queries.

### 7.8 Admin

- **Firm Profile editor** — a real screen, not a config file. This is what makes the system
  portable.
- **Source Registry** with health indicators — where §5.4's rot detection surfaces.

### 7.9 Email's role

A pull signal and a tripwire, not a workspace:

- A scheduled summary indicating whether the queue is worth opening, deep-linked into the app
- Genuinely time-critical alerts: a deadline moved on an active pursuit, an addendum posted,
  an award announced

Two kinds of interruption and only two. Everything else is pull.

---

## 8. Validation

### 8.1 The backtest is the permanent test suite

Phase 0 does not end. Every scoring change is re-run over the archive and compared, which is
only possible because Assessments are versioned by scorer version.

### 8.2 There is no answer key; validation is human adjudication

This section originally assumed KP's bid/win/loss history could seed Pursuit records and serve
as ground truth. It cannot. KP has competitively bid **one** solicitation — a small Indiana
University engagement. Recalled success across all past proposals is roughly 30%, but that is
a recollection rather than a record, and it counts a $100K job identically to a $5M one.

**This is not a system that improves an existing bid process. There is no existing process to
improve.** The pipeline is being built from zero. That raises the bar on early precision: a
bad first month has nothing to be judged against and no established habit to fall back on.

Validation therefore works as follows.

**Adjudication.** The backtest produces a ranked list; the user reads the top N and marks each
*would have bid* / *would not have bid* / *unclear*. Slower than scoring against history, but
it is the only ground truth available — and it produces the few-shot example set (§6.6) as a
byproduct rather than as separate work.

**Coverage, not volume.** Per §1, the question is whether qualified work existed during the
months KP had bench. Group adjudicated results by month and compare against the capacity
timeline (§4.2). Ten opportunities clustered in a single quarter is a *worse* result than five
spread across the year, and a count alone cannot see the difference.

**Value-weighted, never count-weighted.** With roughly a 50× spread between KP's smallest and
largest engagements, any metric treating bids as equal units is wrong. Report expected value,
not hit count. This applies to every number in this section.

**Past proposals still do work.** Even without bid outcomes, the proposals KP has already
written populate the past performance library and the negative profile (§4.2).

**Known limitation:** true recall remains unmeasurable — what was published but never seen is
unknown. If that gap needs closing, the method is to pick one jurisdiction and one year,
exhaustively enumerate everything published, and score all of it. Done once, not annually.

### 8.3 Precision, measured live

Of what the queue surfaced this period, what fraction was marked Interested? Roughly 30–50%
is healthy. Ten percent is noise and predicts abandonment. Ninety percent means the scorer
is too conservative and quietly missing things — the failure mode that feels like success,
and the reason codes never gate.

### 8.4 Extraction accuracy, weighted by consequence

Hand-label ~50 solicitations and measure field by field. **Dates and eligibility flags are
tested hard** — a wrong deadline means a missed bid or a wasted week. Estimated value being
wrong is merely annoying. Weight accordingly.

### 8.5 Acceptance criteria

| Pain | Metric |
|---|---|
| Missing things entirely | Discovery — opportunities surfaced that would not have been seen, weighted by value and by whether they land in a capacity trough |
| Finding out too late | Median lead time from first sighting to deadline; expiration-radar leads converted |
| Drowning in noise | Triage precision (Interested rate) |
| No system of record | Whether the Pursuit board is current — a usage question, not a software one |

### 8.6 What not to measure

**Win rate is not a system metric**, at least not for years. It is dominated by proposal
quality and relationships rather than opportunity selection, and 10–40 pursuits a year
cannot attribute anything. Measure the funnel above the proposal: surfaced, triaged,
pursued. Tuning a scorer against win rate is tuning against noise.

### 8.7 A negative result is a valid result

Phase 0 may report that only a handful of winnable opportunities existed in 24 months, or that
the ones that existed never landed when KP had bench. That is a valuable answer, not a failure
— it would mean the utilization problem is not solved by better opportunity discovery, and
that the effort belongs somewhere else entirely (relationships, teaming, a different market).
Learned for a few weeks of work instead of a year of building. Accepting this outcome in
advance is what makes a small first phase the right first phase.

---

## 9. Explicitly out of scope

Recorded so they are not rebuilt by accident:

- Multi-tenancy, billing, self-serve onboarding, customer support surfaces
- Training a machine learning model on pursuit outcomes (§6.6)
- Proposal writing or generation — Tenderfoot decides *whether* to bid, not *how*
- Scraping paywalled aggregators (GovWin, BidNet, BidPrime) (§5.5)
- Breadth-first national source coverage; coverage is demand-driven (§5.6)
- Win-rate optimization as a system objective (§8.6)

---

## 10. Open questions

**Resolved 2026-08-04** (see §5.7–5.8): Indiana's email notifications are real but
code-filtered. Archive depth is deep for SAM.gov and USASpending, absent for Indiana
solicitations, good for Indiana contracts. KP's bid history is effectively empty, which
rewrote §8.2 rather than merely weakening it.

Still open:

1. **Do the Ohio, Michigan, and Kentucky portals allow anonymous browsing?** Illinois and
   Indiana are verified public; the Ivalua and CGI Advantage deployments are not. This decides
   whether those states are tier 3 or require registered accounts, and it sets the real cost
   of the platform-adapter strategy in §5.7.
2. **Do any state portals archive closed solicitations?** None found so far. If the answer is
   uniformly no, solicitation-side backtesting is a federal-only capability and every state's
   Phase 0 runs on contract data.
3. **What is KP's capacity calendar?** Timing scoring (§6.3) and the Phase 0 coverage measure
   (§8.2) both depend on knowing when current engagements wind down. Needed before Phase 0 can
   be *interpreted*, not before it can be run.
4. **Is anyone besides Matt clearing the triage queue?** Determines whether Pursuits need
   assignment and ownership from day one, or whether that is a later problem.
5. **Technology stack, hosting, and deployment** — deferred to the development plan.

---

## Appendix — relationship to the original concept outline

*Tenderfoot — Concept Outline.md* has since been rewritten as the build inventory. Its
original form is preserved verbatim as *OLD - Tenderfoot Concept Outline.md* (and in git at
`183df06`), and mapped as follows:

| Original | Where it lives now |
|---|---|
| §1 Bid Site Locating and Assessing | §5 Ingestion — Source Registry, adapter tiers, legal posture, yield |
| §1.C Scrapability Index / Data Archive | §5.1, §3.1 — archive depth promoted to a primary selection criterion |
| §2 Scraping | §5.3 Three hops and extraction |
| §3 Matching | §6 Matching engine |
| §3.C Negative Profiles | §4.2 Firm Profile, §6.1 Stage 0 hard gates |
| §3.D Filters — Profit Potential | §6.3 — decomposed into Value, Winnability, and human cost-to-pursue |
| §4.A Notifications | §7.1 Triage queue, §7.9 email tripwires |
| §4.B Reports | §7.6 |
| §4.C Dashboard | §7 — the app, as the primary surface |
| §4.D Custom Queries | §7.7 Saved views |
| Sub-opportunity monitoring as a filter | §4.6, §6.5 — promoted to the Teaming radar |

New material not in the original outline: the entity graph and the Solicitation → Award →
Contract chain (§4.3), the expiration radar and pre-RFP layer (§4.6), Sightings and change
detection (§4.4), the Pursuit lifecycle and feedback loop (§4.5, §6.6), Phase 0 as
market-sizing and permanent test harness (§3.1, §8), and portability as a design constraint
(§2.1).
