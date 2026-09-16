# Tenderfoot — Behind the Explainer

**An addendum for management · 16 September 2026**

*Read alongside `Tenderfoot-Explainer.pdf` (August 2026). The explainer sells the destination. This document says what is standing on the site today, and what the crew is doing next. It is four pages on purpose; the detailed record lives in the repository.*

---

## 1. What the explainer promotes

The explainer was built on 12 August from the design prototype, and it was written deliberately to show the **finished product** rather than the first release — its own closing page says so. Five weeks on, here is each promise against what exists.

| Explainer page | The promise | Where it stands today |
|---|---|---|
| **3 · What it does** | It collects from every source you switch on, prepares the documents and facts, and you decide with a reason. | **Built.** All three moves exist and have been used on real data. |
| **4 · The daily driver** | One opportunity at a time, keyboard-only, Interested / Pass / Undo. | **Built and used in anger.** 150 real opportunities were triaged in the app on 13 September. |
| **5 · Evidence** | Scores that quote the sentence they came from. | **Parked, by design.** V1 has no scores (§2). The citation mechanism does exist for extracted facts — every deadline points to the passage it came from. |
| **6 · The brief** | What the work is, why it fits, what is missing. | **Not built.** The record screen exists with its Extracted Fields, Documents and Timeline tabs; Brief is shown as parked. |
| **7 · The headline feature** | Contracts expiring, months before an RFP. | **Data loaded, screen not built.** All 204,920 Indiana contracts are in production; the radar screen is scheduled after the go / no-go. |
| **8 · Recall** | Rejected is filed with its reason, never deleted. | **Partly.** Every decision carries a reason in the reader's own words and can be undone. The drawer of machine-rejected items has nothing to hold, because V1 rejects nothing on your behalf. |
| **9 · Configuration** | Your firm is a row; sources are the control. | **Built.** The firm profile is editable data; the Source Registry shows every source with its health, and each can be checked or run from the screen. |

Two things to say plainly about the explainer itself. Its screenshots still carry a placeholder wordmark and predate the current prototype version, so it should stay internal until it is rebuilt. And its closing "Where this stands" page describes the plan as it was in August; §3 below replaces it.

---

## 2. What the software actually does today

Tenderfoot is a deployed web application with a real database behind it, built between 3 August and today: **607 commits, over 1,100 automated tests**, and a continuous-integration gate that must pass before anything merges.

### It collects

Three sources are live, and one solicitation seen on two of them becomes one record. Nothing is filtered out on the reader's behalf.

- **SAM.gov** — federal solicitations, pulled directly and free. **9,883** solicitations in production.
- **HigherGov** — a paid aggregator covering Indiana, Ohio, Michigan, Illinois and Kentucky at state *and* local level. **4,377** solicitations from **851** buying organisations, including a complete 28-day window bought specifically so coverage could be measured rather than guessed.
- **The Indiana contract register** — every contract the state holds: **204,920** rows with value and end date. This is the data behind the expiration radar, loaded and waiting for its screen.

### It prepares

When a reader opens a solicitation, its documents are fetched and read, and facts — the deadline first — are extracted with a confidence and the passage they came from. On the first live measurement the extracted deadline was **right every time it was found (100% precision)** and **found less often than we want (recall 12.5%** — a lower bound that has not yet been validated by hand-labelling).

### You decide

The queue is real. One opportunity, keyboard-only, Interested or Pass with a required reason. The reasons are captured verbatim, and they are the raw material for the next design step (§4).

### It administers itself

A Source Registry with a health check and a run control per source; a firm profile held as data, not code; a spend ledger for the one metered source.

### What it deliberately does not do

- **It does not rank, score or filter.** V1 returns everything from every switched-on source. This was decided on 11 August and is a reason, not an omission: a system that returns everything cannot silently miss anything, and nobody knew what the sources actually publish until it ran. That measurement is now in hand.
- **It does not run unattended.** Every ingest is started by an operator. Scheduling is the first thing after the go / no-go.
- **It does not yet show the radar, the brief, organisations, or reports.** Those destinations exist in the navigation and say honestly that they are not built.

---

## 3. Note to management: where the team is

**The short version.** The plumbing is built and proven on real data. The project changed direction on 3 September — from building screens to measuring the sources those screens depend on — and that measurement is nearly complete. One decision sits with management now (the HigherGov subscription), and one gate sits with the team (go / no-go).

**How we got here.** August was construction: the schema, a design system matched pixel-for-pixel to the prototype, federal ingestion, cross-source merging, document extraction, and the triage screen — each slice merged with its tests. By the end of August the app was deployed and taking real federal data.

**The pivot, in Matt's words:** *"Once we have both our reliable upstreams defined, we can then flesh out the rest of the app with real data and analysis methods, instead of just hoping that the source meets our criteria."* When the free state portals were measured they were thin — Indiana's own portal publishes no archive, Kentucky and Michigan show only what is open today, Ohio can only be read by hand. Rather than build screens over a weak foundation, the team built a **data floor** — seven pass/fail tests the data must meet before a go / no-go means anything — and evaluated a paid aggregator against a free answer key.

**The finding.** HigherGov, on a two-week trial, recalled **98.7–100%** of state-agency notices with **37–39 days** of bidding time still left when it first carried them, and holds an Indiana archive back to 2013 that the state itself does not publish. That is a buy at **$500 a year**. One honest caveat: it was bought for city, county and school-district coverage, and that segment could not be measured, because there is no free source to check it against. The trial closed on 15 September with **8,682 of 10,000** metered records spent and the remainder held in reserve.

**The gate.** The data floor now passes **six of its seven** tests. The seventh — that where a listing defers to a document, we hold the document — can only close through use, because documents are fetched on demand to protect the metered budget. In practice, the go / no-go is ready to be taken.

**The cost discipline.** The one metered thing in the project is HigherGov's 10,000 records a month. Two rules have bound every call since 3 September: no call without explicit approval outside a small standing budget, and rejection must be free — a notice is ruled out from its listing alone, and documents are bought only for what survives. A live key was leaked into a working session on 3 September and rotated within the hour; every response is now scrubbed at the boundary.

---

## 4. What lies before us

In order, each gated on the one before it.

1. **Turn the 150 reasons into a vocabulary.** The triage session produced 150 decisions (11 Interested, 139 not) in the reader's own words. The fixed reasons the queue will offer — "out of state", "deadline passed" and their siblings — are derived from those, not invented. Free; needs Matt at the table.
2. **Two small rulings** surfaced while building the last set. Neither costs anything.
3. **The go / no-go.** With the floor at six of seven and the sources graded, the team can put the question: does the data justify the post-gate slices?
4. **On go — live ingestion.** Scheduled runs, and health alarms that fire when a source goes quiet. This is what turns an instrument into a daily tool.
5. **On go — the radar and reporting.** The expiration radar over the 204,920 contracts already held; source yield and market sizing.
6. **Later, deliberately.** Scoring and evidence, the brief, organisations and vendors, the pipeline board, and sign-in — each parked with a reason on record, none forgotten.

### Decisions management can make now

- **The HigherGov subscription.** The trial has ended. Renewal at $500/yr is recommended on the evidence above, with the sub-state caveat stated.
- **Whether the explainer goes outside the firm.** Not until it is rebuilt against the current prototype and its closing page is replaced with this one.

### Risks worth knowing

Extraction recall is unvalidated. The sub-state coverage the aggregator was bought for is unmeasured. Nothing runs without a person starting it. The app is public behind platform deployment protection only, with no sign-in yet.

---

> The explainer promised a tool that removes every reason the bid decision is slow. What exists today does the collecting and the preparing on real data, at a known cost, and has been used to decide. The rest is sequenced behind a gate that is ready to be taken.

*Every figure here is traceable to the project's own records as of 16 September 2026: `STATUS.md`, `DOOGIE - TENDERFOOT.md`, `docs/Tenderfoot-Plan-of-Action.md`, and the fitness and platform-comparison documents under `docs/`.*
