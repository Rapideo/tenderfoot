# PINNED — ingestion scaffolding, and mechanical vs smart modes

**Raised 2026-08-12 by Matt. Brainstorm deliberately deferred — nothing here is decided.**

Recorded so the thinking survives the gap. **Do not treat any of this as designed**, and do not let it quietly become the design (`Proto2PRD.md` §4.7.5).

---

## What prompted it

Reviewing the prototype, Matt went looking for where the system's *sources* are configured and had to hunt:

> *"The application front end itself is so user focused and so elegant that I almost had to search for — hey, where can I even figure out what places we're scraping for?"*

**That is a finding, not a complaint.** The prototype optimises hard for the daily habit — nav collapses during triage, one opportunity fills the screen — and the mechanical layer went somewhere behind that. With matching parked and **the Source Registry now V1's only control surface**, the mechanics are no longer back-office: they are the product's configuration.

*Possibly already half-solved:* the status bar renders `4 SOURCES · 1 DEGRADED · 1 ROT SUSPECTED` on every screen and is a button in the prototype. Whether that is the intended way in, and whether it reads as one, is part of the brainstorm.

---

## Proposal 1 — scaffolding for the mechanical layer

Something explicit and temporary — settings, an admin area, or a config file — where the ingestion mechanics are visible and adjustable. **Deliberately allowed to be unlovely.** Matt: *"this is a super simple scaffolding… that's not application-defined yet."*

**It is not a new concept — it is `View 6.2` (Source Registry) in its first, file-based form.** The registry already carries adapter tier, platform, archive depth, legal posture and health per source. This adds ingestion bounds to the same row and starts as a file rather than a screen.

Sequencing to consider: **config file → settings screen → the registry as specified.** `Stack-Requirements.md` already requires the registry to be runtime-editable without a deploy, so the file is a way station, not a destination.

---

## Proposal 2 — a candidate scrape, not a full one

Bounded fetch before committing to the real thing. Matt's framing: *"we're not gonna wanna do like a full scrape, we're gonna wanna do like a candidate scrape."*

> **This fills a hole nobody had noticed.** §5.3 fetches in three hops — listing → detail → documents — and governs depth with *"fetch depth follows score."* **Parking the scorer removed that governor**, and nothing replaced it. Every bundle would be pulled at full depth, and bundles reach 21 MB.
>
> A candidate scrape that stops at hop 1 is a natural replacement: **counts before documents.** It also answers the question V1 exists to answer — how much do these sources actually publish — at almost no cost.

---

## Proposal 3 — a hard ingestion window, per source

A simple mechanical rule bounding what a run returns. Matt started at *"must be today's date"* and revised to a week.

**Three notes on shape, from the existing design:**

**1. Make it `since = last successful run`, not a fixed lookback.** These are identical until a run fails. Miss Tuesday, and a fixed 7-day window on Wednesday still looks back only 7 days — Tuesday's postings are lost permanently and silently, which is the exact failure mode §5.4 and §6.2 exist to prevent. **§3.1 already specifies that every adapter takes a `since` parameter**, precisely so backfill and live are the same code path. A week becomes the seed and the backstop; `since` is the rule. Backfill then costs nothing — same code, different `since`.

**2. Fail closed.** A source with no window configured should **refuse to run**, not default to unbounded. A missing config that quietly means *everything* is how a first run pulls 24 months of Indiana and 8,000 contract records.

**3. Per source, always.** A day of IDOA and a day of SAM.gov are not comparable volumes.

**This is not a filter in the sense §1.1 forbids.** V1 returns everything the active sources return; an ingestion window bounds *when we looked*, not *what qualified. It makes no judgment about any record.* The distinction is worth stating explicitly, because it will be questioned.

---

## Proposal 4 — mechanical and smart are first-class modes in the application

The largest idea here, and the one most worth getting right. Matt: *"we have mechanical actions and smart actions, or LLM-driven actions. Let's make those different options within the application."*

**Why this is stronger than a phase.** `Stack-Requirements.md` poses extraction as a fork — rules **or** model. As modes it is **both, selectable per action**, which is a better answer than either.

**It is what makes the comparison possible at all.** Every extracted field already carries a confidence and a source pointer. Add **which mode produced it** and §8.4's accuracy measurement becomes computable *per mode* — mechanical against smart, on the same hand-labelled set.

> **The condition the whole idea rests on: the mode must be recorded in the data, not merely set in configuration.** A field that does not remember how it was produced cannot be compared against one produced the other way. **Without that, this is a preference toggle. With it, it is an experiment**, and it is the only mechanism that could ever justify the cost of the smart path.

**It also makes Matt's sequencing permanent rather than transitional.** *Stay mechanical as long as we can, then get smart* stops being a phase the project exits and becomes something the system expresses — including reverting an action to mechanical where smart did not earn its keep.

**Open, and genuinely undecided:** what the unit of an "action" is (a field? an adapter? a whole pipeline stage?), whether mode is chosen per source or per action or both, and whether a smart action may ever run without a mechanical fallback.

---

## Status

**Pinned. Not designed, not scheduled, not started.**

The one piece with a hard deadline attached: **the ingestion window must exist, in code at minimum, before the first real scrape runs.** That is a safety rail rather than a feature, and it is the only item here that cannot wait for the brainstorm.
