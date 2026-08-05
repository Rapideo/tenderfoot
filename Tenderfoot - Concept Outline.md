# Tenderfoot — Component Breakdown

**Revised:** 2026-08-04. The original is preserved verbatim as
*OLD - Tenderfoot Concept Outline.md*, and in git at `183df06`.

**Scope, in one line:** deliver the most accurate, most likely prospects for consideration.
The system is capacity-agnostic and does not manage pursuits — both deliberately (§1, §9).

This is the *build inventory* — every component, what it does, and what it depends on. The
design rationale lives in `docs/superpowers/specs/2026-08-03-tenderfoot-design.md`; section
references below point there. This document exists to be sliced into phases.

**Reading the columns:**

- **Needs** — components that must exist first. Hard ordering constraints only.
- **P0** — relevance to the Phase 0 backtest. ✅ required · ◐ minimal version required ·
  ✕ live-operation only.

The distinction that governs everything: **Phase 0 runs the pipeline backwards over the
archive.** It needs no scheduler, no notifications, no uptime, and no live sources. Every ✕
below is deferrable without blocking the question the project exists to answer.

---

## 0. Foundations

Nothing else can be built first. These are the three portability rules made concrete (§2.1).

| ID | Component | What it is | Needs | P0 |
|---|---|---|---|---|
| 0A | **Schema** | Eleven objects in four groups (§4). Entity foreign keys present from the first migration — retrofitting them is the expensive mistake (§2.2). | — | ✅ |
| 0B | **Firm Profile** | The only home for customer-specific facts (§4.2): capabilities, codes, certifications, geography, hard limits, past performance, negative profile. Hard limits are **eligibility thresholds only** — no workload or capacity modeling (§1). | 0A | ✅ |
| 0C | **Source Registry** | Sources as rows, not code. Carries tier, **platform** (§5.7), legal posture (§5.5), archive depth, yield baselines. | 0A | ✅ |
| 0D | **Storage + migrations** | Stack undecided (§10.3). | — | ✅ |

**The system is capacity-agnostic (§1).** It does not model KP's headcount as a workload
limit, how many pursuits can run at once, or when current engagements end. Earlier drafts
carried a capacity timeline; it was removed deliberately. The single distinction to hold onto:
*eligibility facts stay, capacity judgments go.* A solicitation requiring fifty employees is a
hard gate (3B); whether KP has bandwidth for the work is not modeled anywhere.

---

## 1. Source Locating and Assessing

*Original §1. Largely intact — but the manual "index" scoring became Registry fields and
measured yield.*

| ID | Component | What it is | Needs | P0 |
|---|---|---|---|---|
| 1A | **Scoping** | Geography and sector, as Profile settings rather than code (§4.2). Government / private / nonprofit / educational all in scope; KP starts with Indiana state and local, Midwest, federal, and foundations. | 0B | ✅ |
| 1B | **Candidate source search** | Finding portals worth adding. Demand-driven — cover what the Profile reaches, not "cover Indiana" (§5.6). | 0C | ◐ |
| 1C | **Scrapability assessment** | Was the "Scrapability Index." Now three Registry fields: adapter tier (§5.1), platform (§5.7), and **archive depth** — promoted to a primary selection criterion, because a source that cannot run backwards cannot participate in Phase 0 (§3.1). | 0C | ✅ |
| 1D | **Quality assessment** | Was the "Quality Index." Not estimated up front — *measured*. Yield per source, tracked continuously (5E). A source earns its slot with numbers. | 0C, 5E | ✕ |
| 1E | **Legal posture** | Robots.txt, ToS, account terms, rate limits (§5.5). Paywalled aggregators (GovWin, BidNet, BidPrime) are out of scope entirely. | 0C | ✅ |
| 1F | **Whitelist / blacklist** | Falls out of 1C–1E rather than being a separate mechanism. | 1C, 1E | ✅ |

---

## 2. Ingestion

*Original §2 ("Scraping"). Renamed because scraping is now the third choice, not the method.*

| ID | Component | What it is | Needs | P0 |
|---|---|---|---|---|
| 2A | **Adapter framework** | Every adapter takes a `since` parameter — this is what makes backfill and live the same code path (§3.1). Adapters bind to **platform + config**, not jurisdiction (§5.7). | 0C | ✅ |
| 2B | **Tier 1 — API adapters** | SAM.gov (live API + archived CSV for backfill), USASpending (FY2001–08 depth). Structured, permitted, deep. Where Phase 0 actually starts. | 2A | ✅ |
| 2C | **Tier 2 — Email/RSS adapters** | Dedicated inbox, subscribed broadly. **Register over-inclusively and pair with a listing adapter** — these subscriptions are themselves code filters (§5.1, §6.2). | 2A | ✕ |
| 2D | **Tier 3 — HTML adapters** | Per platform: Periscope S2G (Illinois +), Ivalua (Ohio +), CGI Advantage (Michigan, Kentucky +), Indiana's static list. Accept that these rot. | 2A | ◐ |
| 2E | **Tier 4 — Manual drop** | Paste a URL or forward an email; it ingests. Small feature, disproportionate value — the system is never a wall. | 2A | ◐ |
| 2F | **Record types** | Solicitation sources, award/contract sources, signal sources (§5.2). Award data is where the lead-time advantage comes from — and for Indiana, where Phase 0 has to run at all, since solicitations aren't archived (§5.8). | 0A | ✅ |
| 2G | **Sightings + dedup** | Every observation recorded separately from the canonical record (§4.4). Enables dedup across sources, change detection (addenda, deadline moves), and per-source yield. | 0A | ✅ |
| 2H | **Fetch pipeline** | Listing → detail → documents. **Fetch depth follows score** — only survivors get their documents pulled (§5.3). | 2A, 3B | ✅ |
| 2I | **Extraction** | Deadline, pre-bid conference, Q&A cutoff, value, term, incumbent, bonding/insurance thresholds, set-asides, evaluation criteria and weights. Every field carries **confidence + a pointer to source text** (§5.3). | 2H | ✅ |
| 2J | **Scheduling** | Per-source frequency. Live mode only — Phase 0 is a batch run. | 2A | ✕ |
| 2K | **Health monitoring** | Expected-volume baselines; 30 days of silence is an incident. Sources degrade rather than fail: keep the listing when detail parsing breaks (§5.4). | 2A, 5E | ✕ |

---

## 3. Matching

*Original §3. Structure preserved; the scoring model changed substantially.*

| ID | Component | What it is | Needs | P0 |
|---|---|---|---|---|
| 3A | **Profile as match input** | Capabilities, codes, and negative profile all read from 0B. No KP facts in matching code. | 0B | ✅ |
| 3B | **Stage 0 — Hard gates** | Deterministic, no model. Geography, deadline, mandatory pre-bid held, bonding, insurance, registrations, revenue/headcount floors. Eliminates most volume at zero cost. **Gated items are filed, not deleted** (§6.2). | 3A | ✅ |
| 3C | **Stage 1 — Semantic recall** | Embed the solicitation, compare against Profile capability vectors. Catches work described in vocabulary nobody would keyword on. **Ranks; never rejects.** | 3A | ✅ |
| 3D | **Stage 2 — LLM adjudication** | Survivors only. Produces the four machine scores — Fit, Winnability, Value, Timing — kept separate and separately visible (§6.3). **Timing is a property of the opportunity** (runway to deadline, pre-bid passed, Q&A open), never of KP's workload. The brief is a byproduct of the same call. | 3C, 0B | ✅ |
| 3E | **Cost-to-pursue panel** | *Not machine-scored.* The system extracts the ingredients — page limits, forms, mandatory meetings, references, submission quirks, net-new writing volume. The user rates light/moderate/heavy. After ~20 ratings it surfaces recall, not estimation (§6.3). | 2I | ◐ |
| 3F | **Wired-bid detection** | Short windows, single-firm qualifications, incumbent named in scope, no preceding RFI, sole-source language. Scores as **low winnability**, not high fit (§6.4). | 3D | ✅ |
| 3G | **Stage 3 — Human decision** | Feeds back into 3D. In Phase 0 this role is played by the adjudication tool (5B) rather than the live triage queue — same motion, same captured reason. | 4A *or* 5B | ◐ |
| 3H | **Codes handling** | NAICS, PSC, UNSPSC, state commodity codes. **Signal, never filter** — including upstream, where a portal's own subscription is code-filtered (§6.2). | 3A | ✅ |
| 3I | **Assessment versioning** | Every score versioned by scorer version (§4.5). This is what makes rescoring the archive a regression test rather than a guess. | 0A | ✅ |
| 3J | **Match modes** | Should we bid this? / Who should we call? (teaming) / What's coming? (expiration). Same Profile, same scorer (§6.5). Sub-opportunity monitoring — the original outline's opening note — is match mode 2 plus a value filter. | 3D | ◐ |
| 3K | **Feedback loop** | Every Pursuit decision, especially every no-bid reason, becomes a few-shot example in Stage 2's context. Effective from the first decision. **The system will not train a model** (§6.6). | 4B | ◐ |
| 3L | **Calibration** | Target a volume (top N per period), not a score cutoff (§6.7). | 3D | ✕ |

---

## 4. The Application

*Original §4 ("Reporting"). Promoted — the app is the product, not a delivery channel for
digests (§2.4).*

| ID | Component | What it is | Needs | P0 |
|---|---|---|---|---|
| 4A | **Triage queue** | The daily driver. "Clear the queue" is the habit the whole system depends on. | 3D | ◐ |
| 4B | **Triage decision + reason** | Stubbed lifecycle for now: `New → Triaged → Interested / Not Interested`. The **reason** is the point — it is the feedback loop (3K), not bookkeeping, and with no prior history to seed it, it is load-bearing from decision one (§4.5). | 0A | ◐ |
| 4C | **Full pursuit lifecycle + pipeline board** | `Watching → Bid/No-Bid → Submitted → Won/Lost`, ownership, assignment. **Deferred to the management phase** (§9). | 4B | ✕ |
| 4D | **Opportunity detail** | The brief, the fact panel, the cost-to-pursue ingredients, the source documents, the sighting history. | 2I, 3D | ◐ |
| 4E | **Expiration radar** | Contracts approaching end date → predicted re-competes, months ahead of any RFP. The lead-time advantage, and a graph query rather than a feature (§4.6). | 2F | ◐ |
| 4F | **Teaming radar** | Who wins work KP could sub on. KP's WBE certification makes it attractive to primes carrying participation goals (§4.6). | 2F | ✕ |
| 4G | **Entity browser** | Organizations, Vendors, Awards, Contracts. Win history infers capability without anyone maintaining a taxonomy. | 0A | ✕ |
| 4H | **Reports** | Phase 0 market sizing as a live view — how many qualified prospects, at what value, from which sources. Source yield. Win rate only once history exists — never a system objective (§8.6). | 5C | ✕ |
| 4I | **Saved views** | Was "Custom Queries." | 4A | ✕ |
| 4J | **Admin** | Source Registry management, Profile editing, adapter health. | 0B, 0C | ◐ |
| 4K | **Email** | Summaries and deadline tripwires only. **Not** the decision surface — email reduces a no-bid to a binary and loses the reason, which is the one thing worth capturing (§7.9). | 4A | ✕ |

---

## 5. Validation

*New — no counterpart in the original outline.*

| ID | Component | What it is | Needs | P0 |
|---|---|---|---|---|
| 5A | **Backtest harness** | `since = 24 months ago` over the archive. Not a throwaway import — it is the permanent test suite, re-run on every scoring change (§8.1). | 2A, 3D | ✅ |
| 5B | **Adjudication tool** | The user reads the ranked list and marks *would have bid* / *would not* / *unclear*. **There is no answer key** — KP has competitively bid once, so this is the only ground truth available (§8.2). Doubles as the few-shot example set. | 5A | ✅ |
| 5C | **Accuracy report** | Two numbers from adjudication: **precision** (what fraction of the top N would actually have been bid) and **discovery** (how many of those KP had never seen). **Value-weighted, never count-weighted** — KP engagements span roughly 50×. No workload overlay (§1). | 5B | ✅ |
| 5D | **Extraction accuracy** | ~50 hand-labeled solicitations, field by field. Dates and eligibility flags tested hard; estimated value merely annoying (§8.4). | 2I | ◐ |
| 5E | **Source yield** | Records per source, survival rate through the funnel, staleness. Feeds 1D and 2K. | 2G | ◐ |

---

## Out of scope

Recorded so they don't get built by accident (§9):

- Multi-tenancy, billing, self-serve onboarding, support surfaces
- Training an ML model on pursuit outcomes — 10–40 pursuits/year will never be enough
- Proposal writing or generation — Tenderfoot decides *whether* to bid, not *how*
- Scraping paywalled aggregators
- Breadth-first national source coverage
- Win-rate optimization as a system objective
- **Any model of KP's workload, staffing capacity, pursuit concurrency, or engagement
  calendar** (§1)

**Deferred to the management phase** — designed for, not built now (§9): the full pursuit
lifecycle beyond triage, the pipeline board (4C), assignment and ownership, workload planning,
and win/loss analytics. Tenderfoot becomes a seeking *and management* tool later; this
inventory covers the seeking half.

---

## What this implies about slicing

Not phases yet — just what the dependency graph forces:

**Forty-nine components; twenty-five carry ✅.** The longest dependency *chain* is short —
0A → 0C → 2A → 2B → 2F → 3A → 3B → 3C → 3D → 5A → 5B → 5C — but the chain is not the workload.
Reaching the accuracy report also requires the rest of the ✅ set: sightings and dedup (2G),
the fetch pipeline and extraction (2H, 2I), scoping and source assessment (1A, 1C, 1E, 1F),
and the scoring disciplines that make results trustworthy (3F, 3H, 3I). Half the inventory,
give or take. Everything marked ✕ is genuinely deferrable; the ◐ items are where the
slicing judgment actually lives.

**Narrowing the scope to prospect discovery cut real work.** Capacity modeling is gone
entirely, and the pursuit lifecycle collapsed to a triage verdict plus a reason. What remains
is a straight line: find it, score it, show it, capture what the human decided. Every
component that survives serves one question — *are these prospects accurate and likely?*

**Two things must be right from the first line of code**, per §3.2: entity foreign keys in
the schema (0A), and `since` in the adapter interface (2A). Both are cheap now and expensive
later. Everything else can be rearranged freely.

**Indiana forces an ordering surprise.** Its solicitations aren't archived, so Indiana enters
through contract data (2F, 4E) rather than through a portal scraper. The federal APIs (2B)
carry Phase 0 alone. Tier 3 scrapers (2D) can wait longer than the original outline assumed.

**The app can be very thin at first.** 4A and 4B in minimal form are enough to capture
adjudications (5B) — and adjudication is the same motion as triage, so the Phase 0 tool and
the production daily driver are the same screen built once.
