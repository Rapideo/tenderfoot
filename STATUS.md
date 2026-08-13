# Tenderfoot — status

**Updated 2026-08-12.** One screen. The reasoning lives elsewhere; this is only where things stand.

> **Now:** Stage B, two of three planning documents done. Next action is **B3 — the implementation plan for SP0**.

---

## The shape

**Stage A** establish what it is → **Stage B** plan it → **SP0…SP8** build it, one demo-able slice at a time.

## Stage A — prototype ✅

| | |
|---|---|
| Design spec | ✅ `docs/superpowers/specs/2026-08-03-tenderfoot-design.md` |
| SVRC (screen outline) | ✅ v0.4.0, adopted |
| Prototype | ✅ V1.1, frozen, reference-only |
| Tokens extracted + verified | ✅ 67 colours, 13 radii |
| Corpus | ✅ 76 live + 140 calibration + 2,160 contracts |
| Source research | ✅ Complete 2026-08-12 |

## Stage B — planning ◐

| | | |
|---|---|---|
| **B1** | Fidelity mandate + platform properties into the spec | ✅ 2026-08-12 |
| **B2** | Workflow spec — stack, CI, deploy, secrets | ✅ 2026-08-12 |
| **B3** | Implementation plans, one per slice | ◐ **SP0 in progress** |

## Slices

| | | Status |
|---|---|---|
| **SP0** | Infrastructure — client → API → SQLite, CI green | ◐ planning |
| **SP1** | Entity graph — real solicitations into the real schema | — |
| **SP2** | Design system — every primitive on a dev route. **Sign-off gate** | — |
| **SP3** | Federal ingestion — SAM.gov + USASpending | — |
| **SP4** | Fetch + extraction — documents parsed, fields cited | — |
| ~~SP5~~ | ~~Matching engine~~ | **Removed 2026-08-11** |
| **SP6** | Triage + record. **← GO / NO-GO** | — |
| **SP7** | Live ingestion *(on GO)* | — |
| **SP8** | Radars + reporting *(on GO)* | — |

---

## Waiting on Matt

**None of these block SP0–SP2.**

| | Blocks |
|---|---|
| `three_open_questions.md` — the SVRC `Imp`/`Pri` review | Slice order from SP3 on |
| User stories | Nothing hard; no stand-in exists |
| **Extraction runtime** — Node / Python sidecar / smart mode | **SP4** |
| Doc storage · one-file-per-firm · auth in V1 | Cheap now, expensive later |
| Ingestion scaffolding brainstorm | **SP3** |
| Prototype V1.2 — wordmark, mobile breakpoints | External sharing of the explainer |

## Waiting on Claude

| | |
|---|---|
| B3 for SP0 | In progress |
| B3 for SP1, SP2 | After SP0 proves the workflow spec |

---

## Decided this week

- **V1 returns everything active sources return.** No ranking, scoring or filtering. Matching parked as *undesigned* (spec §1.1)
- **Hand-run retired permanently.** Not deferred
- **Stack:** ideate/IDE8 — React 19, Vite, Zustand+Immer, Express, better-sqlite3 local-first. Minus dnd-kit, plus a router
- **Prototype is reference-only** and represents the finished product; V1 builds a subset
- **Legal posture rule:** ambiguous terms default a source to `out`; documented permission moves it `in`
- **Sources:** Illinois `in` and backtest-capable (2,155 closed to 2018) · Michigan + Kentucky `in`, current-only · Ohio `manual-only`

## Known risks

- **Deployment expires at SP7.** A closed laptop does not scrape
- **Extraction is the only thing V1 can be right or wrong about**, and Node is weak at `.docx`/`.xlsx`
- **Four silent-failure instances across three source platforms.** Every new adapter runs the vary-one-parameter check
- **Volume is unmeasured.** If the sources are loud, V1 feels like the portals it replaces

---

## Where things live

`STATUS.md` here · `DOOGIE - TENDERFOOT.md` session log · `docs/Tenderfoot-Plan-of-Action.md` the sequence and its reasoning · `docs/Proto2PRD.md` the reusable playbook · `docs/superpowers/specs/` design + workflow specs · `docs/superpowers/plans/` implementation plans · `reference/` SVRC + component inventory · `prototype/` frozen, reference-only · `corpus/` real solicitations and contracts
