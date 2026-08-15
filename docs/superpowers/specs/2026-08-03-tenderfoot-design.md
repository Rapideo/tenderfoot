# Tenderfoot — Design Specification

**Date:** 2026-08-03
**Revised:** 2026-08-04 — answer key removed (§8.2); platform-bound adapters and verified source facts added (§5.7–5.8); **scope narrowed to prospect discovery only (§1)** — the system is capacity-agnostic, and pipeline management is deferred (§9)
**Revised:** 2026-08-11 — **§6 Matching is parked in full.** V1 returns everything active sources return, unranked and unfiltered (§1.1). Qualification is not deferred-as-designed but deferred-as-*undesigned*: it will be re-imagined once ingestion is running, and nothing in §6 binds that work.
**Revised:** 2026-08-12 — **Stage B1**: the fidelity mandate added (§7.10) and the platform-properties section added (§5.9), both required by `Proto2PRD` §5.2 *before* sub-project 1 begins. §10.3 closed by the workflow spec.
**Status:** Design approved, with §6 parked
**Author:** Matt Smith, Koehler Partners (with Claude)

---

## 1. Purpose

Tenderfoot finds, evaluates, and tracks contract opportunities for a professional services firm. Koehler Partners is the first and only customer.

KP is an Indianapolis-based, WBE-certified consulting firm founded in 2010, serving state and local government, nonprofits, and Medicaid managed care organizations. Service lines include program evaluation, project management oversight, managed care operations, training and talent development, custom software development, stakeholder research, process optimization, and AI governance.

### The problem

Four problems, all present, none currently addressed by any system:

1. **Missing opportunities entirely** — qualified work comes and goes unseen
2. **Finding out too late** — by RFP publication the incumbent has been positioning for months
3. **Noise** — portal alerts are overwhelmingly irrelevant
4. **No system of record** — opportunities live in email and memory; decisions are not captured

### The goal, stated narrowly

Tenderfoot's only job right now is to **deliver the most accurate, most likely prospects for consideration.** Nothing beyond that.

The system is deliberately **capacity-agnostic.** It does not model how many people KP employs, how much work KP can absorb, or when current engagements wind down. Those are judgments the reader makes when a prospect is in front of them, and encoding them would make the system wrong in a way that is structurally invisible: an opportunity suppressed because the calendar looked full is a miss that never appears in any report. Recall is the first-named pain (§1), and every capacity heuristic is a quiet tax on it.

One distinction has to stay sharp, because it is easy to blur:

> **Eligibility facts stay. Capacity judgments go.**
>
> A solicitation demanding fifty employees, $2M in bonding, or five years of audited financials is a **hard gate** (§6.1) — KP either qualifies or it does not, and that is a fact about the document. Whether KP *wants* the work, or has the bandwidth for it, is not modeled anywhere.

Headcount and revenue therefore remain in the Firm Profile (§4.2) strictly as eligibility thresholds. They never become a reason to rank one qualified prospect above another.

#### The rule binds the machine, not the person

**Clarified by Matt 2026-08-11, and it resolves a contradiction that had been read the wrong way round.**

Capacity-agnostic is a **mandate on the system**. It is not a rule about what a user may think, say, or write down.

| | May consider capacity? |
|---|---|
| The system — inferring, scoring, ranking, gating, suppressing | **Never.** |
| A person reading an opportunity and deciding | **Yes — and they should.** |

A user looking at a $5M solicitation is entitled to conclude *this is too big for us right now*, and **the record should capture that in their words**. It is a real reason, it is often the true reason, and a system of record that cannot hold it is lying about why things were passed on. §7.1 already argues the reason matters more than the decision; refusing to accept the most honest reason available would gut that.

**So the constraint is on data flow, not on vocabulary.** Nothing is forbidden from being *said*. What is forbidden is the machine consuming it:

> **A recorded capacity judgment is a journal entry. It may never become model input, a score, a weight, a filter, or a learned rule.**

That is a narrower and more enforceable rule than banning the category, and it protects the thing §1 actually cares about — the invisible miss — without pretending a real workflow does not exist.

**Where this bites, and it is not hypothetical.** §4.5 proposed that *every* recorded no-bid reason become a few-shot example automatically. Applied to a capacity reason, that converts a human judgment into a machine one silently — the user records an honest fact about this quarter, and the system generalizes it into a standing preference against large contracts. **The defect was the automatic pipe, not the reason.** Any future qualification design must classify reasons on the way in and exclude the capacity class from anything that learns.

**Corollary worth stating, since it follows and is easy to miss.** If a person passes on capacity grounds often enough to matter, *that* is a finding — about the firm, not about the opportunities. The system may surface the count. It may not act on it.

**Later — explicitly not now — Tenderfoot becomes a contract seeking *and management* tool.** Pipeline state, ownership, workload planning, and win/loss analytics all belong to that phase (§9). This document describes the seeking half, and the seeking half is judged on one thing: are the prospects it surfaces accurate and likely?

### 1.1 V1 returns everything

**Decided 2026-08-11.** The application, at start, **returns all results from every active source.** No ranking, no scoring, no filtering, no suppression. If a source is switched on in the Source Registry, everything it yields reaches the user.

Qualification comes later, after ingestion is running, and it is **not** the design in §6. That section is parked, not scheduled.

**Why this is the right first version, and not merely the cheapest.**

The four problems in §1 are not equally urgent, and only one of them is a matching problem. *Missing opportunities entirely* and *no system of record* are solved by collecting and showing; *finding out too late* is solved by the expiration radar; only *noise* needs a scorer. Returning everything attacks three of four immediately, and it attacks the first one — recall, the first-named pain — more completely than any scorer can, because **a system that returns everything cannot have a recall bug.**

It also removes the deepest risk in the project. Every filter is a silent-loss mechanism: §6.2 makes this argument about codes, and it generalizes. A V1 with no filter has no invisible losses, which means the ingestion layer can be trusted on its own terms before any judgment sits on top of it. Debugging a scorer stacked on unverified ingestion is a bad position that this ordering never enters.

And there is a sequencing argument that is stronger than either. **Nobody currently knows what the sources actually return.** Not the volume per week, not the composition, not the duplication rate, not how much of it is obviously irrelevant on sight. Matching designed against a guess about that distribution would be designed against fiction. **V1 is therefore an instrument: it measures the problem that qualification exists to solve, and that measurement is the input to designing it.**

**What this costs, stated plainly.** Problem #3 — *"portal alerts are overwhelmingly irrelevant"* — is untouched in V1. If active sources yield hundreds of rows a week, reading them is real work, and the tool will feel like the portals it was meant to replace. That is accepted knowingly: the volume is the finding, and it is better measured than assumed.

**One consequence to carry.** With everything returned, *precision* is no longer a meaningful measure of the system — it is just the base rate of the sources. The measure that survives is **discovery**: how much of what surfaces is work KP would pursue and had not otherwise seen. See §8.3.

That framing drives the sequencing in §3.1.

---

## 2. Design decisions

Recorded with rationale, because these are the choices that are expensive to revisit.

### 2.1 Built for KP, architected to stay portable

Tenderfoot is a KP tool. It is not a product being built on spec, and there is no plan to sell it. But it is built so that productizing later remains possible, which costs almost nothing if adopted from the start and is expensive to retrofit.

Portability means exactly three rules, and nothing more:

1. No fact about Koehler Partners appears in code. All of it lives in a **Firm Profile** record.
2. No source appears in code. Sources are rows in a **Source Registry**.
3. No jurisdiction name is hardcoded in a query.

Explicitly **not** built: multi-tenancy, authentication beyond single-user needs, billing, self-serve onboarding, or a support surface. Those are built if and when someone offers to pay, and not before.

### 2.2 Entity-centric data model, reached through an opportunity-centric first pass

Three models were considered:

- **Opportunity-centric** — one table of solicitations. Simplest, fastest to first result. But contract expirations, incumbents, and teaming targets are not solicitations, so the pre-RFP layer is unreachable and problem #2 stays unsolved.
- **Entity-centric** — organizations, vendors, contracts, and solicitations as related objects. Unlocks everything interesting. Costs entity resolution, which is genuinely hard.
- **Document-centric** — everything is a document, structure extracted on demand. Fast to start, but deadlines and eligibility thresholds are precisely what LLM extraction handles least reliably, and those are the hard gates.

**Decision: entity-centric, built incrementally.** The opportunity table ships first so the backtest works, but the schema carries `organization_id`, `vendor_id`, and `contract_id` as real foreign keys from day one — even while those tables hold little more than a name. Deferring entity *resolution* is cheap. Deferring the *slots* for it means a migration and a full re-ingest.

Document-centric is rejected as a core model but adopted as a layer: LLM extraction is how Documents become structured fields.

### 2.3 Machine judgment and human judgment are separated deliberately

The system judges what is in the document. The user judges what is in the firm.

Fit and Value are document-derived. Winnability is mixed. Cost to pursue depends on who is available, what has already been written, and how badly KP wants a particular client — the system cannot know any of that and should not pretend to. See §5.3.

### 2.4 The app is the product

Tenderfoot is an application. Email is a notification channel into it, not a substitute for it. See §6.

---

## 3. System shape

A pipeline over an entity graph:

```
Sources → Sightings → canonical records → Assessments → the app
```

### 3.1 Two modes, one codebase

Every ingestion adapter takes a `since` parameter.

> **Naming note.** "Phase 0" in *this* document always means the **backwards run — the backtest**. It is unrelated to "Phase 0" in `docs/Proto2PRD.md`, which means the **prototype**. `docs/Tenderfoot-Plan-of-Action.md` avoids the collision entirely: the prototype is *Stage A* and the backtest lands in *SP6*.

**Backwards (Phase 0 — the backtest).** `since = 24 months ago`. Ingest the archive, score it against the Firm Profile, and produce a market-sizing report:

> *"63 opportunities you were eligible for. 22 strong fits, combined value $4.1M. You saw one of them."*

This does three things simultaneously: sizes the market, builds a labeled example set through adjudication (§8.2), and requires no scheduler, no notifications, no uptime, and no dashboard.

It does *not* validate the scorer against known ground truth. There is no bid history to validate against — see §8.2.

**Forwards (production).** `since = last successful run`, on a schedule. Same adapters, same scorer, same storage.

There is no throwaway "historical import" system. This is why archive depth is a primary source-selection criterion rather than a nice-to-have — a source that cannot be run backwards cannot participate in proving the market.

### 3.2 Build sequencing lives in the plan of action

This document describes the designed system in full. It is deliberately larger than one implementation effort, and it deliberately does not say what gets built when.

**That sequencing now exists: `docs/Tenderfoot-Plan-of-Action.md`** — nine development slices with a go/no-go gate at SP6, applying the `docs/Proto2PRD.md` playbook to this project.

This document constrains that sequencing in exactly two places, and they are load-bearing: the schema carries its entity foreign keys from the first migration (§2.2), and ingestion adapters are backfill-capable from the first adapter (§3.1). Everything else the plan is free to reorder.

---

## 4. Data model

Eleven object types, in four groups.

### 4.1 Buyer side

**Organization** — any entity that buys. State agencies, counties, municipalities, school corporations, health systems, foundations. Hierarchical (*State of Indiana → FSSA → Division of Medicaid*), so filtering works at any level.

Carries an **alias list**. This is the entity resolution problem in its entirety: `Indiana Family and Social Services Administration`, `FSSA`, and `IN-FSSA` are one row.

Accumulates behavior over time: how often it competes work, whether it runs an RFI first, whether incumbents ever lose there.

### 4.2 Seller side

**Vendor** — anyone who sells. Competitors, incumbents, potential primes, and **Koehler Partners itself**. KP being an ordinary Vendor row with a Profile attached is what keeps the system portable. Also carries aliases. Win history *infers* capability — you learn who does Indiana health-policy evaluation work by observing who keeps winning it.

**Firm Profile** — the configuration record attached to KP's Vendor row. The only place KP-specific facts exist:

- Capabilities and service lines, as free text (this is what carries "Medicaid managed care operations")
- Classification codes — NAICS, PSC, UNSPSC, state commodity codes
- Certifications and set-aside status — WBE, MBE, DBE, WOSB/EDWOSB, VOSB, 8(a), HUBZone, state equivalents
- Geography served, and whether work is remote-deliverable
- Hard limits — bonding capacity, insurance ceilings, headcount, revenue, registrations held. **Eligibility thresholds only** (§1): these answer *can KP legally bid this*, never *should KP take this on*.
- Past performance library — the projects that can actually be cited. **Deferred 2026-08-10: the records are not accessible to this project. The field stays in the model and stays empty; nothing may be designed to depend on it.** See §7.3.
- Negative profile — what will never be bid, and why **Not in the Profile:** any representation of KP's workload, staffing level as a capacity constraint, pursuit concurrency limit, or engagement calendar. Earlier drafts carried a capacity timeline; it was removed deliberately (§1). The system surfaces qualified prospects and stops there.

**Bootstrap:** the Profile can be largely auto-drafted from KP's website and past proposals, then corrected by hand. This is also the onboarding flow a future customer would receive.

**Scope configuration.** Geography and sector are Profile settings, not code. KP's initial scope is Indiana state and local, neighboring Midwest states, federal (SAM.gov), and foundation/nonprofit solicitations.

### 4.3 The event chain

**Solicitation → Award → Contract**

**Solicitation** — an event published by an Organization: RFP, RFI, RFQ, IFB, sources sought. Carries type, dates, estimated value, codes, documents, and status. Versioned, because addenda change it.

**Award** — links a Solicitation to the winning Vendor(s) and value.

**Contract** — what results. Organization, Vendor(s), start and end date, value, renewal options.

**The contract end date is the highest-value field in the system.** A contract ending in 14 months, held by a beatable vendor, at an agency that competes its work, is a lead that appears without anyone having published anything. This is the entire answer to problem #2.

Awards and Contracts may exist **without** a corresponding Solicitation, discovered from spending and transparency data. The chain is a graph, not a required sequence.

### 4.4 The three that get skipped

**Source** — registry entry. Jurisdiction, adapter type, auth requirements, legal posture, archive depth, refresh cadence, health metrics, yield statistics. Data, not code.

**Sighting** — *"Source X showed us this listing on date Y."* Raw, unmerged, immutable. A Solicitation is the canonical record produced by merging Sightings.

This separation is nearly free now and expensive later, and it provides three things: deduplication across sources; **change detection** (a Sighting that disagrees with the canonical record means an addendum moved something, which is a notification); and honest **per-source yield metrics** so unproductive sources can be retired.

**Document** — attachments, with raw file, extracted text, and extraction confidence. The listing page is metadata; the scope of work is in a PDF.

### 4.5 Judgment layer

**Assessment** — the score for a `(Solicitation × Firm Profile)` pair, **versioned by scorer version**. Required so that changing the scorer can be evaluated against accumulated adjudications (§8.2) rather than hoped about.

**Pursuit** — the lifecycle record:

```
New → Triaged → Watching → Bid / No-Bid → Submitted → Won / Lost
```

Each transition carries a **reason**. This is the system of record, and every reason is a labeled training example.

There is no prior history to seed this table with (§8.2) — it starts empty and fills from Phase 0 adjudications and then from live use. That makes the reason field load-bearing from the very first decision rather than merely nice to have.

### 4.6 What the model buys

Two of the most valuable features are not features — they are queries:

- **Expiration radar:** contracts ending in 6–18 months, at Organizations matching geography, in categories matching the Profile, held by displaceable Vendors.
- **Teaming radar:** solicitations above KP's size with participation goals, cross-referenced against Vendors likely to bid. KP's WBE status turns unreachable opportunities into outreach targets.

---

## 5. Ingestion

### 5.1 Four adapter tiers, in order of preference

1. **API** — SAM.gov, USASpending, some state portals. Structured, stable, permitted, backfillable. Always preferred where it exists.
2. **Email and RSS** — most portals will email notifications matching saved searches. A dedicated inbox subscribed to many portals yields more per hour of work than scraping, does not break on redesign, has no terms-of-service problem, and needs no scheduler. Detail pages still get fetched, but from a *known* URL rather than a discovered one.

**The trap:** these subscriptions are usually themselves code filters. Indiana matches notifications to the bidder's UNSPSC codes (§5.8) — meaning the portal applies exactly the filter §6.2 forbids, before the record is ever visible, and invisibly. Two rules follow. Register with a **deliberately over-inclusive** code set. And treat email as a *change-detection ping*, never as the record source: every email-tier source stays paired with a listing adapter that sees everything posted.
3. **HTML scrape** — where neither exists. Accept that these rot.
4. **Manual drop** — paste a URL or forward an email and it ingests. Small feature, disproportionate value: the system is never a wall, and opportunities heard about in conversation get captured.

### 5.2 Sources yield different record types

- **Solicitation sources** — the portals
- **Award and contract sources** — USASpending, state transparency sites, contract registries. These feed the entity chain and the expiration radar, and are often easier to obtain than solicitations because transparency law requires publication.
- **Signal sources** — grant awards, board minutes, budget documents. Low structure, long lead time.

Award sources are where the lead-time advantage comes from and are what a generic bid service will not cross-reference.

### 5.3 Three hops, then extraction

**Listing → detail page → attached documents.** Each hop costs more and yields more. Hop one rejects most items on geography and hard gates alone. **Fetch depth follows score** — only survivors have their documents pulled and parsed.

Extraction is a separate stage from fetching. It produces: deadline, mandatory pre-bid conference date, Q&A deadline, contract value and term, incumbent, bonding and insurance thresholds, set-aside requirements, and evaluation criteria with weights.

Every extracted field carries a **confidence score and a pointer back to its source text**, so verification takes seconds rather than re-reading the document.

### 5.4 Sources rot; instrument for it

The failure mode that kills these systems is not a crash — it is a scraper that silently returns zero rows after a site redesign and goes unnoticed for months.

Every source carries expected-volume baselines. A source producing nothing for 30 days raises a flag and is treated as an incident.

Sources degrade rather than fail: if detail-page parsing breaks but the listing works, keep the listing and mark the record incomplete.

### 5.5 Legal posture is a column

Robots.txt, terms of service, whether account terms forbid automated access, and rate limits. GovWin, BidNet, and BidPrime explicitly prohibit scraping. The tier ordering largely resolves this on its own — APIs and email subscriptions are sources inviting you in.

### 5.6 Coverage grows demand-driven

Not "cover Indiana," but "cover what the Profile actually reaches." Realistically: SAM.gov and USASpending first (free, structured, and where the entity model gets validated cheaply), then Indiana's state portal and its largest local buyers, then notification subscriptions for Midwest states, with manual drop covering the rest. Each new source earns its slot with yield numbers.

Demand-driven still governs *which* sources get added. But §5.7 changes the growth curve: the marginal cost of the second jurisdiction on an already-built platform is near zero, so the ordering should prefer a new state on a known platform over a new state on a new one, all else equal.

### 5.7 Adapters bind to platforms, not jurisdictions

States do not build procurement portals; most license one of roughly five. Verified or strongly indicated across the initial scope:

| Portal | Platform | Anonymous browse | Closed solicitations retained |
|---|---|---|---|
| Illinois BidBuy | Periscope S2G (BidSync/Jaggaer) | **Verified** — public browse, no login | **YES — verified 2026-08-12.** 2,155 closed, back to 2018-02-23 |
| Ohio OhioBuys | Ivalua | **Blocked to automation** — CAPTCHA browser check (2026-08-12) | Unknown |
| Michigan SIGMA VSS | CGI Advantage VSS | ✅ **Cleared 2026-08-12** — posture **in**; authorisation read as deriving from a held vendor account | ❌ **NO — settled 2026-08-12.** Only open solicitations are listed, and the filter that would change that is silently ignored |
| Kentucky eMARS VSS | CGI Advantage VSS — *same as Michigan* | ✅ **In**, same reading, same platform | ❌ Assume none — same platform, same behaviour |
| Indiana IDOA | PeopleSoft supplier portal + static HTML public list | Verified public | **No.** Closed solicitations are not published (§5.8) |

The same platforms recur nationally: Periscope also runs Arkansas and Montana, Ivalua runs North Dakota, CGI Advantage runs Colorado and Maine.

**Therefore the Source Registry carries a `platform` field, and adapters bind to platform plus per-deployment configuration rather than to a jurisdiction.** One CGI Advantage adapter covers Michigan and Kentucky together; one Periscope adapter covers Illinois and several others.

Two limits, so this is not oversold. Deployments differ in enabled fields, URL paths, and authentication, so this is a *parameterized* adapter, not a free one — much of the work is shared, not all of it. And the largest states (California, Florida, Texas, Virginia) run custom systems where the leverage is absent entirely.

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
| **Illinois BidBuy (Periscope)** | **Public advanced search carries a real `status` filter — `Approved · Closed · Evaluated · Intent To Award · Opened · Bid to PO · Sent`. Searching `Closed` returns 2,155 records, oldest opening date 2018-02-23.** Results carry buyer, organization, description, opening date and **awarded vendor**. No account | **Solicitation-side backtesting is possible outside the federal sources.** One Periscope adapter covers Illinois and, per §5.7, Arkansas and Montana |
| **Illinois BidBuy (Periscope)** | **The `status` parameter is honoured, not silently ignored** — verified by §5.4's method: holding `openBids=true` and setting `status=Closed` moved the count 127 → 0 (empty intersection), and dropping the open-bids constraint returned 2,155 | The one platform confirmed to pass the silent-failure test. Record the method in the registry's verified-facets field |
| **Michigan SIGMA VSS (CGI Advantage)** | Pages render with no login — *View Published Solicitations* and *Award History* both return data, the latter 3,762 records. The system displays an access-restriction banner: *"intended for government authorized users only… Disconnect immediately if you do not have express written authorization to access SIGMA!"* | **Reviewed and cleared by Matt, 2026-08-12.** Reading: authorisation derives from holding a vendor account, which KP has or has had. Posture **in**; revisit if challenged. **Engineering consequence: the adapter should authenticate rather than read anonymously**, which moves the governing text from this banner to KP's account terms — a different document, and the usual home of automated-access clauses |
| **Michigan SIGMA VSS** | **No closed-solicitation retention. Settled 2026-08-12.** `Show Me` offers *All / Open / Closing Soon / Recently Published / Recent Amendments / Recent Intents / Recent Awards*. Setting it to `All` and to `Recent Awards` **returns byte-identical result sets to `Open`** — same 20 rows, same near-future closing dates, every row status `Open`. Every listed solicitation closes in the future | **A fourth silent-failure instance, on a third platform.** The control's value changes and the result set does not. Same pattern as SAM.gov's `sort` and Indiana's date parameters (§5.4). CGI Advantage is now the third independent system confirmed to accept a parameter and ignore it |
| **Michigan SIGMA VSS** | Solicitation totals are withheld — `1 - 20 of 20+ Records`, `Page 1 of 1+`. Award History *does* give a total (3,762) | An adapter must page until exhaustion rather than read a count, and **§5.4's vary-a-parameter check cannot run on the solicitation grid at all** — there is no number to watch move. Health monitoring for this source needs a different signal |
| **Michigan SIGMA VSS** | **"Award History" is grant disbursements, not procurement awards.** Columns are `Date · Grantee · Component Description · Grant Code Description · Grant Code`; rows are counties, conservation districts, and loan-repayment programmes | **Corrects an earlier entry in this table** that read the 3,762 records as contract awards. It is not the contract-side dataset Indiana's Phase 0 runs on, and it does not substitute for one |
| **Michigan SIGMA VSS** | All traffic is a form POST to a single endpoint, `POST /PRDVSS1X1/Advantage4`, with server-side session state | Tier 3 and genuinely so — postback-driven, not a queryable API. Materially more expensive per adapter than Illinois' Periscope, which exposes real search parameters |
| **Ohio OhioBuys (Ivalua)** | **Gated behind a CAPTCHA browser check.** The public solicitation URL redirects to `/bas/browser_check` and fails automated navigation | **Not a tier-3 candidate as things stand.** Bot detection is a legal-posture and adapter-feasibility fact, not merely an inconvenience. A person can browse it; a scheduled adapter cannot |

The Indiana archive gap resolves in a useful direction. The state's *contract* side is well published even though its *solicitation* side is not — and contract end dates were already the higher-value signal (§4.3). The gap pushes Phase 0 toward the better data rather than away from it.


### 5.9 Platform properties

`Proto2PRD` §5.2 requires this section in the architectural spec, on the strength of a specific failure: IMPACT's production went down thirteen days after launch because both Supabase projects were free tier and auto-paused after ~7 days of inactivity. *"Not a bug — a documented property of the plan, never written down."*

**For Tenderfoot the section inverts, and the inversion is the point.**

**We have no hosting platform, so it has no properties.** V1 is local-first: SQLite on disk, one user, batch ingestion (workflow spec §7). No tier limits, no cold starts, no connection caps, no auto-pause.

**What Tenderfoot has instead is four source platforms belonging to other people**, whose properties are load-bearing and are documented in §5.7–5.8 and carried per-row in the Source Registry. The consolidated view lives in the workflow spec §10; the ones that change how code is written are `sort` on SAM.gov, `amount` on Indiana, withheld totals on Michigan, and CAPTCHA gating on Ohio.

> **The equivalent failure is not ours to prevent by upgrading a plan.** It is **a source that quietly stops returning real results** — four confirmed instances across three independent platforms of a parameter accepted and silently ignored (§5.4). Same shape as auto-pause: a documented property of somebody else's system, invisible until something downstream is already wrong.
>
> **Two consequences, both already in force.** Every new adapter runs the vary-one-parameter check as part of being added, and the result is recorded on the Registry row. Where a source withholds totals — Michigan — **that fact is recorded too, because it means the check cannot run there and health must be inferred another way.**

**One hosting property does exist, and it is dated.** At **SP7**, scheduled live ingestion means a machine must be awake to scrape. That is the point at which this section acquires real content and the workflow spec's §7 needs rewriting. Owned by whoever writes the SP7 plan.

---

## 6. Matching — PARKED 2026-08-11

> ### Read this before reading the rest of §6
>
> **This section is parked in full. It does not describe what will be built.**
>
> V1 returns everything active sources return (§1.1). Qualification happens after ingestion is running, and when it does it will be **re-imagined from scratch** rather than resumed from here. That is a deliberate instruction, not a scheduling note: nothing below is a commitment, an interface, or a starting point.
>
> **Why it is kept rather than deleted.** Everything here is reasoning about a problem that has not gone away, and some of it is durable independent of any particular design — §6.2's argument that a filter's losses are invisible, §6.4's observation that wired bids are a *winnability* signal rather than a *fit* signal, §6.7's case for calibrating to a volume rather than a threshold. Deleting it would cost those arguments and save nothing. **But a parked design that stays legible is a design that gets resumed by accident**, so the boundary is drawn loudly here rather than politely.
>
> **What is actually in force from this section:** nothing structural. The four score components, the funnel, the stage ordering, the feedback loop, and the reason vocabulary are all open questions again.
>
> **One rule survives the parking, promoted out of here so it does not get lost:** *hard gates and soft scores never mix, and gated items are filed rather than deleted* (§6.2). That is not a matching decision, it is a data-integrity decision, and it holds regardless of what qualification eventually looks like.
>
> Reason chips are also parked as a *vocabulary* — V1 records free text. **The capacity question that hung over them is now resolved rather than dormant** (§1, *the rule binds the machine, not the person*): a user may record a capacity reason and should, and the defect was never the chip but §6.6's automatic pipe from every recorded reason into few-shot context. **Whatever replaces this section must classify reasons on the way in and exclude the capacity class from anything that learns.** That is the one requirement §6 hands forward.

### 6.1 The funnel

**Stage 0 — Hard gates.** Deterministic, no model. Geography outside profile, deadline passed, mandatory pre-bid already held, bonding above capacity, insurance above coverage, registration not held, revenue or headcount floors unmet. Eliminates most volume at zero cost, fully auditable.

**Stage 1 — Semantic recall.** Embed the solicitation, compare against Profile capability vectors. Catches opportunities described in vocabulary nobody would have thought to keyword on. Ranks; never rejects.

**Stage 2 — LLM adjudication.** Survivors only. The model reads the solicitation with the Firm Profile in context and produces a structured judgment. The brief (§7.3) is a byproduct of the same call, not a separate feature.

**Stage 3 — Human decision**, which feeds back into Stage 2.

Fetch depth (§5.3) follows this funnel.

### 6.2 Two disciplines

**Hard gates and soft scores never mix.** A model never makes a hard-gate call; a high fit score never overrides one. But **gated items are filed, not deleted** — *"Rejected: bonding requirement $500K exceeds $250K capacity"* is useful information, and extraction is sometimes simply wrong. A rejection that cannot be inspected is a bug that will never be found.

**Codes are a signal, never a filter.** NAICS, PSC, UNSPSC, and state commodity codes are frequently missing or wrong in state and local procurement. Codes earn a positive boost on match; they never gate. Using codes as a filter is the most common way these systems develop a silent recall problem, and recall is KP's first-named pain.

This rule binds upstream too. Where a source's *own* notification subscription is code-filtered — as Indiana's is — the discipline is enforced by registering over-inclusively and pairing the subscription with a listing adapter (§5.1). A filter applied by someone else is still a filter, and it is worse than one applied here because its losses are invisible.

### 6.3 Four machine scores, one human score

The system produces four components, kept separate and separately visible:

| Component | Question |
|---|---|
| **Fit** | Can we do this work? |
| **Winnability** | Realistic odds — incumbency, field size, evaluation criteria, references held |
| **Value** | Contract size × term × plausible margin |
| **Timing** | Is the response window survivable? How much runway is there before the deadline? |

**Timing is a property of the opportunity, not of KP** (§1). It asks whether there is enough time left to produce a real proposal — days remaining, whether a mandatory pre-bid conference has already passed, whether the Q&A window is still open. It does *not* consult a workload calendar, and it does not know or care what else is in flight.

Separation permits sorting a single blended number cannot: *high value, low winnability* is a teaming call, not a no-bid. *Everything strong but a 9-day window* is a lesson about watching that agency earlier.

Every component cites the specific text that drove it — not for elegance, but because an explanation is what makes a human correction meaningful.

**Cost to pursue is a human judgment and is not scored by the system.** It depends on staff availability, existing written content, and appetite for the client. Instead:

- The system **extracts the ingredients**: page limits, required forms and attachments, mandatory meetings with dates and locations, references required, submission quirks (notarization, hard copies, portal formats), and how much of the scope appears to be net-new writing. Facts on a panel — the ten minutes of digging is done, the ten-second judgment is the user's.
- The user rates **light / moderate / heavy** at triage.
- After roughly twenty ratings, the brief can surface **recall, not estimation**: *"you rated the last three IDOA RFPs as heavy."* Honest, and it costs nothing to begin collecting now.

### 6.4 Winnability penalizes wired bids

Explicit negative signals: unusually short response window, qualifications so specific only one firm holds them, incumbent named in the scope, no preceding RFI, sole-source justification language. These score as *low winnability*, not *high fit* — the distinction that prevents three wasted weeks.

### 6.5 Three match modes, one Profile

1. **Should we bid this?** — the funnel above
2. **Who should we call?** — the teaming radar (§4.6)
3. **What's coming?** — the expiration radar (§4.6), scored identically but against a predicted solicitation

### 6.6 Feedback loop, and a hard limit

Every Pursuit decision — especially every no-bid reason — becomes a labeled example, fed into Stage 2's context as few-shot guidance: *here is what this firm bid, here is what they passed on and why.* Effective from the first decision, fully interpretable.

**The system will not train a model.** At 10–40 pursuits per year, a usable training set will not exist for many years. Curated examples in context is not a cheap substitute at this data volume — it is the correct approach, and building an ML pipeline here would be pure waste.

### 6.7 Calibrate to a rate, not a threshold

Target a **volume** (the top N per period), not a score cutoff. Absolute scores drift as the scorer and source mix change; a fixed threshold eventually either floods or goes silent, and both end with the tool being ignored. A thin week shows thin results, which is itself information.

---

## 7. The application

Tenderfoot is an app. Triage happens in the app.

### 7.1 Triage queue — the daily driver

The fastest thing in the product. One opportunity per screen, keyboard-driven, decision in under ten seconds. The working habit is **"clear the queue"** — a queue reaching zero is a stronger habit than a daily email, which becomes wallpaper.

The app earns its login by capturing what email cannot:

- ~~Four scores **with their supporting evidence**~~ — **parked with §6.** V1 shows extracted facts, not judgments.
- The **pursuit-cost fact panel**, enabling the light/moderate/heavy judgment on the spot
- The **decision and its reason**, recorded against the opportunity — something email can only ever reduce to a binary

~~Responsive, so ten-second triage decisions work on a phone.~~ **CHANGED 2026-08-13: the web application is DESKTOP-ONLY. Phone triage is served by a separate mobile client against the same data, not by responsive web.** Reasoning and the measurement behind it are in `prototype/PUNCH-LIST.md` item 2. **Until that client exists there is no phone story at all** — that cost is accepted, not overlooked.

> **What the queue is in V1 (2026-08-11).** Everything active sources returned, in a defensible order that is **not a judgment** — newest first, or soonest deadline first, chosen by the user. No score strip, no ranking, nothing suppressed.
>
> The ten-second decision still stands, but it now rests on **extracted facts** rather than on scores: deadline, buyer, set-aside status, dollar figures, the pursuit-cost panel, and the documents themselves. That is a lower bar than the spec originally set and a much more honest one — every one of those is a fact the system can be right or wrong about in a checkable way, which is exactly what §8.4 measures.
>
> **The reason is still recorded, and it is still worth recording** — it is problem #4, the system of record, and it costs one tap. What changed is that it no longer feeds anything automatically, so recording it is journalism rather than training. When qualification is designed, this is the corpus it gets designed against, and **that is a better position than designing the vocabulary first and collecting into it.**

### 7.2 Pipeline board

Pursuits across their states. The system of record; the answer to problem #4.

### 7.3 Opportunity detail

- The **brief** — what it is, why it fits, what is missing and would need a partner, key dates, key risks, the pursuit-cost fact panel, and a recommended posture.

> **Scope change, 2026-08-10.** This bullet previously read *"which specific past projects to cite"*, and claimed the brief's value *"is not summarizing the RFP; it is connecting the RFP to KP's past performance library, which is the tedious part of every bid/no-bid call."*
>
> **The past performance records are not accessible to this project** (Matt, 2026-08-10), so that capability is deferred and nothing may be built assuming it.
>
> **What this costs, stated plainly:** the brief was the clearest answer to *why open an app instead of reading the RFP*. Without the library it is a well-organised summary with evidence attached — still worth having, no longer decisive. The remaining case for the app is the triage queue's reason capture (§7.1), which is unaffected and was always the larger claim.
>
> The Firm Profile field stays in the model and stays empty (§4.2). If the records become available the capability returns without a migration, which is the only reason to leave the field in place rather than delete it.
- Four scores with citations
- Extracted fields with confidence
- Documents inline, with extraction highlights pointing back into the source PDF
- A **timeline** of every Sighting and addendum — what the Sighting table exists for, and what makes an extracted deadline trustworthy in seconds

### 7.4 Radars

Expiration and Teaming (§4.6). Browsable and filterable. Pure graph queries with no email equivalent; they exist only because of the entity model.

### 7.5 Entity browser

Organizations and Vendors with their histories. *This agency competes work every four years and the incumbent has never lost* is worth knowing before writing anything.

### 7.6 Reports

Phase 0 market sizing as a live view — how many qualified prospects exist, at what value, from which sources — plus source-yield reporting. Win rate becomes a report once there is enough history to populate one; it is never a system objective (§8.6).

### 7.7 Saved views

Persisted custom queries.

### 7.8 Admin

- **Firm Profile editor** — a real screen, not a config file. This is what makes the system portable.
- **Source Registry** with health indicators — where §5.4's rot detection surfaces.

### 7.9 Email's role

A pull signal and a tripwire, not a workspace:

- A scheduled summary indicating whether the queue is worth opening, deep-linked into the app
- Genuinely time-critical alerts: a deadline moved on an active pursuit, an addendum posted, an award announced

Two kinds of interruption and only two. Everything else is pull.


### 7.10 The fidelity mandate

**Added 2026-08-12 (Stage B1), before sub-project 1 begins** — which is the point of it. `Proto2PRD` §5.2: put this in before an audit discovers it is missing.

> **The frontend MUST look and behave exactly like the prototype. Pixel-for-pixel parity is the non-negotiable success criterion. Every other consideration — abstraction reuse, component elegance, developer ergonomics — is subordinate to it.**

**A mandate without a definition is inspiration rather than instruction**, so:

#### What "matching" means

- **Same semantic elements, nesting, and class names.**
- **Same tokens** — `prototype/PROTOTYPE/src/tokens.css`, 67 role-named colours and 13 radius tokens, verified byte-identical to the bundle by `prototype/tools/verify-tokens.py`. CI runs that check (workflow spec §6).
- **Same spacing scale, radii, shadows, typography.**
- **Same container width, header height, mark size.**
- **Copy verbatim.** Titles, button labels, micro-labels, modal bodies, toast messages, empty states. **`MACHINE SCORES — A READING AID`, `COST TO PURSUE — FACTS, NOT A SCORE`, `GATED ITEMS — FILED, NOT DELETED (§6.2)`** — these are specification, not placeholder text, and each carries an argument. **Verified present in the V1.2 bundle: 1, 1 and 2 occurrences respectively.**

  > **⚠ Corrected 2026-08-13. This list previously opened with `ORDER · AMBIGUITY FIRST`, which is NOT literal copy** — the substring `AMBIGUITY` occurs **zero** times in the bundle. It renders on screen because the mock data layer supplies it as a **value**: the label is `ORDER ·` and the rest is *the currently selected ordering*.
  >
  > **Treating it as fixed copy would have contradicted a ratified decision.** SVRC View 1.1 ratified that queue ordering is **switchable**, and recorded that *"switchable is the part worth having"* — a component hardcoding `AMBIGUITY FIRST` would have built the opposite of what was decided.
  >
  > **Found by an implementer searching the bundle for a string this document told it to expect.** The lesson generalises: **a copy list must distinguish labels from values**, because a rendered screenshot shows both and looks identical either way. Ambiguity-first remains the *default* ordering, which is a decision — it is simply not a string.

#### Three clauses this project needs that IMPACT's did not

**1. The mandate names a version.** Parity is against **`Tenderfoot UI Mockups V1.2.html`**, the frozen bundle. Not "the prototype", which iterates. **When a new version lands, re-pointing this mandate is a deliberate act**, taken with the `Proto` audit (`Proto2PRD` §4.7.5), not an automatic consequence of a file appearing. An unversioned parity requirement is unfalsifiable.

> **Re-pointed V1.1 → V1.2 on 2026-08-13, deliberately, and the clause got its first real exercise.** The sequence was: diff the bundles (6 lines, 3 hunks), **verify the *unchanged* `tokens.css` still round-trips to the new bundle** — 67 tokens, 13 radii, zero uncovered literals — re-point the tooling, regenerate and confirm only labels moved, re-score the `Proto` column, rebuild the explainer, and look at a screenshot.
>
> **The token check is the part worth copying.** Verifying the *existing* tokens against the new bundle proves the layer did not move; regenerating first and then verifying would have proved nothing, because the two would agree by construction. That is the same failure this project already recorded once, when a generator and its verifier shared a bug.
>
> **V1.1 stays in `prototype/PROTOTYPE/` and is not deleted.** The diff between versions is what says which rule-bearing comments still apply.

**2. ~~Parity applies to what V1 builds, not to everything drawn.~~ SUPERSEDED 2026-08-13 by Matt — the intelligence chrome IS built, inert.**

> ~~The prototype shows the **finished product**; V1 ships a subset (§1.1). Region 1.1.2 (Score Strip), Region 1.1.5 (Gated Items Drawer) and View 2.2 (Scores and Evidence) are parked and **are not built**. The mandate does not require building them — it requires that when they are built, they match.~~

**The revised rule.** Matt's direction, in his words: *"I want us to keep those in as we build the application and build them into the UI even though they're not active… They will be vestigial until we activate them."*

**So the parked intelligence layer is BUILT as interface and left non-functional.** Score strips, AI-assessment panels, smart-filter controls, the settings that govern them, and any prototype element serving qualification — all constructed, all rendered, none wired. **Nothing is trimmed from the prototype to reflect V1's scope, and nothing is deferred out of the UI either.**

**Why he is right, stated so the reasoning survives the decision.** The prototype represents the finished product and doubles as demo material. A build that omits every parked element would not be a subset of the product — **it would be a different product**, with holes where the screens were designed around content. Views composed to carry a score strip look broken without one, and "looks broken" is indistinguishable from "is broken" to anyone being shown it.

> ### The guard this creates, and it is the important half
>
> **A rendered control may never become an active filter, ranking, or score without qualification being designed first.**
>
> §1.1 parks matching as **undesigned**, not as pending work. Shipping inert filter chrome puts a wired-up switch one small commit away from existing — and that commit would be exactly the failure `Proto2PRD` §4.7.5 names: *the risk is not the wrong answer, it is the unratified one.*
>
> **This is the same shape as the Capacity resolution** (§9 item 8): the artifact is permitted, the data flow is forbidden. There, a recorded capacity judgment may be a journal entry and may never become model input. Here, an intelligence control may be an interface element and may never become a live filter until the thing it filters by has been designed.
>
> **Two consequences worth naming.** The `assessment` table already exists and stays empty by design, so score surfaces render from genuine emptiness rather than fixtures — **do not seed fake scores to make the chrome look alive.** And whatever visual treatment "vestigial" takes — disabled, empty-state, explicitly labelled as inactive — **is undesigned and stays that way until Matt specifies it.** It is a real design question with several defensible answers, and pre-specifying it here would be inventing.

**3. The wordmark is exempt until it exists.** The header renders `WORDMARK — PLACEHOLDER`. Pixel parity with a placeholder is not a goal. On the V1.2 punch list; the exemption ends when the mark does.

#### Acceptable deviations — no paperwork required

- **Real data replacing mock data.**
- **Routes replacing in-page state.** The prototype has no router; the build does (workflow spec §1). Deep links are an addition, pre-authorised here.
- **Framework form components** replacing raw handlers.
- **Working interactions where the prototype's are inert.** The decision buttons do not advance the queue in the mockup, and the cleared state sits behind a flag. Those are mockup limitations, not design intent.
- **Non-visual accessibility additions** — labels, roles, focus management, live regions.

**Anything else requires an explicit `Deviation:` entry in the commit or PR body, with justification.**

> *"A mandate without an escape hatch gets quietly violated. A mandate with a documented escape hatch gets followed, because compliance is easier than the paperwork of deviating."* — `Proto2PRD` §5.2

#### ~~One gap in this mandate~~ — **CLOSED 2026-08-13. The hole became a decision.**

> ~~**The prototype specifies desktop only.** But §7.1 requires the triage queue to work on a phone… **So responsive behaviour has no reference to be faithful to.** Pixel parity is defined at desktop and undefined below it, which means the mobile layout will be *designed during the build* by whoever writes the component — silently, and without anyone deciding it. Two ways to close it, both cheap, neither yet chosen.~~

**A third way was chosen: there is no mobile web layout to be faithful to, because there is no mobile web.** The application is **desktop-only by decision**, and phone triage is served by a **separate mobile client against the same data**.

**Matt's rule was conditional and was tested rather than assumed** — *if the design system supports an easy path to responsiveness, make all of it responsive; if not, stay desktop-only.* Measured across the frozen bundle: **0 `@media` queries, 0 `clamp()`, 0 `auto-fit`, and 3 `flex-wrap` across 74 flex containers.** The layout is *fluid* — 69 `minmax()` uses, only 14 fixed pixel widths — but fluid within desktop widths is not responsive. Grids carry **fixed column counts**, and several mix fixed tracks: `190px minmax(0,1fr) 110px 150px` is 450px of column before content, which overflows a phone outright. Adding breakpoints means a collapse decision for ~33 grids, per screen. Full figures in `prototype/PUNCH-LIST.md` item 2.

**So the mandate is now whole rather than holed.** Pixel parity is defined at desktop, and *undefined below it is no longer a gap* — it is out of scope for this client. **Nothing gets designed silently during the build**, which was the only thing the hole actually endangered.

**The cost, stated so it is not discovered later:** V1 has **no phone story at all** until the separate client exists. Anyone needing to triage on a phone before then cannot. The mobile client is pinned in `docs/Pinned-Ingestion-Scaffolding.md` and is not scheduled.

---

## 8. Validation

### 8.1 The backtest is the permanent test suite

Phase 0 does not end. Every scoring change is re-run over the archive and compared, which is only possible because Assessments are versioned by scorer version.

> **V1 has no scorer, so it has nothing to backtest** — but the archive it runs over is exactly what V1 accumulates. Keep the versioning discipline in the schema from the first migration regardless (§2.2): retrofitting a version column onto recorded judgments is the same expensive mistake as retrofitting foreign keys, and V1's whole output is judgments.

### 8.2 There is no answer key; validation is human adjudication

This section originally assumed KP's bid/win/loss history could seed Pursuit records and serve as ground truth. It cannot. KP has competitively bid **one** solicitation — a small Indiana University engagement. Recalled success across all past proposals is roughly 30%, but that is a recollection rather than a record, and it counts a $100K job identically to a $5M one.

**This is not a system that improves an existing bid process. There is no existing process to improve.** The pipeline is being built from zero. That raises the bar on early precision: a bad first month has nothing to be judged against and no established habit to fall back on.

Validation therefore works as follows.

**Adjudication.** The backtest produces a ranked list; the user reads the top N and marks each *would have bid* / *would not have bid* / *unclear*. Slower than scoring against history, but it is the only ground truth available — and it produces the few-shot example set (§6.6) as a byproduct rather than as separate work.

> **Restated for V1 (2026-08-11), and it gets simpler.** With everything returned there is no ranked list and no top N — the user reads *what arrived* and marks it. Same three verdicts, same one-line reason, no sampling decision to get wrong.
>
> **This dissolves the distinction between the hand-run and the application**, and the hand-run lost. It was conceived as a precursor: score a corpus by hand to find out whether the premise holds before building a scorer. V1 has no scorer, so there was no premise left for it to test — and **it was retired permanently the same day** (plan of action §A2). What it was going to do, V1 does continuously on live data, as its normal operation.
>
> **What that costs, since it is not free.** The negative profile (§4.2) loses its last source — past proposals were already unavailable, and the reroute to the hand-run's no-bid reasons is gone with it, so the field stays in the model and stays empty until V1 accumulates decisions. And **inter-rater agreement is never measured**, which means the ceiling on achievable precision is permanently unknown; when qualification is designed, *how much better than two disagreeing experts does this need to be* will have no answer.
>
> The gain is that decisions now accumulate from the real workflow rather than from an exercise, which is the better corpus to design qualification against. The loss is that nothing arrives until V1 runs, and there is no longer a cheap early read on whether the premise holds at all. That read now happens at SP6, behind every slice of build work.

**Accuracy is the whole measure.** Per §1, the only question Phase 0 answers is whether the prospects surfaced are good ones. Two numbers come out of adjudication: what fraction of the top N the user would actually have bid (precision), and how many of those KP had never seen (discovery). Nothing is grouped against a workload calendar — the system has no opinion about whether KP had room.

**Value-weighted, never count-weighted.** With roughly a 50× spread between KP's smallest and largest engagements, any metric treating bids as equal units is wrong. Report expected value, not hit count. This applies to every number in this section.

**Past proposals still do work — but not yet.** Even without bid outcomes, the proposals KP has already written would populate the past performance library and the negative profile (§4.2). **Both are deferred as of 2026-08-10:** the records are not accessible to this project. The negative profile — what will never be bid, and why — has a second source that *is* available, namely the hand-run's no-bid reasons, and should be built from those instead.

> **That reroute failed 2026-08-11.** The hand-run was retired permanently, so the second source is gone too. **The negative profile now has no source at all** until V1 accumulates real decisions in normal operation.
>
> Same treatment as past performance and for the same reason: **the field stays in the model and stays empty.** Nothing may be designed assuming it, and if a source appears the capability returns without a migration. Worth noticing that this is the second time this field has lost a supplier — it is the least-supported thing in the data model, and any design that leans on it should be read sceptically.

**Known limitation:** true recall remains unmeasurable — what was published but never seen is unknown. If that gap needs closing, the method is to pick one jurisdiction and one year, exhaustively enumerate everything published, and score all of it. Done once, not annually.

### 8.3 Precision, measured live — SUPERSEDED FOR V1

> **Precision is not a measure of a system that returns everything.** With no ranking and no filter (§1.1), the Interested rate is simply the base rate of the active sources. It says something about the *sources* — which is worth knowing, and §5.6 already tracks per-source yield — but nothing whatever about Tenderfoot, because Tenderfoot made no selection to be judged.
>
> **The measure that survives is discovery**, and it is the right one anyway: of what surfaced, how much was work KP would pursue *and had not otherwise seen*? That number is meaningful with or without a scorer, it maps directly onto problem #1, and unlike precision it cannot be gamed by returning less.
>
> Two supporting numbers, both free once everything is collected:
>
> - **Volume**, per source and per week. This is the finding that determines whether qualification is urgent or academic, and nobody currently knows it.
> - **Base rate**, per source. Interested-per-hundred-surfaced. When qualification is eventually designed, this is what it has to beat.
>
> The paragraph below applies again the moment anything ranks or filters. Kept for that reason.

Of what the queue surfaced this period, what fraction was marked Interested? Roughly 30–50% is healthy. Ten percent is noise and predicts abandonment. Ninety percent means the scorer is too conservative and quietly missing things — the failure mode that feels like success, and the reason codes never gate.

### 8.4 Extraction accuracy, weighted by consequence

Hand-label ~50 solicitations and measure field by field. **Dates and eligibility flags are tested hard** — a wrong deadline means a missed bid or a wasted week. Estimated value being wrong is merely annoying. Weight accordingly.

### 8.5 Acceptance criteria

| Pain | Metric | In V1? |
|---|---|---|
| Missing things entirely | Discovery — qualified opportunities surfaced that would not have been seen, weighted by value | **Yes — and it is the whole measure** |
| Finding out too late | Median lead time from first sighting to deadline; expiration-radar leads converted | Yes |
| Drowning in noise | ~~Triage precision (Interested rate)~~ → **volume and base rate per source** | **No.** V1 does not address this pain; it measures it |
| No system of record | Whether the Pursuit board is current — a usage question, not a software one | Yes |

**Three of four pains are addressed in V1, and the fourth is instrumented rather than solved** (§1.1). That is the honest reading of this table and it should not be softened: a user drowning in irrelevant rows is a real failure mode, and V1's answer is to find out how bad it actually is before designing against it.

### 8.6 What not to measure

**Win rate is not a system metric**, at least not for years. It is dominated by proposal quality and relationships rather than opportunity selection, and 10–40 pursuits a year cannot attribute anything. Measure the funnel above the proposal: surfaced, triaged, pursued. Tuning a scorer against win rate is tuning against noise.

### 8.7 A negative result is a valid result

Phase 0 may report that only a handful of genuinely winnable opportunities existed in 24 months. That is a valuable answer, not a failure — it would mean discovery is not the binding constraint, and that the effort belongs somewhere else entirely (relationships, teaming, a different market or service line). Learned for a few weeks of work instead of a year of building. Accepting this outcome in advance is what makes a small first phase the right first phase.

---

## 9. Explicitly out of scope

Recorded so they are not rebuilt by accident:

- Multi-tenancy, billing, self-serve onboarding, customer support surfaces
- Training a machine learning model on pursuit outcomes (§6.6)
- Proposal writing or generation — Tenderfoot decides *whether* to bid, not *how*
- Scraping paywalled aggregators (GovWin, BidNet, BidPrime) (§5.5)
- Breadth-first national source coverage; coverage is demand-driven (§5.6)
- Win-rate optimization as a system objective (§8.6)
- **Any model of KP's workload, staffing capacity, pursuit concurrency, or engagement calendar** (§1). Headcount and revenue exist solely as eligibility thresholds.

### Deferred to the management phase

Tenderfoot becomes a seeking *and management* tool later. These are designed in this document because the data model has to accommodate them, but they are not part of the current build:

- The pipeline board (§7.2) and Pursuit states beyond the triage decision — `Submitted`, `Won`, `Lost` (§4.5)
- Assignment and ownership of pursuits
- Workload planning and win/loss analytics

**What is not deferred** is the triage decision itself and its captured reason. That is not management — it is the feedback loop that makes the next prospect more accurate (§6.6), which is the entire current objective. The lifecycle state machine can stay stubbed at `New → Triaged → Interested / Not Interested` without losing anything that matters now.

---

## 10. Open questions

**Resolved 2026-08-04** (see §5.7–5.8): Indiana's email notifications are real but code-filtered. Archive depth is deep for SAM.gov and USASpending, absent for Indiana solicitations, good for Indiana contracts. KP's bid history is effectively empty, which rewrote §8.2 rather than merely weakening it.

Still open:

1. ~~**Do the Ohio, Michigan, and Kentucky portals allow anonymous browsing?**~~ **Answered 2026-08-12 — and the answer for two of the three is a legal one, not a technical one.**

   **Ohio: effectively no.** The public solicitation page sits behind a CAPTCHA browser check that fails automated navigation. A person can read it; a scheduled adapter cannot.

   **Michigan: cleared for use, and then answered — no retention.** Only open solicitations are published; the `Show Me` filter that appears to offer `All` and `Recent Awards` returns the identical result set to `Open`, which makes it a fourth silent-failure instance rather than a route to history. **Kentucky runs the same platform and should be assumed identical.** So Michigan and Kentucky are live sources for *current* solicitations only, and neither can participate in solicitation-side backtesting.

   **Michigan: cleared for use, 2026-08-12.** Pages render without a login, and SIGMA displays a banner reading *"intended for government authorized users only… Disconnect immediately if you do not have express written authorization to access SIGMA."* Probing stopped on sight; **Matt reviewed the language and cleared it**, reading the authorisation as deriving from a held vendor account — which KP has or has had, and which is the reading that makes sense of a *Vendor* Self Service system. Posture **in**, revisit if challenged. **Kentucky is the same platform and clears on the same reading**, so §5.7's two-state leverage is live.

   > **One consequence to carry into the adapter.** If the authorisation is the account, the adapter should **authenticate rather than read anonymously** — and that moves the governing document from the banner to **KP's account terms**, which is a different text and the usual home of automated-access clauses. Worth pulling up when convenient; not a blocker.

### 5.5.1 The standing rule for legal posture

**Adopted 2026-08-12**, prompted by Michigan. Legal posture is a Registry field (§5.5); this is the procedure that decides it, so that the question is settled once per source rather than re-argued by whoever adds the next portal.

> **Ambiguous or restrictive terms default a source to `out`. Documented permission moves it to `in`, and the evidence is recorded on the row.**

**Why default-out.** The costs are asymmetric. Wrong in the *out* direction costs a source you could have had, and is fully recoverable — you switch it on, as Michigan just was. Wrong in the *in* direction means systematic automated access to something you should not have touched, **at volume, on a schedule, for months before anyone notices** — which is not recoverable, and is the version that ends access permanently rather than temporarily.

**It also puts the burden where it belongs.** Whoever is adding a source wants that source; default-out means the motivated party goes and gets the yes.

**Why recorded on the row.** The reason must outlive the person who established it. Someone reading `in` six months from now needs the date, the name, and the reading that was applied — otherwise **a decision nobody wrote down is indistinguishable from one nobody made**, which is §5.4's silent-failure argument applied to legal rather than to data.

**Three postures, not two** — the third added the same day, from Ohio:

| Posture | Meaning | Current |
|---|---|---|
| `in` | adapters may run on a schedule | Illinois, Indiana, SAM.gov, USASpending, Michigan, Kentucky |
| `manual-only` | a person may read it; no automated access | **Ohio** — CAPTCHA-gated, and KP does little work there |
| `out` | not accessed at all | GovWin, BidNet, BidPrime — excluded by their own terms |

**This rule is not a legal opinion and does not pretend to be one.** It is a workflow guaranteeing that a person made the call knowingly, and that the call is findable afterwards.
2. ~~**Do any state portals archive closed solicitations?**~~ **Answered for Illinois, 2026-08-12: yes, and deeply.** Periscope's public advanced search returns **2,155 closed solicitations back to 2018-02-23**, with awarded vendor on the row. **This overturns the working assumption that solicitation-side backtesting is federal-only.** Michigan indicates the same capability without proving it. Indiana remains the exception — no solicitation archive, which is why its Phase 0 runs on contract data (§5.8).

   > **The consequence is larger than a source being added.** §8.2 says validation is human adjudication because there is no answer key; that stands. But a state with eight years of closed solicitations *and* awarded vendors is the first non-federal place where a backtest can run against outcomes rather than only against judgment — and Illinois is a neighbouring state inside the Firm Profile's secondary geography.
3. ~~**Technology stack, hosting, and deployment**~~ **CLOSED 2026-08-12** — [`2026-08-12-tenderfoot-workflow.md`](2026-08-12-tenderfoot-workflow.md). Stack is the ideate/IDE8 stack (React 19, Vite, Zustand+Immer, Express, better-sqlite3 local-first), minus dnd-kit, plus a router. **Hosting: none in V1** — local-first, one user, batch ingestion — with a knowable expiry at SP7, when scheduled ingestion means a closed laptop stops scraping. Four decisions remain open *inside* the stack and are listed there; the significant one is the extraction runtime, which must land before SP4.

*Closed 2026-08-04:* KP's capacity calendar is no longer needed — the system is capacity-agnostic (§1). Whether anyone besides Matt clears the queue no longer gates anything either, since assignment and ownership moved to the management phase (§9).

---

## Appendix — relationship to the original concept outline

*Tenderfoot — Concept Outline.md* has since been rewritten as the build inventory. Its original form is preserved verbatim as *OLD - Tenderfoot Concept Outline.md* (and in git at `183df06`), and mapped as follows:

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

New material not in the original outline: the entity graph and the Solicitation → Award → Contract chain (§4.3), the expiration radar and pre-RFP layer (§4.6), Sightings and change detection (§4.4), the Pursuit lifecycle and feedback loop (§4.5, §6.6), Phase 0 as market-sizing and permanent test harness (§3.1, §8), and portability as a design constraint (§2.1).
