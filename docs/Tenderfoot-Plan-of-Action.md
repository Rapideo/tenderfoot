# Tenderfoot — Plan of Action

**Written:** 2026-08-04
**Applies:** `Proto2PRD.md` to this project
**Reads with:** `superpowers/specs/2026-08-03-tenderfoot-design.md` (what we're building) and `../reference/Tenderfoot - Concept Outline.md` (the 49-component build inventory)

---

## 1. How to use this document

`Proto2PRD.md` is the general playbook. This document is Tenderfoot's instance of it: the ordered sequence, the development slices, and what is needed from Matt at each point.

Component IDs throughout (`0A`, `2B`, `5C`…) refer to the build inventory. Section references like §6.3 refer to the design spec.

**Where this lands:** Stage A ends with a frozen prototype. Stage B ends with plans committed. Stages C onward are execution. **There is a hard go/no-go gate at SP6** — everything before it exists to answer whether the prospects are good enough to keep building.

---

## 2. What is already done

| Playbook input | Status |
|---|---|
| Requirements / rules / non-goals | ✅ The design spec — stronger than a PRD |
| Scope boundaries | ✅ Capacity-agnostic, discovery-only, management deferred. Past-performance citation cut 2026-08-10 (§7.3). **Matching parked 2026-08-11 — V1 returns everything active sources return (spec §1.1)** |
| Component inventory | ✅ 48 in-scope components with dependencies |
| Source research | ✅ Platform-bound adapters, verified archive depths (§5.7–5.8). One question left: do licensed platforms retain closed solicitations |
| UI outline | ✅ **Adopted 2026-08-10** — `../reference/Tenderfoot SVRC.md`, now **v0.6.0**. Drafted by Claude, used to generate the prototype, then adopted. ~~`Imp`/`Pri` were placeholders — review once.~~ ✅ **Reviewed in full 2026-08-14; fourteen of twenty moved. They are rulings now.** |
| User stories | 🔜 **Matt** — no draft, no stand-in |
| Design references | ✅ **Closed 2026-08-10 without gathering any** — the prototype direction establishes the design language. Slot 3 of the two-slot model, legitimately empty (§A1.1) |
| Brand artifact | ❌ Not gathered — *separate input from references, see §4.1* |
| Tech stack outline | 🔜 **Matt** — closes §10.3, feeds Stage B2 |
| Prototype | ◐ **V1.1 in the repo, 2026-08-10.** Generated in Claude Design from the SVRC. V1 and V1.1 both kept. `src/` was extracted from V1 and is **stale** — V1.1 grew a 67-token layer of its own. See `../prototype/README.md` and §A7 |
| Domain source material | ✅ 76 solicitations banded; all 11 band A bundles pulled (`corpus/`) |
| Calibration material | ✅ 140 closed federal solicitations, two samplings (`corpus/calibration/`) |
| Contract history + expiry dates | ✅ 2,160 Indiana contracts expiring within 18 months (`corpus/indiana-contracts/`) |

**The outline format changed.** IMPACT's terse `SHELL` / `SCREEN` / `VIEW` composition list did not suit this project. Matt is supplying instead:

- The area outline, **with a description per area**
- An **effort/impact assessment** per area
- A **priority** per area
- A **complete set of user stories**

That is richer than the playbook's input #2 and it carries sequencing information the original format did not. Consequence: **§6's slice ordering is now a proposal to reconcile against Matt's priorities, not a fixed plan.** Where his effort/impact ranking disagrees with the dependency graph, the dependency graph wins only on hard ordering constraints; everything else defers to his priority.

**The hard ordering constraints, and there are three.** §2.2 entity FKs · §3.1 `since` · **containment — a shell is built before the views rendered inside it.** The third was added 2026-08-15 by the §6.4 reconciliation: it had been invisible while `Shell A` carried a placeholder `Pri 5` that sorted correctly for the wrong reason, and only became visible when Matt's real ruling put it at `Pri 3`. **A list of exceptions that has never been tested against a disagreement is not known to be complete** — this one was written on 08-04 and was two-thirds complete for eleven days, because nothing disagreed with it until the placeholder scores became rulings.

> ✅ **The reconciliation this line calls for ran on 2026-08-15 — see §6.4.** No slice moved. It could not run before 08-14, because until then the "priorities" it reconciles against were Claude's placeholders rather than Matt's rulings.

---

## 3. The two ways Tenderfoot departs from IMPACT

Both are `Proto2PRD.md` §2.1 boundary conditions, and both change the plan.

**The engine is the risk, not the screens.** IMPACT's screens largely *were* the product. For Tenderfoot, a beautiful triage queue full of plausible opportunities proves nothing about whether the ranking is any good. The prototype still earns its place — it settles the eleven-object schema before a migration exists, which is our most expensive early commitment (§2.2) — but it does not touch the actual risk. That needs a second instrument: the backtest.

**Matching is never "correct."** It is better or worse than the last version. No test goes green. So three things get built as *test infrastructure* rather than as deliverables: the backtest harness (5A), assessment versioning (3I), and a scored baseline. The gate becomes *"precision did not regress against scorer version N−1."*

---

## 4. Stage A — Prototype

### A1. Assemble the five inputs

| # | Input | Tenderfoot's version | Owner |
|---|---|---|---|
| 1 | PRD | The design spec — already written | ✅ |
| 2 | Area outline + user stories | ✅ SVRC adopted. **User stories still owed** | **Matt** |
| 3 | Design conventions | ✅ Closed unfilled — the prototype direction supplies this | — |
| 4 | Palette source | ⚠️ Never filled; palette came from the generator and has no anchor — see A1.1 | **Matt** |
| 5 | Domain source material | 76 real solicitations, 11 bundles pulled | ✅ `corpus/` |

### A1.1 Tenderfoot is its own brand, and that breaks a mechanism

**Decision (2026-08-04):** Tenderfoot is **not** branded as Koehler Partners. It is an internal tool first, but it carries its own name, identity, and design language.

This is architecturally consistent — §2.1's first portability rule says no fact about KP appears in the product — and a KP-branded interface would have been the largest remaining violation of it. Branding Tenderfoot as itself makes the portability claim real rather than notional.

**Both visual input slots stay open.** Proto2PRD §4.5 keeps design conventions and palette source as **two permanent, independent inputs** — either may be absent, either may be pre-existing or created for the project, and one artifact filling both is a convenience rather than the expected case. Tenderfoot is not an exception to that model; it is one configuration of it.

- **Slot 3 — design conventions.** **Closed unfilled, 2026-08-10.** No inspiration images will be gathered. The generated prototype direction establishes the design language directly, so the input the images existed to supply has already been delivered by other means. This is a legitimate configuration of the two-slot model, not a skipped step — the slot stays in the playbook for the next project.
- **Slot 4 — palette source.** **Never filled, and the mechanism it carries never ran.** The palette came out of the generator: 59 colours, now named in `../prototype/PROTOTYPE/src/tokens.css`, none of them measured from a designated artifact.

  This matters more than slot 3 does, and it should be recorded rather than shrugged off. Proto2PRD §4.5's value is not the colour, it is the *anchoring*:

  > "Deriving the palette from an artifact nobody controls removes colour from the space of things that can be relitigated. There is no 'what if the blue were softer' conversation, because the blue is not a preference — it is a measurement."

  A generated palette has no such anchor. `#1b6a8c` is a preference, and preferences can be relitigated indefinitely — which is precisely the conversation §4.5 exists to end. Two ways out, both cheap:

  1. **Designate the frozen bundle as the source retroactively.** It is an artifact nobody is going to re-open, which is most of what §4.5 asks for. The tokens then cite it, and the rule becomes *do not revisit*.
  2. **Produce a Tenderfoot mark from the chosen direction** and sample it, closing the loop the way IMPACT's did. The wordmark was always a Phase 0 output (below); this makes it the palette's source as well.

  Either works. Doing neither leaves colour permanently arguable.

What matters is not provenance but **naming before sampling**. Someone chose IMPACT's logo too, at some point. So whichever route closes slot 4:

1. **Designate one specific source before sampling anything** — one file, not a set.
2. **Sample per token, with a comment naming the source element**, exactly as IMPACT did.
3. **Do not revisit it.** The discipline is in the not-revisiting, not in the provenance.

Step 2 is the one already half-done: `tokens.css` names every colour by role, and says in its own header that no source is cited because none was designated. Closing slot 4 is mostly a matter of adding that line and meaning it.

**And one thing moved from input to output — and has *not* been delivered.** IMPACT got a wordmark free with its logo. Tenderfoot's name treatment was defined as a Phase 0 *deliverable*, produced by the bake-off rather than supplied to it. The generated direction does render a `TENDERFOOT` wordmark, and it remains a candidate for the slot-4 source under route 2 above.

> **Corrected 2026-08-12.** This paragraph previously read *"has now been delivered… so that output exists."* **It does not.** The prototype sets the name in a typeface and labels it, in the artifact itself, `WORDMARK — PLACEHOLDER`. A placeholder that says it is a placeholder is not a delivered mark, and reading it as one would have closed a Phase 0 output that is still open.
>
> **Caught by building the explainer PDF** (`docs/explainer/`), where the placeholder appears in the header of all six screenshots and is the one visible sign the product is unfinished. **That makes it a gating item for anything shown outside the firm**, which is a shorter deadline than "before launch."
>
> **On the V1.2 prototype punch list** (Matt, 2026-08-12). Sequence: V1.2 lands with a real mark → re-run `docs/explainer/build.py` → the explainer becomes externally shareable. Until then it stays internal.

Input 5 is where Tenderfoot differs most usefully. IMPACT's mock data was realistic but *invented* — Eskenazi Health, Indy Tech Trades. Ours can be **real**: pull actual solicitations from SAM.gov and Indiana, PDFs and all.

That single act pays four times over:

1. Realistic data of realistic length, per Proto2PRD §4.1.1 — real RFP titles are 140 characters and real scopes are ugly. Invented ones are neat, and neat data hides every layout problem.
2. It forces the schema to survive real-world mess before a migration exists.
3. It becomes the hand-labeled extraction test set (5D) the spec already requires. **Promoted 2026-08-11:** with no scores in V1, extraction is the only thing the system can be right or wrong about, so this is now the first payoff rather than the third.
4. ~~It seeds the few-shot example set (3K).~~ **Parked 2026-08-11** — nothing consumes examples (spec §1.1). It still accumulates real decisions with real reasons, which is what qualification eventually gets designed *against*; that is a slower and better payoff than seeding a scorer.

### A2. The hand-run — RETIRED PERMANENTLY, 2026-08-11

**Matt's call, and it is not a deferral.** The hand-run is removed from the plan. It is not rescheduled, not reduced in scope, and not waiting on anything. The click-through scoring artifact is obsolete.

**Why it holds up.** Every job this stage existed to do has either been parked or has moved into V1 itself:

| What A2 was for | Where it went |
|---|---|
| Feasibility test — *can a human separate fits from non-fits?* | Parked with the scorer (spec §1.1). V1 separates nothing. |
| Few-shot example set (3K) | Parked. Nothing consumes examples. |
| Reason-chip vocabulary | Parked. V1 records free text. |
| Adjudication answer key | Parked. Nothing to be an answer key *for*. |
| A read on whether the market holds work KP would pursue | **SP6 answers this with live data**, which is a better answer than scoring a frozen corpus. |

The remaining argument for keeping it was that it rehearsed V1's daily loop. **Rehearsing a loop you are about to build is not worth a day**, and it was the weakest of the six reasons.

> **Two things die with it. Both are real losses and neither is being quietly absorbed.**
>
> **1. The negative profile has no source.** §4.2 wants *what KP will never bid, and why*. Past proposals were cut on 2026-08-10 for lack of access, and §8.2 rerouted it to the hand-run's no-bid reasons. **That reroute is now also gone**, so the negative profile is empty until V1 accumulates real decisions. The field stays in the model and stays empty — same treatment as past performance, and for the same reason: if a source appears, the capability returns without a migration.
>
> **2. Inter-rater agreement will never be measured.** `corpus/README.md` argues it is the ceiling on achievable precision — no scorer beats the rate at which two experienced people disagree — and the plan was to get it by having Matt and his boss score the same rows. **There is now no occasion on which that happens.** When qualification is eventually designed, *"how much better than two disagreeing experts does this need to be"* will be unanswerable, and the honest response will be that nobody measured it.
>
> Recorded rather than solved. Both are cheap to recover later if wanted — the corpus is still in the repo and still scoreable — but neither happens by default now.

**The corpus itself stays and is not affected.** `corpus/` was collected for four consumers; the hand-run was one. The other three — realistic prototype data, the hand-labeled extraction test set (5D), and real documents to develop ingestion against — are untouched, and 5D was promoted this same day to the most valuable thing the corpus holds.

> **If the hand-run is hard, that is the most important finding the project will produce.** Stop and reconsider before building anything.

### A3. The bake-off — three directions, three screens

Per Proto2PRD §4.3. Three archetypes that between them exercise every visual decision:

| Screen | Archetype | What it exercises |
|---|---|---|
| **Triage queue** | Dense list | Table density, the four-score display, scanning rhythm |
| **Opportunity brief** | Document-heavy detail | Evidence/citation pattern, fact panels, long-form reading |
| **Firm Profile editor** | Long varied form | Every form primitive — text, codes, multi-select, free text |

Hold brand hue constant across all three directions; vary canvas, radii, typography, and shadow (§4.3.1). **Write the brief down** — IMPACT's was lost.

Expect the references to lose ground to the content type (§4.2.4). Tenderfoot is dense tables and long documents, which is the same pull that took IMPACT to 2/4/8px radii.

**Tooling for this stage: Claude Design, then hand off.** Per Proto2PRD §4.3.2, the bake-off is the one part of Phase 0 where forking away from Claude Code is likely worth it — it is generation-heavy, disposable by design, and two of the three directions get archived. Claude Design's handoff bundle passes to Claude Code in one instruction, which is the seam.

Three Tenderfoot-specific notes on taking that fork:

- **Its headline feature does not apply yet.** Claude Design reads a repository to apply an *existing* design system. Tenderfoot has none — producing it is what A3–A5 are *for*, and the wordmark is an output too (§A1.1). That capability becomes useful at A8–A9 and in production, not here.
- **Commit all three directions to the repo before promoting one**, including the losers. §4.4's archive-don't-delete rule is easy to lose across a tool boundary, and the losers are evidence about why the winner won.
- **Owe Proto2PRD one line afterwards** — whether the handoff actually saved work, or whether translating a Design artifact into a specification-grade repo cost more than building it in the repo would have. §4.3.2 is marked *(N)*: it is an option with no result attached, and this project would be the first to attach one.

**The build-out (A7) stays in Claude Code regardless**, and not by preference. Tenderfoot's mock data is 76 real solicitations and 39MB of committed documents; §4.1.1 makes the production schema *the prototype's mock dataset normalized*; and SP1's demo criterion is those exact records loading into the real schema. None of that survives leaving the repository.

### A4–A6. Select, measure, document

- Select one direction. Promote it. **Archive the losers, do not delete them.**
- *Then* sample the palette from the KP logo, per token, with a comment naming the source element. Not before — choose form while colour is still approximate (§4.5).
- Record whatever constraint the logo imposes.
- Write `CLAUDE.md`: source-of-truth list with explicit precedence, prototype location, token table, product rules, working conventions.

### A7. Build out the prototype

Roughly nine screens: triage queue, opportunity brief, adjudication view, entity detail, expiration radar, saved views, source admin, profile editor, reports.

> **State as of 2026-08-10, end of session.** A first direction exists and covers nearly the whole SVRC. Three facts about it, so nobody has to re-derive them tomorrow:
>
> 1. **The bundle is frozen and unmodified.** `prototype/PROTOTYPE/Tenderfoot UI Mockups.html` is byte-identical to what came out of Claude Design. Editing it in place is pointless — a re-export discards the edits — so it stays as the record of the direction and extraction goes outward into `src/`.
> 2. **The specification layer is started, and it is separate from what renders.** `src/app.js` holds the seed data as a §4.1.1 mock layer with the business rules written in as comments; `src/tokens.css` names the palette. **Nothing loads them.** The rendered prototype still carries 342 inline styles, zero custom properties, ten radius values, and no comments. Gaps are closed *for production*, not *for the artifact you look at*.
> 3. **The rendering layer has not been rebuilt, deliberately.** That is A7 proper, not cleanup, and it is a rebuild with real risk of losing fidelity to the chosen direction. Procedure and rationale: `ClaudeDesign_Proto_Cleanup.md`.
>
> **The decision waiting at the top of A7:** does the rendering get rebuilt repo-native, or does iteration stay in Claude Design with a re-extract each round? The second keeps generation fast and makes the mock layer's comments the only durable specification. The first makes the prototype itself the specification, as IMPACT's was. Not settled.
>
> **Two decisions handed back and still open:** the radius scale (ten values; collapsing them changes the design), and the reason-chip vocabulary (generator-invented, must come from the hand-run instead). One generated chip — *"Capacity — too large"* — contradicts §1's capacity-agnostic rule and is flagged in `src/app.js` rather than silently fixed.

**The mock layer is the deliverable.** `app.js`, IIFE plus one namespace, seeded with the real solicitations from A1, encoding the eleven-object graph with commented business rules — the Solicitation → Award → Contract chain, sightings versus canonical records, assessment versioning, the hard-gate model.

Get these settled here, where they cost a `sessionStorage` key:

- Does the entity graph hold up when you actually try to render a re-compete?
- What does a Sighting look like beside its canonical record?
- How do four separate scores display without turning to mush?
- What does an evidence citation look like — inline, hover, panel?
- What does a filed-not-deleted hard-gate rejection look like?

### A8–A9. Iterate, then freeze

Iterate with real spec/plan pairs (§4.7) — the prototype gets the same discipline as production, including plan-authored commit messages. Update CLAUDE.md as part of each change.

When Matt stops asking for changes: **freeze it.** From that point it is a specification.

---

## 5. Stage B — Planning

| | Task |
|---|---|
| ~~**B1**~~ | ✅ **Done 2026-08-12.** Fidelity mandate at spec **§7.10**, platform properties at **§5.9**. The mandate gained three clauses IMPACT's did not need: it **names a version** (V1.1, re-pointed deliberately when V1.2 lands), parity applies **only to what V1 builds** while requiring parked nodes to match when built, and the wordmark is exempt until it exists. **One hole named rather than discovered: the prototype specifies desktop only, so responsive behaviour has no reference** — a decision that would otherwise get made silently during the build. |
| ~~**B2**~~ | ✅ **Done 2026-08-12** — [`superpowers/specs/2026-08-12-tenderfoot-workflow.md`](superpowers/specs/2026-08-12-tenderfoot-workflow.md). Closes §10.3. **Revised 2026-08-13** for Vercel + Neon: §1, §2, §6, §7, §8, §9, §10, §12. The "no hosting, no staging, nearly no secrets" framing is superseded and marked in place rather than deleted — **there is now a host, preview deploys serve as staging, and `DATABASE_URL` is the first real secret.** Still thin on ceremony; no longer thin on platform properties. |
| **B3** | Write one implementation plan per sub-project below, with complete code and per-task verification. Commit everything before any application code. |

---

## 6. Development slices

Nine sub-projects. Each ≤50 tasks, each ending in something demo-able, each depending only on its predecessor.

| # | Sub-project | Components | Demo-able ending |
|---|---|---|---|
| **SP0** | Infrastructure | 0D + CI, hooks, environments | Hello-world through the **full** deploy path, touching the DB |
| **SP1** | The entity graph | 0A, 0B, 0C, 1A, 1C, 1E, 1F, 4J *(minimal)* | The prototype's real solicitations load into the real schema; profile and source registry editable |
| ~~**SP1.5**~~ | **Postgres port + first deploy** *(added and completed 2026-08-13)* | — *(no new components)* | ✅ **MERGED** `703ea77`. 201 solicitations in Neon, reached at a deployed preview URL; 37 tests, gate 5/5 green. **One clause of the criterion knowingly unmet: preview deploys do NOT yet get their own database branch** — dashboard-only, six steps in workflow spec §8, so every preview writes to production until then |
| ~~**SP2**~~ | Design system | — *(tokens + primitives from the frozen prototype)* | ◐ **All 10 tasks complete 2026-08-13** — branch `sp2-design-system`, 22 commits, 73 files, gate green. **Sixteen primitives**, not the thirteen earlier notes claimed. **Deliberately NOT merged: the sign-off gate is the point of the slice**, and merging before Matt sees the gallery would defeat it. Five findings await his ruling and one known gap is recorded — see `STATUS.md` and [`SP2-fidelity-audit.md`](SP2-fidelity-audit.md) |

| ~~**SP3**~~ | Federal ingestion | 2A, 2B, 2F, **2G(a)**, 5E | ✅ **MERGED to `main` 2026-08-16** (`6a8cf67`). Run live against SAM.gov the same day: 530 open notices scraped, imported and merged. Plus **SP3.6 (source health + the run trigger)**, merged 2026-08-18 (`a110e93`) |
| ~~**SP3.5**~~ | **Merge — sightings into canonical records** *(added 2026-08-15)* | **2G(b)** *(split from SP3, see §6.5)* | ✅ **MERGED to `main` 2026-08-16** (`6a8cf67`). ⚠️ **One clause of the criterion is exercised only by a synthetic fixture:** cross-source dedup, because SAM and USASpending share no ID namespace, so no real pair exists to test it on |
| ~~**SP4**~~ | Fetch and extraction | 2H, 2I, 5D | ✅ **MERGED to `main` 2026-08-30** and deployed. Documents pulled and parsed; every field carries confidence and the passage it came from; accuracy IS measured — `closes_at` precision 100% on the first live reading, and ⚠️ **recall 12.5% UNVALIDATED: a lower bound, not a measurement**, because its denominator assumes all fourteen misses were the extractor's. Validating it is **PARKED** (2026-08-30). ⚠️ **Not measured against A1's labels, which do not exist.** The ground truth is the PORTAL LISTING, per `corpus/FINDINGS.md` §1 — a substitution made in the SP4 design and worth noticing here, because it means recall is scored against a denominator that assumes every miss was ours. Hand-labelling is the open task |
| **SP5** | ~~Matching engine~~ **PARKED** | — | **Removed from the sequence 2026-08-11.** V1 returns everything (spec §1.1); qualification is undesigned and will be re-imagined after ingestion runs. |
| **SP6** | Triage + record | 4A, 4B, 4D, 5A, 5B, 5C | **The answer.** Everything from active sources, read and decided in the app. Produces **discovery and volume**, not precision. **← GO / NO-GO** |
| **SP7** | Live ingestion *(on GO)* | 2C, 2D, 2E, 2J, 2K, 1B, 1D | Scheduled runs; state portals flowing; health alarms firing |
| **SP8** | Radars + reporting *(on GO)* | 3J, 3K, 3L, 4E, 4F, 4G, 4H, 4I, 4K | Expiration radar producing pre-RFP leads |

### 6.-2 What the persistence reversal changes — SP1.5

**Decided 2026-08-13.** Hosting is Vercel; the database is Neon managed Postgres. Reasoning in §9 item 1 and `Stack-Requirements.md`.

**Why it is a slice rather than a patch.** It has a demo-able ending that nothing else produces — **the application reachable at a URL, holding the same 201 solicitations** — and it changes the meaning of SP0's demo criterion, which was *"hello-world through the full deploy path."* That path grew a deployment. **A change that alters a completed slice's acceptance criterion is not a patch.**

**Why here and not later.** SP2 is the design system and touches no persistence. **SP3 is where adapters begin writing to the database in volume** — every line written against the wrong driver between now and then is a line ported twice. This is the last cheap moment.

**What it must not become.** The temptation is to also settle Express-versus-route-handlers, the blob provider, and where long ingestion runs. **Those are §9.2, §9.5 and §9.6 of the workflow spec and they stay open** — conflating them makes the port unreviewable and quietly designs three things nobody decided (`Proto2PRD` §4.7.5). **SP1.5 swaps the driver and deploys. Nothing else.**

> **Ruled 2026-08-13, with the counter-argument on the record.** Because the port makes every query site `await`, it touches every handler anyway — so moving to route handlers *now* would cost one pass instead of two. **Matt chose the second touch deliberately**, keeping Express and keeping IDE8 commonality. The cost is real and small: roughly 180 lines rewritten again if §9.5 later goes the other way.

### 6.-1 What the parking of SP5 changes

**Decided 2026-08-11.** The application returns all results from every active source — no ranking, no scoring, no filtering. Reasoning in spec §1.1.

**SP5 is removed rather than reordered.** It is not "later in the list"; it is undesigned. Components 3A–3I have no home in the current sequence and should not be treated as pending work with a known shape.

**SP6 survives and stays the gate, but the gate's question changes.** It was: *is the scorer's top N precise enough?* It is now: **does reading everything from active sources surface work KP would pursue and had not otherwise seen?** That is the discovery number from §8.5, and it is a fair test — arguably a fairer one, since it asks whether the sources and the collection are worth anything before any judgment layer can flatter them.

**A negative result stays valid, and the shape of it changes too** (§8.7). The old failure mode was *"the scorer cannot separate fits from non-fits."* The new one is *"everything the active sources return, read exhaustively, contained almost nothing worth pursuing"* — which would be a finding about the market rather than about the software, reached faster and with less machinery.

**What SP6 must now also produce, because nothing else will:** volume per source per week, and Interested-per-hundred per source. Those two numbers are the input to designing qualification, and V1 is the only thing that can generate them.

> **Watch this, because it is the risk the ordering creates.** If volume turns out to be high, SP6's demo is a person reading a great many irrelevant rows, and the tool will feel worse than the portal alerts it replaces — while measuring exactly the thing that would fix it. That is a real possibility and it is accepted deliberately (§1.1). **It is not, however, a reason to quietly reintroduce a filter**; if volume forces the issue, that is the trigger to design qualification properly, not to bolt on a threshold.

### 6.0 Open tension — SP8's radar may not belong in SP8

*Raised 2026-08-10 by the Indiana contract probe. Not resolved; flagged for the same reconciliation pass as the rest of §6.*

The slice table puts the Expiration Radar in **SP8** — last, and gated on a GO at SP6. That placement assumed the radar depended on solicitation ingestion, extraction, and matching being in place first.

It does not. `corpus/indiana-contracts/` establishes that every contract Indiana holds publishes its `endDate` through one anonymous JSON endpoint, no scraping, no credentials, no extraction. The radar's whole input is **already collected and in the repo.**

That produces an awkward ordering:

| | Expiration Radar | Everything before it |
|---|---|---|
| Dependencies | One endpoint and the entity graph (SP1) | Ingestion, fetch, extraction, matching |
| Lead time it buys | **6–18 months ahead of an RFP** | Days to weeks |
| Answers §1 problem | #2, *finding out too late* | #1 and #3 |
| Current slice | SP8, post-gate | SP3–SP6 |

So the feature that most directly answers the problem the project exists to solve is scheduled last, behind a gate, and its data is the easiest to get.

**Arguments for leaving it in SP8.** SP6 is the honest go/no-go; moving attractive work in front of the gate weakens it. The radar produces *leads*, not scored opportunities, so it does not demonstrate the matching engine works — which is the thing actually in doubt. And contract-expiry leads are unvalidated: nobody has confirmed KP would act on one.

**Arguments for pulling it forward.** It is cheap, its data is in hand, and it is the one output KP could use before the engine is trustworthy. It also exercises the Organization ↔ Vendor ↔ Contract path of the entity graph early, which SP1 otherwise only asserts.

**A third option, probably the right one:** leave the slice where it is, and add the contract register as a *source* in SP1's demo criterion — the real contracts load into the real schema alongside the real solicitations. That gets the data model tested against contract records early without moving a post-gate feature in front of the gate.

### Resolved 2026-08-10 — Matt's answer

> *"It's not likely, but it is possible, especially for Medicaid-related RFPs."*

That is a narrower answer than either argument above assumed, and it settles the slice question cleanly: **the Expiration Radar stays in SP8, behind the gate.** A capability KP would use rarely does not justify moving work in front of the go/no-go.

But "rarely, except in one sector" is not the same as "no", and the exception is specific enough to design for:

1. **The radar is sector-weighted, not global.** A contract expiring in Medicaid managed care is a lead. The same contract expiring in facilities or IT maintenance is a row in a table. When SP8 arrives, expiry alone must not generate a lead — expiry **within a Firm-Profile sector of interest** does. Otherwise the radar produces 2,160 leads a year and gets muted in a week, which is failure mode #3 (noise) rebuilt in a new place.
2. **The third option still stands, and is now the whole of the near-term work.** Fold the contract register into **SP1's demo criterion**: real contracts load into the real schema beside real solicitations. That tests Organization ↔ Vendor ↔ Contract early, costs nothing extra, and moves no post-gate feature forward.
3. **The 2026-12-31 Medicaid cliff is a live instance, not a hypothetical.** 231 contracts across 149 vendors, including the MCO capitation book, all expiring on one date inside KP's single strongest sector. Whatever the radar would have said about it can be checked by hand now, which makes it the natural fixture for the SP8 seam test.

### 6.1 Why these boundaries

**SP1 is where the prototype cashes in.** Per Proto2PRD §4.1.1, the production data model should be the prototype's mock dataset normalized. Making that the *demo criterion* — the same real solicitations loading into the real schema — turns a principle into a check.

**SP2 comes before any feature work.** This is the ordering that cost IMPACT an entire unplanned sub-project (§7.1). Tenderfoot's primitives are unusually load-bearing: the four-score display and the evidence/citation pattern appear on every surface, so getting them wrong once means getting them wrong in fifteen places.

**Ingestion splits across SP3, SP3.5 and SP4** because each is large on its own and independently demo-able. **SP3 proves records arrive; SP3.5 proves the system can tell one opportunity from two; SP4 proves the contents get read correctly.** *(Amended 2026-08-15 — this sentence previously read "SP3 proves records arrive and dedup," which is the conflation §6.5 separates: arriving and de-duplicating are different claims, provable at different moments, and bundling them let the merge hide inside a criterion no component built.)*

**SP6 is the gate, and everything before it is in service of it.** The spec already accepts a negative result as valid (§8.7). Sequencing puts that finding as early as it can honestly come.

**SP7 and SP8 are conditional.** They are the only sub-projects that assume the answer was yes.

### 6.2 Seam tests, before the features that use them

Per Proto2PRD §8.3, the places where Tenderfoot fails **silently**:

| Seam | Failure mode | Test lands in |
|---|---|---|
| ~~**Hard gates**~~ | ~~A wrong gate deletes a qualified opportunity and nothing reports it~~ | ~~SP5~~ — **parked with SP5.** V1 has no gate, so it has no gate seam |
| **Sighting identity** | One solicitation from three sources becomes three records — or two different ones merge | SP3 |
| **Dates + eligibility extraction** | A wrong deadline is a missed bid | SP4 |

The spec already requires gated items be *filed, not deleted* (§6.2) precisely so the first one is inspectable. The test makes that promise real.

> **The gate seam comes back the day anything gates.** It is parked, not retired, and it is the single most dangerous seam in the design — a wrong gate is a loss nothing reports. Reinstate this row before the first filter ships, not after.
>
> **Sighting identity gets more load-bearing, not less.** With everything returned, duplicate suppression is the only volume control V1 has, and it is the honest kind: one solicitation reaching the user once is not a judgment about whether it deserves attention. Weight SP3's test accordingly.

### 6.3 The regression gate — PARKED WITH SP5

From SP5 onward, every scorer change re-runs the backtest and compares against the previous scorer version. The gate is **"precision did not regress against version N−1"** — the substitute for a green test on a component that is never simply correct.

This is why 5A and 3I get built as infrastructure in SP5–SP6 rather than as features later.

### 6.4 Slice order reconciled against the ruled scores — 2026-08-15

**The pass §4 called for, and it could not run until 2026-08-14.** §4 says *"§6's slice ordering is now a proposal to reconcile against Matt's priorities, not a fixed plan"* — but the priorities were Claude's placeholders until Matt ruled all twenty SVRC nodes on 08-14 (v0.6.0, fourteen moved). This is the first time the reconciliation has had a real input.

**The rule being applied**, from §4: where Matt's ranking disagrees with the dependency graph, **the dependency graph wins only on hard ordering constraints; everything else defers to his priority.**

~~**Result: no slice moves.**~~ **AMENDED 2026-08-16 — one does.** As written on 08-15 the result was no movement, two amendments to how §6 justifies itself, one finding proposed for Matt, and one tension recorded. **Matt ruled the proposed finding YES on 2026-08-16 (A3 below), so source health moves in front of the GO gate** and the sequence gains a slice.

**Sequence as it now stands:** SP0 → SP1 → SP1.5 → SP2 → SP3 → SP3.5 → **source health** → SP4 → SP6 → SP7 → SP8. Everything else is unchanged.

> **Updated 2026-08-30: everything through SP4 is merged to `main`.** The next slice is **SP6 — Triage + record**, which is the **GO / NO-GO gate**. It also now carries two bullets of SP4's own demo criterion, deferred to it by ruling because they need a record view SP6 owns (`specs/2026-08-28-sp4-fetch-extraction-design.md` §10.1 names what that deferral costs).

#### A1 — "Build the shell first" is now a stated dependency, not an inherited score. **Applied.**

`Shell A` and `Region A.1 : Main Header` both rule at **`Pri 3`**. Eight nodes rule higher, and `View 1.1 : The Queue` and `View 6.2 : Source Registry` both rule `Pri 5`. **Sorted by priority, the queue would be built before the frame it renders inside** — which is absurd for a reason that has nothing to do with priority.

**The scores are correct and must not be adjusted to fix this.** KP does not want a header; they want the queue. `Pri 3` is a true statement about the product, and lowering or raising it to make a planning document sort correctly is precisely the circularity Q1 outlawed on 08-13.

> **So §6 states the constraint on its own authority: the shell is built before the views it contains.** This is a **third hard ordering constraint**, and §4 lists only two — §2.2 entity FKs and §3.1 `since`. **§4's list was incomplete, and the `Pri 3` ruling is what exposed it.** A containment relationship is a hard constraint in exactly the way a foreign key is; it was invisible while the shell carried a placeholder `Pri 5` that happened to sort right for the wrong reason.

#### A2 — Parked nodes are excluded by their marker, never by their number. **Applied.**

Two parked nodes now carry **`Pri 4`** — `Screen 7 : Pipeline Board` (raised from `Pri 1`) and `View 2.2 : Scores and Evidence`. **Both now outrank every `Pri 3` node that does ship**, including `View 2.1 : Brief`, `View 2.4 : Documents`, `View 4.1 : Organizations` and `View 4.2 : Vendors`.

**Any Pri-derived ordering would pull both in front of shipping work.** The SVRC's scoring key already rules the fix — *"planning excludes a parked node by that marker, not by its number"* — and names this document as the consumer. **§6 now says so explicitly rather than depending on a reader of the SVRC having seen it.**

> `Screen 7` is the clean case: **its number went up and its schedule did not move.** That is the whole purpose of separating the marker from the score, and it is worth noting the two parked nodes were parked for *different causes* — `View 2.2` by the V1 scoring decision (spec §1.1), `Screen 7` by a phase deferral (§9). The marker handled both without amendment.

#### A3 — Source health precedes the gate. ✅ **RULED YES by Matt, 2026-08-16.**

`Region A.2 : Status Bar` rules **`Pri 4`** — **higher than the shell that contains it and higher than the main header.** Its two children are the Source Health Indicator and Last Run. §6 currently places health alarms in **SP7**, which is *after* SP6's GO / NO-GO.

**The tension is not about priority, it is about whether the gate's number means anything.** SP6 must produce volume per source per week and Interested-per-hundred per source (§6.-1). **Known risks record four silent-failure instances across three source platforms.** A GO / NO-GO measured during a window in which a source was silently dead is not a measurement of the market; it is a measurement of an outage, and nothing in the current sequence would reveal which one had happened.

| | |
|---|---|
| **What is proposed** | A minimal source-health surface — is each source up, when did it last run — lands **before SP6**, not in SP7. Not alarms, not alerting: the read-only indicator `Region A.2` already describes |
| **Why it is not just moved** | It is a slice-boundary change and therefore Matt's, not Claude's. `View 5.2 : Source Yield` (`Pri 4`) is already in SP3's demo criterion, so part of the surface may exist by then and the increment could be small |
| ~~**If declined**~~ | Not declined. *(For the record, the declined branch would have required SP6 to name how liveness was verified during the measurement window rather than assume it.)* |

##### What the ruling settles, and what it does not — 2026-08-16

**Settled: it lands before SP6, and it is read-only.** Is each source up, when did it last run. **Not alarms, not alerting** — the indicator `Region A.2` already describes, and nothing more.

**The argument got stronger between proposal and ruling, by measurement rather than debate.** The proposal rested on *four* silent-failure instances across three platforms. Since then: a **fifth**, and the first one that was ours — `is_active=false` aimed SAM's adapter at a 5.5-million-record archive and **reported success**, 307 rows, no errors. And the first two live windows returned **530 notices one day and 57 the next**. A GO/NO-GO taken across those two days would differ by an order of magnitude, and **nothing in the sequence could have told that apart from a source that had quietly died.** That is the tension this row describes, observed rather than predicted.

**Not settled: the slice number, and it is deliberately left open.** No dependency forces a position between SP3.5 and SP6 — health needs sightings to exist (SP3, done) and nothing else. Two honest options:

- **Immediately, before SP4.** The cheapest moment: `View 6.2` shipped on 2026-08-16 and **already renders a HEALTH column**, which currently reads `unknown` on all thirteen rows because nothing writes `source.health`. The screen and the empty column are both sitting there.
- **As SP4.5, after extraction.** Defers it behind the larger slice, which risks the same "we will measure it later" the A3 tension is about.

**Claude recommends the first**, and notes the increment is genuinely small: the column, `last_run_at`, and a rule for setting them. `View 5.2 : Source Yield` already exists as of SP3.5, so part of the surface is built.

⚠️ **`Region A.2 : Status Bar` itself may not be buildable yet.** It is a *shell* region — the bundle renders it as the footer, `4 SOURCES · 1 DEGRADED · 1 ROT SUSPECTED · LAST RUN …`, deep-linking into the registry — and A1 above makes the shell a hard dependency of the views it contains. **The registry column can carry health before the status bar does.**

#### A4 — An `Imp 5` node sits behind the gate. **Recorded, no change proposed.**

Four nodes rule `Imp 5`: `View 1.1 : The Queue` (SP6), `View 2.3 : Extracted Fields` (SP4), `View 6.1 : Firm Profile` (SP1) — and **`View 5.1 : Market Sizing`, which sits in SP8, behind a GO.** Three of the four most important things in the product are built before the gate and the fourth is conditional on passing it.

**This is judged correct and left alone.** Market sizing is a claim about a population, and the population does not exist until ingestion has run for a while — the dependency is real rather than administrative. **And SP6 already discharges part of it**: volume per source per week and Interested-per-hundred are required outputs of the gate itself, so the first market-sizing numbers arrive with the gate rather than after it.

> Recorded here because an `Imp 5` behind a conditional gate is the kind of thing that gets rediscovered as a surprise at SP6. **It is a known and accepted position, not an oversight.**

#### Closing §6.0's flag

§6.0 was raised on 08-10 and marked *"flagged for the same reconciliation pass as the rest of §6."* **This is that pass.** Matt resolved the substance on 08-10 — the Expiration Radar stays in SP8 — and the ruled score now independently agrees: `View 3.1 : Expiration Radar` rules **`Pri 4`, not `Pri 5`**, so nothing in the priorities argues for pulling it in front of the gate. **§6.0's flag is closed, its ruling stands, and the three consequences recorded under it (sector-weighting, the SP1 demo-criterion fold-in, the Medicaid cliff as SP8's fixture) are unaffected.**

> **There is no scorer in V1, so there is no scorer regression gate.** What replaces it is narrower and still worth having: **ingestion regression.** A source that silently returns fewer records than last run is the V1 equivalent of a scorer regression — invisible, and a direct hit on the one pain V1 exists to solve. Spec §5.4 already requires instrumenting for source rot; that instrument *is* the regression gate for V1, and it should be built in SP3 rather than inherited later.

### 6.5 The merge step becomes its own slice — SP3.5, added 2026-08-15

**Ruled by Matt 2026-08-15**, out of the ingestion scaffolding design (`docs/superpowers/specs/2026-08-15-ingestion-scaffolding-design.md`, open item 2). That design lands **sightings**; turning them into canonical solicitations was real work with no home in the plan.

**It was not missing from the plan — it was hidden inside SP3's demo criterion.** SP3 read *"dedup works; per-source yield visible."* Both clauses describe the merge, not the ingestion, and both have now moved. A criterion that names a capability no listed component builds is how a slice silently grows.

**Why `2G` splits rather than moves.** The build inventory's `2G` is *"Sightings + dedup"*, which bundles two things at different stages:

- **`2G(a)` — the schema.** Observations recorded separately from the canonical record. **Already shipped in SP1** (`002_entity_graph.sql`: the `sighting` table, deliberately without a unique constraint on `solicitation_id`). SP3 consumes it by writing sightings.
- **`2G(b)` — the merge logic.** Dedup across sources, change detection for addenda and deadline moves, and honest per-source yield. **Not built.** This is SP3.5.

**Why it is a slice and not a task.** It has a demo-able ending nothing else produces — *the same solicitation, seen by two sources, resolving to one row, with its sighting history intact* — and that demo is the first time the system shows it can tell one opportunity from two. It also has a hard dependency in the other direction: **SP6's gate cannot demo real screens against raw sightings**, because a triage queue that shows the same solicitation three times because three sources carry it is not a triage queue.

**Why SP3.5 and emphatically not SP5.** SP5 is a **retired** number — the parked matching engine (§6.-1) — and it is referenced as such across this document, `STATUS.md`, and the design spec. Reusing it for something unrelated is exactly the failure `Proto2PRD-Lessons.md` §2.18 records: *a change to what something means moves nothing and breaks everything.* Every historical reference to "SP5" would silently acquire a second meaning. **SP1.5 is the precedent for inserting a slice**, and it is the one followed here.

**Position is forced, not chosen.** After SP3, because merge needs sightings to exist. Before SP4, because extraction attaches documents to canonical records. Well before SP6.

---

## 7. What is needed from Matt, and when

| When | What | Rough cost |
|---|---|---|
| **Tomorrow** | Area outline with descriptions, effort/impact, priority — plus user stories | In progress |
| **Tomorrow** | Inspiration images | In progress |
| Tomorrow | Tech stack outline — closes §10.3 | In progress |
| Stage A3 | Name **one** inspiration image as the palette source (§4.1.1) — Tenderfoot has no logo to measure | Minutes |
| ~~Stage A2~~ | ~~**The hand-run**~~ | **Retired permanently 2026-08-11 — see §A2** |
| Stage A4 | Pick a design direction | Minutes |
| Stage A8 | Prototype iteration feedback | Recurring |
| SP2 gate | Design system sign-off | An hour |
| **SP6** | **Adjudication session** — the gate | A day |

**With A2 retired, SP6 is the only place Matt's judgment enters the project** — and it now sits behind every slice of build work rather than in front of it. That is a real change in shape: there is no longer a cheap early read on whether the premise holds, and the first honest signal arrives at the gate. Deliberate, and worth seeing plainly.

Everything else is buildable without blocking on him.

---

## 8. Immediate next actions

1. ~~**Claude:** collect real solicitations with documents.~~ ✅ Done — `corpus/`, 76 banded, 11 band A bundles pulled, findings in `corpus/FINDINGS.md`.
2. ~~**Matt:** the SVRC.~~ ✅ **Adopted 2026-08-10** — `../reference/Tenderfoot SVRC.md`. ~~**Two follow-ups:**~~ **Both closed.** `Imp`/`Pri` reviewed in full 2026-08-14 (fourteen of twenty moved, v0.6.0); `Proto` filled 08-12 against V1.1 and re-pointed 08-13 to V1.2, mean 85.2%. **User stories are still owed and have no stand-in** — the last thing outstanding on this item.
3. ~~**Matt:** inspiration images.~~ ✅ **Closed 2026-08-10 without gathering any** — the prototype direction supplies the design language (§A1.1).
4. ~~**Matt:** tech stack outline.~~ ✅ **Closed 2026-08-13.** The IDE8 stack above the database, **Vercel hosting with a Neon Postgres database below it.** Constraints in [`Stack-Requirements.md`](Stack-Requirements.md); the assessment and its 08-13 revision are at the foot of that file. **Six open questions now sit inside the choice** (workflow spec §9), two of them new and two carrying deadlines they did not have before: *where long ingestion runs* (SP3) and *which blob provider* (SP4). The largest is still whether extraction is rules-based or model-based.
   > **One requirement the checklist was missing, worth fixing in the template rather than just here:** it never asked **where the thing runs, and what it is allowed to write to.** That omission is the whole reason the persistence answer had to be given twice. Staged as a playbook lesson (`Proto2PRD-Lessons.md` §2.12).
4b. ~~**Matt owes answers — three of them.**~~ **Two down, one to go — [`../three_open_questions.md`](../three_open_questions.md), pinned 2026-08-12.**
   - ✅ **Q1 answered 2026-08-13** — `Pri` is **pure product judgment**, not build order. Dependency ordering is applied once, on top, here. **A node can be `Pri 5` and still land in a late slice**, and that is not a contradiction to fix by lowering the number.
   - ✅ **Q2 answered 2026-08-14** — a parked node **keeps its product scores and carries a bold `PARKED` marker above its grid.** **§6 must exclude a parked node by that marker, not by its number** — read the marker first and the `Pri` second. Three nodes are affected: Region 1.1.2, Region 1.1.5, View 2.2.
   - ✅ **Q3 answered 2026-08-14 — all twenty re-scored, fourteen moved.** `Imp` and `Pri` are Matt's rulings now, not Claude's placeholders. SVRC **v0.6.0**.

   **✅ CLOSED. Item 7 is unblocked** — §6 can now be reconciled against ratified numbers rather than guesses.

   **Two of the fourteen change the input to §6 directly, and in opposite directions.** `Shell A` and `Region A.1` dropped `Pri 5 → 3` because *"built once, early, everything assumes it"* is a statement **this section owns and the SVRC no longer makes** — they are still built first, and §6 must now say so on its own rather than inheriting it from a score. `Screen 7` rose `Pri 1 → 4` and **must not move earlier for it**; it carries a `PARKED` marker (§9 deferral) and §6 excludes it by that marker, not by its number.
5. **Matt, in progress 2026-08-10:** the prototype. Per §A3 the bake-off may run in Claude
   Design; the build-out returns to the repo (Proto2PRD §4.3.2). It ran *ahead* of the SVRC,
   which was flagged as a departure from the stated order — **the objection is now moot**, since
   the thing it was supposed to run behind was the hand-run, and that is retired (§A2).
6. ~~**Matt:** the hand-run (A2).~~ **RETIRED PERMANENTLY 2026-08-11.** Not deferred, not
   reduced. Every job it did is either parked with qualification or has moved into SP6, and the
   scoring artifact is obsolete. Two losses recorded in §A2 rather than absorbed: the negative
   profile has no source until V1 accumulates decisions, and inter-rater agreement will never be
   measured.
7. ~~**Claude:** reconcile §6's slice order against Matt's priorities — including the §6.0 tension about where the Expiration Radar belongs; draft the workflow spec from the stack outline.~~ ✅ **DONE 2026-08-15 — see §6.4.** Both halves closed: the workflow spec was drafted 2026-08-12, and the reconciliation ran against Matt's 08-14 rulings. **No slice moved.** Two amendments applied (shell-first is now a stated dependency; parked nodes excluded by marker, not number), **one finding proposed for Matt — source health before the gate rather than in SP7 (§6.4 A3)** — and one tension recorded. **§6.0's flag is closed and the radar stays in SP8**, which the ruled `Pri 4` independently agrees with. The note below stands as written and was not the deciding argument.
8. ~~**Claude, unblocked:** test whether one licensed platform retains closed solicitations.~~ ✅ **Done 2026-08-12. The answer is yes, and it changes an assumption.** **Illinois/Periscope retains 2,155 closed solicitations back to 2018-02-23, anonymously, with awarded vendor on the row** — so solicitation-side backtesting is *not* federal-only, which is what the spec had assumed. Michigan/CGI Advantage browses anonymously and returns 3,762 award-history records; closed-solicitation retention is indicated there but unproven. **Ohio/Ivalua is gated behind a CAPTCHA and is not a tier-3 adapter candidate as things stand.** Recorded in spec §5.7, §5.8, and §10.1–10.2.
9. **Then:** the bake-off.
10. ~~**Claude, next — SP1.5, the Postgres port.**~~ ✅ **Done and merged 2026-08-13** (`703ea77`). Plan written first, then executed as nine reviewed batches, a whole-branch review, a fix wave and a scoped re-review. **Scope held** — Express, the blob provider and the ingestion runtime all stayed open and out of it.
    > **What verification caught is the part worth reading, and it is in the merge commit.** The whole-branch review found four defects that all nine task-scoped reviews missed, because each was scoped to one diff. **The worst was a regression the port introduced and neither contributing diff was wrong:** one batch correctly made `enabled` a real boolean, another correctly deleted the now-redundant coercion, and between them `PATCH {"enabled":"true"}` began enabling a ToS-excluded aggregator with no legal note and no ingestion window — inert under SQLite, live under Postgres.
    >
    > It also found that `npm run check` had never run from a clean shell; every green gate reported during the slice passed only because the shell already carried the variables. And running the gate five times rather than once exposed a ~20% flake, traced to a Neon compute pinned at a fixed 0.25 CU and fixed by resizing it.
    >
    > **Sixteen rulings recorded with their costs.** Three corrected errors in the plan itself — two counts written from memory and a function-entry path Vercel never detects — each caught by an implementer who checked rather than complied.
    > **Two things the port must not lose**, because both were bought at some cost and neither is free in the new world: **foreign keys stay enforced** (they become unconditional in Postgres, which is strictly better than SP1's `PRAGMA`), and **`value_cents` becomes `bigint`, not `integer`** — a contract above roughly $21M overflows 32 bits, and the corpus holds contracts in that range.

Steps 2 through 5 are independent of each other, and step 7 is independent of all of them.

---

## 9. Open questions

1. ~~**Stack, hosting, deployment.**~~ **Answered twice, and the second answer reversed part of the first.**
   > **2026-08-12:** the IDE8 stack, with local-first SQLite and no hosting.
   > **2026-08-13:** **hosting is Vercel and the database is Neon managed Postgres.** Matt had intended Vercel throughout; the two decisions were made a day apart and could not both hold, because **Vercel has no writable persistent filesystem and a SQLite file cannot survive a request there.**
   >
   > **No data was lost** — `*.db` was gitignored from SP0 and the database has always been rebuilt from `corpus/` and the seed migrations. **The cost is ~600 lines of server code**, all inside the one merged slice, and it becomes **SP1.5** in §6. Everything above the database — React, Vite, Zustand, the router, no CSS framework — is unchanged.
   >
   > Recorded in `Stack-Requirements.md` ("Revision — Vercel and Neon") and the workflow spec §1, §7–§10. **Two lessons staged** in `Proto2PRD-Lessons.md` §2.11–2.12.
2. ~~**Where the hand-run's labels live.**~~ **Moot 2026-08-11** — the hand-run is retired (§A2) and produces no labels. The Verdict and Reason columns stay in `corpus/manifest.md` unfilled; the first real labels now come from V1 itself.
3. ~~**Prototype repo location.**~~ **Resolved 2026-08-10: a tracked subdirectory, `prototype/`.** IMPACT used a nested independent repo, which worked — 177 iteration commits kept out of the production log, and a freeze enforced by the filesystem rather than by discipline. Tenderfoot takes the simpler route because there is no production repo to nest inside yet. **The cost is real and accepted:** prototype commits interleave with planning and corpus commits, and "frozen" (§4.9) becomes a rule rather than a property. Splitting it out later is the remedy, and it gets more annoying the longer it waits. Layout and rules in `../prototype/README.md`.
4. **How many design directions in the bake-off, and what register does each represent?** IMPACT ran three — warm-editorial, civic-minimal, modular-dashboard — but the brief itself was lost, which Proto2PRD §4.3 flags as the one part of Phase 0 that did not survive. **Overtaken by events 2026-08-10:** one direction was generated and is in the repo; `prototype/archive/` is empty. Either other directions exist and should be committed there before this one is promoted (§4.4), or the bake-off effectively ran with N=1 — which is a legitimate choice but should be *recorded as* a choice, since §4.3.1's argument is that the comparison is what makes the selection mean something.
5. ~~**Does the rendering get rebuilt repo-native, or does iteration stay in Claude Design with a re-extract each round?**~~ **ANSWERED 2026-08-13: iteration stays in Claude Design. Claude does not hand-edit the bundle.**
   > **Three reasons, in order of weight.**
   >
   > **1. Hand-editing would make the token gate circular.** `verify-tokens.py` proves `tokens.css` round-trips to *the bundle*, and the bundle's value is that it is exactly what the generator emitted. Editing it by hand means editing the reference the verifier validates against — the check would then confirm agreement between two things the same author wrote, which is the failure this project has already recorded twice (SP0's verifier sharing a bug with the thing it verified).
   >
   > **2. Two editors, one artifact, no merge story.** Any hand-edit is lost or conflicts the moment Claude Design regenerates.
   >
   > **3. Breakpoints need a preview loop.** Responsive behaviour is the one gap §7.10 names about itself; deciding it by editing a `text/x-dc` DSL blind is the worst available method.
   >
   > **The cost that argued the other way has narrowed twice.** Token extraction is scripted — one command — and only the mock layer needs hand-carried work, specifically its comments.
   >
   > **The remaining half of this question has a stated expectation rather than an answer.** V1.2 is probably the **last round where the prototype is the source of truth**: once SP2 ships primitives, the repo holds a living component set and the prototype's job shifts from *specification* to *historical reference*. **Named now rather than left to happen by drift** — when it shifts, that is a decision to record, not a thing to notice afterwards. Raised 2026-08-10 by the first extraction, and **partly answered within hours by V1.1.** Re-extraction is not free and is not one-off: every Design iteration invalidates it. But the cost is narrower than feared — the generator closed the token gap by itself, so only the mock layer genuinely needs re-extracting, and only its **comments** must be carried forward by hand. **Narrower again as of 2026-08-11:** the token half is now scripted (`prototype/tools/`), so it costs one command per round. Measured in `ClaudeDesign_Proto_Cleanup.md`. The question that remains is whether the visual artifact ever becomes the specification, as IMPACT's was, or stays disposable with `src/app.js` carrying the spec. See §A7.
6. ~~**The radius scale.**~~ **Resolved 2026-08-11: twelve steps, adopted as-is, named for the element they sit on.** Sampling what carried each value showed the ramp tracks element size rather than being arbitrary — 1px on an 8×8 mark, 3px on a 22×22 checkbox, 7px on a button, 12px on a 540px modal — so a proposed five-step scale would have destroyed a real logic. `50%` is kept out of the scale as a separate primitive.
7. ~~**Token naming.**~~ **Resolved 2026-08-11: by role, with the generated names kept as aliases** so the frozen bundle keeps rendering. `prototype/PROTOTYPE/src/tokens.css`.
8. ~~**The reason-chip vocabulary.**~~ **Parked 2026-08-11 with qualification.** Chips were going to feed few-shot examples; nothing feeds anything now, so there is no vocabulary to get right and no urgency to derive one. V1 records a reason as free text against the decision.
   > **The `Capacity` question is resolved, not dormant** — corrected the same day. §1 binds the *system*, not the *user*: a person may record "too big for us right now" and should, since it is often the true reason and a system of record that cannot hold it misrepresents why things were passed on. **The defect was the automatic pipe from every reason into few-shot context, not the word.** The rule that carries forward is a data-flow constraint — *a recorded capacity judgment is a journal entry and may never become model input, a score, a weight, a filter, or a learned rule.* Surfacing a count is fine; acting on it is not.
10. **What V1's queue is ordered by, given that nothing ranks it.** Newest-first and soonest-deadline-first are both defensible and neither is a judgment; the user picks. Flagged rather than decided, because it is a prototype question and the prototype already has an opinion.
11. **Ingestion scaffolding, and mechanical vs smart as first-class modes.** Raised 2026-08-12, brainstorm deliberately deferred — [`Pinned-Ingestion-Scaffolding.md`](Pinned-Ingestion-Scaffolding.md). Four proposals: visible scaffolding for the mechanical layer, a candidate scrape that stops at the listing hop, a per-source `since` window, and **mechanical/smart as selectable modes recorded in the data rather than only in config.** Two of these fill holes that already exist — parking the scorer removed §5.3's fetch-depth governor and nothing replaced it, and the mode field is what would make §8.4 measurable per mode. **One item there does not wait for the brainstorm: the ingestion window must exist in code before the first real scrape.**
12. **When does volume force the question?** V1 measures rows per source per week (§8.3). Nobody knows the number. There should be a figure above which qualification stops being deferred work and becomes urgent work — but picking it before the first measurement would be inventing it, so it stays open deliberately.
9. **Two findings from the token extraction, both handed back rather than fixed** (cleanup never changes a colour). Ninety colour pairs sit below the just-noticeable-difference threshold, one of which is a hover state 0.44 ΔE from a resting surface and so cannot read as feedback. And `--signal-neg` carries three unrelated jobs — data-conflict flag, destructive action, and low score — which leaves the interface unable to distinguish "this is wrong" from "this is bad news." Both are documented in `tokens.css`.
