# Tenderfoot — status

**Updated 2026-08-13.** One screen. The reasoning lives elsewhere; this is only where things stand.

> **Now:** **Persistence changed — SQLite is out, Neon Postgres on Vercel is in** (decided 2026-08-13). **No data lost; the database was always derived from `corpus/` and the seed migrations.** Cost is ~600 lines of server code in the one merged slice. **SP1.5 is the port, and it comes next.**
>
> Behind it: SP1 T12–T15 still outstanding (mock-layer re-extraction, minimal admin UI). 33 tests green as of the last run.

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
| **B3** | Implementation plans, one per slice | ◐ SP0 done · SP1 drafted · SP2 next |

## Slices

| | | Status |
|---|---|---|
| **SP0** | Infrastructure — client → API → DB, check gate green | ✅ **merged to `main`** 2026-08-12. *Deploy path now half-satisfied — see SP1.5* |
| **SP1** | Entity graph — real solicitations into the real schema | ◐ **T1–T11 done, merged.** T12–T15 outstanding |
| **SP1.5** | **Postgres port + first deploy** — Neon, Vercel, preview branches | 🔜 **NEXT.** [Plan written 2026-08-13](docs/superpowers/plans/2026-08-13-sp1.5-postgres-port.md) — 16 tasks. **Needs Matt to provision Neon via the Vercel Marketplace first (P3)** |
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
| ~~User stories~~ | ✅ **93 drafted 2026-08-12** — `docs/user-stories-source.html` and the published story map. Yours to edit |
| **Extraction runtime** — Node / Python sidecar / smart mode | **SP4** |
| **Express or framework route handlers?** New 2026-08-13. Express keeps IDE8 commonality; route handlers are the platform's grain. **Recommend deciding *after* the port, not with it** | SP1.5 → SP2 |
| **Which blob provider** — Vercel Blob / S3 / R2 | **SP4** |
| **Where long ingestion runs** — bounded candidate scrape / durable workflow / off-platform. **The one the hosting decision created and did not answer:** the host solves *when* ingestion runs, not *how long it may run* | **SP3** |
| ~~Doc storage on filesystem~~ · one-database-per-firm · auth in V1 | **Auth got sharper — it is a public URL now, not one laptop** |
| Ingestion scaffolding brainstorm | **SP3** |
| Prototype V1.2 — wordmark, mobile breakpoints | External sharing of the explainer |

## Waiting on Claude

| | |
|---|---|
| ~~B3 for SP0~~ | ✅ written 2026-08-12 |
| SP1 T12–T15 | Re-extraction + minimal admin |
| B3 for SP2 / SP3 | Unblocked |

---

## Decided this week

- **V1 returns everything active sources return.** No ranking, scoring or filtering. Matching parked as *undesigned* (spec §1.1)
- **Hand-run retired permanently.** Not deferred
- **Stack:** ideate/IDE8 — React 19, Vite, Zustand+Immer. Minus dnd-kit, plus a router
- **Persistence and hosting, 2026-08-13 — reversed from the day before.** ~~better-sqlite3 local-first~~ → **Neon managed Postgres, hosted on Vercel.** Not two decisions: Vercel has no writable persistent filesystem, so a SQLite file cannot survive a request there. **Zero data lost** — `*.db` was gitignored from SP0 and the database is rebuilt from `corpus/` and the seed migrations. Cost is the code: ~600 lines, all in the merged slice
- **Prototype is reference-only** and represents the finished product; V1 builds a subset
- **Legal posture rule:** ambiguous terms default a source to `out`; documented permission moves it `in`
- **Sources:** Illinois `in` and backtest-capable (2,155 closed to 2018) · Michigan + Kentucky `in`, current-only · Ohio `manual-only`

## Known risks

- ~~**Deployment expires at SP7.** A closed laptop does not scrape~~ **RETIRED 2026-08-13** — Vercel Cron answers it. Arrived four slices early, with the answer attached
- ~~**A second reader means a second copy**~~ **RETIRED 2026-08-13** — managed Postgres answers it
- **NEW — long ingestion may not fit one function invocation.** §5.3 fetches in three hops and was written assuming a process that could run for minutes. **Blocks SP3**
- **NEW — documents need a blob provider and a bill.** `document.path` now means a blob key; there is no filesystem. Thousands of bundles to 21 MB. **Blocks SP4**
- **NEW — we are on a serverless database that suspends when idle.** This is the IMPACT failure's exact shape, not an analogy. Plan limits get **measured and dated** into workflow spec §10.1, never recalled
- **Extraction is the only thing V1 can be right or wrong about**, and Node is weak at `.docx`/`.xlsx`. **The Python-sidecar option got more expensive** — on Vercel it is a second deployment target, not just a second runtime
- **Four silent-failure instances across three source platforms.** Every new adapter runs the vary-one-parameter check
- **Volume is unmeasured.** If the sources are loud, V1 feels like the portals it replaces

---

## For a full narrative

[`docs/Tenderfoot-Project-Overview-2026-08-12.md`](docs/Tenderfoot-Project-Overview-2026-08-12.md) — 7,100 words, written to be read aloud. Where the project is, how it got here, every significant decision and why, what was found that surprised us, what is next, and what is still open. Prepared for KP leadership.

## Where things live

`STATUS.md` here · `DOOGIE - TENDERFOOT.md` session log · `docs/Tenderfoot-Plan-of-Action.md` the sequence and its reasoning · `docs/Proto2PRD.md` the reusable playbook · `docs/Proto2PRD-Lessons.md` lessons staged for it · `docs/superpowers/specs/` design + workflow specs · `docs/superpowers/plans/` implementation plans · `reference/` SVRC + component inventory · `prototype/` frozen, reference-only · `corpus/` real solicitations and contracts
