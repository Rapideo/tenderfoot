# Tenderfoot — status

**Updated 2026-08-15.** One screen. The reasoning lives elsewhere; this is only where things stand.

> **Now: the repo is public at `Rapideo/tenderfoot`, pushed, and CI IS GREEN on both branches (2026-08-15).** First-ever CI execution failed on the one predicted cause — `DATABASE_URL_TEST` missing as an Actions secret — **and there was no Windows-vs-Linux problem at all.** Secret set from `.env` on Matt's ruling, both runs re-run: **92 tests, 20 files, success.** Identical to local, so **green-on-CI now means what green-on-laptop means.**
>
> **Also ruled 2026-08-15: where long ingestion runs.** On Vercel, invoked by hand, operator sets the scope. Unattended ingestion is deferred to SP7 and does not exist before then. **B3 for SP3 clears its §9.6 gate but not its last one** — the ingestion scaffolding brainstorm is Matt's and lands *in* the plan.
>
> **Also done 2026-08-15: the §6 slice-order reconciliation** (Plan of Action §6.4). **No slice moved.** One finding went back to Matt: whether source health belongs in front of the GO gate rather than in SP7.
>
> **Behind that: SP2 is SIGNED OFF (2026-08-14) and merged.** Sixteen primitives on `/dev/gallery`, reviewed against the V1.2 bundle with no issues raised; **all five gate rulings resolved** — two of them turned out not to be what the gate list said. Three fixes applied (`--type-body-default` → `--type-body-para`/`-detail`, `StatusDot` `degraded` → `failing`, and `npm run dev` now loads `.env`), gate re-run **green: 92 tests, 20 files, exit 0**.
>
> **Also closed today:** all three of `three_open_questions.md`, and the full twenty-node SVRC `Imp`/`Pri` re-score (v0.6.0, fourteen moved).
>
> **Credential rotation is COMPLETE — both branches, 2026-08-14.** `main` was rotated first (old string proved dead, new one live, 201 solicitations intact). **`test` rotated today**; `DATABASE_URL_TEST` re-derived from the unpooled endpoint and the **full gate re-run green on it**.
>
> ⚠️ **One honest limit on the `test` rotation.** Per lesson §2.16 a revocation is proved by the OLD key failing, not the new one working — and **the old `test` string was overwritten before it was captured**, so that negative test could not be run. Neon's dialog asserts the old password is invalid; nothing here demonstrates it. **The `main` rotation was proved properly; this one is asserted.**
>
> **All three Neon console changes are done** — test-branch password, compute default `0.25 → 8`, and the project rename. ~~Nothing infrastructural is pinned for Matt; two design items are~~ **— revised 2026-08-15: one infrastructural item IS pinned again.** Per-preview branching was enabled and then *disproved* by an actual preview deploy: it does nothing until the Vercel project is connected to a Git repo, and **connecting it changes the deploy model**, so it is Matt's. Plus the two design items — the scaffolding brainstorm and §6.4 A3.
>
> Behind it: SP1 T12–T15 still outstanding (mock-layer re-extraction, minimal admin UI).

---

## 🔖 RESUME HERE — updated 2026-08-15

**State is clean apart from this file.** On `main`, **SP2 merged** (`ebbcf7c`), gate green locally *and* on CI — 20 files, 92 tests, every token check passing. ⚠️ **`STATUS.md` and the workflow spec have uncommitted edits** — the per-preview-branching result. Nothing else is dirty and **no code changed** (this session touched Vercel/Neon settings and docs only).

> **First thing to know on resume, 2026-08-15.** **Per-preview branching is enabled but inert, and previews still write to production — proven with a real deploy, not inferred.** The blocker is that **the Vercel project has no connected Git repository**; Neon branches per *Git* preview, and every deploy this project has ever made was CLI-driven. Connecting it is Matt's call because pushes to `main` would then auto-deploy to production. Full trace in workflow spec §8. **Two of §8's six steps were also wrong** — the branch checkboxes are disabled until `Require Active Resource` is on, and its `vercel env ls` success signal never fires.
>
> **Also worth knowing:** the only **Production** deployment is in `● Error` state (2 days old, 3s), so `tenderfoot-koehler-partners.vercel.app/api/health` 404s. Untouched this session and not diagnosed.

**🟢 The repo is public and pushed — 2026-08-15.** `Rapideo/tenderfoot` created, `main` and `sp2-design-system` both pushed, `origin` tracking. **`gh repo create` was not blocked after all** — the earlier classifier refusal did not recur, and `gh` was already authenticated as `Rapideo`. Verified before pushing: `.env` and `.env.local` are gitignored and were never tracked, only `.env.example` ships. **Matt chose to publish the live infra identifiers and the credential-incident write-up as-is**, having been asked specifically about both.

**✅ CI ran for the first time ever, failed, and is now green.** The first run failed on **the harmless one of the two predicted causes** — `DATABASE_URL_TEST` missing as an Actions secret. **The other predicted cause did not exist:** 16 of 20 files ran on Linux and all 55 of their tests passed, so there is no Windows-vs-Linux path problem. Matt ruled that Claude set the secret; it was piped from `.env` into `gh secret set` **without the value ever entering the transcript**, and both runs were re-run green at **92 tests / 20 files** — matching local exactly.

> **The residual risk that came with that ruling, stated plainly:** a live Neon `test` credential now sits in a **public** repo's secret store. It is not readable back and is withheld from fork PRs, but **anyone with write access can exfiltrate it via a workflow.** The blast radius is the `test` branch only — not `main` — and that branch is already the one whose rotation is asserted rather than proved.

### Matt — four, and the first one gates Claude

**1. 🟡 NEW — the ingestion scaffolding brainstorm, which gates B3 for SP3.** `docs/Pinned-Ingestion-Scaffolding.md`, four proposals. **It is a shorter conversation than it was yesterday:** Proposals 2 (candidate scrape) and 3 (hard ingestion window) were both shapes for surviving the duration ceiling, which the §9.6 ruling dissolves. What is left is mostly Proposal 1 (scaffolding for the mechanical layer) and Proposal 4 (mechanical and smart as first-class modes) — and 4 is entangled with the SP4 extraction-runtime decision below.

**2. 🟡 NEW — §6.4 A3: does source health move in front of the GO gate?** `Region A.2 : Status Bar` rules `Pri 4` — higher than the shell that contains it — and §6 currently puts health in SP7, *after* SP6. **The tension is whether the gate's number means anything:** SP6 measures volume and Interested-per-hundred, known risks record four silent-failure instances across three platforms, and nothing in the sequence would distinguish a quiet market from a dead source. Proposed: a read-only liveness surface before SP6, not alarms. **A slice-boundary change, so it is Matt's.** If declined, SP6 must name how source liveness gets verified instead.

**3. Two SP4 decisions, not yet needed.** Extraction runtime (Node / Python sidecar / smart mode — the largest open question in the stack) and the blob provider.

**4. `THOUGHTS.md`** — whether the two live ideas become real backlog items.

### ✅ Ruled 2026-08-15 — where long ingestion runs

**Ingestion runs on Vercel, invoked by hand, with the operator setting the scope of each run — which sources, how deep.** It does not pick one of the three options; it removes the constraint that made them necessary. Scope becomes an input rather than a constant, so a run fits the 300-second ceiling by construction and nothing has to survive an invocation boundary.

> **What it defers, loudly, to SP7.** Unattended ingestion does not exist. **Nothing scrapes unless a human asks it to**, the 8,000-record register cannot be taken in one action, and no source stays current on its own. **Vercel Cron is not exercised in V1** — the platform can still do it, so the closed-laptop risk stays retired, but SP3 does not use it and SP7 must.
>
> Recorded in workflow spec §9.6. **B3 for SP3 is unblocked.**

### Claude — next session, in this order

1. **B3 for SP3** — now unblocked by the §9.6 ruling, **but still gated on the ingestion scaffolding brainstorm**, which is Matt's and lands *in* the plan rather than after it. Two things the ruling hands it: a scoped run needs defined behaviour when the operator asks for more than fits (bound the inputs or stop gracefully — not a 300-second death mid-write), and the invocation needs a surface a human can reach, which lands on **T12–T15's admin UI** rather than a second one.
2. ~~⏸ **Per-preview DB branching**~~ **→ HANDED TO MATT 2026-08-15. The dialog half is done; the remaining half is not Claude's.** The setting is enabled and verified persisted (`Require Active Resource` on, `Preview` checked, `Production` unchecked). **It is inert, and that is now proven:** a throwaway preview deploy created no Neon branch and its ping moved production's `last_ping`. **The blocker is that the Vercel project has no connected Git repository** — Neon branches per *Git* preview, and every deploy this project has ever made was CLI-driven. Connecting it changes the deploy model, so it is Matt's call. **Until then every preview deployment still writes to the production database.** Full trace and two corrections to §8's steps in workflow spec §8.
3. ~~**§6 slice-order reconciliation**~~ ✅ **DONE 2026-08-15 — Plan of Action §6.4.** **No slice moved.** Both named inputs applied: shell-first is now a **stated hard dependency** rather than an inherited score, and parked nodes are excluded **by marker, not number** (`Screen 7` and `View 2.2` both rule `Pri 4` and would otherwise jump ahead of shipping work). §4's list of hard ordering constraints **was incomplete and gained a third** — containment. §6.0's flag closed; the radar stays in SP8. **One finding went to Matt — see A3 below.**
4. **SP1 T12–T15** — re-extraction, minimal admin. **Coupled to item 1 now**, since the manual scrape needs somewhere to live.
5. **SP6 preconditions** — ✅ **section primitive DONE 2026-08-15** (`Section`, 5 tests, gate green 97/21). ⛔ **The other two are NOT startable, by their own stated triggers** — and "precondition" misled me into thinking they were. **Spacing/shadow layers** rule is *"extract when a composed screen shows which values are systematic"*; there are still zero composed screens and `Card`'s shadow still has one consumer. **`Button` danger-primary** rule is *"decide the affordance when the decision bar exists"*; SP6 *composes* the decision bar. **Both are first-moves INSIDE SP6, not work that precedes it.** Building either now would invent a scale, or a variant, from a single instance — exactly what the 3× recurrence bar exists to stop.

### One open thread that is nobody's task yet

**The `test` branch rotation is asserted, not proved.** The old string was overwritten before it was captured, so the negative test could not run — the failure mode that `Proto2PRD.md` §5.4 now exists to prevent. If it ever matters, the only way to close it properly is to rotate again, capturing the current string first.

---

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
| **SP2** | Design system — every primitive on a dev route. **Sign-off gate** | ✅ **SIGNED OFF 2026-08-14.** Branch `sp2-design-system`, **sixteen primitives** on `/dev/gallery`, gate green (**92 tests / 20 files**) after the three sign-off fixes. **Clear to merge — not yet merged** |
| **SP3** | Federal ingestion — SAM.gov + USASpending | ◐ **B3 unblocked 2026-08-15** — §9.6 ruled. Hand-invoked, operator-scoped |
| **SP4** | Fetch + extraction — documents parsed, fields cited | — |
| ~~SP5~~ | ~~Matching engine~~ | **Removed 2026-08-11** |
| **SP6** | Triage + record. **← GO / NO-GO** | — |
| **SP7** | Live ingestion *(on GO)* | — |
| **SP8** | Radars + reporting *(on GO)* | — |

---

## ~~Waiting for Matt at the SP2 gate~~ — ✅ SIGNED OFF 2026-08-14

**Matt drove `/dev/gallery` against the V1.2 bundle and passed the visual review with no issues raised.** The five rulings were then walked through individually and all resolved. **Two of the five were not what the gate list said they were.**

| Ruling | Outcome |
|---|---|
| **98 type tokens** | ✅ **Census accepted, one name fixed.** Measured: **17 of 88 font tokens are actually consumed**; the 25-member `--type-body-*` family is 7 sizes × 8 leadings, of which **four are used**. Kept as a census — parity outranks elegance and 17/88 means nobody yet knows which survive a real screen. **But `--type-body-default` (12.5px, 7 uses) was outweighed by `--type-body-default-2` (11px, 11 uses)** — a token named "default" that wasn't, beside the family's most-used member hidden behind a positional `-2`. Renamed **`--type-body-para`** and **`--type-body-detail`**, *in the generator as well as the emitted file* |
| **No spacing layer, no shadow layer** | ✅ **Accepted, with a date instead of a "later."** Extract when the second consumer appears; sixteen primitives and **zero composed screens** cannot distinguish systematic spacing from incidental. `Card`'s `rgba` shadow has exactly one consumer. **Now a named SP6 precondition** |
| ~~**`StatusDot`: `rot` = yellow, `degraded` = red**~~ | ✅ **Not backwards — the colours were right and the NAME was wrong.** The bundle is coherent: *"Rot suspected"* is a suspicion and warns yellow; *"Failing"* is confirmed and errors red. The apparent inversion came from the state being called **`degraded`**, picked *"by elimination"* rather than from the bundle — and "degraded" reads as *less* severe than "rot." **Renamed `degraded` → `failing`** to match the bundle's own label. TypeScript union member: **zero parity impact, nothing rendered changed.** The four states now read green/yellow/red/grey in plain ascending severity |
| ~~**`--brddash` is misnamed**~~ | ✅ **Already fixed; struck from the list.** It is `--line-dashed` now with the description corrected, `--brddash` retained as one of ~16 bundle-name aliases. **Nothing consumes either** — the only dashed affordances are the two unimplemented singletons. This row was stale |
| **Gaps in `Button`** | ✅ **Danger-primary deliberately not added.** It is `confirmReason`'s pass branch (`--bad`/`--baddk`), driven by app state rather than any prop — no consumer exists, and building a variant ahead of need is what the 3× recurrence bar prevents. **Deferred to SP6 as a named precondition**, because it is a *destructive confirm* and SP6 composes the decision bar. The two singletons (`toggleDrawer`, dashed "+ New view") stay out unless they recur |

### SP6 preconditions — three items, one gate

Named together so they cannot be rediscovered piecemeal. **None block the SP2 merge; all three block SP6 composing a real screen.**

| | Why it waits for SP6 |
|---|---|
| ~~**A "recessed section" primitive**~~ ✅ **DONE 2026-08-15 — `Section`** | The bundle's `COST TO PURSUE` panel sits in a `--surface3` recessed wrapper no primitive expressed, so the gallery drew it on plain white. Colour difference is near-imperceptible — **the real gap was the missing primitive, not the colour**, and that is what got built. `--ground-recess-1` had **zero consumers** before this; it has one now |
| **Spacing + shadow token layers** | Extract when a composed screen shows which values are systematic |
| **`Button` danger-primary** | A destructive confirm; decide the affordance when the decision bar exists |

## Infrastructure — live, re-read from the account 2026-08-14

| | |
|---|---|
| Vercel | project `tenderfoot`, team `koehler-partners`, beside `kp-web` |
| Neon | project `wispy-tooth-06225229`, named **`tenderfoot-db`** since 2026-08-14, org `Vercel: Koehler Partners`, beside `kp-web-prod`. Postgres 17, `aws-us-east-1` |
| Billing | **`launch_v3` (Launch), subscription** — same org and bill as the website |
| `DATABASE_URL` | pooled endpoint, injected by the integration into all three environments |
| Compute — existing | ✅ **resized 0.25 → 8 CU on both computes 2026-08-13**, verified by reading back. The `test` compute had been the tighter of the two at 0.25→0.25 |
| Compute — **default** | ✅ **set to `0.25 → 8` CU 2026-08-14**, read back on the settings page. Governs computes that do **not exist yet** — new branches are now born right. Neon's own dialog states the §2.17 hazard verbatim: *"Modifying these defaults does not alter the settings of any existing computes"* |
| Branches | `main` (`br-super-breeze-aun4swjv`) · `test` (`br-delicate-leaf-auwo0czn`). **Role passwords are per branch** — **both rotated 2026-08-14** |
| ✅ **Rename** | **`neon-lime-button` → `tenderfoot-db`, done 2026-08-14 from the VERCEL dashboard.** The Neon console refuses it outright — `action restricted; reason:"organization is managed by Vercel"`. The spec had predicted the two names were independent strings with Neon upstream; **it is the reverse** — renaming the Vercel resource renamed the Neon project, confirmed by reading it back through the MCP. Details in workflow spec §10.1 |

## Waiting on Matt

**Nothing here blocks SP0–SP2 any more.** The sign-off gate, all three open questions, and all three Neon console changes closed on 2026-08-14.

| | Blocks |
|---|---|
| ~~🔴 **The SP2 sign-off gate**~~ | ✅ **SIGNED OFF 2026-08-14.** Gallery reviewed against V1.2, no issues raised; all five rulings resolved above. **SP2 is clear to merge** |
| ~~`three_open_questions.md`~~ ✅ **ALL THREE CLOSED 2026-08-14.** Q1 `Pri` = product priority · Q2 parked nodes keep their scores and carry a `PARKED` marker · Q3 all twenty re-scored, **fourteen moved**. `Imp`/`Pri` are rulings now, not placeholders. **The §6 slice-order reconciliation is unblocked** | ~~Slice order from SP3 on~~ — now Claude's |
| ~~User stories~~ | ✅ **93 drafted 2026-08-12** — `docs/user-stories-source.html` and the published story map. Yours to edit |
| **Extraction runtime** — Node / Python sidecar / smart mode | **SP4** |
| ~~🟡 **Rotate the Neon credentials**~~ | ✅ **BOTH BRANCHES DONE 2026-08-14.** `main` proved by the old string failing; `test` reset and `DATABASE_URL_TEST` re-derived, gate green. ⚠️ **`test` is asserted, not proved** — the old string was overwritten before capture, so the negative test could not run. See `Proto2PRD.md` §5.4 |
| 🔴 **Per-preview database branching. SETTING ENABLED 2026-08-15 — AND THE FOOTGUN IS STILL LIVE.** The dialog is configured and verified persisted (`Require Active Resource` on, `Preview` checked, **`Production` deliberately unchecked**). **It changed nothing yet, and this is now proven, not inferred:** a throwaway preview deploy created **no Neon branch**, and `POST $PREVIEW/api/health/ping` moved production's `last_ping` to `2026-08-15T18:07:16.838Z`. **Root cause is not this setting — the Vercel project has no connected Git repository.** Neon's branch-per-preview keys off *Git* preview deployments; a CLI `vercel deploy` has no branch to attach to and falls back to the static Preview vars, i.e. production. Invisible until now because the repo only existed from 08-15. **Two corrections to §8: the branch checkboxes are `disabled` until `Require Active Resource` is on (steps 4 and 5 are ordered), and step 5's `vercel env ls` narrowing NEVER HAPPENS — that check would report a good save as a failure.** ➡️ **Next move is Matt's:** connecting Git changes the deploy model (pushes to `main` auto-deploy to production) | SP2 onward |
| ~~🟡 **Set the project compute DEFAULT**~~ | ✅ **`0.25 → 8` CU, done 2026-08-14**, read back on the settings page. New branches are now born right |
| ~~◐ **A git remote**~~ | ✅ **DONE 2026-08-15 — public at `Rapideo/tenderfoot`, `main` and `sp2-design-system` pushed.** Decided 08-14, executed 08-15. **The classifier block did not recur** — Claude created it directly, `gh` already authenticated as `Rapideo`. The first push turned CI on for the first time ever and it failed on the missing test-DB secret; see the new row below |
| ~~🔴 **`DATABASE_URL_TEST` as a GitHub Actions secret**~~ | ✅ **DONE 2026-08-15 — Matt ruled Claude sets it; set from `.env`, CI green at 92/20 on both branches.** The rejected option was gating the DB tests off in CI, which would have made green-on-CI weaker than green-on-laptop. **Accepted residual: a live `test` credential is in a public repo's secret store, exfiltratable by anyone with write access.** Blast radius is the `test` branch only |
| ~~Express or framework route handlers?~~ | ✅ **Ruled 2026-08-13: Express stays.** Workflow spec §9.5 stays open on its own terms; the port did not decide it by momentum |
| **Which blob provider** — Vercel Blob / S3 / R2 | **SP4** |
| ~~**Where long ingestion runs**~~ | ✅ **RULED 2026-08-15 — on Vercel, invoked by hand, operator sets the scope.** Not one of the three options; it removes the constraint that made them necessary. **Unattended ingestion deferred to SP7 and does not exist before then.** Workflow spec §9.6 |
| ~~Doc storage on filesystem~~ · one-database-per-firm · auth in V1 | **Auth got sharper — it is a public URL now, not one laptop** |
| 🟡 **Ingestion scaffolding brainstorm — now the last gate on B3 for SP3.** Shorter than it was: the §9.6 ruling dissolves Proposals 2 and 3, leaving mostly 1 and 4, and 4 is entangled with the extraction-runtime decision | **SP3 — blocking** |
| 🟡 **NEW — §6.4 A3: source health in front of the GO gate?** `Region A.2` rules `Pri 4`; §6 puts health in SP7, after SP6. A slice-boundary change, so it is Matt's. If declined, SP6 names how source liveness gets verified instead | **SP6's number** |
| ~~Prototype V1.2 — wordmark, mobile breakpoints~~ | ✅ **Both closed 2026-08-13.** V1.2 landed and was verified against V1.1 rather than trusted (colours 132→132, media queries 0→0, `display:flex` 74→73 — exactly the one disclosed wrapper). **The wordmark item turned out to be a deletion, not a design** — the logo already existed; only the 8px placeholder *label* was provisional. **Mobile ruled desktop-only** by measurement, not instinct; a separate mobile client is now plan of record |
| 📎 **`THOUGHTS.md`** — ✅ **tracked 2026-08-14**, committed verbatim. Four ideas from 08-11. **Two bear on open questions:** *levels of research and qualifying against that research* collides with the qualification work spec §1.1 parks as **undesigned** — note the collision, don't resolve it — and *what analysis 20+ years of historical data enables* is real against the 2,160-contract corpus (Illinois backtests to 2018). The other two are V2-shaped, past SP8. **Still to decide: promote the live two into backlog, or leave filed** | Nothing |

## Waiting on Claude

| | |
|---|---|
| ~~B3 for SP0~~ · ~~B3 for SP1.5~~ · ~~B3 for SP2~~ | ✅ written and executed. SP2's scope grew 2026-08-13 — the parked intelligence chrome is built inert, so it was never "mostly transcription" |
| SP1 T12–T15 | Re-extraction + minimal admin |
| **B3 for SP3** | **Next and UNGATED as of 2026-08-15** — §9.6 is ruled. The round-trip fix and the scaffolding brainstorm still land *in* the plan rather than after it. Two things the ruling hands the plan: behaviour when the operator asks for more than fits, and where the human-reachable trigger lives (T12–T15's admin UI) |
| ~~**A "recessed section" primitive**~~ | ✅ **BUILT 2026-08-15 as `Section`** — the one known SP2 gap, now closed as far as a primitive can close it. **Landed under a different name on purpose:** only one of D6's two section instances is recessed (the other sits on `--ground-surface` and is distinguished by a right-hand divider), so the shared property is the padding and `recessed` is one of two independent modifiers. Naming the container after a treatment half its evidence lacks is D5's `--line-dashed` error repeated. **The composition half stays open for SP6** — the existing gallery entries were deliberately not rewired |
| **The ingestion round-trip fix** | **No longer a blocker — it changed job on 2026-08-15.** ~7 rows/sec against a *measured* 300s ceiling was fatal while a full register had to fit one invocation. Under a hand-scoped run it is a **scope multiplier**: every row/second buys depth the operator can ask for. Multi-row `INSERT`/`UNNEST`, still before SP3 ships |

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

- ~~🔴 **a leaked database credential is still live on the `test` branch**~~ **CLOSED 2026-08-14** — reset from the Neon console, `DATABASE_URL_TEST` re-derived, gate green on it. ⚠️ **Closed on assertion, not evidence:** the old string was overwritten before capture, so the negative test could not run. The rule it produced — **a revocation is proved by the OLD key failing, not the new key working** — is lessons `2.16`, **promoted into the playbook 2026-08-14** after this second instance
- ~~🟡 **the compute default that mints future branches is still wrong (1→1 CU)**~~ **CLOSED 2026-08-14** — set to `0.25 → 8` and read back on the settings page. New branches are now born right. **The spec had already written the warning and it happened anyway;** lessons `2.17`
- 🟡 **NEW 2026-08-15 — nothing ingests unless a human asks it to.** The direct and accepted consequence of the §9.6 ruling. **Sources go stale between hand-run scrapes**, and the 8,000-record register cannot be taken in one action. Not a defect and not a surprise — it is what buys SP3 a plan that fits the 300-second ceiling. **It becomes a real problem only if SP7 slips or the GO decision assumes currency V1 does not have**

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
