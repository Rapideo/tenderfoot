# Tenderfoot — status

**Updated 2026-08-14.** One screen. The reasoning lives elsewhere; this is only where things stand.

> **Now: SP2 is built and waiting on Matt's sign-off.** Sixteen primitives on `/dev/gallery`, **26 commits** on `sp2-design-system`, gate green (**92 tests, 20 files**), whole-branch review clean. **Deliberately not merged** — the sign-off gate *is* the slice.
>
> **Credential rotation is HALF done.** `main` is rotated and verified: old string dead, new one live, **201 solicitations intact**, full gate green on the new credential. **The `test` branch is still on the leaked password and still connects.**
>
> **Three console clicks are pinned for Matt** — see *Waiting on Matt*. Nothing is blocked on Claude.
>
> Behind it: SP1 T12–T15 still outstanding (mock-layer re-extraction, minimal admin UI).

---

## The shape

**Stage A** establish what it is → **Stage B** plan it → **SP0…SP8** build it, one demo-able slice at a time.

## Stage A — prototype ✅

| | |
|---|---|
| Design spec | ✅ `docs/superpowers/specs/2026-08-03-tenderfoot-design.md` |
| SVRC (screen outline) | ✅ v0.6.0, adopted — `Imp`/`Pri` ruled by Matt 08-14 |
| Prototype | ✅ V1.2, frozen, reference-only |
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
| **SP1.5** | **Postgres port + first deploy** — Neon, Vercel | ✅ **merged to `main`** 2026-08-13. 23 commits, 37/37 tests, gate 5/5 green. **Preview live serving 201 solicitations.** Task 15 (per-preview DB branching) outstanding — dashboard-only, six steps in workflow spec §8 |
| **SP2** | Design system — every primitive on a dev route. **Sign-off gate** | ◐ **All 10 tasks done 2026-08-13**, branch `sp2-design-system`, **26 commits**, gate green (**92 tests / 20 files**, re-verified 2026-08-14 on the rotated credential). **Sixteen primitives** on `/dev/gallery`. **NOT merged — waiting on Matt's sign-off**, which is the point of the slice |
| **SP3** | Federal ingestion — SAM.gov + USASpending | — |
| **SP4** | Fetch + extraction — documents parsed, fields cited | — |
| ~~SP5~~ | ~~Matching engine~~ | **Removed 2026-08-11** |
| **SP6** | Triage + record. **← GO / NO-GO** | — |
| **SP7** | Live ingestion *(on GO)* | — |
| **SP8** | Radars + reporting *(on GO)* | — |

---

## Waiting for Matt at the SP2 gate — five rulings, none of them defects

Run `npm run dev`, open `/dev/gallery`. **Read the second paragraph first** — it names two decoy bundle files that sit beside the real one; only **V1.2** is the parity reference.

| | |
|---|---|
| **98 type tokens** | 88 font shorthands + 10 tracking. Not a scale — a census. `--type-body-*` alone has 25 thin variants. **Merging them would break the parity §7.10 ranks above elegance**, so nobody did |
| **No spacing layer, no shadow layer** | The same gap typography had before Task 1. Every primitive inlines bundle-faithful literals; `Card`'s shadow uses `rgba` because there is no token for it |
| **`StatusDot`: `rot` = yellow, `degraded` = red** | Faithfully transcribed from the bundle. Possibly backwards *in the prototype* |
| **`--brddash` is misnamed** | Named for dashed borders, commented "empty states" — but the bundle uses it for placeholders and drop zones and **never** for an empty list, which uses `--brdctl3` |
| **Gaps in `Button`** | A **danger primary** exists in the bundle uncovered by the prop set; two singleton styles left out as below the 3× recurrence bar |

**One known gap, ruled not gate-blocking:** the bundle's `COST TO PURSUE` panel sits in a **recessed** wrapper (`--surface3`) that no primitive expresses, so the gallery shows it on plain white. Colour difference is near-imperceptible; **the real gap is that no "recessed section" primitive exists** — needs one before SP6 composes a real screen.

## Infrastructure — live, re-read from the account 2026-08-14

| | |
|---|---|
| Vercel | project `tenderfoot`, team `koehler-partners`, beside `kp-web` |
| Neon | project `wispy-tooth-06225229`, org `Vercel: Koehler Partners`, beside `kp-web-prod`. Postgres 17, `aws-us-east-1` |
| Billing | **`launch_v3` (Launch), subscription** — same org and bill as the website |
| `DATABASE_URL` | pooled endpoint, injected by the integration into all three environments |
| Compute — existing | ✅ **resized 0.25 → 8 CU on both computes 2026-08-13**, verified by reading back. The `test` compute had been the tighter of the two at 0.25→0.25 |
| Compute — **default** | 🟡 **still `1 → 1` CU**, read from the project 2026-08-14. Governs computes that do **not exist yet**, so the row above is true and this one is also true. Every new branch is born wrong until it is fixed |
| Branches | `main` (`br-super-breeze-aun4swjv`) · `test` (`br-delicate-leaf-auwo0czn`). **Role passwords are per branch** — `main` rotated 2026-08-14, `test` **not yet** |
| ⬜ **Outstanding** | **rename `neon-lime-button` → `tenderfoot-db`.** Still unchanged as of 2026-08-14 — the resize landed, the rename did not. Not doable through the Neon MCP or the Vercel CLI — console or Neon API. Exact call in workflow spec §10.1. *Cosmetic; blocks nothing* |

## Waiting on Matt

**The first one blocks the SP2 merge. The rest do not block SP0–SP2.**

| | Blocks |
|---|---|
| 🔴 **The SP2 sign-off gate.** `npm run dev` → `/dev/gallery`. **Read the second paragraph first** — it names two decoy bundle files beside the real one; only **V1.2** is the parity reference. **Five rulings** listed above, none of them defects | **Merging SP2** |
| ~~`three_open_questions.md`~~ ✅ **ALL THREE CLOSED 2026-08-14.** Q1 `Pri` = product priority · Q2 parked nodes keep their scores and carry a `PARKED` marker · Q3 all twenty re-scored, **fourteen moved**. `Imp`/`Pri` are rulings now, not placeholders. **The §6 slice-order reconciliation is unblocked** | ~~Slice order from SP3 on~~ — now Claude's |
| ~~User stories~~ | ✅ **93 drafted 2026-08-12** — `docs/user-stories-source.html` and the published story map. Yours to edit |
| **Extraction runtime** — Node / Python sidecar / smart mode | **SP4** |
| 🟡 **Rotate the Neon credentials — HALF DONE 2026-08-14.** `main` is rotated: the old string now fails authentication, the new one works, 201 solicitations intact, full gate green (92 tests). **The `test` branch is still on the leaked password and still connects.** A Neon role password is per *branch*, not per project — this was asserted the other way and was wrong; see workflow spec §10.1. One console reset on the `test` branch closes it | **Now** |
| 🔴 **Per-preview database branching.** Six numbered steps in workflow spec §8; dashboard-only. **Until it is done, every preview deployment writes to the production database.** ⚠️ **Do the compute-default fix below FIRST** — this step creates branches, and today every new branch is born at 1→1 CU | SP2 onward |
| 🟡 **Set the project compute DEFAULT to 0.25→8 CU.** The 2026-08-13 resize fixed the two existing computes; `default_endpoint_settings` still reads **1→1**, and it applies only to *newly created* endpoints. Harmless today, wrong the moment any branch is created. Also the reason the `test` branch must be password-reset rather than rebuilt — rebuilding it would restore the SP1.5 flaky gate. Exact call in workflow spec §10.1 | **Before per-preview branching** |
| **A git remote — or accept that CI is decorative.** `.github/workflows/ci.yml` is correct and has never run. Without it the local gate is the *only* gate | Decide before SP3 |
| ~~Express or framework route handlers?~~ | ✅ **Ruled 2026-08-13: Express stays.** Workflow spec §9.5 stays open on its own terms; the port did not decide it by momentum |
| **Which blob provider** — Vercel Blob / S3 / R2 | **SP4** |
| **Where long ingestion runs** — bounded candidate scrape / durable workflow / off-platform. **The one the hosting decision created and did not answer:** the host solves *when* ingestion runs, not *how long it may run* | **SP3** |
| ~~Doc storage on filesystem~~ · one-database-per-firm · auth in V1 | **Auth got sharper — it is a public URL now, not one laptop** |
| Ingestion scaffolding brainstorm | **SP3** |
| ~~Prototype V1.2 — wordmark, mobile breakpoints~~ | ✅ **Both closed 2026-08-13.** V1.2 landed and was verified against V1.1 rather than trusted (colours 132→132, media queries 0→0, `display:flex` 74→73 — exactly the one disclosed wrapper). **The wordmark item turned out to be a deletion, not a design** — the logo already existed; only the 8px placeholder *label* was provisional. **Mobile ruled desktop-only** by measurement, not instinct; a separate mobile client is now plan of record |
| 📎 **`THOUGHTS.md`** — ✅ **tracked 2026-08-14**, committed verbatim. Four ideas from 08-11. **Two bear on open questions:** *levels of research and qualifying against that research* collides with the qualification work spec §1.1 parks as **undesigned** — note the collision, don't resolve it — and *what analysis 20+ years of historical data enables* is real against the 2,160-contract corpus (Illinois backtests to 2018). The other two are V2-shaped, past SP8. **Still to decide: promote the live two into backlog, or leave filed** | Nothing |

## Waiting on Claude

| | |
|---|---|
| ~~B3 for SP0~~ · ~~B3 for SP1.5~~ · ~~B3 for SP2~~ | ✅ written and executed. SP2's scope grew 2026-08-13 — the parked intelligence chrome is built inert, so it was never "mostly transcription" |
| SP1 T12–T15 | Re-extraction + minimal admin |
| **B3 for SP3** | **Next**, but gated: §9.6 (where long ingestion runs), the round-trip fix, and the scaffolding brainstorm all land in the plan rather than after it |
| **A "recessed section" primitive** | The one known SP2 gap, ruled not gate-blocking. Needed **before SP6** composes `FactPanel` into a real screen |
| **The ingestion round-trip fix** | **Blocks SP3.** ~7 rows/sec against a *measured* 300s function ceiling: an 8,000-record register is ~19 minutes and does not fit. Multi-row `INSERT`/`UNNEST` |

---

## Decided this week

- **V1 returns everything active sources return.** No ranking, scoring or filtering. Matching parked as *undesigned* (spec §1.1)
- **Hand-run retired permanently.** Not deferred
- **Stack:** ideate/IDE8 — React 19, Vite, Zustand+Immer. Minus dnd-kit, plus a router
- **Persistence and hosting, 2026-08-13 — reversed from the day before.** ~~better-sqlite3 local-first~~ → **Neon managed Postgres, hosted on Vercel.** Not two decisions: Vercel has no writable persistent filesystem, so a SQLite file cannot survive a request there. **Zero data lost** — `*.db` was gitignored from SP0 and the database is rebuilt from `corpus/` and the seed migrations. Cost is the code: ~600 lines, all in the merged slice
- **Prototype is reference-only** and represents the finished product
- **The intelligence chrome is BUILT, inert — decided 2026-08-13.** Score strips, AI-assessment panels, smart-filter controls and their settings are all constructed and rendered, none wired. A build that omitted them would not be a subset of the product but a different one, with holes where screens were composed around content. **Supersedes fidelity mandate §7.10 clause 2**, which said parked regions are not built. **Affects SP2 scope directly.** The guard that comes with it: *a rendered control may never become a live filter or score until qualification is designed* — same shape as the Capacity rule, artifact permitted, data flow forbidden. **How "vestigial" should look is undesigned and stays that way until Matt specifies it**
- **Legal posture rule:** ambiguous terms default a source to `out`; documented permission moves it `in`
- **Sources:** Illinois `in` and backtest-capable (2,155 closed to 2018) · Michigan + Kentucky `in`, current-only · Ohio `manual-only`

## Known risks

- 🔴 **NEW — a leaked database credential is still live on the `test` branch.** Rotation closed `main` and not `test`, because a Neon role password is per *branch*. **Verified by connecting, not assumed:** the old `main` string fails auth, the old `test` string still works. One console reset closes it. **The general rule this produced — a revocation is proved by the OLD key failing, not the new key working** — is lessons `2.16`
- 🟡 **NEW — the compute default that mints future branches is still wrong (1→1 CU).** Harmless today because every compute that exists was fixed; wrong the instant anything is created. **The spec had already written the warning and it happened anyway.** Lessons `2.17`

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
