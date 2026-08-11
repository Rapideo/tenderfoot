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
| Scope boundaries | ✅ Capacity-agnostic, discovery-only, management deferred. Past-performance citation cut 2026-08-10 (§7.3) |
| Component inventory | ✅ 48 in-scope components with dependencies |
| Source research | ✅ Platform-bound adapters, verified archive depths (§5.7–5.8). One question left: do licensed platforms retain closed solicitations |
| UI outline + user stories | ◐ **Claude drafted an SVRC** — `../reference/Tenderfoot SVRC V0.1.0 (CLAUDE DRAFT).md`, structure derived from spec §7. **Matt owns the real one**; the draft exists to be overwritten, and its `Imp`/`Pri` columns are placeholders. **User stories still outstanding.** |
| Design references | 🔜 **Matt** — inspiration images |
| Brand artifact | ❌ Not gathered — *separate input from references, see §4.1* |
| Tech stack outline | 🔜 **Matt** — closes §10.3, feeds Stage B2 |
| Prototype | 🔜 **Matt, in progress as of 2026-08-10** |
| Domain source material | ✅ 76 solicitations banded; all 11 band A bundles pulled (`corpus/`) |
| Calibration material | ✅ 140 closed federal solicitations, two samplings (`corpus/calibration/`) |
| Contract history + expiry dates | ✅ 2,160 Indiana contracts expiring within 18 months (`corpus/indiana-contracts/`) |

**The outline format changed.** IMPACT's terse `SHELL` / `SCREEN` / `VIEW` composition list did not suit this project. Matt is supplying instead:

- The area outline, **with a description per area**
- An **effort/impact assessment** per area
- A **priority** per area
- A **complete set of user stories**

That is richer than the playbook's input #2 and it carries sequencing information the original format did not. Consequence: **§6's slice ordering is now a proposal to reconcile against Matt's priorities, not a fixed plan.** Where his effort/impact ranking disagrees with the dependency graph, the dependency graph wins only on hard ordering constraints (§2.2 entity FKs, §3.1 `since`); everything else defers to his priority.

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
| 2 | Area outline + user stories | **SVRC format** (IDE8 grammar) + user stories. Claude draft exists; Matt owns the real one | **Matt** |
| 3 | Design conventions | Inspiration images — one coherent system | **Matt** |
| 4 | Palette source | Open. May be a mark, a named image, or something else — see A1.1 | **Matt** |
| 5 | Domain source material | 76 real solicitations, 11 bundles pulled | ✅ `corpus/` |

### A1.1 Tenderfoot is its own brand, and that breaks a mechanism

**Decision (2026-08-04):** Tenderfoot is **not** branded as Koehler Partners. It is an internal tool first, but it carries its own name, identity, and design language.

This is architecturally consistent — §2.1's first portability rule says no fact about KP appears in the product — and a KP-branded interface would have been the largest remaining violation of it. Branding Tenderfoot as itself makes the portability claim real rather than notional.

**Both visual input slots stay open.** Proto2PRD §4.5 keeps design conventions and palette source as **two permanent, independent inputs** — either may be absent, either may be pre-existing or created for the project, and one artifact filling both is a convenience rather than the expected case. Tenderfoot is not an exception to that model; it is one configuration of it.

- **Slot 3 — design conventions.** Filled: inspiration images.
- **Slot 4 — palette source.** **Open.** There is no Tenderfoot mark yet. It may end up a mark created for the project, one named inspiration image, or something else. Keep the slot; decide the filling later.

What matters is not provenance but **naming before sampling**. Proto2PRD §7.2 is about relitigation:

> "Deriving the palette from an artifact nobody controls removes colour from the space of things that can be relitigated. There is no 'what if the blue were softer' conversation, because the blue is not a preference — it is a measurement."

Someone chose IMPACT's logo too, at some point. So whatever fills slot 4:

1. **Designate one specific source before sampling anything** — one file, not a set.
2. **Sample per token, with a comment naming the source element**, exactly as IMPACT did.
3. **Do not revisit it.** The discipline is in the not-revisiting, not in the provenance.

**And one thing moves from input to output:** IMPACT got a wordmark free with its logo. Tenderfoot's **name treatment is a Phase 0 deliverable**, produced by the bake-off rather than supplied to it. Each design direction should render the name in its own register — that is part of what is being chosen.

Input 5 is where Tenderfoot differs most usefully. IMPACT's mock data was realistic but *invented* — Eskenazi Health, Indy Tech Trades. Ours can be **real**: pull actual solicitations from SAM.gov and Indiana, PDFs and all.

That single act pays four times over:

1. Realistic data of realistic length, per Proto2PRD §4.1.1 — real RFP titles are 140 characters and real scopes are ugly. Invented ones are neat, and neat data hides every layout problem.
2. It forces the schema to survive real-world mess before a migration exists.
3. It becomes the hand-labeled extraction test set (5D) the spec already requires.
4. It seeds the few-shot example set (3K).

### A2. The hand-run — do this before anything is built

Mark each solicitation **would bid / would not bid / unclear**, with a one-line reason.

**As built, 2026-08-10:** 216 rows across three corpora in a click-through page, not 30–50 in a markdown table. The 24 live band A/B rows are the priority and the only ones the go/no-go depends on; the 140 calibration rows add example depth; band C is a spot-check. Two people score independently and exports are attributed — see `corpus/README.md` for why inter-rater disagreement is worth measuring before the engine exists.

This is the cheapest signal available anywhere in the project, and it is a genuine feasibility test. If a human expert cannot reliably separate fits from non-fits by reading the documents, no scorer will either — and that is worth knowing on day two rather than at SP6.

It also produces, for a day of work: the adjudication answer key, the few-shot examples, the negative profile in Matt's own words, and a concrete sense of what the brief needs to surface.

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
| **B1** | Amend the design spec: add the **fidelity mandate** and the **platform-properties section** (Proto2PRD §5.2). Platform properties matter more here than they did for IMPACT — half our inputs belong to other people (SAM.gov quotas, portal rate limits, IP blocks). |
| **B2** | Write the **workflow spec** — stack, hosting, CI, deploy, secrets, branch protection. Closes §10.3, the last open question. |
| **B3** | Write one implementation plan per sub-project below, with complete code and per-task verification. Commit everything before any application code. |

---

## 6. Development slices

Nine sub-projects. Each ≤50 tasks, each ending in something demo-able, each depending only on its predecessor.

| # | Sub-project | Components | Demo-able ending |
|---|---|---|---|
| **SP0** | Infrastructure | 0D + CI, hooks, environments | Hello-world through the **full** deploy path, touching the DB |
| **SP1** | The entity graph | 0A, 0B, 0C, 1A, 1C, 1E, 1F, 4J *(minimal)* | The prototype's real solicitations load into the real schema; profile and source registry editable |
| **SP2** | Design system | — *(tokens + primitives from the frozen prototype)* | Every primitive on a dev-only route. **Sign-off gate.** |
| **SP3** | Federal ingestion | 2A, 2B, 2F, 2G, 5E | `--since 24mo` pulls real SAM.gov + USASpending into the graph; dedup works; per-source yield visible |
| **SP4** | Fetch and extraction | 2H, 2I, 5D | Documents pulled and parsed; every field carries confidence + a source pointer; accuracy measured against A1's labels |
| **SP5** | Matching engine | 3A, 3B, 3C, 3D, 3F, 3H, 3I | A ranked, scored, **cited** list of real opportunities |
| **SP6** | Triage + adjudication | 4A, 4B, 4D, 3E, 3G, 5A, 5B, 5C | **The answer.** Backtest over 24 months, adjudicate the top N, produce precision and discovery. **← GO / NO-GO** |
| **SP7** | Live ingestion *(on GO)* | 2C, 2D, 2E, 2J, 2K, 1B, 1D | Scheduled runs; state portals flowing; health alarms firing |
| **SP8** | Radars + reporting *(on GO)* | 3J, 3K, 3L, 4E, 4F, 4G, 4H, 4I, 4K | Expiration radar producing pre-RFP leads; feedback loop closing |

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

**Ingestion splits across SP3 and SP4** because extraction (2I) is large on its own and independently demo-able. SP3 proves records arrive and dedup; SP4 proves the contents get read correctly.

**SP6 is the gate, and everything before it is in service of it.** The spec already accepts a negative result as valid (§8.7). Sequencing puts that finding as early as it can honestly come.

**SP7 and SP8 are conditional.** They are the only sub-projects that assume the answer was yes.

### 6.2 Seam tests, before the features that use them

Per Proto2PRD §8.3, the places where Tenderfoot fails **silently**:

| Seam | Failure mode | Test lands in |
|---|---|---|
| **Hard gates** | A wrong gate deletes a qualified opportunity and nothing reports it | SP5 |
| **Sighting identity** | One solicitation from three sources becomes three records — or two different ones merge | SP3 |
| **Dates + eligibility extraction** | A wrong deadline is a missed bid | SP4 |

The spec already requires gated items be *filed, not deleted* (§6.2) precisely so the first one is inspectable. The test makes that promise real.

### 6.3 The regression gate

From SP5 onward, every scorer change re-runs the backtest and compares against the previous scorer version. The gate is **"precision did not regress against version N−1"** — the substitute for a green test on a component that is never simply correct.

This is why 5A and 3I get built as infrastructure in SP5–SP6 rather than as features later.

---

## 7. What is needed from Matt, and when

| When | What | Rough cost |
|---|---|---|
| **Tomorrow** | Area outline with descriptions, effort/impact, priority — plus user stories | In progress |
| **Tomorrow** | Inspiration images | In progress |
| Tomorrow | Tech stack outline — closes §10.3 | In progress |
| Stage A3 | Name **one** inspiration image as the palette source (§4.1.1) — Tenderfoot has no logo to measure | Minutes |
| **Stage A2** | **The hand-run** — verdicts on the 24 band A/B rows in `corpus/manifest.md` | **A day. Highest-value item here, and it blocks on nothing.** |
| Stage A4 | Pick a design direction | Minutes |
| Stage A8 | Prototype iteration feedback | Recurring |
| SP2 gate | Design system sign-off | An hour |
| **SP6** | **Adjudication session** — the gate | A day |

Everything else is buildable without blocking on him.

---

## 8. Immediate next actions

1. ~~**Claude:** collect real solicitations with documents.~~ ✅ Done — `corpus/`, 76 banded, 11 band A bundles pulled, findings in `corpus/FINDINGS.md`.
2. **Matt:** the SVRC — area outline with descriptions, effort/impact, priority — plus the user
   stories. The format is now IDE8's SVRC grammar (shell/screen/view/region, six-column grid,
   grids at levels 1–2 only). A Claude draft exists at
   `../reference/Tenderfoot SVRC V0.1.0 (CLAUDE DRAFT).md` as a starting point to overwrite, not
   a substitute. **User stories are not drafted and have no stand-in.**
3. **Matt:** inspiration images. No KP branding — Tenderfoot carries its own identity (§4.1.1).
4. **Matt:** tech stack outline.
5. **Matt, in progress 2026-08-10:** the prototype. Per §A3 the bake-off may run in Claude
   Design; the build-out returns to the repo (Proto2PRD §4.3.2). Note this runs *ahead* of the
   SVRC and the hand-run rather than after them, which is a departure from the stated order —
   worth watching, since §A2 puts the hand-run before anything is built precisely because it is
   the cheap way to find out the premise is wrong.
6. **Matt:** the hand-run (A2). **This blocks on nothing else and is the only step that can invalidate the project cheaply.** It does not have to wait for the outline. Now runs in a click-through page rather than by editing markdown — 216 rows across three corpora, exporting back to `corpus/manifest.md` format. The live band A/B rows (24) are the priority; calibration is for depth of examples, not for the go/no-go.
7. **Claude:** reconcile §6's slice order against Matt's priorities — including the §6.0 tension about where the Expiration Radar belongs; draft the workflow spec from the stack outline.
8. **Claude, unblocked:** test whether one licensed platform (Periscope, Ivalua, CGI Advantage) retains closed solicitations. Under §5.7 a single answer covers Illinois, Ohio, Michigan, and Kentucky at once. This is the last unexplored source question.
9. **Then:** the bake-off.

Steps 2 through 5 are independent of each other, and step 7 is independent of all of them.

---

## 9. Open questions

1. ~~**Stack, hosting, deployment.**~~ Matt is supplying a tech stack outline; it becomes the input to the workflow spec (B2).
2. ~~**Where the hand-run's labels live.**~~ Settled: `corpus/manifest.md`, versioned from the start, with Verdict and Reason columns already in place.
3. ~~**Prototype repo location.**~~ **Resolved 2026-08-10: a tracked subdirectory, `prototype/`.** IMPACT used a nested independent repo, which worked — 177 iteration commits kept out of the production log, and a freeze enforced by the filesystem rather than by discipline. Tenderfoot takes the simpler route because there is no production repo to nest inside yet. **The cost is real and accepted:** prototype commits interleave with planning and corpus commits, and "frozen" (§4.9) becomes a rule rather than a property. Splitting it out later is the remedy, and it gets more annoying the longer it waits. Layout and rules in `../prototype/README.md`.
4. **How many design directions in the bake-off, and what register does each represent?** IMPACT ran three — warm-editorial, civic-minimal, modular-dashboard — but the brief itself was lost, which Proto2PRD §4.3 flags as the one part of Phase 0 that did not survive. Decide it deliberately this time and write it down before generating anything.
