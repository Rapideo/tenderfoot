# Tenderfoot — Plan of Action

**Written:** 2026-08-04
**Applies:** `Proto2PRD.md` to this project
**Reads with:** `superpowers/specs/2026-08-03-tenderfoot-design.md` (what we're building) and
`../reference/Tenderfoot - Concept Outline.md` (the 49-component build inventory)

---

## 1. How to use this document

`Proto2PRD.md` is the general playbook. This document is Tenderfoot's instance of it: the
ordered sequence, the development slices, and what is needed from Matt at each point.

Component IDs throughout (`0A`, `2B`, `5C`…) refer to the build inventory. Section references
like §6.3 refer to the design spec.

**Where this lands:** Stage A ends with a frozen prototype. Stage B ends with plans committed.
Stages C onward are execution. **There is a hard go/no-go gate at SP6** — everything before it
exists to answer whether the prospects are good enough to keep building.

---

## 2. What is already done

| Playbook input | Status |
|---|---|
| Requirements / rules / non-goals | ✅ The design spec — stronger than a PRD, 746 lines |
| Scope boundaries | ✅ Capacity-agnostic, discovery-only, management deferred |
| Component inventory | ✅ 48 in-scope components with dependencies |
| Source research | ✅ Platform-bound adapters, verified archive depths (§5.7–5.8) |
| Per-view UI outline | ❌ **Matt, next** |
| Design references + brand artifact | ❌ Not gathered |
| Domain source material | ❌ Not collected |
| Workflow spec (stack/hosting) | ❌ The last open question (§10.3) |

---

## 3. The two ways Tenderfoot departs from IMPACT

Both are `Proto2PRD.md` §2.1 boundary conditions, and both change the plan.

**The engine is the risk, not the screens.** IMPACT's screens largely *were* the product. For
Tenderfoot, a beautiful triage queue full of plausible opportunities proves nothing about
whether the ranking is any good. The prototype still earns its place — it settles the
eleven-object schema before a migration exists, which is our most expensive early commitment
(§2.2) — but it does not touch the actual risk. That needs a second instrument: the backtest.

**Matching is never "correct."** It is better or worse than the last version. No test goes
green. So three things get built as *test infrastructure* rather than as deliverables:
the backtest harness (5A), assessment versioning (3I), and a scored baseline. The gate becomes
*"precision did not regress against scorer version N−1."*

---

## 4. Stage A — Prototype

### A1. Assemble the five inputs

| # | Input | Tenderfoot's version | Owner |
|---|---|---|---|
| 1 | PRD | The design spec — already written | ✅ |
| 2 | Per-view outline | `SHELL` / `SCREEN` / `VIEW` inventory | **Matt** |
| 3 | Design references | One coherent system, sampled at several zoom levels | Matt + Claude |
| 4 | Brand artifact | KP logo — `C:\projects\kp-web` | Matt |
| 5 | Domain source material | **30–50 real solicitations, hand-collected** | Claude |

Input 5 is where Tenderfoot differs most usefully. IMPACT's mock data was realistic but
*invented* — Eskenazi Health, Indy Tech Trades. Ours can be **real**: pull actual solicitations
from SAM.gov and Indiana, PDFs and all.

That single act pays four times over:

1. Realistic data of realistic length, per Proto2PRD §4.1.1 — real RFP titles are 140 characters
   and real scopes are ugly. Invented ones are neat, and neat data hides every layout problem.
2. It forces the schema to survive real-world mess before a migration exists.
3. It becomes the hand-labeled extraction test set (5D) the spec already requires.
4. It seeds the few-shot example set (3K).

### A2. The hand-run — do this before anything is built

Sit with those 30–50 real solicitations and mark each one: **would bid / would not bid / unclear**,
with a one-line reason.

This is the cheapest signal available anywhere in the project, and it is a genuine
feasibility test. If a human expert cannot reliably separate fits from non-fits by reading the
documents, no scorer will either — and that is worth knowing on day two rather than at SP6.

It also produces, for a day of work: the adjudication answer key, the few-shot examples, the
negative profile in Matt's own words, and a concrete sense of what the brief needs to surface.

> **If the hand-run is hard, that is the most important finding the project will produce.**
> Stop and reconsider before building anything.

### A3. The bake-off — three directions, three screens

Per Proto2PRD §4.3. Three archetypes that between them exercise every visual decision:

| Screen | Archetype | What it exercises |
|---|---|---|
| **Triage queue** | Dense list | Table density, the four-score display, scanning rhythm |
| **Opportunity brief** | Document-heavy detail | Evidence/citation pattern, fact panels, long-form reading |
| **Firm Profile editor** | Long varied form | Every form primitive — text, codes, multi-select, free text |

Hold brand hue constant across all three directions; vary canvas, radii, typography, and shadow
(§4.3.1). **Write the brief down** — IMPACT's was lost.

Expect the references to lose ground to the content type (§4.2.4). Tenderfoot is dense tables
and long documents, which is the same pull that took IMPACT to 2/4/8px radii.

### A4–A6. Select, measure, document

- Select one direction. Promote it. **Archive the losers, do not delete them.**
- *Then* sample the palette from the KP logo, per token, with a comment naming the source
  element. Not before — choose form while colour is still approximate (§4.5).
- Record whatever constraint the logo imposes.
- Write `CLAUDE.md`: source-of-truth list with explicit precedence, prototype location, token
  table, product rules, working conventions.

### A7. Build out the prototype

Roughly nine screens: triage queue, opportunity brief, adjudication view, entity detail,
expiration radar, saved views, source admin, profile editor, reports.

**The mock layer is the deliverable.** `app.js`, IIFE plus one namespace, seeded with the real
solicitations from A1, encoding the eleven-object graph with commented business rules — the
Solicitation → Award → Contract chain, sightings versus canonical records, assessment
versioning, the hard-gate model.

Get these settled here, where they cost a `sessionStorage` key:

- Does the entity graph hold up when you actually try to render a re-compete?
- What does a Sighting look like beside its canonical record?
- How do four separate scores display without turning to mush?
- What does an evidence citation look like — inline, hover, panel?
- What does a filed-not-deleted hard-gate rejection look like?

### A8–A9. Iterate, then freeze

Iterate with real spec/plan pairs (§4.7) — the prototype gets the same discipline as
production, including plan-authored commit messages. Update CLAUDE.md as part of each change.

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

Nine sub-projects. Each ≤50 tasks, each ending in something demo-able, each depending only on
its predecessor.

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

### 6.1 Why these boundaries

**SP1 is where the prototype cashes in.** Per Proto2PRD §4.1.1, the production data model
should be the prototype's mock dataset normalized. Making that the *demo criterion* — the same
real solicitations loading into the real schema — turns a principle into a check.

**SP2 comes before any feature work.** This is the ordering that cost IMPACT an entire
unplanned sub-project (§7.1). Tenderfoot's primitives are unusually load-bearing: the
four-score display and the evidence/citation pattern appear on every surface, so getting them
wrong once means getting them wrong in fifteen places.

**Ingestion splits across SP3 and SP4** because extraction (2I) is large on its own and
independently demo-able. SP3 proves records arrive and dedup; SP4 proves the contents get read
correctly.

**SP6 is the gate, and everything before it is in service of it.** The spec already accepts a
negative result as valid (§8.7). Sequencing puts that finding as early as it can honestly come.

**SP7 and SP8 are conditional.** They are the only sub-projects that assume the answer was yes.

### 6.2 Seam tests, before the features that use them

Per Proto2PRD §8.3, the places where Tenderfoot fails **silently**:

| Seam | Failure mode | Test lands in |
|---|---|---|
| **Hard gates** | A wrong gate deletes a qualified opportunity and nothing reports it | SP5 |
| **Sighting identity** | One solicitation from three sources becomes three records — or two different ones merge | SP3 |
| **Dates + eligibility extraction** | A wrong deadline is a missed bid | SP4 |

The spec already requires gated items be *filed, not deleted* (§6.2) precisely so the first one
is inspectable. The test makes that promise real.

### 6.3 The regression gate

From SP5 onward, every scorer change re-runs the backtest and compares against the previous
scorer version. The gate is **"precision did not regress against version N−1"** — the
substitute for a green test on a component that is never simply correct.

This is why 5A and 3I get built as infrastructure in SP5–SP6 rather than as features later.

---

## 7. What is needed from Matt, and when

| When | What | Rough cost |
|---|---|---|
| **Now** | Per-view UI outline — `SHELL` / `SCREEN` / `VIEW`, elements in caps, composition only | A sitting |
| Stage A1 | Design references + KP brand artifact | An hour |
| **Stage A2** | **The hand-run** — score 30–50 real solicitations | **A day. Highest-value item here.** |
| Stage A4 | Pick a design direction | Minutes |
| Stage A8 | Prototype iteration feedback | Recurring |
| Stage B2 | Stack / hosting preference | A conversation |
| SP2 gate | Design system sign-off | An hour |
| **SP6** | **Adjudication session** — the gate | A day |

Everything else is buildable without blocking on him.

---

## 8. Immediate next actions

1. **Matt:** write the per-view UI outline. Composition only — no styling. Proto2PRD §4.2.2 has
   the format, and the IMPACT original is a working example.
2. **Matt:** point at design references and the KP brand artifact.
3. **Claude:** collect 30–50 real solicitations from SAM.gov and Indiana, with documents.
4. **Both:** the hand-run (A2). Do this before writing any code, including prototype code.
5. **Then:** the bake-off.

Steps 1 and 3 are independent and can run at the same time.

---

## 9. Open questions

1. **Stack, hosting, deployment** — deferred to the workflow spec (B2). The last open item from
   the design spec's §10.
2. **Prototype repo location** — separate repo, per Proto2PRD §4.9, or a tracked subdirectory?
   IMPACT used a nested independent repo, which worked.
3. **Where the hand-run's labels live** — they are needed by the prototype (mock data), SP4
   (extraction accuracy), SP5 (few-shot examples), and SP6 (adjudication baseline). One file,
   versioned, from the start.
