# Tenderfoot — status

**Updated 2026-08-29.** One screen. The reasoning lives elsewhere; this is only where things stand.

> **Now: the repo is public at `Rapideo/tenderfoot`, pushed, and CI IS GREEN on both branches (2026-08-15).** First-ever CI execution failed on the one predicted cause — `DATABASE_URL_TEST` missing as an Actions secret — **and there was no Windows-vs-Linux problem at all.** Secret set from `.env` on Matt's ruling, both runs re-run: **92 tests, 20 files, success.** Identical to local, so **green-on-CI now means what green-on-laptop means.**
>
> **Also ruled 2026-08-15: where long ingestion runs.** On Vercel, invoked by hand, operator sets the scope. Unattended ingestion is deferred to SP7 and does not exist before then. **B3 for SP3 clears its §9.6 gate**, and ~~not its last one~~ **its last one too, later the same day — the scaffolding brainstorm is done and specced.**
>
> **Also done 2026-08-15: the §6 slice-order reconciliation** (Plan of Action §6.4). **No slice moved.** One finding went back to Matt: whether source health belongs in front of the GO gate rather than in SP7.
>
> **Also closed 2026-08-15: per-preview database branching — the last red risk on the board.** It needed **two** changes, and the two-day assumption that it was "dashboard-only, hand it to Matt" was half wrong: the toggle is dashboard-only, but the other half is `vercel git connect`, which is not. **Proven end to end** — a Git preview deployment wrote to its own Neon branch and left production's `last_ping` untouched, where the same test on a CLI deploy hours earlier had moved it. ⚠️ **CLI deploys remain branchless and still hit production.**
>
> **Also done 2026-08-15: the `Section` primitive** — the one known SP2 gap (Deviation D6), closed as far as a primitive can close it. **Gate green at 97 tests / 21 files.** Landed as `Section` rather than `RecessedSection` because only one of its two bundle instances is recessed. **The other two "SP6 preconditions" turned out not to be preconditions at all** — spacing/shadow layers and `Button` danger-primary are both gated on SP6 existing, so they are first moves *inside* the slice.
>
> **Behind that: SP2 is SIGNED OFF (2026-08-14) and merged.** Sixteen primitives on `/dev/gallery`, reviewed against the V1.2 bundle with no issues raised; **all five gate rulings resolved** — two of them turned out not to be what the gate list said. Three fixes applied (`--type-body-default` → `--type-body-para`/`-detail`, `StatusDot` `degraded` → `failing`, and `npm run dev` now loads `.env`), gate re-run **green: 92 tests, 20 files, exit 0**.
>
> **Also closed today:** all three of `three_open_questions.md`, and the full twenty-node SVRC `Imp`/`Pri` re-score (v0.6.0, fourteen moved).
>
> **Credential rotation is COMPLETE — both branches, 2026-08-14.** `main` was rotated first (old string proved dead, new one live, 201 solicitations intact). **`test` rotated today**; `DATABASE_URL_TEST` re-derived from the unpooled endpoint and the **full gate re-run green on it**.
>
> ⚠️ **One honest limit on the `test` rotation.** Per lesson §2.16 a revocation is proved by the OLD key failing, not the new one working — and **the old `test` string was overwritten before it was captured**, so that negative test could not be run. Neon's dialog asserts the old password is invalid; nothing here demonstrates it. **The `main` rotation was proved properly; this one is asserted.**
>
> **All three Neon console changes are done** — test-branch password, compute default `0.25 → 8`, and the project rename. **Nothing infrastructural is pinned for Matt; ~~two design items are~~ one is** — **§6.4 A3**. *(Briefly untrue on 08-15, when per-preview branching turned out to need a Git connection; ruled and executed the same day. The scaffolding brainstorm, the other of the two, was done the same day as well.)*
>
> Behind it: ~~SP1 T12–T15 still outstanding~~ ✅ **T12–T15 BUILT 2026-08-16** — the re-extraction, the schema reconciliation, and the first composed screen.
>
> **Also done 2026-08-17: the app fetches a font.** Until `d891bbb` it never had — every screen ever rendered, `/dev/gallery` at the SP2 sign-off included, used whatever the viewer had installed. Self-hosted woff2, verified in a browser. **The sign-off stands** (geometry, colour and spacing don't depend on the face), but *"matched against the bundle"* meant *"matched given the right fonts are installed"* until today.
>
> **Also done 2026-08-18: SP3.6 — source health, built and gate-green on branch `sp3.6-source-health`, NOT YET MERGED to `main`.** A3's ruling (below) is now built, not just decided: `source.health` is a live "is this source reachable" value written by an operator-invoked probe, migration 006 pins it with a `source_health_valid` CHECK (`ok`/`failing`/`rot`/`excluded`/`unknown`, four new columns), and `/admin`'s Source Registry gained **Check** and **Run** controls — Run does scrape → import → merge as one request, the artifact living only inside that request so SP4's blob-provider decision stays exactly as parked as it was. Thirteen tasks implemented; twelve reviewed at the time of writing, with this one — the paperwork — under review. Gate green at **263 tests / 42 files**, `npm run check` exit 0. `app/shared`'s `SourceHealth`/`SourceRow` types were reconciled to migration 006 in the same pass (Task 13) — narrowing `health` from `string` to the real enum surfaced no defect, because the one client consumer (`Admin.tsx`) had already been fixed to the real vocabulary in Task 11. **Two things this slice deliberately left alone, on record rather than by oversight:** `PATCH /api/sources/:id` (the Enable toggle) is still unauthenticated — only Check and Run sit behind `requireAdminSecret` — and `Region A.2 : Status Bar` is still unbuilt, per A3's own note that it is a shell region and the shell is a hard dependency of the views it contains. **◐ The demo criterion (design spec §10) is HALF RUN** (✅ *the other half ran 2026-08-18 — see RESUME HERE*). Its server half was executed 2026-08-18 against a fully-migrated test database and passed: no secret → 401; unknown name → 404 (not an empty success); `GovWin IQ` → `{"checked":[]}` with no probe and no timestamp; `Kentucky eMARS VSS` (null `probe_url`) → skipped, left `unknown` and unstamped rather than `failing`; `SAM.gov` → `ok` via method `sam`; check-all returned **5** rows, not 7. Final state 5 stamped / 6 `excluded` unstamped / 2 `unknown` unstamped. **⚠️ The browser click-through was NOT done** — the Chrome extension was unavailable, so the Check and Run *buttons* have never been clicked; only the endpoints beneath them were exercised. **✅ SUPERSEDED 2026-08-18: it has since been done, and it found two defects the server half could not — `Run` had never worked in any browser, and `Check` was silently inert on two rows. See the DONE entry in RESUME HERE. The sentence above is kept because it is exactly right about what the server half was worth: it passed, and the buttons above it were still broken.** Design: `docs/superpowers/specs/2026-08-17-source-health-design.md`. Deviations: `docs/admin-deviations.md` D5 (rewritten) and new H1–H3.

---

## 📌 PINNED — LAST UPDATED 2026-08-28 — READ THIS FIRST, THEN THE RESUME BLOCK BELOW

> *2026-08-29: the resume block below is newer than this one and carries the current state. Nothing pinned here was invalidated by the 08-28/29 run, but the solicitation counts here predate it — production now holds 7,644 SAM.gov deadlines that were null when this block was written.*

**The production admin gate is LIVE (verified `401`), the demo criterion is MET, and RUN WORKS** — a real run landed on production 2026-08-28 (`200` in 2.7s, 2 rows), which also **removed the seven-day-window hazard** by stamping a genuine `last_run_at`. Run is now safe to press in the browser for the first time. Gate 301 tests / 43 files. Production holds **9,883 solicitations / 11,121 sightings / 1,214 organizations** after two real ingests on 2026-08-28 (12-hour, then seven-day), and **Run has been clicked in a browser on production and completed** — the first time ever. Gate **308 tests / 44 files**. **Nothing is outstanding.** Production is public **by decision** (§5), local development no longer touches production (§4), and the 2026-08-27 Run failure is **solved, attributed and fixed** (§3) — a 30-second `maxDuration` in `vercel.json` that every budget in the codebase had been reasoning past, now 300 and tied to the code by a test.

### ✅ 1. `ADMIN_SECRET` — RESOLVED 2026-08-27. The gate is LIVE in production.

**Verified: `/api/admin/health` answers `401`.** Measured 2026-08-27 late — `X-Powered-By: Express` on the response, so our app replied, not the platform. `requireAdminSecret` can only reach its 401 branch when `process.env.ADMIN_SECRET` is **truthy**, so this is positive proof the variable is in the production runtime. It answered `503` on 08-19 and `503` again on 08-26. It does not any more.

**What fixed it was recreating the ENTRY, and this is the part to remember.** The delete-and-re-add was done by hand with **Production and Preview ticked at creation**, then a **Redeploy with the build cache unticked**. That redeploy **registered no new GitHub deployment** — the deployments list still tops out at `77d5115` — and yet the behaviour changed. **The build was never wrong; the value was.** ⚠️ **Do not use the deployments list as evidence of what the runtime holds.** A whole diagnostic hour went into "was the alias promoted?", and promotion was never the problem.

**Three hypotheses were live before the fix; the winner was the dullest.** (a) the alias still served the old build — false; (b) the key name was wrong — false; (c) **the saved value was empty or never pasted** — effectively this one. `!secret` is true for `""`, so **an empty value yields exactly the same 503 as a missing one.** A clipboard command that prints nothing on success also prints nothing on failure. **Verify the paste by revealing the value and counting characters (40), not by assuming the copy worked.**

**The rotation stays ruled out.** **RULED 2026-08-26 by Matt: do not rotate. The partial exposure is an ACCEPTED RISK, closed by decision rather than by action.** 19 of the 40 characters were printed into a session transcript by Claude, while inspecting the `.env` line's bytes with `od -c` after a redaction that silently did not apply to that command's output. **None of that changed — it was weighed and dropped.** *(This item previously read "ROTATE `ADMIN_SECRET` — do this before anything else". It was never done, and it is now not going to be.)* Local `.env` line 26 holds the value and did not change.

> ⚠️ **Two Vercel behaviours cost an hour on 08-19 and cost more on 08-26. They are still true.**
>
> **Editing an existing variable's environment scope SILENTLY DOES NOT SAVE.** It was set to Production, then "moved" to Preview, and four separate attempts to also tick Production left the listing reading `Preview` only every time. **Creating a fresh entry with every box ticked at creation works** — that is how the Neon vars hold three scopes in one entry. **Delete and recreate; never edit the scope.**
>
> **Env vars are baked into a deployment at build time.** Changing one does nothing until the next deploy — which is why production kept working after the variable moved, and then died the moment Matt redeployed.

### ✅ 2. THE DEMO CRITERION IS MET — 2026-08-27

**Check was clicked on SAM.gov in production, and it returned real data.**

```
POST /api/admin/health?source=SAM.gov  →  200
{"checked":[{"name":"SAM.gov","state":"ok","method":"sam","note":"1 records available"}],"skipped":[]}
```

Clicked first by Matt in his own browser, then **independently re-verified by Claude driving Chrome over CDP** (the extension does not connect in this environment; the DevTools Protocol does, with zero new dependencies). The row moved from `checked 9 minutes ago` to `checked 1 second ago` live, state `ok`, no console errors. **`SAM.gov` no longer reads `unknown`** — the "all seven eligible rows read unknown" line above is now stale for that row and true for the other six.

*Automation note for next time:* `getAdminSecret` falls back to `window.prompt`, which **deadlocks CDP**. Seed `sessionStorage['tenderfoot.adminSecret']` via `Page.addScriptToEvaluateOnNewDocument` **before** navigating and the prompt never opens. Controls carry `aria-label="Check <name>"` and `aria-label="Run <name>"`, which makes them unambiguous to target — and makes it easy to be certain you are **not** clicking Run.

### ✅ 3. RUN WORKS, and the 2026-08-27 FAILURE IS SOLVED — a 30-second ceiling nobody had checked

**✅ RUN SUCCEEDED ON PRODUCTION 2026-08-28.** `POST /api/admin/run?source=SAM.gov&since=<15 minutes ago>` answered **`200` in 2.7 seconds**, doing the whole path — scrape, import, merge, stamp:

```json
{"since":"2026-08-28T03:46:35.232Z","rows":2,"imported":2,"skipped":false,
 "ingestedThrough":"2026-08-28T04:01:35.561Z","merged":2,"updated":0,"linked":2,
 "last_run_at":"2026-08-28T04:01:37.445Z"}
```

**✅ AND THEN MATT CLICKED THE BUTTON — 2026-08-28, in a real browser, against production. It worked.** `ingest_run` id 6, `rows_imported: 0`, and `last_run_at` moved **04:01:37Z → 04:03:59Z**. **Zero rows is the correct answer, not a failure:** the derived window was the 2 minutes 22 seconds since the previous stamp, and SAM.gov posted nothing in it. The whole path still ran — scrape, import, merge, stamp — and the stamp is the proof.

**This is the first time the Run control has ever completed from a browser in production.** SP3.6’s click-through found on 2026-08-18 that "the Run control had never worked once, in any browser, for any source"; that fix was verified on test, never on production, and the two attempts since had been blocked — first by a 404 on `/admin`, then by a dead `ADMIN_SECRET`, then by the seven-day window. D5 is now genuinely exercised end to end.

**So the Run path is not broken.** The first of the two calls above was invoked with an explicit `?since=` — honoured per §9.6, "the operator sets the scope of each run" — which the Run BUTTON deliberately never sends. That is the whole difference between this call and the failing one.

⚠️ **The 2026-08-27 error is STILL NOT IDENTIFIED, and this does not identify it.** The leading hypothesis is now much narrower — the seven-day window rather than a broken code path — but nothing here proves that, and it is recorded as a hypothesis, not a finding.

**The original failure, for the record. Run was clicked on SAM.gov in production on 2026-08-27; it returned an error code shortly after, and imported nothing.** The exact code was not captured and **Vercel's runtime-logs API returns `403` for the available token**, so the server side could not be read. The client-side error text is still the missing evidence.

**✅ PARTLY MITIGATED 2026-08-27 — D7, `docs/admin-deviations.md`.** The screen now reports a request that never completes. **This does NOT diagnose the failure above; it makes the NEXT one legible.** The non-2xx path was already right (it reads the body and surfaces `data.error`), which is why an error code was seen at all. What was missing: there was **no `try` anywhere in `Admin.tsx`**, so a REJECTED `fetch` — dropped connection, a request killed at the 300s function ceiling, an offline client — escaped the handler and skipped `setBusy(..., false)`. That left **no message and a row frozen busy**, since every control in it is `disabled={busy}` — strictly worse than a swallowed error, because the row could not even be retried. Both handlers now catch, clear busy, and report `Request failed — <message>` in the browser’s own words. Gate green at **301 tests / 43 files**.

> 🔎 **The original error text may still be recoverable.** The row error lives in React state until the next click or a reload, so if the `/admin` tab from 2026-08-27 is still open and untouched, it is still under the SAM.gov row. **The advice this note used to carry — "set a recent `last_run_at` first" — is now obsolete, and was never a good idea:** it would have written a false fact, claiming a run that never happened, into a database this file exists to keep honest. The window shrank on its own instead, because a REAL run stamped it. `since_default` was never touched and still reads `P7D`.

**Production, measured 2026-08-28 after the successful run** (the 2026-08-27 failure imported nothing; these two rows are the first ingestion into production since 2026-08-17):

| | |
|---|---|
| solicitations | 788 → **790** |
| sightings | 788 → **790** |
| organizations | 197 → **198** |
| `ingest_run` rows | 2 → **4** (ids 5 and 6), newest **2026-08-28T04:03:59Z** |
| `source.last_run_at` for SAM.gov | NULL → **2026-08-28T04:03:59Z** (real, twice) |

**Three things contained it, and they are worth keeping.** `RUN_HANDLER_BUDGET_MS = 180_000` caps the scrape below Vercel's 300s ceiling; the scrape stages into a `mkdtempSync` artifact that a `finally` deletes unconditionally, so a failure before `importArtifact` cannot touch Postgres; and the `affected !== 1` assertion on the `last_run_at` stamp fails loud rather than reporting a success it did not achieve. **The fail-closed, stage-then-import design is what made a misclick harmless. Do not "simplify" any of it.**

✅ **THE SEVEN-DAY HAZARD IS GONE, and it closed itself correctly.** `resolveSince` returns `last_run_at` when there is one and only falls back to `since_default` when there is not — so now that a genuine run has stamped **2026-08-28T04:01:37Z**, the Run BUTTON derives a window of *minutes*, not seven days. **Run is now safe to press in the browser**, which it has never been before.

*(What made it safe is worth keeping straight: nothing was configured around the hazard. `since_default` is still `P7D`, untouched. A real run supplied the real timestamp, and the rule did the rest — which is exactly what 003_seed_source_registry.sql meant by "`since_default` is only a SEED. The rule is `since = last successful run`.")*

#### 🔬 WHAT THE 2026-08-27 FAILURE ACTUALLY DID — reconstructed 2026-08-28 from sequence forensics

**There was no log to read.** Vercel’s runtime-log API answers `403` for this project’s token, and the transaction rolled back, so the database recorded nothing either. The evidence is a gap in a sequence.

**Every `sighting` id is accounted for, and the arithmetic closes exactly:**

| `sighting` ids | what | live |
|---|---|---|
| 1 – 201 | corpus import | 201 |
| 202 – 226 | deleted by hand | matches `n_tup_del = 25` |
| 227 – 756 | `ingest_run` 2 (2026-08-16) | 530 |
| 757 – 813 | `ingest_run` 3 (2026-08-17) | 57 |
| **814 – 9,910** | **ROLLED BACK** | **9,097 — exactly the unaccounted insert count** |
| 9,911 – 9,912 | `ingest_run` 5 (2026-08-28) | 2 |

201 + 530 + 57 + 2 = **790 live**, which is what the table holds. `stats_reset` is `null`, so those counters are cumulative for the life of the database.

**PROVEN: one aborted transaction consumed 9,097 sighting ids, and it sits chronologically after 2026-08-17 and before 2026-08-28.** `importArtifact` inserts the `ingest_run` row FIRST and the sightings after it — so **the scrape SUCCEEDED and 9,097 rows reached the import** before the transaction died. This was never a failed fetch.

✅ **SOLVED 2026-08-28 BY REPRODUCING IT.** A deliberate seven-day Run was fired at production with the guard in place. It answered **`504 FUNCTION_INVOCATION_TIMEOUT` after 30.3 seconds**, and left the identical fingerprint:

| | 2026-08-27 | the reproduction |
|---|---|---|
| sighting ids consumed and rolled back | 9,097 | **9,099** (`sighting_seq` 9,912 → 19,011) |
| `ingest_run` ids consumed and rolled back | one (id 4) | **one (id 7)** |
| rows imported | 0 | **0** |
| `last_run_at` stamped | no | **no** |

**Both open questions close at once.** The 2026-08-27 failure was a **30-second function timeout**, and the click is attributed: the same conditions produce the same signature on demand. Not merge superlinearity, not the window size in itself — the function cannot finish that much work inside its ceiling, and dies mid-transaction.

⛔ **THE ROOT CAUSE, AND IT INVALIDATED EVERY BUDGET IN THE SYSTEM: `vercel.json` set `maxDuration: 30`.** Meanwhile `routes/admin.ts` reasons throughout about "the platform’s ~300s ceiling". Nobody had checked the one against the other:

| constant | value | vs the REAL 30s ceiling |
|---|---|---|
| `HANDLER_BUDGET_MS` (`/scrape`) | 240,000 | **8× the ceiling** |
| `RUN_HANDLER_BUDGET_MS` (`/run`) | 180,000 | **6× the ceiling** |
| `CEILING_MS` (the guard, shipped hours earlier) | 300,000 | **10× the ceiling** |

**None of them could ever fire.** The function always died first. That includes the guard added earlier the same day — it inherited the 300s figure from the very comments that were wrong, so it shipped inert and did not fire on the reproduction either. Recorded rather than quietly corrected, because it is the same mistake twice: **trusting a number written in a comment instead of the file that configures it.**

✅ **FIXED 2026-08-28: `maxDuration` raised 30 → 300**, which is the value every budget in the route was already written against, and which makes a wide first run viable rather than architecturally impossible.

✅ **DEMONSTRATED 2026-08-28: the seven-day window now returns `200` in 77.6s.** 9,096 rows scraped, 9,096 imported, **7,860 new solicitations** merged (dedup absorbed the 12-hour overlap), `last_run_at` stamped. **77.6s is past 30s**, so under the old `maxDuration: 30` this run would have died almost exactly where the 504 hit at 30.3s. Same window, same row count, succeeds only because the ceiling moved — which confirms the diagnosis beyond the fingerprint match. `sighting`’s lifetime rollback count now reads **18,196 = 9,097 + 9,099**, the two failures, exactly.

⚠️ **The 12-hour verification before it did NOT demonstrate this, and the attempt is kept as a lesson.** A 12-hour verification run was chosen to exceed the old 30s ceiling — the test branch had measured 43s for that window — but production returned **1,235 rows in 6.0s**, never approaching 30s, so it proves the run works and proves nothing about the ceiling. **Production is ~206 rows/sec end to end**, far faster than the test-branch figure this repo had been reasoning from. The arithmetic now fits the failure almost exactly (9,000 rows ≈ 44s against a 504 at 30.3s), but **fitting is not showing**: only a run lasting past 30s would demonstrate the raise, and that means ≈6,200 rows — essentially the seven-day window.

**MERGE IS MILDLY SUPERLINEAR, and the numbers are now on record.** Per-row cost went **4.86 ms at 1,235 rows → 8.53 ms at 9,096 rows** — about 1.75× for 7.4× the scale. The hypothesis this file had set aside as untested is real; it simply was not the cause. **Extrapolating the small run linearly predicted ~45s for a run that took 77.6s** — the third time in one session a measurement was carried past its scale, which is exactly the habit `import-budget.ts`’s 2× factor exists to absorb.

*(That factor is now vindicated rather than merely cautious: `MS_PER_ROW = 9`, derived from a 530-row measurement, sits almost exactly on the 8.53 ms/row observed at nine thousand. The 2× on top is the margin, and it correctly ALLOWED this run rather than refusing it.)*

✅ **AND THE ACTUAL ROOT CAUSE IS FIXED, WHICH IS NOT THE NUMBER.** It was **two numbers in two files with nothing tying them together** — one could change and the other would go on reasoning from the old value in silence. `import-budget.test.ts` now **reads `vercel.json` and asserts `CEILING_MS === maxDuration * 1000`**. Keep that test; it is the only thing preventing a third occurrence. Gate green at **309 tests / 44 files**.

#### ✅ FIXED 2026-08-28 — the guard that was missing (`scrape/import-budget.ts`)

**The certain defect is not a mis-sized number; it is that nothing checked.** `RUN_HANDLER_BUDGET_MS` bounds only the scrape loop. `importArtifact` and `mergeSightings` run after it, in the same request, against the platform ceiling. The route reserved 120s for them — explicitly, and sized from real measurements — but a **fixed** reservation sized at one scale cannot notice a run arriving at another, and **nothing compared it to the rows actually returned.**

`importFitsInBudget({ rows, elapsedMs })` is pure — both inputs are parameters rather than clock reads, the same posture `resolveSince` takes — and `/run` now calls it **before** `importArtifact`. When the import cannot finish it answers **400**, names the row count and the window, and imports nothing.

**The estimate deliberately carries a factor of two beyond the measured rate.** Both rates come from a 530-row run, and extrapolating them to nine thousand rows as though they were linear is precisely the assumption that left this unguarded. The guard is therefore pessimistic at scale and **will sometimes refuse a run that would have completed** — the correct direction to be wrong in, since a refusal is legible and costs one narrower re-run, while an overrun discards every fetched row silently.

**Zero rows always passes**, deliberately: a run that found nothing must still reach its `last_run_at` stamp, and stranding that stamp would widen the next window — manufacturing the very condition the guard exists to prevent. Gate green at **308 tests / 44 files**.

> 🛟 **If a run ever does land badly: Neon `history_retention_seconds` is 86400 on `wispy-tooth-06225229`.** Branch `main` (`br-super-breeze-aun4swjv`) has a **24-hour** point-in-time restore window. Verified present 2026-08-27.

### ✅ 4. LOCAL DEVELOPMENT WROTE TO THE PRODUCTION DATABASE — found AND FIXED 2026-08-28

**`.env`’s `DATABASE_URL` points at production.** Its host is endpoint `ep-super-bonus-auoe43hj`, and that endpoint belongs to branch **`br-super-breeze-aun4swjv`, which is `main`**. The `test` branch has a different endpoint entirely — `ep-withered-base-au6l4cjf` — which is what `DATABASE_URL_TEST` correctly points at.

**The gate is SAFE; this is not a test problem.** `scripts/check.mjs:185` runs the suite with `DATABASE_URL` overridden to `DATABASE_URL_TEST`, and `useTestSchema()` gives each test file an isolated schema inside that branch. Tests never touch production.

⚠️ **Everything else is not.** `db/index.ts` reads `const CONN = process.env.DATABASE_URL` with no override — so **`npm run dev`, and any bare CLI scrape / import / merge, reads and writes production’s `public` schema.** No guard, no prompt, and nothing in the connection string that reads as "production" to a human glancing at it.

**This is why §3’s attribution cannot be closed** — a local run is an equally available explanation for the 9,097-row rollback — and it was the larger of the two findings.

**✅ RULED AND DONE 2026-08-28: local now points at the `test` branch.** `DATABASE_URL` was repointed to the `test` endpoint, and the production string is preserved in `.env` under the explicit name **`DATABASE_URL_PRODUCTION`** — so reaching production from a local shell is now a deliberate act rather than the default.

**Verified by the DATA, not by the string.** A local connection using the new `DATABASE_URL` returns **1,925 solicitations** and a `SAM.gov.last_run_at` of 2026-08-19 — the `test` branch. Production holds 790 and 2026-08-28. The two are unmistakable from each other, which is the only check worth trusting here.

⚠️ **ONE CONSEQUENCE, and it is deliberate: `npm run migrate` now targets `test`.** `db/migrate.ts:55` reads the same `DATABASE_URL`. **Migrating production is now an explicit act** — run it with `DATABASE_URL` set to `DATABASE_URL_PRODUCTION`. That is the safer default, but it is a behaviour change and will surprise anyone who does not know it.

⚠️ **What was NOT changed.** `.env` still carries the Neon/Vercel integration keys (`POSTGRES_URL`, `PGHOST`, `DATABASE_URL_UNPOOLED`, and the rest) pointing at production. **Nothing in this codebase reads any of them** — the only connection reads are `DATABASE_URL` (`db/index.ts`’s `const CONN`, `db/migrate.ts:55`) and `DATABASE_URL_TEST` (`db/testdb.ts`, `scripts/clean-test-schemas.mjs`) — so they are inert, not a second live path. They are left alone rather than deleted because `vercel env pull` would restore them anyway.

`.env` is properly ignored, not merely untracked (`.gitignore:6`).

### ✅ 5. WHAT GOT FIXED ON 2026-08-19, AND ONE CORRECTION THAT MATTERS

**`/admin` 404'd in production and always had.** `vercel.json` rewrote only `/api/:path*`, so **every client-side route was a genuine Vercel 404 on a direct request.** Navigating from `/` worked and rendered all 13 rows — which is exactly why nobody noticed, and **the real reason nobody had ever clicked those buttons in production: the URL for doing it did not resolve.** Standard SPA fallback added (`5e518df`); **verified live — `/admin` 200, `/api/health` 200, assets 200.**

> ⚠️ **CORRECTION, AND IT CHANGES A SECURITY CLAIM THIS FILE HAS MADE SINCE 08-15: production had NO Deployment Protection.** Plain `curl` with **no credentials at all** got `200` on `/` and on `/api/sources` — which returned the full source registry including legal notes — and on `/api/profile`, which returned the firm profile. STATUS has said for days that production "answers 302 publicly" and is protected. **It was not.**
>
> **This retroactively upgrades tonight's auth work from tidiness to a real fix.** Claude described the ungated `PATCH` routes earlier as *"missing defence-in-depth, not an open door"* — **that was wrong**: with no protection in front, anyone on the internet could have flipped sources on or rewritten the firm profile. Verified with plain `curl`, no credentials: **`PATCH /api/sources/1` now returns 401.**
>
> ✅ **RULED 2026-08-28 by Matt: YES — production is SUPPOSED to be publicly readable.** The open read surface is intentional, not an oversight. What made this a question was never the openness itself: STATUS had claimed since 08-15 that Deployment Protection sat in front of it, that claim was false, and "open by design" had therefore never actually been chosen — only assumed. It is chosen now.
>
> **What this ruling covers: READS.** `/` and `/api/sources` (the full registry including legal notes) and `/api/profile` (the firm profile) answer `200` to anyone with the URL, with no credential. **The firm profile being world-readable is part of what was accepted here**, not an oversight this ruling overlooks.
>
> **What it does NOT cover: WRITES, which stay closed and must stay closed.** Every `/api/admin/*` route sits behind `requireAdminSecret`, which fails CLOSED (`503` when the variable is unset) and "must never be ‘fixed’ into failing open" — adminSecret.ts says so in as many words. `PATCH /api/sources/:id` was ungated until 2026-08-19 and now answers `401`, verified with plain `curl`. **A public read surface makes that boundary more load-bearing, not less:** with no protection in front, the gate is the only thing standing between the internet and production data.
>
> ⚠️ **The standing consequence, worth reading before adding a route.** Every new `GET` on this app is public the moment it deploys — there is no second layer to catch a mistake. Anything that should not be world-readable needs its own gate at the point it is written, not later.

⚠️ **Vercel Attack Challenge Mode was tripped, almost certainly by Claude's own probing** — repeated `curl`/`vercel curl` plus two headless Chrome sessions against production in a few minutes. Everything, including static assets, answered `403` with a "Vercel Security Checkpoint" page for several minutes, then cleared on its own. **Back off rather than retry harder**; the control is at `https://vercel.com/koehler-partners/tenderfoot/firewall`.

### ✅ 6. ALSO DONE — extraction spike, part two

**Structure survives.** `.docx` tables: 244/244 tables and 758/758 rows preserved by `mammoth.convertToHtml` (the 64-cell gap is vertical-merge continuations, i.e. correct `rowspan`, not loss). `.xlsx` has two traps and **neither is about Node**: declared `!ref` dimensions are fiction (89–99% phantom rows), and **SheetJS replays Excel's cached formula values rather than evaluating** — so a workbook saved without recalculation yields a stale total with no signal. `.pdf` has no table structure at all; geometry is present, reconstruction is not provided. Full write-up: `docs/2026-08-18-extraction-spike.md`.

✅ **RULED 2026-08-28: pin SheetJS from `cdn.sheetjs.com`.** Not the npm package with unfixable advisories, not a Python sidecar. That was the last open question on SP4, which is now **designed** — `docs/superpowers/specs/2026-08-28-sp4-fetch-extraction-design.md`.

---

## 🔖 RESUME HERE — updated 2026-08-30

> ✅ **THE BRANCH IS PUSHED, 2026-08-30.** `origin/sp4-fetch-extraction` exists and tracks. Every
> SP4 commit — tasks 1–10 — is off the one laptop it used to live on. ⚠️ You are still ON
> `sp4-fetch-extraction`, not `main`, and **production is still deployed from it**; that has not
> changed and is not a defect, but it is the thing to know before reading a deploy.

**Working tree CLEAN. Gate green at 406 tests / 57 files, `npm run check` exit 0.** Production is deployed and healthy (`/api/health` returns `ok`, migrations 001–010). **The pinned block above has no outstanding rulings** — read it first, then this.

### ✅ 2026-08-30 — SP4 Task 10 built, and the brief could not run as written

**`4d60d81`.** `extract/run-extract.ts` walks pending documents nearest-deadline first, fetches, parses, writes fields, and records every failure with a reason naming the step that failed. No transaction around the batch — `extract_status` is already the checkpoint, and 2026-08-27 proved what wrapping it costs.

**Two parts of the brief were stale.** Its fixture inserted `INSERT INTO solicitation (title, closes_at)` — illegal since migration 010, written later the same night as the brief, made `source_id` NOT NULL. Its imports were static, which hoists them ahead of `useTestSchema()` and builds the pool from an ambient `DATABASE_URL` that `npm run check` deliberately strips.

**🔴 D9 — THE ONE CHANGE OF SUBSTANCE, and it is the same failure shape as Task 9's.** The brief expanded a `.zip` into child rows marked `pending` for a later batch. **A member row can never be fetched by a later batch**: its bytes came from inside an archive, so it has no `source_url`, and ruling 1 keeps no bytes anywhere. As briefed, all 86 of the spike's members become rows the next pass fetches from `null`, fails, and stamps **`download failed`** — the network blamed for a design gap, one paragraph up the same code path from D8, which exists to stop exactly that. Members are now absorbed inside the parent's iteration, by the same function that handles a top-level document. The spec is *silent* on how a member gets its bytes, so this is the smallest thing that keeps its stated shape, numbered rather than debated. `docs/admin-deviations.md` D9.

**The brief's own three tests never reached the success path** — all three feed the orchestrator a file no parser can read, so `extractFields`, the `extracted_field` rows, `produced_by` and the parser notes were entirely unpinned. Seven tests added; **six mutants, six killed.** The most instructive: removing the `!res.ok` guard makes a 404 report `parse failed: The PDF file is empty` — blaming the extractor for a document that never arrived, which is precisely what `opportunities` cannot survive.

⚠️ **`WHERE closes_at >= now()` is NOT implemented, though design §4.3 words it that way.** The `ORDER BY` is kept and is what §4.3 is for. The filter is not: a comparison against a NULL `closes_at` yields NULL and WHERE reads NULL as false (Task 9's Critical (b), verbatim), and a permanent filter makes the returned `remaining` a lie — documents on a since-closed solicitation would sit `pending` forever under a counter that never reaches zero, on the screen Task 12 builds.

**The 53 pending documents on the `test` branch are untouched.** Task 10 was proved against fixtures; a live run belongs with Task 11's endpoint.

### ✅ THE NIGHT OF 2026-08-28/29 — SP4 Task 9 closed, and the slice's premise nearly did not survive

**Nine commits.** `9cf85a2` `885416e` `a8eaaa3` `72ba4fa` `bbb7e01` `42e3204` `6c66a8b` `a0a41d6` `5d7a711`, plus `6e12897` for the DOOGIE entry. Full reasoning in `.superpowers/sdd/2026-08-28-sp4-fetch-extraction/progress.md`; DOOGIE entries 248–271.

**Task 9's review found two Criticals that together meant the slice produced NOTHING**, and a third was found while fixing them. (a) The SAM attachment endpoint was written from memory and 404s on every id — the correct host was already in `adapters/sam.ts` and `probes/sam.ts`, now shared as `SAM_HOST`. (b) `left(closes_at,10) >= today` is NULL for a NULL `closes_at` and WHERE reads NULL as false, so **every SAM.gov solicitation was silently excluded** from the candidate list. (c) `solicitation` had no source column at all, so the query handed Indiana ids to a federal API — and the NULLS-LAST fix for (b) sorted those wrong-source rows to the FRONT.

⚠️ **None of the three was catchable by the tests that existed.** `source_url.length > 0` was the only thing pinning the endpoint and passes against the wrong host; no fixture had a NULL `closes_at`. **New rule, now enforced in the tests: a test that composes the same constant the implementation composes moves with the bug instead of catching it.** URLs are literals now. Every fix in this run was verified by MUTATION — fourteen mutants across the night, all killed.

**Migration 010 — `solicitation.source_id`, NOT NULL**, backfilled latest-sighting-wins to match `merge.ts`'s own `latest_source_id` rule. NOT NULL is load-bearing: a null source is invisible to `WHERE source_id = …`, the same silent-exclusion shape as (b).

**`accuracyByField` gained `missed` and `opportunities`** (Matt ruled options 1+2). ⚠️ **The units differ and DO NOT SUM** — `agreed`/`disagreed` count document statements, `missed`/`opportunities` count solicitations. A test pins both. Expect `set_aside`, `value_cents` and `prebid_required` to report **100% missed**: `fields.ts` marks them `NOT_EXTRACTED`, so that is honest, not broken.

**🔴 THE BIG ONE — the accuracy instrument had NO GROUND TRUTH AT ALL.** The first live smoke run worked (7 documents, 0 skipped) and **every listing row it wrote said ABSENT**. Measured: all six fields null on **all 9,682 production SAM.gov rows**. The accuracy query requires a stated listing value, so it would have reported **zero fields — not the one field we had already reduced it to.** *Green tests over an empty premise, for the whole slice.* **Generalisation worth keeping: tests prove the code does what it says, and say nothing about whether the data can support what the code is FOR.**

**The fix was already in the database.** `sighting.raw` carried `responseDate` on 7,644 of 9,682 rows. `merge.ts` had only ever learned to read ONE field out of the payload — the title — and `ingest/corpus.ts` was the sole writer of `closes_at` anywhere, which is exactly why 201 corpus rows had deadlines and no SAM row did. New `merge/closes-at.ts`, same shape as `org-chain.ts`. ⚠️ **It reads `responseDateActual` (local), NOT `responseDate` (UTC) — they are the same instant, `closes_at` is a bare date, and on 39 of 1,338 (2.9%) they disagree.** Every one is an evening deadline rolling past midnight in UTC, so reading the UTC field records deadlines **a day LATE**. Measured, not assumed.

**Ordering constraint REMOVED rather than enforced.** merge populates `closes_at`; discover copies it into ground truth; nothing sequences them and nothing can. `ON CONFLICT DO NOTHING` became `DO UPDATE` (reversing an earlier decision in the same round, whose premise proved false) plus a bounded `REFRESH` pass, so a later run repairs the copy whichever order they ran in. **ABSENT and "we had not read it yet" are different facts** — recording the second as the first is the one way a ground-truth row can lie.

**Gate hygiene, worth not re-deriving.** `check.mjs` asserted ".env's DATABASE_URL is the PRODUCTION pooler" — **false and load-bearing**, it was the entire justification for the build-step override, which was therefore substituting a value for itself. Now `refuseToRunAgainstProduction()` checks the invariant instead of asserting it, comparing by DATABASE not by string (Neon serves pooled and direct hosts for one endpoint). ⚠️ **`vercel env pull` with no path argument overwrites `.env`, and Vercel's own `DATABASE_URL` IS production** — that guard is what catches it. Also: **`api/index.ts`, the file Vercel actually deploys, was in NO TypeScript project** and had never been typechecked; `tsconfig.api.json` fixes our side. ⚠️ **Vercel still prints a spurious `admin.ts` TS2339 and still does not fail the build on type errors** — that half is unfixed, and is a deploy-pipeline decision.

**PRODUCTION IS CAUGHT UP, both halves.** `mergeSightings` ran against production after a pre-flight that measured the blast radius (0 unlinked sightings ⇒ no inserts, no links possible): result `{created:0, updated:0, linked:0, orgsAttached:0, deadlinesSet:7644}`. SAM.gov **0 → 7,644 dated**. Then deployed — migrations 007 → 010 applied, `source_id` backfilled 9,682/140/61 with zero NULLs.

### ✅ 2026-08-30 — SP4 Task 11, the two endpoints

**`49f6352`.** `POST /api/admin/discover` and `POST /api/admin/extract`, both under the router's existing `requireAdminSecret`, both bounded by `RUN_HANDLER_BUDGET_MS`. Gate green at **406 tests / 57 files**.

**🔴 The brief's clamp had a bug and its test could not have caught it.** `Math.min(Number(q ?? 10) || 10, MAX)` lets a NEGATIVE through — `-5` is truthy so `||` misses it, and `Math.min` misses it too since `-5` is already below the maximum — and it reaches Postgres as `LIMIT -5`. **Measured, not argued: reinstating that expression as a mutant turns `?limit=-5` into a 500.** The briefed test asserted only that `?limit=99999` answered 200, which is equally true with the clamp deleted. Now `lib/batchLimit.ts`, pure, eight unit tests, and **both endpoints echo the effective limit** — an operator who asks for 99999 and gets 50 should be told, and a clamp nobody can observe is a clamp no test can pin.

⚠️ **The two 401 tests pass "for free"** — an unmatched route under the gate 401s before it 404s. That is why they are worth having: what they actually pin is the mounting **order**, which is invisible at the call site. Mounted above `admin.use(requireAdminSecret)`, an unauthenticated POST to `/discover` answers 200 and scrapes a federal API from the app's IP. Three mutants, three killed.

**Not done, deliberately: the live run.** Both endpoints are proved against fixtures only. The **53 pending documents on the `test` branch** are still waiting, and firing at SAM.gov for real is outward-facing and Matt's call.

### ⏭ START HERE — SP4 Task 12, the screen and the seam test

**Brief: `.superpowers/sdd/2026-08-28-sp4-fetch-extraction/task-12-brief.md`.** The Admin controls over the two endpoints, plus the seam test that is the regression test for the FSSA near-miss. It reads `data.processed ?? data.documents ?? 0` and `data.remaining ?? 0`; the endpoints' added `limit` key is additive and safe.

⚠️ **`extract_status` transitions carry weight.** `opportunities` counts only solicitations with a document in `extracted` or `absent` — a `failed` document is a missed FETCH, not a missed extraction, and conflating them blames the extractor for the network. Tasks 10 and 11 both pin that distinction; the screen must not undo it by collapsing what it shows.

**Then a browser click-through, over CDP** — the extension has never connected on this machine. This is the first moment SP4 has a surface, and 08-18 and 08-28 are the argument: `Run` had never worked in *any* browser and `Check` was silently inert on two rows, and the passing server-half tests saw neither.

**Then a fresh review of Task 9** — that diff now carries SIX things the original review never saw: the source filter, migration 010, the miss counts, the api typecheck, the closes-at reader, and the ground-truth refresh. **Tasks 10 and 11 want reviews of their own**, D9 first.

**Open, and Matt's:** ~~① push this branch~~ ✅ **done 2026-08-30**; ② whether Vercel's build should fail on type errors; ③ the staging-branch decision — `.env`'s `DATABASE_URL` and `DATABASE_URL_TEST` are currently the SAME string, both pointing at `test`, which ci.yml mirrors deliberately; ④ delete the abandoned `preview/sp3-federal-ingestion` Neon branch from the console, **not** through the MCP. **Standing:** execute the slice sequence in order, no shortcuts (ruled 2026-08-29).

**What changed on 2026-08-28, in one line each.** The admin gate went live (§1). The demo criterion was met (§2). Run was clicked in a browser on production for the first time ever, and the 2026-08-27 failure was diagnosed as a 30-second `maxDuration` every budget in the codebase had been reasoning past — now 300, and tied to `vercel.json` by a test (§3). Local development was repointed off production (§4). Production was ruled public by decision (§5). Production holds **9,883 solicitations** after two real ingests, up from 788.

**Two things a future session should not re-investigate.** The `sighting_id_seq` gaps at 814–9,910 and the second block after it are the two failed runs, both explained and both closed — see §3. And the `db/schema.test.ts` flake is a Node happy-eyeballs connection timeout, not a schema fault: `db/connect-tuning.ts` carries the full investigation, including three hypotheses that were each tested and each wrong.

*(Everything from here down is the 2026-08-18 resume and older. It is accurate for its dates; where it conflicts with the above, the above wins.)*

**You are on `main`, SP3.6 IS MERGED, and the working tree is clean.** Merge commit `a110e93` (`--no-ff`, matching this repo's convention), branch `sp3.6-source-health` deleted after merging. Gate green **on the merged result**: **266 tests / 42 files**, `npm run check` exit 0. Thirteen tasks, each implemented and reviewed by a fresh agent; nineteen controller rulings, each recorded with what it costs if wrong; a whole-branch review that returned **Ready to merge** after a five-finding fix wave (`9be2280`).

✅ **THE BUTTONS HAVE NOW BEEN CLICKED — 2026-08-18 — AND BOTH OF THEM WERE BROKEN.** The click-through that SP3.6 still owed finally ran, in real Chrome, and it found two defects that 266 passing tests and a whole-branch review had all missed. **The Run control had never worked once, in any browser, for any source.** Both are fixed; gate is **292 tests / 43 files**, `npm run check` exit 0. See the DONE entry below. ~~⚠️ **Uncommitted** — the fix is in the working tree, not yet a commit.~~ **Committed and pushed long since; the tree is clean as of 2026-08-28.**

*(The paragraph this replaced described `main`'s state on 2026-08-17, before SP3.6 existed — 193 tests / 36 files, gate 94s. Accurate for that date, preserved further down this section, and superseded here because SP3.6 has since merged into it.)*

✅ **The local gate's fragility is mostly gone — `corpus.test.ts` went 81.7s → 3.44s (`2cac516`).** ⚠️ **Mostly, not entirely**: the ~73s transaction that caused it is fixed, the 48.3s `DROP SCHEMA` is not. See item 1.

✅ **DONE 2026-08-28: all five merged slice branches are deleted, local and remote.** `sp0-infrastructure` (`66b8669`), `sp1-entity-graph` (`faf060a`), `sp1.5-postgres-port` (`57e52df`), `sp2-design-system` (`fc1d1d9`), `sp3-federal-ingestion` (`3c65a2f`) — the last two also removed from `origin`. **`main` is now the only branch that exists anywhere.** Every one was verified fully merged first (`git branch --merged`, and `-d` rather than `-D`, so an unmerged branch would have refused), local and remote tips confirmed identical. Nothing was lost: the commits are reachable from `main`, only the labels went. Tips recorded above in case a name is ever wanted back.

⛔ **RETRACTED 2026-08-28, SAME DAY, AND THE RETRACTION MATTERS MORE THAN THE CLAIM.** This section briefly said the Neon branch `preview/sp3-federal-ingestion` (`br-falling-wildflower-aul37lat`) had SURVIVED the git-branch deletion, because querying it returned rows. **That was wrong, and the method was wrong.**

⚠️ **`mcp__neon__run_sql` IGNORES ITS `branch_id` ARGUMENT.** Every query sent through it lands on the project’s DEFAULT branch — `main`, which is production. Proved two ways: asking for `br-falling-wildflower-aul37lat` returned 9,883 solicitations including an import from 04:50:58 that night, which a branch cut from `main` on 2026-08-16 cannot possibly contain; and asking for the `test` branch (`br-delicate-leaf-auwo0czn`), independently verified by direct `psql` to hold **1,925**, also returned **9,883**.

**What this does and does not invalidate.** Every production figure in this file is UNAFFECTED — those queries named `main`’s id, and `main` is the default, so they hit the branch they claimed to. What is void is any statement about a NON-default branch made through that tool. **The current existence of `preview/sp3-federal-ingestion` is UNKNOWN**; the deletion may well have removed it.

⛔ **DO NOT DELETE NEON BRANCHES THROUGH THIS MCP.** If `run_sql` mis-routes a branch id, nothing establishes that `delete_branch` routes one correctly — and the failure mode of a mis-routed delete is the production database. `list_branches`, `list_operations` and `list_postgres_endpoints` had already degraded to "tool not found" the same evening, so the server’s branch handling is not trustworthy. **Use the Neon console**, where the target is visible before confirming.

*(The near-miss is on record because the process is the point: an identity check was run before an irreversible delete precisely because it was irreversible, and it is the only reason the mis-routing was caught rather than acted on.)*

**So the answer is now the reverse of the assumption: the Vercel–Neon integration does not appear to garbage-collect a preview branch when its git branch disappears.** That branch is now genuinely orphaned — no git branch, no deployment, still consuming storage against the project. **Deleting it is Matt’s call** (it is destructive and unrecoverable past the retention window); the alternative is leaving a dead branch that no longer maps to anything.

> ## 🚨 FIRST THING TO KNOW ON RESUME — SIX SLICES ARE SHIPPED, AND THE PRODUCT HOLDS REAL FEDERAL DATA
>
> **SP0 · SP1 · SP1.5 · SP2 · SP3 · SP3.5 are all merged to `main`.** SP1 closed on 2026-08-16 (`a512ad0`) when T12–T15 landed; SP3 + SP3.5 closed the same day (`6a8cf67`).
>
> **Production: 788 solicitations, 788 sightings, zero unlinked, zero duplicate external_ids, every row carrying an organisation.** Two `SAM.gov` ingest runs. `SAM.gov` is the only enabled source; the other twelve stay off, fail-closed.
>
> **`/admin` is the first composed screen** and it is live — Firm Profile and Source Registry, matched to the frozen V1.2 bundle with five numbered deviations in `docs/admin-deviations.md`.

### ✅ DONE 2026-08-17 — the fonts, and the app finally fetches one

**`d891bbb`.** Self-hosted per Matt's 2026-08-16 ruling: four woff2 files (100 KB) in `app/client/src/tokens/fonts/`, an `@font-face` block in `fonts.css`, imported by `main.tsx`. **Not in `type.css`** — that file and `tokens.css` are byte-locked to `prototype/PROTOTYPE/src/` and `npm run tokens` fails the gate on drift, so neither could carry the block. `type.css` **names** the families; `fonts.css` **fetches** them.

**Four files, not seven, and this is the part worth remembering.** `docs/explainer/fonts/` holds seven, but `IBMPlexSans-400/500/600/700` are **byte-identical** (md5 `b2c9031d`) — **one VARIABLE font copied four times** under four static-sounding names. Confirmed against the `fvar` table: `wght 100..700`, default 400. So Sans is declared **once over its real axis range** instead of four times at pinned weights. The three Mono files *are* genuinely distinct (`usWeightClass` 400/500/600, three md5s). All four are md5-identical to `docs/explainer/fonts/` — **the same metal the prototype rendered with**, so no new download was needed.

**Verified in a browser, not just asserted.** All four fetched with byte counts matching source exactly; `document.fonts.check()` true for Sans and Mono at 400/500/600; canvas metrics differ from fallback (Sans 156.86 vs serif 148.07, Mono 187.20 vs monospace 171.54) — real Plex glyphs, not a substitute.

> ⚠️ **The guard test caught its own scanner, and that is the transferable lesson.** `fonts.test.ts`'s first regex anchored on `font\s*:`, which matched `Admin.css` and the primitives and **missed all 88 tokens in `type.css`** — the file the whole defect started in. It found 14 usages and **every coverage test went green.** Only the counting guard (`fail under 50`) exposed it. It now matches the shorthand *value* wherever it appears and finds 110. **A coverage test is worth exactly what its scanner sees, and nothing tells you the scanner went blind except a test that counts.**

**One honest limit, recorded not fixed.** These are the "latin" subsets (~230 glyphs). An audit of every non-ASCII codepoint the client renders found six: `§ · — …` are covered; **`→` (`Health.tsx`, `Gallery.tsx`) and `▸` (`GatedDrawer.tsx`) are not** and still fall back per-glyph. Not a regression — the bundle loaded these same subsets, so the prototype fell back on exactly these glyphs too.

### ✅ DONE 2026-08-18 — the click-through, and the two defects it found

**The Chrome extension was unavailable again, so Chrome was driven directly over the DevTools Protocol instead** — `chrome.exe --headless=new --remote-debugging-port`, spoken to with Node 24's built-in `WebSocket`. **No dependency was added**; Playwright would have been ~300MB in a repo whose `package.json` is deliberately small. The clicks were `Input.dispatchMouseEvent` at real viewport coordinates — trusted browser input, not `element.click()`. The admin secret went in through the app's own `window.prompt` path (overridden to return a value rather than open a modal), so `getAdminSecret`'s prompt-once-then-`sessionStorage` behaviour was exercised rather than bypassed: one prompt call, secret held for the tab.

> ## 🚨 DEFECT 1 — `Run` had NEVER worked, in any browser, for any source
>
> **`Admin.tsx` sent `since=<since_default>`. `since_default` is an ISO-8601 DURATION (`'P7D'`); `validateRun` requires an ISO-8601 DATE.** Every click of Run, on every source, answered:
>
> ```
> 400 since must be an ISO-8601 date (YYYY-MM-DD[T...]), got: P7D
> ```
>
> `last_run_at` never moved. **D5 — the control the whole §9.6 ruling exists to house — was inert from the moment it was written.**
>
> ⚠️ **THE CLIENT'S OWN TEST PINNED THE DEFECT AS THE EXPECTED VALUE.** It asserted `expect(posts[0].url).toBe("/api/admin/run?source=SAM.gov&since=P7D")` against a stubbed `fetch` that answered `{ok: true}` to any POST. **It could not have discovered that the server refuses that URL — it never spoke to a server.** The assertion simply wrote the wrong string down and locked it in. *A test that names a wrong constant is worse than no test: it makes the defect look deliberate, and it makes the next reader trust it.* Same lesson `fonts.test.ts` taught on 2026-08-17 in a different costume — a test is worth exactly what it actually observes.
>
> **Nothing else could have caught it either.** `003_seed_source_registry.sql` states the rule in as many words — *"since_default is an ISO-8601 duration and is only a SEED. The rule is `since = last successful run`; a fixed lookback loses a day permanently when a run fails"* — and **nothing had ever implemented it.** The server tests all passed `&since=2026-08-01` by hand, so the only caller that used the real column was the button, and the button had never been pressed.
>
> **Fixed by putting the window where the rule lives — on the server.** New `app/server/src/scrape/window.ts`: `resolveSince(row)` returns `last_run_at` when there is one, else now minus the `since_default` duration. `?since=` is still honoured when supplied (§9.6: "the operator sets the scope of each run"); only its ABSENCE now means *derive* instead of *refuse*. **The client sends no `since` at all** — which is what this codebase's own rule already required, since a window derived from `last_run_at` and `since_default` is registry knowledge, and "two registries drift" (the task-12 ruling that put source resolution server-side, for exactly the same reason).
>
> **Proven by clicking it, not by asserting it.** SAM.gov, real 12-hour window, real federal scrape → import → merge, **43.1 seconds**, `last_run_at` moved, **solicitations 201 → 1,925**. The regression test that would have caught the original defect feeds `resolveSince`'s output straight into `validateRun` — closing the loop the two test suites left open between them.

> ## 🚨 DEFECT 2 — a `Check` button that did nothing at all, silently
>
> **Kentucky eMARS VSS and Michigan SIGMA VSS render a Check control, and clicking it changed nothing.** No state, no timestamp, no error: `200 {"checked": []}`. Indistinguishable from a broken button.
>
> **The skip itself was CORRECT and is unchanged.** Both are CGI Advantage VSS with `probe_url` NULL (007 leaves them null on purpose), and `checkSources` deliberately skips them rather than writing a false `failing`. **What was missing is that the decision was never reported** — so no caller could tell *"probed it"* from *"may contact it, chose not to"*. Both were an absence.
>
> ⚠️ **`Admin.tsx`'s `isProbeable` mirrors `eligibility.ts`'s three conditions — but `check.ts` applies a FOURTH filter after it**, and the client had no way to know. It cannot be given one, either: the reason lives in `health/probes/registry.ts`, which is deliberately **not** the adapter registry (*"a probe can exist for a platform long before an adapter does"*), so any rule written client-side would be a second registry that drifts. **The server had to say it.**
>
> **Fixed by making `checkSources` return `{ checked, skipped }`**, where `skipped` carries a reason, and the route passes both through. The row now reads *"Not checked — no probe target: CGI Advantage VSS has no probe of its own and the row has no probe_url…"* and stays honestly `unknown`. **`skipped` is built from `eligible`, not from every row** — an excluded source has no place on a list that reads as "nearly probed".

**What the click-through also confirmed, positively:** all 13 rows render; the six excluded rows read `excluded` with the decorative dot and offer no Check or Run; the eligible rows carry real health with a live timestamp; the Enable toggle writes through; and the error slot surfaces a 400 rather than swallowing it (SP3.6's own final-review fix, working as designed).

⚠️ **SIX ORPHANED VITE DEV SERVERS were squatting ports 5175–5180**, left behind by sessions on 08-16, 08-17 and 08-18. `npm run dev` fell through to **5181** — so the first `curl localhost:5175` answered 200 **from a stale bundle**, not from the server just started. Killed, and the pair restarted on the documented ports. **A dev server that silently moves port is a trap for exactly this kind of verification:** read the Vite banner, never assume the port.

⚠️ **STATE LEFT ON THE `test` BRANCH, deliberately and reversibly.** `SAM.gov` is now `enabled = true` there (it was false, and Run refuses a disabled source, so the toggle had to be clicked), `last_run_at` is set, and **`public` now holds 1,925 solicitations / 1,925 sightings instead of the 201-row corpus** — real SAM.gov data from the proving run. **No test reads that schema** (vitest uses `test_*` schemas) and **production was never touched**. Worth saying before someone reads `public` expecting the corpus.

⚠️ **1,724 rows from a twelve-hour window is a third volume data point, and it does not match the other two** — 530 in a day (08-16), 57 the next, now ~1,724 in twelve hours. **Three observations, no pattern.** Any capacity or Interested-per-hundred figure taken from a single window is still standing on one number.

### ✅ DEPLOYED TO PRODUCTION 2026-08-18 — and the buttons work there now

**Pushed `61de4cf..53f8e8a`; the Git-connected production deploy went ● Ready in 16s.** CI green in 37s. **Verified in the deployed bundle rather than assumed:** the live `assets/index-D0Rrx6HH.js` builds `api/admin/run?source=${encodeURIComponent(...)}` with **zero occurrences of `since=` anywhere in the file**, and carries the Check fix's `Not checked — ${reason}`. `/api/health` reports all seven migrations.

⚠️ **The first click of Run on production will be a SEVEN-DAY SAM.gov scrape, and nobody should be surprised by it.** Production's `SAM.gov` is `enabled = true` with **`last_run_at = NULL`** and `since_default = 'P7D'`, so `resolveSince` takes the fallback branch: now minus seven days. For scale, a **twelve-hour** window on the test branch returned **1,724 rows in 43 seconds**. Seven days will very likely exceed `RUN_HANDLER_BUDGET_MS` (180s), which is **designed behaviour, not failure** — the loop checkpoints and reports a resume marker rather than dying mid-write — but the honest description is *"the first click starts a large ingest that probably needs a second click to finish"*, not *"the first click refreshes the list"*.

> **Two ways to make that first click small, neither of them taken** — recorded rather than chosen, because production data is Matt's call: set `last_run_at` on the production row to something recent so the primary branch of the rule applies, or pass an explicit `?since=` (the override is still honoured, §9.6). **Nothing was changed on production beyond the deploy.**

### ✅ DONE 2026-08-18 — the extraction spike, and the premise did not survive it

**Node parsed everything. 172 parse attempts, 0 failures, 0 empty results, 80.1 MB in 16.9 s.** Full findings: [`docs/2026-08-18-extraction-spike.md`](docs/2026-08-18-extraction-spike.md). Harness committed and re-runnable at `docs/spikes/2026-08-18-extraction/`, with its dependencies installed **there** rather than in the root `package.json` — installing parsers into the project would have pre-committed the repo to Node before the ruling the spike exists to inform.

**The claim the whole SP4 decision rested on — *"Node is the weakest major runtime for this"* — did not hold against a single file.** It was never measured; it was inherited from the stack assessment and treated as a constraint for six days. `.docx` 105/105, `.pdf` 37/37, `.xlsx` 22/22, `.xls` 6/6, `.pptx` 2/2, nine `.zip` bundles opened and 86 members reached.

**"Parsed" was not allowed to mean "did not throw"**, since that is exactly the shape of the two defects found hours earlier the same day. **`.docx` was checked against independent ground truth** — mammoth's output against every `<w:t>` run in the file's own XML — and kept ≥99% on 39 of 52 files and ≥95% on the rest, **with nothing below 95%**. **`.pdf` was checked per PAGE, not per file**, because one scanned page inside a forty-page document is invisible in a file-level average: **457 pages, zero with no extractable text.**

> ⚠️ **THE REAL COST IS SUPPLY CHAIN, NOT PARSING — and no argument would have found it.** **npm's `xlsx` is frozen at 0.18.5 with two high-severity advisories and `No fix available`** (prototype pollution, ReDoS). **SheetJS left npm**; current versions ship only from `cdn.sheetjs.com`. It parsed 28/28 spreadsheets flawlessly including legacy `.xls` binary — capability is not the problem, **provenance is**. Python's `openpyxl` has no equivalent problem, which is now **the strongest surviving argument for the sidecar, and it is an argument about dependency provenance rather than about parsing.**
>
> ⚠️ **`.pptx` has no maintained Node library.** Those two results came from unzipping the file and reading `<a:t>` runs out of the slide XML by hand — ten lines, and it worked, but it is hand-rolled where every other format has a library, and the corpus holds exactly **one** distinct `.pptx`.
>
> ⚠️ **No OCR need — and that is a fact about this corpus, not about government documents.** Federal + Indiana, entirely digital-native. The first scanned bundle needs OCR and **no runtime choice avoids it**; it would be equally missing in Python.

⚠️ **TWO SCANNER BUGS, BOTH IN THE SPIKE'S OWN CODE, AND THIS IS THE THIRD TIME TODAY.** A `/message/` test matched the literal string `"no messages"` and reported *105/105 files produced warnings* when the truth is **1 of 52**. A `<w:t[^>]*>` regex also matches `<w:tbl>`, so it captured raw XML markup as document text and reported **a 95% silent data loss that does not exist** — 10,161 of its 10,675 "characters of text" were angle-bracket markup. **Settled by a third independent method**, which agreed with the strict scanner exactly: mammoth had extracted everything, and the file is 3.7 MB because it embeds 6.9 MB of fonts. **The size heuristic was discarded rather than tuned** — all three of its flags were false alarms, and a 100 KB file with the same real loss would have graded clean. Same lesson as `fonts.test.ts` on 08-17: **a scanner is worth exactly what it actually matches.**

### ✅ UNBLOCKED AND DEPLOYED 2026-08-19 — `ADMIN_SECRET` is live in production

**Matt set `ADMIN_SECRET` in Vercel (Production) and in local `.env`; `146c943..2b94ac0` pushed; production deploy ● Ready in 17s; CI green in 50s.**

**Verified, not inferred** — the distinction that got the 400-vs-503 wrong yesterday. `GET /api/admin/health` on the production deployment answers **`401 Unauthorized`**, carrying `Access-Control-Allow-Origin: *` and `X-Powered-By: Express`, so it is our app replying. **401 rather than 503 is the whole proof**: 503 is what `requireAdminSecret` returns when the variable is absent, so a 401 means the variable reached the function runtime and the gate is live under its new name.

⚠️ **PREVIEW STILL HAS NO `ADMIN_SECRET`.** Confirmed against the preview scope directly (`vercel env ls preview` lists nothing). Production is correct; **preview deployments will answer 503 on every admin write**, where before this deploy they answered 200 because the PATCH routes were ungated. That is a real regression **on preview only**, and one command closes it:

```powershell
$s = (Get-Content .env | Where-Object { $_ -like 'ADMIN_SECRET=*' }) -replace '^ADMIN_SECRET=',''
$s | vercel env add ADMIN_SECRET preview
```

⚠️ **NON-GET REQUESTS TO PRODUCTION COULD NOT BE VERIFIED FROM HERE, and a false alarm was raised and withdrawn.** `vercel curl -X POST/PATCH` returned `404 X-Vercel-Error: NOT_FOUND` and then, on a re-run of the identical request, `400` — flapping between two answers, and **carrying neither the Express nor the CORS headers that every genuine response from this app carries.** They are not coming from the application. *This was briefly written up as "Vercel is not routing non-GET methods", which would have been a serious production defect; it was not evidence of anything and is retracted.* **What is true is narrower: the write path on production is UNVERIFIED, not broken** — and asserting either way without a measurement is the exact mistake this file recorded yesterday.

> **The honest way to close it is the demo criterion itself, and it needs Matt's browser.** Production sits behind Deployment Protection, so a fresh automated Chrome hits the protection page rather than the app; Matt's browser already holds the session. **Open `https://tenderfoot-tau.vercel.app/admin`, enter the secret once when prompted, click Check on SAM.gov.** All seven eligible production rows currently read `unknown` with no timestamp — nothing has ever probed production — so a successful Check is unmistakable.
>
> ⚠️ **Do not click Run first.** Production's `SAM.gov` has `last_run_at = NULL` and `since_default = 'P7D'`, so the first Run derives a **seven-day** window. Twelve hours returned 1,724 rows in 43s on the test branch. It is designed to checkpoint rather than die, but it is a large ingest, not a list refresh.

### ✅ WAS BLOCKED ON MATT — one environment variable; RESOLVED 2026-08-27, see §1

**`146c943` and the rename that follows it are COMMITTED AND NOT PUSHED, deliberately.** Pushing deploys, and deploying this before the variable exists would take the Enable toggle and the Firm Profile editor on production **from working to 503**.

**`vercel env ls` shows the secret has NEVER been set in ANY Vercel environment** — not production, not preview, not development. Two things follow, and the first corrects the record:

1. **Every `/api/admin/*` route has answered 503 on production since the day it shipped.** Check and Run have never worked there, and the `since=P7D` defect was never even reached — `requireAdminSecret` refuses before the handler runs. *STATUS asserted a 400 for several hours; that 400 was measured on a laptop and asserted about production.*
2. **The two PATCH routes are the only admin writes that DO work in production today** — precisely because they are the ungated ones. Gating them without the variable in place turns a working control into a 503.

**✅ RULED 2026-08-19: rename to `ADMIN_SECRET`, no fallback.** The variable now gates every admin write, not just scraping, and renaming cost nothing *today* because there was no value in any environment to migrate — a week of it being set would have made this a migration instead of a find-and-replace. **A `??` fallback was declined on purpose:** it would make the push order-independent and then be a second name nobody removes.

> ### What Matt does, and it is three lines
>
> **1.** Set **`ADMIN_SECRET`** in Vercel for **Production** and **Preview** — dashboard (*Settings → Environment Variables*) or `vercel env add ADMIN_SECRET production`. Any long random string. **Keep a copy**: it is what gets typed into the browser tab when Check or Run is clicked.
> **2.** Add the same line to local `.env`, so `npm run dev` stops needing a hand-exported variable.
> **3.** Tell Claude, who pushes — and then **verifies by calling `/api/admin/health` with the header rather than inferring from the bundle**, which is the mistake that produced the wrong 400 above.
>
> ⚠️ **Order is load-bearing, because there is no fallback: variable first, push second.** Reversed, every admin write answers 503 until the variable appears.

### ~~⏭ START HERE — one ruling left on SP4~~ ✅ RULED AND DESIGNED 2026-08-28 — *superseded 2026-08-29; the live START HERE is above*

**The runtime question is answered by measurement; what is left is a dependency decision.** The recommendation on file is **Node throughout** — `mammoth` and `unpdf` are settled for the two formats that carry the scope of work — **with the spreadsheet dependency chosen deliberately instead of inherited:**

~~**Pin SheetJS from `cdn.sheetjs.com`, or accept a package with unfixable published advisories in a public repo, or run spreadsheets through a Python sidecar.**~~ ✅ **RULED 2026-08-28: pinned from `cdn.sheetjs.com`.**

✅ **Both of the spike’s other open questions are also closed, 2026-08-28.** **Whether the original document must be kept at all: NO** — a citation quotes the extracted passage rather than opening the original, which removes document storage and the blob-provider decision from SP4 entirely. **Formatting fidelity** is answered for the two formats that carry the scope of work (`.docx` tables survive `convertToHtml` completely; `.pdf` has no table structure to preserve) and is now a build requirement rather than an open question. See the SP4 design spec.



*(The section below is the previous START HERE, kept for its file list.)* ~~**The two fixes above are in the working tree and NOT committed.**~~ ✅ **Committed and pushed 2026-08-18** (`bbd051b`, `b04684e`, `53f8e8a`), CI green, production deployed — see above. **The next work is the extraction spike ruled below: parse all 110 `corpus/` files with Node libraries and report what breaks.** Original note follows for the file list. Gate is green on them: **292 tests / 43 files**, `npm run check` exit 0. Files touched: `app/server/src/scrape/window.ts` + `window.test.ts` (both new), `app/server/src/health/check.ts` + `check.test.ts`, `app/server/src/routes/admin.ts` + `admin.test.ts`, `app/client/src/admin/Admin.tsx` + `Admin.test.tsx`.

**⚠️ CORRECTED 2026-08-18: production DOES have 006 and 007, and this entry said the opposite for several hours.** Checked directly against production rather than inherited from the previous entry: both columns exist, the backfill has run (**7 `unknown` / 6 `excluded`**), and `schema_migrations` stamps both at **2026-08-18 20:18:19 UTC** — applied by the production deploy that followed pushing `main` after the SP3.6 merge, since `npm run build` runs `migrate:deploy`. *The claim was true when first written, on 08-17, and was carried forward twice without being re-checked. A fact about production has to be re-read from production, not from the last thing that said it.*

**What that changes: production has been serving the BROKEN buttons.** The deploy that applied the migrations also shipped the SP3.6 client, so production's `/admin` has offered a Run control that cannot work. ⚠️ **CORRECTED LATER THE SAME DAY — it does not answer 400, it answers 503, and the reason matters:** `vercel env ls` shows **`ADMIN_SCRAPE_SECRET` has never been set in ANY Vercel environment** — not production, not preview, not development. `requireAdminSecret` runs before the handler, so **every `/api/admin/*` route has answered 503 on production since the day it shipped**, and the `since=P7D` defect was never even reached there. *The 400 was measured on a laptop and asserted about production. Two different failures, and only the local one was ever observed.* **The fix is committed and not yet pushed**, so the live defect is real until it is. Production health is still `unknown` on all seven eligible rows — nothing has probed it, which is correct: health is only measured when an operator asks.

⚠️ **`docs/admin-deviations.md` D5 still says the click calls `?source=<name>&since=<window>`, and the `since` half is now wrong** — the client sends no window. One-line edit, not yet made.

### Then, in rough priority

1. **Push `main`** — ✅ done 2026-08-18, see the header. Then decide on the five old slice branches: `sp0-infrastructure`, `sp1-entity-graph`, `sp1.5-postgres-port`, `sp2-design-system`, `sp3-federal-ingestion` are all merged and never deleted, and deleting `sp3-federal-ingestion` also settles the Neon preview-branch cleanup question open since 08-15.
2. **`corpus.test.ts` — ✅ MOSTLY FIXED 2026-08-17 (`2cac516`), and read the caveat before closing it.**
   - **What was actually wrong** (this entry twice said something false before landing here): not a parallel-load flake, and not vitest's 5s default. `loadCorpus` held **ONE transaction open for ~73s** doing 201 rows × ~4 awaited round trips to a remote Neon branch — and **~400 of those ~800 trips were organisation lookups for 79 distinct organisations**, the same buyer re-resolved on every row that named it.
   - **Fixed by batching**, the third instance of this exact fix here: `import` 12 → 1,038 rows/sec, `merge` 3m36s → 4.07s, and now **`loadCorpus` ~73s → 1.17s (~62×)**. `corpus.test.ts` **81.7s → 3.44s**; the whole gate **~154s → 94s**.
   - **Proved identical, not assumed.** Production still holds exactly what the old loader wrote. Loading fresh into a throwaway schema and diffing **every column of all 201 rows** against it — including `codes::jsonb` and the sighting `raw::jsonb` — gives **0 rows missing, 0 extra, 0 differing**. The eight-test suite could not have shown that; it asserts eight properties, the diff asserts every field.
   - ⚠️ **NOT fully closed, and do not let the green fool you.** Two things caused the failures. The transaction is fixed; **`resetSchema()`'s `DROP SCHEMA … CASCADE` taking 48.3s in COLLECTION (vs 0.9s on a passing run) is untouched.** Much less likely to bite now the file's own work is 3.4s, but *less likely* is not *fixed*. **The honest test is whether it recurs.**
   - **Why CI never saw any of it, and it is not luck.** `runSuffix()` is `GITHUB_RUN_ID ?? "local"`. CI gets a **fresh, never-before-used** schema name every run and drops it at the end (`npm run test:clean`, `if: always()`), so its `DROP SCHEMA IF EXISTS` is a no-op on a name that never existed. Locally the suffix is the constant `"local"`, so `test_corpus_local` **persists populated between runs** and every local gate pays to drop it. **CI green is not evidence this is fixed, and never was.**
   - **Cheap mitigation if it does recur:** `npm run test:clean` before a local gate. It only **moves** the drop out of vitest's collection phase; it does not make it cheaper.
3. **Auth in V1 — still open, and now half-answered rather than fully open.** `/admin` is a real product route. Check and Run sit behind `requireAdminSecret` as of SP3.6, but `PATCH /api/sources/:id` (the Enable toggle) does not — the design spec calls the secret itself "a shared bearer secret typed into a browser tab, not authentication" (§7), so even the two gated controls are a compromise, not a solution. ~~Production is gated only by Vercel Deployment Protection.~~ **FALSE, corrected 2026-08-19: there was no Deployment Protection at all** — see the correction in §5 of the pinned block. As of 2026-08-28 the open read surface is a RULING rather than an accident, and writes are gated by `requireAdminSecret` alone.
4. **`Region A.2 : Status Bar` — still unbuilt.** A3 flagged it as likely unbuildable on its own terms: it is a shell region, and A1 makes the shell a hard dependency of the views it contains. SP3.6 gave the registry a health column instead; the status bar does not exist yet and nothing in SP3.6 changes that.
5. **SP4** — ✅ **BOTH RULED 2026-08-18.** **Blob provider: Vercel Blob** (platform-native, one vendor, one credential, private storage supported). **Extraction runtime: MEASURE FIRST, then rule** — see the ruling below. SP4 is no longer decision-blocked; it is spike-blocked, which is work rather than waiting.

### Two decisions still on Matt

✅ **ALL THREE RULED 2026-08-18.** See *Ruled 2026-08-18* below — extraction runtime (measure first), blob provider (Vercel Blob), and `THOUGHTS.md` (filed as parked backlog).

> ## 🚨 SP3 HAS NOW RUN AGAINST A LIVE SOURCE — and the first run was scraping the wrong 5.5 million records
>
> **2026-08-16. `sam.ts` carried `is_active=false`, which does not mean *"do not filter on active"*. It means INACTIVE ONLY.** Varying that one parameter and holding every other constant:
>
> | `is_active` | total matching | active in sample |
> |---|---|---|
> | `false` | **5,538,794** | 0 / 100 |
> | `true` | **49,225** | 100 / 100 |
> | omitted | 5,588,019 | 99 / 100 |
>
> **The first live run returned 307 notices: none active, 274 already past their response deadline.** It reported `done: true`, 307 rows, zero undated, no livelock. **Nothing failed.** A working scraper pointed at the archive is indistinguishable from a working scraper, and every signal the run produces says success.
>
> **Root cause is inheritance, not a typo.** The URL was taken wholesale from `corpus/calibration/pull-naics.py`, where `is_active=false` is **correct** — that script builds a *historical backtest corpus*. The right parameter for the opposite job. `is_active` was never in the registry's `verified_facets` either: it was carried across, never characterised.
>
> **Fixed to `is_active=true` and pinned by a test**, because the defect is invisible in every signal except the URL itself. Same window re-run: **530 notices, 530 active, 519 with future deadlines, 3 past, 8 absent.** The inversion is the proof. `verified_facets` on the `SAM.gov` row now records the finding.
>
> ⚠️ **Already-awarded notices still arrive under `true`** — `corpus/manifest.md:193` measured 3 of 15. **Not a second bug:** V1 returns everything an active source returns and does not filter (spec §1.1).
>
> ### Production holds real federal data now
>
> **788 solicitations, 788 sightings, zero unlinked, zero duplicate external_ids** — up from 201/201 corpus rows. Two `SAM.gov` ingest runs: **530 rows** (2026-08-16, one day) and **57 rows** (2026-08-15, the day before). **`SAM.gov` is `enabled = true` in production**; the other twelve rows are still off.
>
> ⚠️ **Daily volume is not steady: 530 one day, 57 the next.** Two observations, so the pattern is unestablished — but any capacity or Interested-per-hundred figure taken from a single day's window is standing on one number.
>
> **Nothing from the bad run reached production.** The 307-row artifact was discarded on Matt's ruling before any import.

> ## 🚨 SECOND THING TO KNOW ON RESUME — SP3 AND SP3.5 ARE BUILT
>
> **The whole ingestion pipeline exists and runs end to end:** scrape → SQLite transport artifact → import as sightings → merge into canonical solicitations → per-source yield. Eleven tasks, executed with a fresh implementer and reviewer per task.
>
> **Four operator commands, all working:**
> ```
> npm run scrape -- --source sam --since 2026-08-01 --depth listing
> npm run import -- runs/<artifact>.db
> npm run merge
> POST /api/admin/scrape          (requires X-Admin-Secret)
> ```
>
> ⚠️ **A source must be enabled before it will scrape** — the scraper refuses a disabled source *before* fetching, which is the fail-closed posture the spec always demanded and nothing had implemented. **`SAM.gov` was flipped on in production 2026-08-16 and stays on; the other twelve rows are still `enabled = false`.**
>
> ⚠️ **`ADMIN_SCRAPE_SECRET` must be set** or `/api/admin/scrape` returns 503. Unset fails closed by design.
>
> **Import is no longer the slow step — 2026-08-16.** `npm run import` batches its sightings into one `UNNEST` statement: **1,038 rows/sec measured**, up from 12. Proven on the first real artifact: **530 rows imported in 5.7s end to end**, where the old path would have spent ~44s on inserts alone.
>
> ✅ **`npm run merge` was the slow step and is not any more — fixed 2026-08-16, hours after it was measured.** It was **3m36s for 530 solicitations (~2.4/sec)**; the same command now runs in **4.07s**. Three set-based statements in one transaction, where there had been a transaction per group.
>
> **The waste was worse than "one trip per group."** The grouping query returns *every external_id ever seen*, and the old loop opened a transaction for each — including fully-merged groups whose link UPDATE then matched nothing. **Cost tracked the whole corpus on every run, not the new batch**, so a merge got slower forever even on a quiet day. Proven by the 57-row window that followed: the old shape would have spent ~4 minutes on 788 groups to do 57 rows of work; the new one spent 4 seconds.
>
> **Two things the reviews caught that would otherwise have shipped:** the branch could not complete a single real lifecycle (adapter keys `sam`/`usaspending` never matched the seeded names `SAM.gov`/`USASpending`), and resume could livelock forever on SAM's second-precision timestamp ties. Both fixed; the second is *detected and reported*, not solved — see below.
>
> **Design:** `specs/2026-08-15-ingestion-scaffolding-design.md`. **Plan:** `plans/2026-08-15-b3-ingestion.md`.

> **Also done 2026-08-15.** ✅ **Per-preview branching is DONE and PROVEN.** It took two changes, not one: the dialog toggle **and** `vercel git connect` — the toggle alone was inert. `Rapideo/tenderfoot` is now connected, and a real Git preview deployment left production's `last_ping` untouched while writing to its own Neon branch. **The same test three hours earlier, on a CLI deploy, moved production.** Full trace in workflow spec §8, including two of §8's six steps that were wrong.
>
> ⚠️ **The one edge that is still live: `vercel deploy` from a laptop.** No Git branch to key on means no database branch, so a CLI preview still writes to production. **The fast path is the unsafe one** — push a branch instead.
>
> ✅ **Production is healthy again, and it fixed itself.** It had sat in `● Error` for two days (3s, `/api/health` 404). The first Git-triggered production deploy replaced it: `● Ready` in 23s, serving `{"ok":true}` with migrations 001–004. **Never diagnosed** — connecting Git resolved it as a side effect, so if it recurs there is no root cause on file. Note it answers **302** publicly: Deployment Protection is on for production as well as previews, so it is reachable through `vercel curl`, not a browser.
>
> ⚠️ **NEW watch item — preview Neon branches do not appear to clean themselves up.** `preview/verify-preview-branching` **still existed roughly ten minutes after its Git branch was deleted**, and was removed by hand. Whether cleanup is merely delayed, or tied to deleting the *deployment* rather than the branch, is **not established** — one observation, ten minutes, one branch. **If it never fires, every PR leaves a database branch behind**, which is a slow storage-and-compute leak rather than a visible failure.

> **REFINED 2026-08-16, and the news is good.** Preview branches are **per GIT BRANCH, not per deployment**: three preview deployments of `sp3-federal-ingestion` produced **one** branch, `preview/sp3-federal-ingestion`, created at the first push and merely *updated* on each later one. **Worst case is therefore one stray database branch per PR, not one per push.** Whether it self-cleans is still unestablished — `sp3-federal-ingestion` has not been deleted, so nothing has been asked of it. **Delete that branch and watch: that is the whole experiment.**

**🟢 The repo is public and pushed — 2026-08-15.** `Rapideo/tenderfoot` created, `main` and `sp2-design-system` both pushed, `origin` tracking. **`gh repo create` was not blocked after all** — the earlier classifier refusal did not recur, and `gh` was already authenticated as `Rapideo`. Verified before pushing: `.env` and `.env.local` are gitignored and were never tracked, only `.env.example` ships. **Matt chose to publish the live infra identifiers and the credential-incident write-up as-is**, having been asked specifically about both.

**✅ CI ran for the first time ever, failed, and is now green.** The first run failed on **the harmless one of the two predicted causes** — `DATABASE_URL_TEST` missing as an Actions secret. **The other predicted cause did not exist:** 16 of 20 files ran on Linux and all 55 of their tests passed, so there is no Windows-vs-Linux path problem. Matt ruled that Claude set the secret; it was piped from `.env` into `gh secret set` **without the value ever entering the transcript**, and both runs were re-run green at **92 tests / 20 files** — matching local exactly.

> **The residual risk that came with that ruling, stated plainly:** a live Neon `test` credential now sits in a **public** repo's secret store. It is not readable back and is withheld from fork PRs, but **anyone with write access can exfiltrate it via a workflow.** The blast radius is the `test` branch only — not `main` — and that branch is already the one whose rotation is asserted rather than proved.

### Matt — four, and the first one gates Claude

**1. ~~🟡 NEW — the ingestion scaffolding brainstorm~~ ✅ DONE 2026-08-15.** Nine decisions, specced and committed. **The headline: SQLite is the transport artifact, not the database** — scraping splits from the app, a scrape emits a `.db` file, an importer loads it into Postgres, which stays the only system of record. **Two of this row's earlier claims were wrong:** Proposal 3 did not dissolve (it fell out of checkpoint-and-resume, since the resume marker and *`since` = last successful run* are the same mechanism), and Proposal 1's config file was dropped entirely because the `source` table already *is* the registry, `since_default` included. **The brainstorm also produced a new slice, SP3.5**, for the merge step that had been hiding inside SP3's demo criterion.

**2. ~~🟡 §6.4 A3: does source health move in front of the GO gate?~~ ✅ RULED YES 2026-08-16 — it moves.** A read-only liveness surface lands BEFORE SP6, not alarms, and not in SP7. **The volume data sharpened the case the same day it was ruled:** SAM returned 530 open notices one day and 57 the next, and nothing in the sequence could have told that swing apart from a source that had quietly died. ⚠️ **This is a slice-boundary change and `docs/Tenderfoot-Plan-of-Action.md` §6 does NOT yet reflect it** — the sequence doc still puts health in SP7. Recording the ruling here is not the same as re-sequencing; that edit is outstanding. *Original framing:*  `Region A.2 : Status Bar` rules `Pri 4` — higher than the shell that contains it — and §6 currently puts health in SP7, *after* SP6. **The tension is whether the gate's number means anything:** SP6 measures volume and Interested-per-hundred, known risks record four silent-failure instances across three platforms, and nothing in the sequence would distinguish a quiet market from a dead source. Proposed: a read-only liveness surface before SP6, not alarms. **A slice-boundary change, so it is Matt's.** If declined, SP6 must name how source liveness gets verified instead. **✅ NOW BUILT, 2026-08-18 (SP3.6, branch `sp3.6-source-health`, not yet merged).** The liveness surface exists — migration 006, the probe subsystem, Check and Run on `/admin` — but `Region A.2 : Status Bar` from the original framing above is still not built; A3 named it likely unbuildable on its own (a shell region, and the shell is a hard SP-ordering dependency), and SP3.6 put health on the registry column instead of waiting on it. The `docs/Tenderfoot-Plan-of-Action.md` §6 re-sequencing edit is still outstanding.

**3. ~~Two SP4 decisions~~ ✅ RULED 2026-08-18.** Blob provider is **Vercel Blob**. Extraction runtime is **not ruled by argument — it is to be measured first**, because the corpus that would settle it has been on disk the whole time. See below.

**4. `THOUGHTS.md`** — whether the two live ideas become real backlog items.

### ✅ Ruled 2026-08-15 — where long ingestion runs

**Ingestion runs on Vercel, invoked by hand, with the operator setting the scope of each run — which sources, how deep.** It does not pick one of the three options; it removes the constraint that made them necessary. Scope becomes an input rather than a constant, so a run fits the 300-second ceiling by construction and nothing has to survive an invocation boundary.

> **What it defers, loudly, to SP7.** Unattended ingestion does not exist. **Nothing scrapes unless a human asks it to**, the 8,000-record register cannot be taken in one action, and no source stays current on its own. **Vercel Cron is not exercised in V1** — the platform can still do it, so the closed-laptop risk stays retired, but SP3 does not use it and SP7 must.
>
> Recorded in workflow spec §9.6. **B3 for SP3 is unblocked.**

### ✅ Ruled 2026-08-18 — the two SP4 decisions, and THOUGHTS.md

**1. Extraction runtime — MEASURE FIRST, then rule.** Not Node, not a Python sidecar, not smart mode: **none of the three, yet.** The whole argument for "Node is the weakest major runtime for this" is inherited from `Stack-Requirements.md` and **has never been tested against a single file**. It does not need to be argued, because the evidence is already on disk and always has been — `corpus/` holds **110 real files: 52 `.docx`, 20 `.pdf`, 11 `.xlsx`, 9 `.zip`, 3 `.xls`, 1 `.pptx`, 76 MB.** Every format the decision is about.

> **The spike:** run Node parsers over all 110, and report per file what was extracted, what failed, and how badly — nested `.zip` included. **Then** rule, with a measured failure rate rather than a reputation.
>
> **Why this is the project's own method and not a dodge.** `is_active=false` aimed the entire SAM adapter at a five-million-record archive and every signal said success; it was caught by running it, not by reviewing it. The registry's `verified_facets` exists because *"an adapter must not trust a parameter it did not verify."* **The same rule applied to a runtime choice: do not trust a parsing reputation nobody has verified.** §8.4 makes it sharper — with no scores in V1, extraction accuracy is the only thing the system can be right or wrong about, so it is the last place to accept an inherited assumption.
>
> ⚠️ **What the spike must not do is quietly become the decision.** If Node clears the corpus, that rules Node in for *these* files, not for every future bundle — the corpus is federal and Indiana, and `.pptx` is a sample of exactly one.

**2. Blob provider — Vercel Blob.** Platform-native: one vendor, one credential, no second account, and private storage is supported. ⚠️ **Not yet provisioned, and deliberately not** — nothing needs it until SP4 actually persists a document, and it stays unprovisioned until then. **The prior question is still open and is a design question, not a vendor one:** SP3.6's Run proved the artifact-in-request pattern (fetch, parse, write fields, discard the binary), so *whether the original document must be kept at all* — for citation, for provenance, for re-display — has never actually been asked. Vercel Blob is the answer to "which provider", if and when the answer to "do we keep it" is yes.

**3. `THOUGHTS.md` — filed as parked backlog.** All four ideas move into the backlog carrying a **PARKED** marker, the convention Q2 established for SVRC nodes: recorded so they cannot be lost, **nothing designed, nothing sequenced, explicitly out of V1.** Three of the four (extra research after a good bid; levels of research and qualifying against them; analysis over 20+ years of historical data) are **the parked matching engine wearing different hats** — SP5's removal note already says qualification "is undesigned and will be re-imagined after ingestion runs", and that still holds. The fourth (a NotebookLM-style chat over responding) is a different animal and is parked on its own terms.

### Claude — next session, in this order

1. ~~**B3 for SP3**~~ ✅ **WRITTEN AND EXECUTED 2026-08-15.** `plans/2026-08-15-b3-ingestion.md`, 11 tasks across SP3 and SP3.5, all built and reviewed. Both spec open items were resolved inside it: `ingested_through` **joins** `last_run_at` rather than redefining it, and adapters **must not trust a parameter they did not verify** — which mattered immediately, since `corpus/calibration/pull-naics.py` already records SAM silently ignoring a sort parameter.

**NEXT: `SP1 T12–T15` — the admin UI, and it is fidelity work, not design work.** `View 6.2 : Source Registry` is one of only two `Pri 5` nodes in the whole product (the other is `View 1.1`, the triage queue); the SVRC calls it *"V1's entire control surface — switching a source on or off is the only lever there is"*; and **the frozen V1.2 prototype already renders it**, including GovWin as `EXCLUDED` with legal posture as a column. `StatusDot` was corrected at the SP2 gate to carry that screen's exact four-state vocabulary. So it is matched against the bundle the way SP2's primitives were, with an audit at the end — **not brainstormed**. It is also where §9.6 ruled the scrape trigger lives, and it would be the **first composed screen**, which is what makes the two remaining SP6 preconditions decidable at all.
2. ~~⏸ **Per-preview DB branching**~~ ✅ **DONE AND PROVEN 2026-08-15.** Took two changes, not one — the dialog toggle was inert until `vercel git connect` linked `Rapideo/tenderfoot`. A real Git preview deployment then left production's `last_ping` untouched while writing to its own branch; the identical test on a CLI deploy hours earlier had moved production. **Residual: CLI deploys are still branchless and still hit production.** Workflow spec §8 carries the trace and two corrections to its own steps.
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
| **SP1** | Entity graph — real solicitations into the real schema | ✅ **T1–T11 merged; T12–T15 BUILT 2026-08-16** on `sp1-admin-ui`. T12's re-extraction found the dataset had **not** moved (five ids, five titles, every field identical to V1.2) — the real gap ran the other way: the 2026-08-10 extraction took the opportunity dataset and **left `sources[]`, `profile[]` and `yields[]` behind entirely**, which is why nothing noticed until a screen needed them. T13 found §4 and the prototype **agree**, including on a deferral neither knew the other had written. `/admin` is the **first composed screen** |
| **SP1.5** | **Postgres port + first deploy** — Neon, Vercel | ✅ **merged to `main`** 2026-08-13. 23 commits, 37/37 tests, gate 5/5 green. **Preview live serving 201 solicitations.** Task 15 (per-preview DB branching) ✅ **CLOSED 2026-08-15** — needed the dialog toggle *and* a Git connection; proven with a real Git preview deployment. Workflow spec §8 |
| **SP2** | Design system — every primitive on a dev route. **Sign-off gate** | ✅ **SIGNED OFF 2026-08-14.** Branch `sp2-design-system`, **sixteen primitives** on `/dev/gallery`, gate green (**92 tests / 20 files**) after the three sign-off fixes. ✅ **MERGED to `main`** — corrected 2026-08-15: this row read *"clear to merge — not yet merged"* for a day after the merge had actually happened. `git branch --merged main` lists `sp2-design-system` with nothing outstanding. **Seventeen primitives now**, not sixteen — `Section` was added 2026-08-15 |
| **SP3** | Federal ingestion — SAM.gov + USASpending, landing **sightings** | ✅ **MERGED to `main` 2026-08-16** (`6a8cf67`), built 2026-08-15. Tasks 1–9: run contract, adapter framework, SQLite transport artifact, checkpointing scrape loop, CLI, migration 005 + importer + import CLI, SAM.gov adapter, USASpending adapter, `POST /api/admin/scrape`. **Both adapters characterised against live APIs, not written from memory** — ⚠️ **and that was still not enough:** the characterisation covered the parameters somebody thought to vary, and `is_active` was inherited unexamined from a corpus script, aiming the whole adapter at the archive. Caught 2026-08-16 by the **first live end-to-end run**, not by review or tests. Hand-invoked and operator-scoped per §9.6. ✅ **RUN LIVE AGAINST SAM.gov 2026-08-16** — 530 open notices scraped, imported and merged into production |
| **SP3.5** | **Merge — sightings into canonical records** *(added 2026-08-15)* | ✅ **MERGED to `main` 2026-08-16** (`6a8cf67`), built 2026-08-15. Tasks 10–11: `mergeSightings()` and honest `perSourceYield()`, plus `npm run merge`. `2G` split — schema shipped in SP1, merge logic is this. **Demo criterion met, but see the caveat:** cross-source dedup is exercised only by a synthetic fixture, because SAM and USASpending do not share an ID namespace. Plan §6.5. **Rewritten set-based 2026-08-16** — 3m36s → 4.07s; the per-group transaction had made cost track the whole corpus rather than the new batch |
| **SP3.6** | **Source health + the run trigger** *(added 2026-08-16, A3's ruling)* | ✅ **MERGED to `main` 2026-08-18** (`a110e93`, `--no-ff`), built the same day. **✅ DEMO CRITERION NOW FULLY RUN — and the browser half found two defects the server half could not: `Run` had never worked in any browser (it sent the `since_default` DURATION where the route requires a DATE, 400 every time), and `Check` was silently inert on the two rows with no probe target. Both fixed 2026-08-18; gate 292 tests / 43 files.** *(This row read ◐ BUILT … NOT YET MERGED, demo criterion NOT YET RUN for the part of 08-18 between the two, which was accurate then and is superseded here.)* Thirteen tasks implemented, twelve reviewed at the time of writing (the paperwork task, this one, under review): migration 006 (`source_health_valid` CHECK — `ok`/`failing`/`rot`/`excluded`/`unknown` — plus `health_checked_at`/`health_method`/`health_note`/`probe_url`), eligibility rules (posture governs contact, not `enabled`), a platform-keyed probe registry (real SAM/USASpending probes, `genericUrlProbe` fallback, hard 10s timeout, `allSettled`), the orchestrator (`checkSources`), `POST /api/admin/health` and `POST /api/admin/run` (scrape → import → merge in one request, artifact alive only inside it), the screen's Check and Run controls, and the `app/shared` type reconciliation (`SourceHealth`/`SourceRow.health` narrowed to the real DB enum — surfaced no defect, since Task 11 had already fixed the one client consumer). Gate **263 tests / 42 files**, `npm run check` exit 0. Design: `docs/superpowers/specs/2026-08-17-source-health-design.md`. Plan: `docs/superpowers/plans/2026-08-18-sp3.6-source-health.md`. **Two things deliberately left alone:** `PATCH /api/sources/:id` is still unauthenticated (only Check/Run gained `requireAdminSecret`), and `Region A.2 : Status Bar` is still unbuilt (a shell region; A1 makes the shell a hard dependency). **⚠️ Demo criterion (design spec §10) is outstanding — built-and-gate-green is not the same claim as demoed** |
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

> **Revised 2026-08-15 — "precondition" was the wrong word for two of the three, and it misled a session into trying to start them.** Only the section primitive was work that could precede SP6, and it is now done. **The other two are gated on SP6 *existing*:** each names a trigger — a composed screen, a decision bar — that SP6 is the slice that creates. They are **first moves inside SP6**, not a queue to clear before it. Attempting either early means inventing a spacing scale, or a button variant, from a single instance, which is the exact thing the 3× recurrence bar and the "extract on the second consumer" rule exist to prevent.

| | Why it waits for SP6 |
|---|---|
| ~~**A "recessed section" primitive**~~ ✅ **DONE 2026-08-15 — `Section`** | The bundle's `COST TO PURSUE` panel sits in a `--surface3` recessed wrapper no primitive expressed, so the gallery drew it on plain white. Colour difference is near-imperceptible — **the real gap was the missing primitive, not the colour**, and that is what got built. `--ground-recess-1` had **zero consumers** before this; it has one now |
| **Spacing + shadow token layers** | Extract when a composed screen shows which values are systematic. **Still zero composed screens; `Card`'s shadow still has one consumer.** `Section`'s `20px 30px 24px` is the first section-level spacing value and will be part of what the extraction pass collects — one consumer, so it does not trigger it |
| **`Button` danger-primary** | A destructive confirm; decide the affordance when the decision bar exists. **Still no consumer, still below the 3× bar** |

## Infrastructure — live, re-read from the account 2026-08-14

| | |
|---|---|
| Vercel | project `tenderfoot`, team `koehler-partners`, beside `kp-web` |
| Neon | project `wispy-tooth-06225229`, named **`tenderfoot-db`** since 2026-08-14, org `Vercel: Koehler Partners`, beside `kp-web-prod`. Postgres 17, `aws-us-east-1` |
| Billing | **`launch_v3` (Launch), subscription** — same org and bill as the website |
| `DATABASE_URL` | pooled endpoint, injected by the integration into all three environments |
| Compute — existing | ✅ **resized 0.25 → 8 CU on both computes 2026-08-13**, verified by reading back. The `test` compute had been the tighter of the two at 0.25→0.25 |
| Compute — **default** | ✅ **set to `0.25 → 8` CU 2026-08-14**, read back on the settings page. Governs computes that do **not exist yet** — new branches are now born right. Neon's own dialog states the §2.17 hazard verbatim: *"Modifying these defaults does not alter the settings of any existing computes"* |
| Branches | `main` (`br-super-breeze-aun4swjv`) · `test` (`br-delicate-leaf-auwo0czn`). **Role passwords are per branch** — **both rotated 2026-08-14**. **From 2026-08-15 a third kind appears and disappears on its own:** `preview/<git-branch>`, created by Vercel per Git preview deployment, `creation_source: "vercel"`, parented on `main` |
| ✅ **Git** | **`Rapideo/tenderfoot` connected to the Vercel project 2026-08-15** via `vercel git connect` — the CLI does this, though the branching toggle beside it is dashboard-only. **Pushes now deploy: a branch push builds a preview, a push to `main` builds production.** PR comments, `deployment_status` and `repository_dispatch` events all on by default |
| ✅ **Rename** | **`neon-lime-button` → `tenderfoot-db`, done 2026-08-14 from the VERCEL dashboard.** The Neon console refuses it outright — `action restricted; reason:"organization is managed by Vercel"`. The spec had predicted the two names were independent strings with Neon upstream; **it is the reverse** — renaming the Vercel resource renamed the Neon project, confirmed by reading it back through the MCP. Details in workflow spec §10.1 |

## Waiting on Matt

**Nothing here blocks SP0–SP2 any more.** The sign-off gate, all three open questions, and all three Neon console changes closed on 2026-08-14.

| | Blocks |
|---|---|
| ~~🔴 **The SP2 sign-off gate**~~ | ✅ **SIGNED OFF 2026-08-14.** Gallery reviewed against V1.2, no issues raised; all five rulings resolved above. **SP2 is clear to merge** |
| ~~`three_open_questions.md`~~ ✅ **ALL THREE CLOSED 2026-08-14.** Q1 `Pri` = product priority · Q2 parked nodes keep their scores and carry a `PARKED` marker · Q3 all twenty re-scored, **fourteen moved**. `Imp`/`Pri` are rulings now, not placeholders. **The §6 slice-order reconciliation is unblocked** | ~~Slice order from SP3 on~~ — now Claude's |
| ~~User stories~~ | ✅ **93 drafted 2026-08-12** — `docs/user-stories-source.html` and the published story map. Yours to edit |
| ~~**Extraction runtime** — Node / Python sidecar / smart mode~~ ✅ **Ruled 2026-08-18: measure before ruling.** A spike parses all 110 corpus files with Node libraries and reports what actually breaks | **SP4** |
| ~~🟡 **Rotate the Neon credentials**~~ | ✅ **BOTH BRANCHES DONE 2026-08-14.** `main` proved by the old string failing; `test` reset and `DATABASE_URL_TEST` re-derived, gate green. ⚠️ **`test` is asserted, not proved** — the old string was overwritten before capture, so the negative test could not run. See `Proto2PRD.md` §5.4 |
| ~~🔴 **Per-preview database branching**~~ ✅ **CLOSED 2026-08-15 — AND PROVEN, NOT ASSERTED.** Two halves, and only one was the dialog. The setting (`Require Active Resource` on, `Preview` checked, **`Production` deliberately unchecked**) did nothing on its own: a preview deploy created no Neon branch and its ping moved production's `last_ping`. The missing half was **the Git connection** — `vercel git connect`, which is **not** dashboard-only, unlike the toggle. With `Rapideo/tenderfoot` connected, the identical test on a Git preview deployment: **production `main` unchanged at `18:07:16.838Z`, the write landed on `preview/verify-preview-branching` at `21:01:14.521Z`.** Only the trigger changed, which is what isolates the cause. ⚠️ **Still live for CLI deploys:** `vercel deploy` from a laptop has no Git branch to key on, so it is still branchless and still points at production. **The safe path is a Git push; the quick path is the dangerous one** | SP2 onward |
| ~~🟡 **Set the project compute DEFAULT**~~ | ✅ **`0.25 → 8` CU, done 2026-08-14**, read back on the settings page. New branches are now born right |
| ~~◐ **A git remote**~~ | ✅ **DONE 2026-08-15 — public at `Rapideo/tenderfoot`, `main` and `sp2-design-system` pushed.** Decided 08-14, executed 08-15. **The classifier block did not recur** — Claude created it directly, `gh` already authenticated as `Rapideo`. The first push turned CI on for the first time ever and it failed on the missing test-DB secret; see the new row below |
| ~~🔴 **`DATABASE_URL_TEST` as a GitHub Actions secret**~~ | ✅ **DONE 2026-08-15 — Matt ruled Claude sets it; set from `.env`, CI green at 92/20 on both branches.** The rejected option was gating the DB tests off in CI, which would have made green-on-CI weaker than green-on-laptop. **Accepted residual: a live `test` credential is in a public repo's secret store, exfiltratable by anyone with write access.** Blast radius is the `test` branch only |
| ~~Express or framework route handlers?~~ | ✅ **Ruled 2026-08-13: Express stays.** Workflow spec §9.5 stays open on its own terms; the port did not decide it by momentum |
| ~~**Which blob provider** — Vercel Blob / S3 / R2~~ ✅ **Ruled 2026-08-18: Vercel Blob** | **SP4** |
| ~~**Where long ingestion runs**~~ | ✅ **RULED 2026-08-15 — on Vercel, invoked by hand, operator sets the scope.** Not one of the three options; it removes the constraint that made them necessary. **Unattended ingestion deferred to SP7 and does not exist before then.** Workflow spec §9.6 |
| ~~Doc storage on filesystem~~ · one-database-per-firm · auth in V1 | **Auth got sharper — it is a public URL now, not one laptop** |
| ~~🟡 **Ingestion scaffolding brainstorm**~~ ✅ **DONE 2026-08-15 — nine decisions, spec written and committed.** `specs/2026-08-15-ingestion-scaffolding-design.md`. **SQLite became the transport artifact, not the database** — the app keeps Postgres. Proposal 3 did **not** dissolve as this row previously claimed; it fell out of the over-ask answer instead, since the resume marker and *`since` = last successful run* are one mechanism. Proposal 1's config file was dropped — the `source` table already is the registry. Proposal 4 is deferred to a `mode` column that only reads `mechanical`. **Produced a new slice, SP3.5** | ~~SP3 — blocking~~ **cleared** |
| ~~🟡 **§6.4 A3: source health in front of the GO gate?**~~ | ✅ **RULED YES 2026-08-16 — source health moves in front of the GO gate.** A read-only liveness surface, not alarms. **Sharpened by measurement rather than argument:** 530 open SAM notices one day, 57 the next — a swing the sequence had no way to distinguish from a dead source. ⚠️ **`docs/Tenderfoot-Plan-of-Action.md` §6 still places health in SP7 and has not been re-sequenced.** The ruling is recorded; the sequence edit is outstanding. **✅ BUILT 2026-08-18 — SP3.6, branch `sp3.6-source-health`, gate-green, not yet merged, demo criterion not yet run.** `Region A.2 : Status Bar` remains unbuilt |
| ~~Prototype V1.2 — wordmark, mobile breakpoints~~ | ✅ **Both closed 2026-08-13.** V1.2 landed and was verified against V1.1 rather than trusted (colours 132→132, media queries 0→0, `display:flex` 74→73 — exactly the one disclosed wrapper). **The wordmark item turned out to be a deletion, not a design** — the logo already existed; only the 8px placeholder *label* was provisional. **Mobile ruled desktop-only** by measurement, not instinct; a separate mobile client is now plan of record |
| 📎 **`THOUGHTS.md`** — ✅ **tracked 2026-08-14**, committed verbatim. Four ideas from 08-11. **Two bear on open questions:** *levels of research and qualifying against that research* collides with the qualification work spec §1.1 parks as **undesigned** — note the collision, don't resolve it — and *what analysis 20+ years of historical data enables* is real against the 2,160-contract corpus (Illinois backtests to 2018). The other two are V2-shaped, past SP8. **Still to decide: promote the live two into backlog, or leave filed** | Nothing |

## Waiting on Claude

| | |
|---|---|
| ~~B3 for SP0~~ · ~~B3 for SP1.5~~ · ~~B3 for SP2~~ | ✅ written and executed. SP2's scope grew 2026-08-13 — the parked intelligence chrome is built inert, so it was never "mostly transcription" |
| ~~SP1 T12–T15~~ | ✅ **BUILT 2026-08-16.** Five deviations logged in `docs/admin-deviations.md` — ⚠️ **the frozen bundle renders both admin screens READ-ONLY**, with no toggle, no posture editor, no profile input and no scrape trigger in 700KB, so every control on this screen is invented and numbered. **D5 was the one to know then: §9.6's scrape trigger was still unhoused — ✅ housed 2026-08-18 by SP3.6, see below** |
| **B3 for SP3** | **Next, and now fully UNGATED as of 2026-08-15** — §9.6 ruled *and* the scaffolding brainstorm specced. Both questions the ruling handed the plan are answered: over-ask is **checkpoint-and-resume**, and the trigger lives on **T12–T15's admin UI**. What still lands *in* the plan: the round-trip fix, **SP3.5**, and the spec's two remaining open items |
| ~~**SP3.6 — source health + the run trigger**~~ | ✅ **BUILT 2026-08-18, gate-green on branch `sp3.6-source-health` (263 tests / 42 files) — NOT YET MERGED, demo criterion NOT YET RUN.** Thirteen tasks. D5 finally housed: `POST /api/admin/run` does scrape → import → merge in one request, artifact alive only inside it. `app/shared`'s `SourceHealth`/`SourceRow` reconciled to migration 006 (Task 13) — narrowing `health` to the real enum surfaced no defect. Left deliberately alone: `PATCH /api/sources/:id` still unauthenticated; `Region A.2 : Status Bar` still unbuilt. **Next: run the design spec §10 demo end to end, then merge** |
| ~~**A "recessed section" primitive**~~ | ✅ **BUILT 2026-08-15 as `Section`** — the one known SP2 gap, now closed as far as a primitive can close it. **Landed under a different name on purpose:** only one of D6's two section instances is recessed (the other sits on `--ground-surface` and is distinguished by a right-hand divider), so the shared property is the padding and `recessed` is one of two independent modifiers. Naming the container after a treatment half its evidence lacks is D5's `--line-dashed` error repeated. **The composition half stays open for SP6** — the existing gallery entries were deliberately not rewired |
| ~~**The ingestion round-trip fix**~~ | ✅ **DONE 2026-08-16 — `UNNEST`, and the gain was measured on both sides rather than divided into the old figure.** Like-for-like on one machine, one Neon test branch, ~500-byte realistic payloads: **12 rows/sec → 1,038 rows/sec, an 87× improvement**, statements per import N+1 → **1**. *(The old path measured 12 here, not the ~7 this row used to quote — a different day and a different network, which is exactly why both ends were re-run.)* **`UNNEST` rather than a multi-row `VALUES` list on purpose:** both collapse the round trips, only `UNNEST` collapses the bind parameters (7, whatever N is), and a seven-column `VALUES` list hits Postgres's 65535-parameter cap at **~9,362 sightings** — under every fixture, first seen on a real register. ⚠️ **This row's own framing was wrong:** the importer never ran under the 300s ceiling. Neither `routes/admin.ts` nor `scrape/cli.ts` calls `importArtifact` — import is its own CLI step, and the ceiling binds the *scrape* handler. Still a scope multiplier, just of operator wall-clock. Gate **162 / 33** |
| ~~🔴 **`merge.ts` has the same round-trip shape**~~ | ✅ **MEASURED AND FIXED 2026-08-16, within hours of each other.** **3m36s for 530 solicitations (~2.4/sec) → 4.07s.** Three set-based statements in one transaction, replacing a transaction per group. **The diagnosis changed once it was measured:** the cost was not "one trip per group" but *one transaction per group in the whole corpus*, because the grouping query returns every external_id ever seen and the loop opened a transaction for each — fully-merged groups included, whose link UPDATE matched nothing. **A merge therefore got slower forever, even on a day with nothing to do.** Verified on real data: a 57-row window that would have cost ~4 minutes against 788 groups took 4 seconds. ⚠️ **One deliberate behaviour change:** the whole merge is now ONE transaction, so a partial failure rolls everything back rather than leaving some groups committed — right for a re-runnable batch step, but not what the old shape did. **Test asserts CONSTANCY, not smallness** — 5 groups and 25 groups must issue the same statement count, which no per-group implementation can satisfy |
| ~~🟡 **every merged solicitation has `org_id = NULL`**~~ | ✅ **RULED AND FIXED 2026-08-16 — Matt ruled the merge resolves organisations.** All **788 production solicitations now carry one; zero NULL**, backfilled in **5.7s**. **197 organisations, 111 with a parent, zero cycles.** ⚠️ **The schema had already answered the design question and nobody had noticed:** `organization.parent_id` exists with the comment *"State → FSSA → Division"*, and SAM hands over a ready-made five-level chain that was being discarded. **`solicitation.org_id` anchors the DEEPEST node**, so `DLA AV RICHMOND` (303 solicitations) and `DLA LAND AND MARITIME` (175) are distinguishable — anchoring at level 1 would have read `DEPT OF DEFENSE` for 96% of a day's federal notices and told a triage queue nothing. Rolling up is always possible via `parent_id`; losing the office is not. Chain proven on real data: `DEPT OF DEFENSE → DEFENSE LOGISTICS AGENCY → DLA AVIATION → DLA AV RICHMOND` |

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
- ~~**NEW — long ingestion may not fit one function invocation.**~~ **RETIRED 2026-08-15** — the scrape loop runs against a *time budget*, commits what it has, and returns a resume marker, so the ceiling became a parameter rather than a limit. The CLI passes a generous budget, the HTTP handler one below 300s, and the same code serves both
- 🔴 **NEW 2026-08-15 — resume can livelock on timestamp ties, and it is DETECTED but NOT SOLVED.** SAM's `modifiedDate` is second-precision and bulk re-indexes tie it across many records — 3 of 5 in the captured fixture share one timestamp. Because the resume marker is inclusive, a budget too small to clear a tie block re-fetches the same prefix forever. **The build now notices this and reports `noProgress` instead of handing back a marker that promises movement it cannot deliver.** The real fix is a secondary tiebreak, which is design work. **Widen the window or raise the budget if you see the warning**
- 🟡 **NEW 2026-08-15 — cross-source `external_id` collision.** The merge groups by `external_id` alone, which assumes global uniqueness across sources. Safe for SAM's opaque `_id` and USASpending's `generated_internal_id`. **Not safe for the state portals, which emit human-assigned numbers like `"RFP-2024-001"`** — two states colliding would silently fuse unrelated opportunities, and it reads as *"2 sightings, 1 solicitation"*, i.e. corroboration rather than corruption. Documented at the top of `merge/merge.ts`. **A blocking prerequisite for onboarding the first human-ID source, not a someday item**
- **NEW — documents need a blob provider and a bill.** `document.path` now means a blob key; there is no filesystem. Thousands of bundles to 21 MB. **Blocks SP4**
- **NEW — we are on a serverless database that suspends when idle.** This is the IMPACT failure's exact shape, not an analogy. Plan limits get **measured and dated** into workflow spec §10.1, never recalled
- **Extraction is the only thing V1 can be right or wrong about**, and Node is weak at `.docx`/`.xlsx`. **The Python-sidecar option got more expensive** — on Vercel it is a second deployment target, not just a second runtime
- **FIVE silent-failure instances across three source platforms — the fifth found 2026-08-16, and it was ours.** `is_active=false` sent SAM's adapter at the 5.5M-record archive; the run reported complete, 307 rows, no errors. **The vary-one-parameter check is what caught it, run against the live API rather than the fixture** — and it caught it only because the *first live run* was treated as evidence rather than a formality. Every new adapter runs that check; **this one had, and still missed `is_active`, because the check was run on the parameters somebody thought to vary.** The registry's `verified_facets` is now the place a parameter's status is recorded, not the adapter's comment header
- 🟡 **Volume has a first measurement, and it is DLA — 2026-08-16.** One day of open SAM notices = **530**, of which **507 are Department of Defense**, titles overwhelmingly part-number micro-purchases (`53--RETAINER,SEAL`, `59--SWITCH,FLOW`). That is **~3,700/week from one source**, mostly parts orders a professional-services firm cannot bid. **The old risk was "volume is unmeasured"; it is measured now and it is loud.** Directly relevant to SP6's Interested-per-hundred: a queue that is 95% DLA parts will read as noise whatever the triage UI does. **Not a filter decision — spec §1.1 still parks qualification as undesigned** — but it is the strongest evidence yet that the GO gate needs the number before it can mean anything

---

## For a full narrative

[`docs/Tenderfoot-Project-Overview-2026-08-12.md`](docs/Tenderfoot-Project-Overview-2026-08-12.md) — 7,100 words, written to be read aloud. Where the project is, how it got here, every significant decision and why, what was found that surprised us, what is next, and what is still open. Prepared for KP leadership.

## Where things live

`STATUS.md` here · `DOOGIE - TENDERFOOT.md` session log · `docs/Tenderfoot-Plan-of-Action.md` the sequence and its reasoning · `docs/Proto2PRD.md` the reusable playbook · `docs/Proto2PRD-Lessons.md` lessons staged for it · `docs/superpowers/specs/` design + workflow specs · `docs/superpowers/plans/` implementation plans · `reference/` SVRC + component inventory · `prototype/` frozen, reference-only · `corpus/` real solicitations and contracts
