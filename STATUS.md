# Tenderfoot — status

**Updated 2026-09-03.** One screen. The reasoning lives elsewhere; this is only where things stand.

> **NOW: the project turned data-first on 2026-09-03, and the data question is answered.** HigherGov was tested against a 71-item answer key and returned **99% coverage recall**, an **Indiana solicitation archive back to 2013** where the source itself publishes none, and **sub-state coverage no adapter strategy reaches** — for $500/yr. The verdict is a buy, and the adapter backlog (Illinois, Michigan, Kentucky, Ohio, the OpenGov municipalities) is **shelved pending a reliability test**. SAM.gov stays direct and free; HigherGov's metered allowance is spent only on what we cannot get free.
>
> **`npm run fitness` now gives a verdict rather than an opinion.** The floor fails five of seven predicates against production and **blocks GO/NO-GO by rule**. ⚠️ **A live API key was leaked and rotated during this work — CLAUDE.md §5 is binding on anyone touching that API.**
>
> **The Indiana EDS contract register is loaded: 204,920 contracts, two requests, 86 seconds — and floor predicates F1 and F2 flipped to PASS.** It is the highest-scoring free source we hold and the first row the `contract` table has ever held. ⚠️ **That is the `test` branch only. Production holds zero contracts**, so the five-of-seven figure above is still production's number; loading it is a deliberate 86-second act nobody has taken. `docs/2026-09-03-eds-ingest-run.md`.
>
> **Read the RESUME HERE block below before the Plan of Action**, whose slice order no longer matches the sequence Matt set.

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
> **Also done 2026-08-18: SP3.6 — source health, built and gate-green on branch `sp3.6-source-health`.** *(This line read "NOT YET MERGED to `main`" until 2026-08-30; **it was merged the same day it was written**, `a110e93`, `--no-ff` — see the slice table. The rest of this entry is as written.)* A3's ruling (below) is now built, not just decided: `source.health` is a live "is this source reachable" value written by an operator-invoked probe, migration 006 pins it with a `source_health_valid` CHECK (`ok`/`failing`/`rot`/`excluded`/`unknown`, four new columns), and `/admin`'s Source Registry gained **Check** and **Run** controls — Run does scrape → import → merge as one request, the artifact living only inside that request so SP4's blob-provider decision stays exactly as parked as it was. Thirteen tasks implemented; twelve reviewed at the time of writing, with this one — the paperwork — under review. Gate green at **263 tests / 42 files**, `npm run check` exit 0. `app/shared`'s `SourceHealth`/`SourceRow` types were reconciled to migration 006 in the same pass (Task 13) — narrowing `health` from `string` to the real enum surfaced no defect, because the one client consumer (`Admin.tsx`) had already been fixed to the real vocabulary in Task 11. **Two things this slice deliberately left alone, on record rather than by oversight:** `PATCH /api/sources/:id` (the Enable toggle) is still unauthenticated — only Check and Run sit behind `requireAdminSecret` — and `Region A.2 : Status Bar` is still unbuilt, per A3's own note that it is a shell region and the shell is a hard dependency of the views it contains. **◐ The demo criterion (design spec §10) is HALF RUN** (✅ *the other half ran 2026-08-18 — see RESUME HERE*). Its server half was executed 2026-08-18 against a fully-migrated test database and passed: no secret → 401; unknown name → 404 (not an empty success); `GovWin IQ` → `{"checked":[]}` with no probe and no timestamp; `Kentucky eMARS VSS` (null `probe_url`) → skipped, left `unknown` and unstamped rather than `failing`; `SAM.gov` → `ok` via method `sam`; check-all returned **5** rows, not 7. Final state 5 stamped / 6 `excluded` unstamped / 2 `unknown` unstamped. **⚠️ The browser click-through was NOT done** — the Chrome extension was unavailable, so the Check and Run *buttons* have never been clicked; only the endpoints beneath them were exercised. **✅ SUPERSEDED 2026-08-18: it has since been done, and it found two defects the server half could not — `Run` had never worked in any browser, and `Check` was silently inert on two rows. See the DONE entry in RESUME HERE. The sentence above is kept because it is exactly right about what the server half was worth: it passed, and the buttons above it were still broken.** Design: `docs/superpowers/specs/2026-08-17-source-health-design.md`. Deviations: `docs/admin-deviations.md` D5 (rewritten) and new H1–H3.

---

## 📌 PINNED — LAST UPDATED 2026-08-28 — READ THIS FIRST, THEN THE RESUME BLOCK BELOW

> ⚠️ **2026-09-03: this pinned block is now SIX DAYS STALE and describes a project that has since
> changed direction. Read `RESUME HERE` first.** Nothing pinned here was invalidated, but the
> solicitation counts predate three ingests, and the whole "which sources do we scrape" frame it
> assumes was answered on 2026-09-03 by buying one instead.
>
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

## 🔖 RESUME HERE — updated 2026-09-03

## ▶️ NEXT SESSION — THE PROJECT CHANGED DIRECTION TODAY, AND THE DATA QUESTION IS ANSWERED.

**Read this before the plan of action, because the plan's slice order no longer
matches the sequence Matt set.**

### 🔄 THE REVERSAL, in Matt's words

> *"Once we have both our reliable upstreams defined, we can then flesh out the
> rest of the app with real data and analysis methods, instead of just hoping
> that the source meets our criteria."*

**Data first, screens second.** The project's recorded history is the argument
for it: every defect that mattered — the inert undo, the missing description,
the unbiddable queue, D27's four SAM-shaped layers — was found by real data
hitting a screen, and none was catchable by the tests passing at the time.

⚠️ **This does NOT relax the fidelity mandate (CLAUDE.md §1).** It means screens
get built ONCE, against data whose shape is known, rather than rebuilt when the
source turns out different.
⚠️ **And it must not become app-dark.** Ruling 3A keeps triage live because the
app is the detector.

**The sequence Matt set:** ① field mapping ✅ · ② the floor, measured ✅ ·
③ a bounded reliability test ⏸ · ④ then the corpus pulls ⏸.

---

### 🔑 HIGHERGOV IS THE ANSWER, AND IT IS A BUY

Trial key obtained and tested 2026-09-03. **~490 records of a 10,000/month
allowance spent.** Everything measured, not quoted:

| | |
|---|---|
| **Coverage recall** | **69 / 70 — 99%** against the 71-item IDOA answer key |
| **Relevance recall** | **5 / 5** on the KP-shaped subset |
| **Indiana archive** | **9,286 records back to 2013-06-19**, where IDOA publishes 71 open notices and none at all |
| **Sub-state buyers** | **34 / 100**, 33 distinct agencies — Allen County, Fort Wayne, Fishers, Zionsville, Indianapolis Airport Authority, Ivy Tech |
| Method | exact `source_id` lookup — **their `source_id` IS IDOA's 15-digit Event ID** |

**Full evidence: [`docs/2026-09-03-platform-comparison.md`](docs/2026-09-03-platform-comparison.md) §R0–R11.**
Field mapping: [`docs/2026-09-03-highergov-field-mapping.md`](docs/2026-09-03-highergov-field-mapping.md).

**🔴 A LIVE API KEY WAS LEAKED INTO A TRANSCRIPT AND ROTATED.** Revocation
**proved**, not asserted: the burned key answers `403` where a live one answers
`400`. `document_path` embeds the api_key in every response, and a `scrub()`
helper that guarded every error path printed a field *value* raw. **The three
rules that follow are in CLAUDE.md §5.3 and bind any code written against this
API.**

**⚖️ CLAUDE.md GAINED §5, AND IT IS BINDING.** Never call this API without
Matt's explicit approval — testing, verification, a quick check, all of it.
A **standing budget of 500 records** was granted 2026-09-03; inside it calls may
be made without asking each time, but every one is counted and reported.
**Consumption cannot be read from the API at all** — no quota field, no usage
endpoint, no header. The account dashboard is the only instrument.
**The meter counts records RETURNED**, proved by an isolated test: 478 → 489 on
one call returning 1 opportunity + 10 documents.

**Staged retrieval, Matt's principle:** *everything needed to REJECT a notice is
already in the listing record; documents are only needed to ACCEPT one.*
Rejection is free; acceptance costs ~11 records. **A bulk document pass is
structurally impossible** — 9,286 Indiana opportunities at 10–19 documents each
is nine to seventeen months of allowance.

---

### ⚖️ THREE RULINGS, 2026-09-03

| | Ruling | Consequence |
|---|---|---|
| **1A** | The contract corpus is **evidence toward a qualification design that does not yet exist** | Ingest proceeds. **Nothing scores, nothing filters, no control is wired.** §7.10 clause 2 intact |
| **2C** | The fitness statement carries **both floor and target** | The gap between them *is* the roadmap |
| **3A** | **Effort moves to data; triage stays live** | No new UI slices. Sample 2 keeps running as the detector |

Spec: [`docs/superpowers/specs/2026-09-03-data-fitness-and-source-rubric-design.md`](docs/superpowers/specs/2026-09-03-data-fitness-and-source-rubric-design.md).
Plan: [`docs/superpowers/plans/2026-09-03-data-fitness-and-source-rubric.md`](docs/superpowers/plans/2026-09-03-data-fitness-and-source-rubric.md).

---

### ✅ SHIPPED 2026-09-03 — gate 738 tests / 83 files, `main` == `origin/main`

**`npm run fitness`** — the floor and the source profiles, read-only by
construction (no `INSERT`/`UPDATE`/`DELETE` anywhere in `fitness/`), so it is
safe to point at production:
`DATABASE_URL="$DATABASE_URL_PRODUCTION" npm run fitness`

**THE FLOOR'S FIRST VERDICT, against production:**

```
F1 FAIL  1 source has ever ingested (threshold 2)
F2 FAIL  0 ingested sources in Indiana, the primary geography
F3 PASS  0 rows hidden by an impossible deadline
F4 PASS  no gap — across a span of only three weeks
F5 FAIL  10 real decisions (threshold 100)
F6 FAIL  p10 description = 57 chars over 7,271 biddable rows
F7 FAIL  3 of 979 document-deferring rows have the document — 0.3%
```

**⚠️ F1 and F2 no longer read this way — UPDATED 2026-09-03, later the same day.**
The Indiana EDS contract register (§ below, "STILL OPEN") has since been
ingested against the `test` branch: **204,920 contracts loaded**, two requests,
86 seconds. That flips both:

```
F1  PASS   3 sources have completed a real ingest   (threshold 2)
F2  PASS   2 ingested sources in Indiana             (threshold 1)
```

Both were failing when this section was first written and are the two
predicates that blocked any GO/NO-GO adjudication. Full run report, including
the 71-row shortfall against the register's advertised 204,991 and why it was
accepted: [`docs/2026-09-03-eds-ingest-run.md`](docs/2026-09-03-eds-ingest-run.md).
The block above is left as originally printed rather than edited in place —
this project's convention is that a reader meets the correction, not a
silently-changed number.

**Two numbers worse than anything previously quoted.** Sample 2's median of 515
chars hid a tenth of biddable rows at **57 characters or fewer**. And **979 rows
explicitly say "see the attachment"**; we hold three.

⚠️ **F4 passes and must be read carefully** — it measures the span we HAVE, not
the span we should have. §8.2's adjudication window is still undefined.
⚠️ **Thresholds are UNRATIFIED proposals** and the report says so on every run.

**THE RUBRIC** — nine ordinal dimensions, **no aggregate score**, with a test
asserting the absence. R1 (legal posture) is a GATE: a disqualified source
returns with only R1 populated. `unknown` is never collapsed to `weak`.
Five acceptance tests, including the one it exists for: **IDOA grades STRONG on
geography and STRONG on cost and must still come out rejected** — a weighted
total would have carried it.

**Migrations 018–022.** 018 the rubric's three columns (cost is two columns:
*a source nobody has priced is not a free source*). 019 HigherGov, the first
paid source in the project's history. 020 the Indiana archive correction.
021 `sole_source` + `source_key` + the watermarks the registry already knew.
022 sighting identity — below.

---

### 🔴 THE FUSION merge.ts WARNED ABOUT SINCE SP3.5 — FIXED, migration 022

merge.ts's own header carried it for a month: *"grouping is by external_id
ALONE… this code fuses two UNRELATED opportunities into one canonical row, and
nothing errors or logs: the merge reports one solicitation with two sightings,
which **reads as corroboration**, not as corruption."*

**Measured 2026-09-03: Allen County publishes external ids `132`, `134`, `135`.**

`source.external_id_scope` declares whether a source's ids may be trusted
globally, **defaulting to `local`**. SAM.gov and USASpending are `global`, so the
demo criterion is untouched and production behaviour is unchanged.

**Fixing the grouping alone would have MOVED the defect.** Three more places
keyed on `external_id`: the link `UPDATE` (the actual fusion site), the insert's
`RETURNING id, external_id` (which cannot tell two rows apart when both say
"134"), and the `chains` Map. All now keyed by identity.

**Two things the tests caught that were wrong first time.** The coalesce fell
back to the scoped form unconditionally, so a directly-inserted sighting behaved
differently from an imported one *for the same source* — `identity_key` is a
CACHE of the declaration, not a second rule. And **mutating the DEFAULT from
`local` to `global` left all 23 tests passing**: the default is the entire
protection for a source nobody has thought about, and nothing exercised it.

---

### 🌿 `idoa-adapter` IS MERGED — Option A, and the parser stays as EVIDENCE

Merged `--no-ff` at `b4d4b1e`. **`Indiana IDOA solicitations` stays
`enabled = false` and is not expected to change.**

**The parser is retained deliberately.** It is the only second source this
codebase has, and D27 established what that is worth. Deleting it returns every
source-agnostic test to SAM plus a string constant — in the weeks before adding
a paid API whose payload resembles nothing here.

**🗓️ NAMED DELETION TRIGGER**, recorded in `idoa.ts`'s header and `registry.ts`:
**delete the parser, its fixture and its tests WHEN THE HIGHERGOV ADAPTER LANDS**
and becomes the second live shape. Not before.

⚠️ **The ledger's merge advice was WRONG by the time it was used.** It said "one
conflict in `merge.ts`, take the branch's version, it is a strict superset."
There were **four**, and taking the branch wholesale would have **silently
deleted `place_of_performance`**, which shipped to production the same day.
Resolved as a union.

⚠️ **Migrations now interleave**: the branch's `016` applies after `017`–`020` on
every existing database. Harmless — independent `ALTER`s — and already flagged
once as Ruling 11.

---

### 📌 INDIANA HAS A SOLICITATION ARCHIVE AFTER ALL — three documents amended

IDOA publishes none. **HigherGov holds 9,286 Indiana records back to 2013.**
So the *finding* stands and the *consequence* drawn from it does not.

Amended in place with originals struck through: design spec **§5.7**'s platform
table, **§5.8**'s finding row and closing paragraph, **§10.2**'s "Indiana remains
the exception", and the registry row via **migration 020**.

**What did NOT change:** Indiana Phase 0 *may* still run on contract data and the
contract side is independently valuable. §8.2 is untouched — there is still no
answer key.

---

### 🅿️ WITH MATT — the blacklist

[`docs/negative-profile.md`](docs/negative-profile.md) is a template awaiting his
entries. `firm_profile.negative_profile` has been NULL since migration 002, and
its note says why: *"lost its last source when the hand-run was retired
2026-08-11."* **Empty because its source went away, not by decision** — unlike
`past_performance` beside it. Matt is the new source; INDOA is entry one.

**It does more for F6 and F7 than any document-fetch rule could**, because it
removes unreadable rows by removing work we would never do rather than by paying
to read it.

---

### 🔴 STILL OPEN

- **The description ruling.** ~34% of rows carry no description, **58% among
  sub-state buyers** — and the gap does NOT track work type: KP's own sector is
  missing descriptions **42%** of the time, and 3 of 5 such rows were NAICS
  541611, KP's primary code. All INDOT. **Four options costed in
  `docs/2026-09-03-platform-comparison.md`; Option C (fetch on demand,
  ~11 records per click) recommended and unruled.**
- **The floor's thresholds are unratified** — F1=2, F5=100, F6=200, F7=0.8.
- ~~**The best-scoring source in the registry has never been run.** The Indiana
  EDS contract register grades STRONG on five of nine — free, primary
  geography, full archive to 2005, verified watermark — and is **exactly the fix
  for F1 and F2**. Held back only because Matt put the corpus pulls at step ④.~~
  **RUN, 2026-09-03.** 204,920 contracts loaded against `test`, two requests,
  86 seconds. **F1 and F2 now PASS** (3 sources ingested, threshold 2; 2 in
  Indiana, threshold 1). See
  [`docs/2026-09-03-eds-ingest-run.md`](docs/2026-09-03-eds-ingest-run.md).
- **Michigan SIGMA is outside the firm profile entirely** (`IN` primary,
  `IL/OH/KY` secondary — MI is neither). Worth knowing before anyone budgets an
  adapter for it.
- **`merge.ts` is not source-agnostic yet** — 021's header records that
  `source_key` is the precondition, not the repair.
- **The flaky gate's second cause is still unexplained.** Fired twice on
  2026-09-03, passing on immediate re-run each time.
  **A lead, found incidentally during the EDS ingest branch's review
  (`.superpowers/sdd/2026-09-03-indiana-contract-register/progress.md`):** a
  bare `vitest run` outside `npm run check` resolves its scratch schema to the
  FIXED name `test_schema_local` rather than one keyed to a per-invocation run
  id, so two such runs against the shared Neon `test` branch can collide.
  `resetSchema()` does `DROP SCHEMA ... CASCADE`, so the second run drops the
  first's tables mid-run. That is a plausible cause of the unexplained
  "collect failure reporting the file's whole body as skipped" seen above, and
  it means any flake hunt run via bare `vitest` — rather than through
  `npm run check`, which mints a real `TENDERFOOT_RUN_ID` — proves less than
  it appears to. Not yet chased down to a fix.
- `accuracyByField` has no surface · `fields.ts` matches one date format · the
  cleared-queue Metrics card goes to `/admin` · **the real GO/NO-GO adjudication
  still has not happened** — and the floor now says it may not.

---

## 🗄️ Earlier resume block — updated 2026-09-02 (end of day)

## ▶️ NEXT SESSION — ONE DECISION BLOCKS THE NEXT SLICE. Everything else is shipped, parked, or written down.

### 🔴 THE DECISION, and it is a ratification not a technical call
Asked what the Indiana contract corpus is FOR, Matt answered **"somewhere between"**:
**(2)** a live product surface — expiration radar, vendor records, incumbency — and
**(3)** calibration for qualification.

**(3) trips a guard this project built deliberately.** §1.1 parks matching as *undesigned*, not
pending; §7.10 clause 2: *"A rendered control may never become an active filter, ranking, or score
without qualification being designed first."* Its own note: inert filter chrome puts a wired-up
switch *"one small commit away from existing"*, and that commit is *"not the wrong answer, but the
unratified one."* **Calibration data is exactly what makes it tempting.**

> **ANSWER FIRST: is this the moment qualification gets DESIGNED, or is the corpus evidence
> gathered TOWARD that design, with nothing scoring yet?** Matt paused rather than answer quickly.
> **Do not start building until it is answered**, and do not let an ingest slice quietly answer it
> by arriving with a score attached.

**Full findings, API contract and open design questions: [`docs/Pinned-Indiana-Contract-Register.md`](docs/Pinned-Indiana-Contract-Register.md).**
It records the whole probe so nothing has to be rediscovered: `POST …/api/contracts/search` with
`{page, pageSize}`, **204,991 records back to 2006**, a **PDF per row**, and a `contract` table
already in the schema whose columns map almost one-to-one and which has never held a row.

---

### ✅ SHIPPED TO PRODUCTION TODAY — four things, all verified live
| | |
|---|---|
| **Discovery channel** | migration 013, seven required channels; §8.5's measure is recordable for the first time |
| **Undo toast** | D23 — the old control was a `<span>` that looked like a button. Found by Matt clicking it |
| **Description panel** | migration 015, D24 — backfilled **0 → 8,484 of 9,883** |
| **Eligibility + card signal** | migration 017 — the queue stopped showing awarded work, and the card gained place-of-performance and NAICS labels |

**Gate: 625 tests / 75 files, exit 0.** `main` == `origin/main`.

### 🎯 SAMPLES — sample 2 is the live one
| | sample 1 | **sample 2** |
|---|---|---|
| Seed | `gate-2026-09-02` | **`gate-2026-09-02b`** |
| Population | 6,893 | **4,192** (post-filter) |
| Unbiddable items | **38** | **0** |
| Description present | 77/100 | **100/100** |
| NAICS label | — | **97/100** |
| Decisions | **3, real, keep them** | 0 |

⚠️ **Sample 1 keeps its 38 unbiddable items permanently** — they were drawn and stored before the
filter existed, and an eligibility change cannot retroactively remove rows from a drawn sample.
**Triage sample 2:** `https://tenderfoot-tau.vercel.app/?sample=2`

---

### 🔴 THE FINDING THAT OUTRANKS EVERYTHING SHIPPED — D27
**Tenderfoot ingested exactly ONE real source for its entire life**, so every payload-reading layer
looks source-agnostic and is actually SAM-shaped. **Nothing could reveal that until a second source
existed.** Four instances, one root cause, **none caught by 653 passing tests** — because every
fixture was SAM-shaped too. One of the modules, `org-chain.ts`, had no test file at all.

Generalised as **Proto2PRD lesson 2.26**: *a layer is only proven source-agnostic by a second
source.* An elegant abstraction at N=1 is a hypothesis, not a property.

**And a second pattern worth naming:** the three defects that actually stopped work today — the
inert undo, the missing description, the unbiddable queue — were all found by **Matt using the
product**, not by tests, reviews or audits. Each took minutes to hit and none was catchable by the
checks in place.

---

### 🅿️ PARKED — with why, so none of it is rediscovered

**🚩 IDOA solicitations — RED-FLAGGED 2026-09-02.** Matt: *"if we really can only get 76 out of
IDOA at any time, let's just red flag that right now as probably not worth pursuing."* The page
shows **71 open and no history at all**. The branch `idoa-adapter` is **built, reviewed and green
(673 tests / 79 files) but UNMERGED and UNPUSHED**, with one known conflict in `merge.ts` whose
resolution is written down in its ledger: *take the branch's version, it is a strict superset.*
**Not wasted:** the framework underneath it — two source shapes, date provenance, the shape-aware
run contract — is what any future source needs, and building it is what exposed D27's four defects.

**🅿️ HigherGov — parked, not rejected.** $500/yr with API at every tier, server-side filtering via
a saved-search `search_id`, a dedicated **SLED** endpoint refreshed every 30 min with
`captured_date` as a watermark, **10,000 records/month** standing, and **attorney sign-off on
storing the data in our own store** — the §5.5.1 *documented permission* the registry requires.
**Blocked on a trial key** (Matt has emailed them; free accounts appear not to include API access).
**The decisive test is designed:** diff their Indiana SLED feed against the **71 known IDOA
solicitations** captured at `app/server/src/scrape/adapters/fixtures/idoa-listing.html`. That turns
"how comprehensive are they" into a percentage.

**🅿️ The document pass — the next real slice for triage quality.** SAM sits at **12 documents
across 9,883 solicitations**. Where a biddable notice's description is thin it usually says why:
*"see SOW and additional items list."* Sample 2's median description is 515 chars with **6 of 25
under 200**. Matt: *"I'm not going to be able to complete the sample for a while until they do."*
⚠️ **Size it before starting** — it is thousands of fetches, not a handful.

**🅿️ Two merge behaviours documented, not fixed** (D27): 45 IDOA rows keep `(untitled)` permanently
because titles are recomputed only for rows with unlinked sightings and re-import is idempotent;
and merge is **two-pass for newly created rows**, so any source's first ingest lands with empty
fields and reads as the adapter failing. Both are merge-internals slices of their own.

**🅿️ A scraping console** — `docs/Pinned-Scraping-Console.md`. `/admin` lists sources; the adapter
layer is invisible, so a source with no adapter reads health `ok` and looks one toggle from working.

### 🔴 STILL OPEN, unchanged all day
`accuracyByField` has no surface · `fields.ts` matches one date format · the cleared-queue Metrics
card goes to `/admin` · **the flaky gate's second cause is still unexplained** (it fired three times
today, on solo runs as well as concurrent — so concurrency aggravates it and is not the cause;
signature is a collect failure reporting the file's whole body as *skipped*, and an immediate
re-run passes) · **and the real GO/NO-GO adjudication still has not happened.**

### 📌 MATT'S FRAMING FOR NEXT TIME, in his words
> *"We can refine, test, and perfect our methodology based on past bids, contracts, and data. Why
> even worry about live data until we have all that figured out?"*
>
> *"…they're two separate problems: the analysis and the contracts themselves."*

**Treat those as two slices, not one.** The contract INGEST is a data-plumbing problem with a
documented API. The ANALYSIS — what a KP-shaped contract looks like, and whether that becomes a
score — is the parked qualification question above, and it is the one that needs a ruling.

---

## 🗄️ Earlier resume block — updated 2026-09-02 (midday)

## ▶️ NEXT SESSION — everything is built and the sample is drawn. **The next move is Matt triaging it**, and then IDOA.

### ✅ THE SHAKEDOWN RUN HAPPENED, AND IT WORKED — 2026-09-02

**Matt triaged 8 items on production and returned the guide's checklist.** This is the first time a person has made a decision in this product on production, and **8 of the 11 checks are confirmed by a human**, not by a test:

| Confirmed | By |
|---|---|
| The banner names all three numbers · the counter moves | *"Counts all look good"* |
| `I` opens a step rather than deciding | implied — the channel guard could not fire otherwise |
| **Confirming with nothing picked refuses** | *"It does protect against having to select one of the channels before allowing you to advance"* |
| The channel is single-select | **the data** — 7 decisions, exactly one channel each |
| No chips on the Pass step | *"We do want chips in the pass step at some point but not now"* |
| `U` restores the card and the count | *"Undo works with the shortcut"* |
| The toast's UNDO undoes · no inert hint remains | *"Undo is working great now"* |

**Still unconfirmed, and only the last needs a deliberate action:** `Back` clears the selection · the two confirms do not look alike · **the unsampled queue at `/` is still ~6,920** (sampling must not filter the product, spec §2.1).

**The one defect it found was real and is fixed** — the undo affordance was a `<span>` dressed as a button. **D23.** No test could have caught it; an inert element has no behaviour to assert against.

### 🔄 AND THE 8 DECISIONS WERE RETRACTED, BY RULING — sample 1 is clean again

**They were test presses, and the shape says so:** 7 Interested out of 8, spread across **6 distinct channels**, with `indiana_email` joint-top on a *federal* sample. That is someone pressing each chip once, which is exactly what the guide asked for.

**Left in place they would have poisoned the denominator.** The numbers they produced — **interested-per-hundred 87.5** and **discovery_rate 0** — are not measurements, and a `discovery_rate` of 0 is a NO-GO reading. Mixed in with real judgements later, nobody could have said which were which. That is the "denominator nobody can defend" failure the whole design exists to prevent.

**Retracted the product's own way: 8 appends of `New`, through the API, one per item.** ⚠️ **Nothing was deleted** — `pursuit` is append-only (§5.1), the original rows survive with `decided_by: MS`, and `discoveryRate()` reads latest-per-solicitation so they simply stop counting. **The audit trail says a decision was made and taken back, which is the truth.**

**After: `decided 0`, `interested_per_hundred null`, `discovery_rate null`** — `null` and not `0`, which is the correct reading of "nobody has answered yet". Script kept at `runs/retract-shakedown.mjs` (gitignored); it refuses any host that is not the production endpoint.

### 🎯 SAMPLE 1 IS DRAWN AND WAITING — production, 2026-09-02
| | |
|---|---|
| Source | **SAM.gov** (id 1) — the only source ever ingested |
| Seed | `gate-2026-09-02` |
| Drawn | **100** |
| Population at draw time | **6,893** — the denominator |
| Decided | **0** |
| Triage at | `https://tenderfoot-tau.vercel.app/?sample=1` |

**This is the first sample ever drawn on production.** The SP6 demo (sample 1, seed `gate-2026-08-31`, population 1,018) was on **`test`** — a different database and a different sample id, so do not confuse the two.

**Two prompts, once each:** the admin secret, then a name/initials stored as `decided_by` on every row (spec §5.3). **`I` now opens a step rather than deciding** — that is the behaviour change to the fastest path in the product.

**An operator's guide was published for the run** — the seven channels, the keyboard loop, and nine checks that were proven in a browser first so a failure is a real regression: `https://claude.ai/code/artifact/85361af2-0180-40a2-a097-45b621c9e7df`

⚠️ **The queue is not the sample.** `/` with no `?sample=1` is ~6,920 rows across three sources including two disabled corpus imports. Triaging *that* measures something else. The banner on screen is the check: `SAMPLE · 100 of 6,893 · SAM.gov · seed gate-2026-09-02`.

⚠️ **Not yet done on production: a real Interested.** The step was pre-flighted there (bundle `index-DNeXJwnW.js`, seven chips, correct copy and colours on a live SAM.gov notice) but **no decision has ever been recorded on production**, so the first one Matt makes is genuinely the first.


### ✅ PRODUCTION IS LIVE, MIGRATED AND VERIFIED — 2026-09-02

**Migration 013 applied to production** (`applied 013_discovery_channel.sql`, endpoint `ep-super-bonus-auoe43hj`, run by Matt through the new guard below), **then** `main` pushed `b5d6b07..441cb5d`. That order was the whole hazard: the *server* half was already in `main`, so a deploy landing before the migration would have made Interested **500** on production — the client is not what would have broken it.

**Verified by BEHAVIOUR, and one request proved both halves at once.** `GET /api/triage/metrics` answered `200` with

```json
"discovery": {"answered":0,"discovered":0,"not_sure":0,"discovery_rate":null,"by_channel":[]}
```

- **The deploy landed**, because the `discovery` key exists only in the new code — production returned `volume, interested` and nothing else 45 seconds earlier, captured before the push precisely so this comparison could be made.
- **The migration landed**, because `discoveryRate()` SELECTs `pursuit.discovery_channel`. On an unmigrated database that is a `500`, not a `null` rate. **A route answering 200 is the column existing.**

**And the write gate is intact:** an unauthenticated `POST` answers **`401`** with `X-Powered-By: Express` — our app replying, not the platform, which per §1 is positive proof `ADMIN_SECRET` is truthy in the production runtime.

⚠️ **`discovery_rate` is `null`, not `0`, and that is correct** — nobody has answered the question yet. **The first real number comes from a triage session, which has still not happened.**

### 🛡️ NEW: `npm run migrate:production`, because §4 made the safe thing silent
§4 repointed `DATABASE_URL` at `test`, which made every local command safe by default and left migrating production as a bare shell-variable override. **Getting that override subtly wrong is SILENT: it migrates `test` a second time and prints success.** The wrapper prints the host, checks it against §4's two recorded endpoints, and **refuses the test endpoint by name** rather than merely failing a positive check. All three refusal paths were exercised before it was handed over — a guard nobody has seen refuse is decoration.

### ✅ WHAT LANDED TODAY — merged `07d216f` (`--no-ff`), gate **592 tests / 72 files**, exit 0
**Branch `sp6-discovery-channel` is merged.** It had been held unmerged on purpose since 09-01: the server half REQUIRES `discovery_channel` on Interested, so landing it alone would have made the button answer 400 in the live app.

**The bundle had more of this than STATUS credited.** The note read *"fidelity-POSITIVE, the bundle already has it"*, citing one line — `confirmLabel`. Behind it sits a **complete Interested branch**: `YES_CHIPS` (four fit chips), **`ANYTHING TO NOTE? — OPTIONAL`**, *"Skip it and the decision still records"*, and a `confirm()` that permits an empty answer. **A different question from ours, with a different vocabulary, and optional where ours is required.**

**⚖️ Ruled by Matt 2026-09-02 as a gate question (CLAUDE.md §1): replace the question.** Seven single-select channels, required, `Save & next` and the accent confirm kept from the bundle. **D21** carries the argument, the cost (the bundle's note-capture affordance goes with it), and why the invented vocabulary may override SVRC 1.1.4's derive-don't-invent parking.

**⚠️ AND THE PASS STEP HAD INVENTED ITS OWN COPY — unrecorded, since 08-31.** The fidelity audit logged the panel's *structure* ("prompt + help text") and never transcribed its *strings*, so four divergences passed review. Ruled and fixed: `WHY ARE YOU PASSING?` → **`WHY NOT? — REQUIRED`**, the help line, `Confirm pass` → **`Pass & next`**, and the placeholder's dropped **`(this is the training signal)`**. **An audit that checks shape and not strings will keep missing this class.**

**`askReason` was a BOOLEAN where the bundle has a three-state field** — not a simplification, since **eight** rendered values branch off it. One of the four we had hardcoded to the Pass values was `reasonAccent`, a constant `--bad` that would have rendered the discovery prompt in the rejection colour.

**Two new primitives-layer facts.** `ChoiceChip` is a **new** primitive, not a tone on `Chip` — `Chip` is the bundle's 4px mono *tag* pill, reason chips are 20px sans and interactive; reusing it would have rendered the control at 40% size. And `Button` gained **`danger`** (**D22**), defined at `size="sm"` only because the bundle draws it nowhere else — we had built only the accent half of the confirm ternary, so **a rejection looked exactly like a save at the moment of committing.**

### 🔬 HOW IT WAS PROVEN, since a green server test has passed here with both buttons broken
- **Four mutations, whole file each run.** Dropping the channel from the POST body kills 3 tests; removing the required guard kills 1; not clearing on Back kills 1; `danger`→`primary` kills 1.
- **Real mouse clicks in Chrome.** `i` opens the step; seven chips on one row, 20px radius, `500 12.5px 'IBM Plex Sans'`; prompt renders `#1b6a8c` (`--acc`), not `--bad`; Portal-then-Nowhere leaves exactly one selected; **confirming with nothing picked shows the error and sends ZERO requests**; the button then sent `{"state":"Interested",…,"discovery_channel":"nowhere"}` verbatim. Pass branch live: `--bad` prompt, `--baddk` border on `--bad`, `Pass & next`, **zero discovery chips leaking across the mode**.
- **End to end against `test`.** No channel → **400** `field: discovery_channel`; the browser's exact body → **201**; a value outside the vocabulary → **rejected by migration 013's CHECK**, not coerced; the metric then read **`discovery_rate 100 · {nowhere: 1}`**. **Retracted by APPENDING a `New`**, the way undo does it, so the audit trail survives and `test`'s measure is back to `null`.

### 🔴 FOUND AND NOT FIXED — outside the ruling, both cheap
- **`.queue__reason` has no band.** Measured live: `background rgba(0,0,0,0)`, `border-top 0px`, while `.queue__decision` carries `--surface4` and `--brdsoft`. **The band vanishes the moment either step opens**; the bundle keeps one band and swaps its contents. **Two declarations.** Audit item 10 was half stale and now says so.
- **A bad channel answers 500, not 400.** Correct that it is not coerced — the CHECK is the authority — but a client-supplied bad value reads as a server fault. Unreachable from our UI, which only sends the seven.
- **The reason input is `--type-body-decision` (12px); the bundle's is 13px.** No 13px token exists. Pre-existing, unrecorded until now.

### 🟡 STILL OPEN, unchanged by today
`accuracyByField` has no surface · `fields.ts` matches one date format · the merge may still drop SAM fields nobody has looked for · the cleared-queue Metrics card goes to `/admin` · **and the real GO/NO-GO adjudication still has not happened.**

### 🗣️ IDOA IS NEXT, AND IT IS NOW SCOPED — researched and ruled 2026-09-02

**The platform question is answered, and the answer killed the cheaper-looking option.**

| | **Indiana IDOA** (state) | **City of Indianapolis** |
|---|---|---|
| Platform | **bespoke, in-house** HTML table on `in.gov` | **transitioning to OpenGov** — says so on the page |
| Open right now | **50** | ~9 |
| Listing fields | Event Name · Agency · Event ID · Description · **Response Due By** · Contact | Bid Number · Title · Agency · Status · Service Type · Due Date |
| Posted date | **none** | **none** |
| Documents | **direct ZIP per row**, named by Event ID, no auth | not surfaced in the list |

**They are two adapters, not one — no shared platform, no carry-over.** Matt's instinct that cities outsource was right, and it argues *against* Indianapolis as a first target: **whatever is built against today's indy.gov list is thrown away when the OpenGov migration completes.** Nine rows is also too little to learn from.

**So IDOA wins on engineering as well as on being KP's ground:** 50 rows is small enough to see end to end, the ZIPs exercise the `.zip` parser that already exists, it is static HTML with no JS and no login, and the document depth is where `qa_closes_at` / `prebid_at` actually come from.

> 📌 **File for later: OpenGov is the platform bet.** If Indianapolis is moving there, other Indiana municipalities likely are too — one OpenGov adapter would then cover many cities at once. That is §5.7's leverage, not yet available.

**⚠️ FREE CORRECTNESS CHECK, noticed in passing.** Row 2 of IDOA's live table is *"General Supervision-State Complaint Corrective Act"* — **the same solicitation sitting in our production queue** from the `Corpus import — Indiana open (2026-08-04)`. That corpus was taken from this exact page, so the first adapter run can be diffed against it.

### ⚖️ TWO RULINGS, Matt, 2026-09-02

**1. `first-seen` stands in for `posted_at` on IDOA — labelled distinctly, not written into the same column.** IDOA publishes no posting date and only 3 of 50 descriptions leak one (all addendum notices), so there is nothing to backfill. `sighting` already models first-observation, and SP3.5 merged sightings into canonical records.

> 🔴 **THIS MAKES STARTING EARLIER WORTH SOMETHING, which is unusual and easy to miss.** Volume-per-week for IDOA can only count **from the day we first scrape**. Every day before the first run is a day of volume data that **can never be recovered** — unlike SAM, where the history came free because SAM publishes `posted_at`. The clock does not start until the adapter runs.

**2. Scrape listings first; fetch documents on a separate pass.** Same shape as SAM. ⚠️ Worth naming the known cost: **that separation is exactly why extraction has only ever run on 12 of 9,883 SAM rows.** A second pass that nobody invokes is a second pass that does not happen. Whatever schedules the IDOA document pass should be decided when the adapter is built, not after.

### 🧭 ADAPTER ARCHITECTURE — brainstorm opened 2026-09-02, PARKED mid-design

**The framework does not fit IDOA, and that is the finding.** `Adapter.fetchListing(since, until, cursor)` is built on three assumptions — a filterable date window ("what makes backfill and live the same code path", §3.1), a required `modifiedAt` per item, and a resume marker that tracks the MINIMUM `modifiedAt` written, exploiting SAM paging newest-first. **IDOA has no dates, 50 rows on one page, and no history.** Followed literally, every IDOA row lands in `undatedSkipped` and nothing ingests.

**So there are two SOURCE SHAPES, and Matt ruled they be recognised explicitly:**
- **Windowed feed** (SAM) — dated, filterable, paged, history reachable. Resume by lowering the ceiling.
- **Open-set snapshot** (IDOA, Indianapolis) — undated, small, bounded, no history. **No window to resume; the diff against the last run is the news**, and the scrape itself is the clock. `sighting` already models this.

**⚖️ RULED: adapters return what they can; the merge layer decides what is trustworthy.** The alternative — an adapter DECLARING its capabilities, with the framework refusing to infer beyond the declaration — was tabled and rejected *for now*: **"We need to keep it flexible."** A declaration maintained before the shapes are known is a guess with ceremony attached.

> 🔴 **THE CONSEQUENCE THAT MAKES THAT RULING WORK, and it is not optional: PROVENANCE MUST TRAVEL WITH THE VALUE.** Merge can only sort out trustworthiness if it can tell a published `posted_at` from a synthesised one. `extracted_field` already carries origin and confidence; **listing-level fields are merged bare.** If IDOA hands back a first-seen-derived `posted_at` with no tag, merge cannot distinguish it from SAM's published one and the distinction is lost silently — the exact shape of every field-level defect this project has already paid for.

**⚠️ THE INFERENCE TRAP, raised by Matt and worth writing down before anyone builds on it.** Position in a table is often a proxy for recency and occasionally fiction. **IDOA's first two rows share a due date but carry wildly different Event IDs** (`0023…87895`, `0070…88051`), so the table is probably ordered by DUE DATE, not insertion. Assume insertion order and we manufacture a posting sequence that is pure invention **and looks entirely plausible on screen.** The ordering must be VERIFIED before anything depends on it — the `verified_facets` instinct (§5.4), one level up.

**Still open when this was parked:** what `run.ts` does for a source with no resume marker; whether the operator gets a row LIMIT alongside the time budget ("just grab me 1,000 records"); and what triggers IDOA's document pass.

### 🗄️ Matt's original call, 2026-09-01
**To discuss first — not designed, not started.** `Indiana IDOA solicitations` reads health `ok`, which makes it look like a switch. **It is not:** `scrape/adapters/registry.ts` imports exactly three adapters — `fake`, `sam`, `usaspending` — so **there is no IDOA adapter at all** (re-verified 2026-09-02). This is an adapter build, not a toggle. It does not improve the gate's measurement; it changes **what the gate is a gate ON**, which is bigger than a slice.

### ⚠️ THE PRECONDITION STILL FAILS
**Only SAM.gov has ever been ingested.** Any GO/NO-GO taken now is a verdict on **federal SAM.gov alone** and must say so in those words.

---

## 🗄️ Earlier resume block — updated 2026-09-01 (late)

## ▶️ NEXT SESSION — START HERE: finish the discovery capture's CLIENT half, then adjudicate.

### 🗣️ MATT'S CALL, 2026-09-01 late: **IDOA should really be next.** To discuss first — not designed, not started.

**One fact to bring to that conversation, checked before it:** `Indiana IDOA solicitations` reads health `ok`, which makes it look like a switch. **It is not.** `scrape/adapters/registry.ts` imports exactly three adapters — `fake`, `sam`, `usaspending` — so there is **no IDOA adapter at all**. `enabled=no` is the smallest part of what stands between us and Indiana data; this is an adapter build (the shape SP3 did twice), not a toggle.

**Why it matters more than its size:** today's gate numbers are a picture of the FEDERAL market. Indiana is arguably KP's core ground. Turning it on does not improve the gate's measurement — it changes what the gate is a gate ON, which is a bigger decision than a slice.

### 🎯 THE ONE TASK TO START WITH
**Branch `sp6-discovery-channel` holds the SERVER half of the discovery capture and is NOT merged, deliberately.** The server now REQUIRES a `discovery_channel` on Interested; the client does not send one. **Merging it as-is would make the Interested button answer 400 in the live app.** Finish the client, then merge the two together.

**What the client needs** (all decided, nothing to re-litigate):
- The decision bar is already a two-state mode machine (default / `askReason` on Pass). **Interested needs its own step**, mirroring Pass.
- 💡 **This is fidelity-POSITIVE, not an invention.** The bundle already has it: `confirmLabel: s.askReason === "pass" ? "Pass & next" : "Save & next"`, with a matching `--accbrd` confirm style. We only ever built the Pass branch.
- Seven options: `already_knew · indiana_email · portal · colleague · nowhere · not_sure · other`. Picking **Other** uses the existing optional reason box for detail rather than adding a second text field.
- POST `discovery_channel` on the decision. A missing one answers **400** with `field: "discovery_channel"`.
- **Then: migration 013 must be run against production** before any triage session — `pursuit` gains the column and its CHECK.
- **Then: write deviation D21** — the channel vocabulary is INVENTED, which cuts against SVRC 1.1.4's ruling that chip vocabularies be *derived* from a hand-run. The argument for overriding it is in `013_discovery_channel.sql`; it needs a number.

### 📊 THE GATE'S FIRST REAL NUMBERS — measured on production today, in `docs/2026-09-01-gate-measurements.md`
| | |
|---|---|
| Volume/week, SAM.gov | **7,614** notices — **4,549 biddable** |
| Lead time posted→closes | **median 11 days** (p25 7, p75 15) |
| Not biddable | **26%** — award notices, special notices, justifications |
| Carrying a KP PSC code | **49/week** — ten a working day |

**Still uncomputable:** Interested-per-hundred (0 decisions on production), discovery (the branch above fixes this), and value weighting — **closed by evidence, not pending:** SAM publishes no estimate for open notices.

### ⚠️ THE PRECONDITION STILL FAILS, and it is not an outage
**Only SAM.gov has ever been ingested.** `Indiana IDOA solicitations` and `Indiana EDS` are health `ok`, `enabled=no`, `last_run=never` — arguably KP's core ground, contributing nothing. **Any GO/NO-GO taken now is a verdict on federal SAM.gov alone and must say so in those words.** Turning state sources on is a separate decision and was not taken.

**⚠️ OVERTAKEN ON `test`, STILL BINDING ON PRODUCTION — 2026-09-03.** The Indiana EDS contract register has since been ingested: **204,920 contracts against the `test` branch**, so `Indiana EDS` is no longer `last_run=never` there and floor predicates F1/F2 pass. *Production is untouched and this entry's verdict still binds it* — a GO/NO-GO taken against production remains a verdict on federal SAM.gov alone. See `docs/2026-09-03-eds-ingest-run.md`.

### ✅ WHAT LANDED TODAY, all on `main`, gate green at 71 files
- **Matt's five fidelity rulings** — score strip back (D13 reversed), conflicts inline (§6.1 amended), seven-item nav with stubs, tabs disclosed, CONFIDENCE held at a flat 0.6. Deviations **D17–D20**.
- **The flaky gate is FIXED at the root** — 87 leftover schemas and 11,052 `pg_class` rows were slowing the suite until tests timed out. `resetSchema()` now records each schema's birthday and `--reap` drops only those over three hours old, so it is safe to run unattended. **174s → ~107s, and four consecutive green runs.**
- **The SAM payload audit** — `kind`/`codes`/`set_aside` were null on every row while the payload carried them. Backfilled on production: `posted_at` 140 → 9,822.
- **106 opportunities recovered** — an impossible deadline (closes before posted) was filed as *closed* and hidden. Now treated as unknown. Production queue 6,814 → **6,920**.

### 🔴 STILL OPEN, unchanged
`accuracyByField` has no surface · `fields.ts` matches one date format · the merge may still drop SAM fields nobody has looked for · the cleared-queue Metrics card goes to `/admin` · **and the real GO/NO-GO adjudication has still not happened.**

> 💡 **The lesson that cost twice today:** a merge-layer fix changes nothing until the merge is RE-RUN against the database in question. Shipping and deploying is not backfilling, and the gap is invisible — production looked fine and simply had no posting dates.

---

## 🗄️ Earlier resume block — updated 2026-09-01 (evening)

## ▶️ NEXT SESSION — ALL FIVE RULINGS ARE RULED AND BUILT. The gate is green again after expiring overnight. What is left is the instrument, not the paint.

**Branch `sp6-fidelity-rulings`, two commits, merged to `main` with `--no-ff`. Gate green at 556 tests / 70 files, exit 0** (from 550 / 69 — and **34 tests that had been reporting as *skipped* are now actually running**, because a file that fails to collect reports its whole body as skipped).

### ⚖️ THE FIVE RULINGS — all decided 2026-09-01, all built, all recorded

| # | Ruling | Built | Recorded |
|---|---|---|---|
| **01** | **Render the score strip**, bars as placeholders that state they are unpopulated | Two-up band on the triage card: `Fit · Winnability · Value · Timing`, all empty, with the disclosure | **D13 REVERSED** (kept in full, reversal on top) + new **D17** |
| **02** | **Conflicts inline**, as the bundle draws them | `2026-08-17 · CONFLICT with …pdf (2026-08-13)` on `--badbg2`, both origins joined `A + B` | **spec §6.1 AMENDED** + new **D18** |
| **03** | **All seven nav entries, each to a stub** | 5 stub screens, copy from the SVRC's own overviews; `Queue` → `Triage` | new **D19** |
| **04** | **Five tabs, parking disclosed** | already built — no code change | audit table |
| **05** | **Keep `CONFIDENCE` at a flat `0.6`, for now** | no change | new **D20**, as a *provisional hold* |

**Ruling 01 did not simply overturn D13.** D13 chose between *four dashes captioned A READING AID* and *nothing*, and on those two it was right. The ruling picked a third option nobody had tabled — **render the placeholders and say in words that they are not populated** — which answers D13's objection rather than ignoring it. The note is load-bearing and is asserted separately from the strip.

**⚠️ Ruling 02 cost something real, and D18 records it.** The losing value's **quote no longer appears anywhere**. Both values and both origins survive; the loser's evidence does not — and it bites hardest on the case the display exists for, since a listing-origin winner contradicted by a document now shows **no citation at all**. That is the FSSA near-miss shape exactly.

**⚠️ Ruling 03 contradicts the SVRC on exactly one item.** Region A.1.2 lists **six** and says the pipeline board joins the nav *"when the management phase starts and not before"*. Surfaced before the ruling, ruled anyway. **D19.**

### 🔴 STILL OPEN AND STILL OUTRANKING FIDELITY — unchanged by this session
Every item in the 2026-08-31 block below is **still true and still unactioned**: `accuracyByField` has no surface; `fields.ts` matches exactly one date format; nothing captures *"had not otherwise seen"*; the merge drops most of the SAM payload (assume a third instance); parser dispatch covers five types; the cleared-queue Metrics card goes to `/admin`. **And the real GO/NO-GO adjudication session still has not happened.**

### ⏰ THE GATE EXPIRED OVERNIGHT, and it is worth knowing how
**`main` was RED when this session started, and STATUS said green.** Both were true: four tests in `run-extract.test.ts` hardcoded `2026-09-01` as the "soonest" deadline and **went red at 20:00 EDT on 2026-09-01**, when a **GMT** database rolled to `2026-09-02` and that date stopped satisfying the ordering clause's liveness test.

**The rows did not fail — they SORTED DIFFERENTLY**, which is worse. Only one of the four broken assertions was about ordering; the rest were about batch contents and document text, so the failure surfaced far from its cause. Fixed with a computed `daysOut(n)`; a JS fake clock cannot help because **`now()` is evaluated by Postgres**. Proven by two mutations, so the fixtures still exercise the ordering rather than sorting correctly by luck.

**⚠️ THIS IS NOT THE FLAKY GATE, and must not be recorded as fixing it.** That one has a **connection-level signature on repeated sequential runs**; this was deterministic, dated, and reproducible on a clean tree. **The flaky second cause is still live and still unexplained.**

### 🔎 THREE THINGS THE SCREENSHOTS CAUGHT THAT NO TEST DID
- **The stub screen was broken on its first cut** — it used `Section`, whose padding belongs to the triage card's band, and skipped the card, so the title sat 30px out from its own paragraph on bare canvas. **Rebuilt on Screen 2's frame.**
- **Opening the prototype in a browser caught two errors before they reached code** — the score rows are `Fit / Winnability / Value / Timing`, not labels invented from memory; and the shell header is **light**, not dark.
- **⚖️ OPEN FOR MATT: the SOURCE column truncates, and now holds TWO filenames.** On real data it renders `Solicitation Amendment…`, so the losing value's origin is **hover-only**. The 150px truncation was ruled 2026-08-31, **before any row had two sources in it**. The `title` attribute is pinned by a test. Whether that is good enough is **not decided**.

### 💡 THE BUNDLE *DOES* DESIGN THE CLEARED QUEUE — found while pulling evidence
The audit had `View 1.3` as *"not audited against the bundle at all"* and **D14 rests on the state being undesigned**. It is not: the bundle's `isCleared` branch renders a 64px mono `0`, `Queue cleared.`, and **two cards wired to `goRadars` and `goReports`**. This does not overturn D14 — its correction was about *our* cards carrying no `onClick` — but **D14's premise is false about the bundle**, and that premise is why three cards were invented. Both of the bundle's cards now have real destinations, since `/radars` and `/reports` exist as stubs.

### ⏭ BUILDABLE NEXT
The buyer-note callout wired to entity resolution; the decision bar's own `--surface4` band; and `View 1.3`, which now has a bundle treatment to match rather than an invention to defend.

---

## 🗄️ Earlier resume block — updated 2026-08-31 (evening)

> **All five rulings named below were ruled on 2026-09-01 — see the block above.** Kept because its statement of the conflicts, and of the findings that outrank them, is the fullest one written.

## ▶️ NEXT SESSION — SP6 is MERGED, DEPLOYED and its criterion is MET. The work now is FIDELITY, and five rulings are waiting on Matt.

**Branch `sp6-triage-record` merged to `main` and pushed. Production runs SP6. Working tree clean, `main` == `origin/main`, gate green at 550 tests / 69 files** (baseline entering the slice: 430 / 58).

### ⚖️ FIVE RULINGS WAITING ON MATT — none of them block other work, all of them block "done"
Recorded per `CLAUDE.md` §1: where the frozen prototype and a spec disagree, **Matt decides** — not me, and not silently in either direction.
1. **The score strip.** The bundle renders `MACHINE SCORES — A READING AID` on the card; SP6's **D13** ruled it does not. `ScoreBar`'s empty branch already exists, so either way is cheap.
2. **Conflicts: inline or beneath?** The bundle puts a disagreement *inside the value cell*; SP6 §6.1 puts the loser *beneath* with its own origin and quote. Currently built the spec's way, in the bundle's colours.
3. **The nav: seven items or two?** The bundle shows Triage · Opportunities · Radars · Entities · Reports · Admin · Pipeline. We show Queue · Admin. Five lead to unbuilt screens.
4. **Parked tabs: disclosed or absent?** Screen 2 renders all five of the bundle's tabs; `Brief` and `Scores & Evidence` state plainly that they are parked rather than faking a body.
5. **⚠️ Does a flat `0.6` deserve the label `CONFIDENCE`?** `fields.ts` sets `confidence: value !== null ? 0.6 : 0` — **a constant**. Every document-extracted value shows `60%`. It means "found", not "how sure", and the record view presents it under a column heading a reader will believe. Same class as the parked score strip: a number that looks like a judgement and is not.

### What is DONE, so nobody redoes it
`docs/SP6-fidelity-audit.md` is the live checklist — audit items 1–7 plus the shell pair are complete. Both screens were rebuilt against the bundle and deployed: the triage card's three-up fact panel, the two-up deadline-disagreement panel, the two-state decision bar, the page frame and meta line; Screen 2's tabs, crumbs, subtitle and card; the document-attributed SOURCE column; Documents as two panes; the Timeline rail; the counter as a control; and the nav-collapsed affordance.

### ⏭ BUILDABLE NEXT, no rulings and no new data
The buyer-note callout wired to entity resolution; the decision bar's own `--surface4` band; and `View 1.3 : Queue Cleared`, which was never audited against the bundle at all.

### 🔴 THE FINDINGS THAT OUTRANK FIDELITY — from the overview pass, all verified, none actioned
These are about the instrument, not the paint, and they are the reason the gate's number is not yet trustworthy.
- **`accuracyByField` has no surface.** No route, no CLI, no screen — its only caller is its own test file. SP4 §8.4's accuracy measurement cannot be run by anyone.
- **`fields.ts` matches exactly ONE date format** — long-form `Month D, YYYY`. No ISO, no numeric, no day-first. This silently bounds every recall figure ever quoted, and is written down nowhere else.
- **Nothing captures "had not otherwise seen".** That is the discovery half of the GO/NO-GO question the gate exists to answer. Value-weighting it is also impossible today (`value_cents` is null on every ingested row).
- **The merge drops most of the payload.** `posted_at` was the second instance of this (fixed 2026-08-31); SAM also carries notice type, set-aside and PSC codes, all unread. **Assume a third instance exists until someone looks.**
- **Parser dispatch covers pdf/docx/xlsx/xlsm/zip only.** `.doc`, `.xls` and `.pptx` are filed "unsupported" although the spike parsed them.
- **The cleared-queue "Metrics" card navigates to `/admin`, which shows no metrics.**
- **The flaky gate has a SECOND cause, still live.** The `runSuffix` collision was real and fixed; but four sequential runs on the merged tree went red twice with a connection-level signature, and sequential runs cannot collide. Green currently means "green if you do not run it twice quickly."

### 🎯 AND THE THING THE SLICE EXISTS FOR
**The real GO / NO-GO adjudication session has not happened.** Plan of Action §6 budgets a day. What exists is a mechanism proven end to end on production and a rate computed over **five decisions** — a shape, not a measurement. Volume per source per week became computable for the first time on 2026-08-31; Interested-per-hundred needs Matt triaging a real sample.

### Where the record lives
`docs/SP6-fidelity-audit.md` — the fidelity checklist and the three prototype/spec conflicts. `docs/Tenderfoot-Overview-2026-08-31.md` — 12,806 words, written to be listened to, ⚠️ predating the `posted_at` fix. `CLAUDE.md` — the fidelity mandate and the conflict-resolution rule. `.superpowers/sdd/2026-08-30-sp6-triage-record/progress.md` — the full SDD ledger, **gitignored scratch, so `git clean -fdx` destroys it**.

---

## 🗄️ Earlier resume block — updated 2026-08-31 (midday)

## ▶️ NEXT SESSION — SP6's thirteen build tasks are DONE and reviewed. Task 14 (this docs pass) just landed. What is left is the final whole-branch review, then Task 15 — the demo criterion, run for real.

> ### ✅ 2026-08-31 — SP6 IS MERGED, DEPLOYED, AND ITS CRITERION IS FULLY MET, ON PRODUCTION.
>
> Merge `19688be` (`--no-ff`), pushed `fda6f07..19688be`, deploy landed via the Git integration — verified by `/api/queue` answering `200` on production, a route that exists only in SP6. ⚠️ The Vercel MCP returned **403** (no permission to list deployments), so the deploy was confirmed by **behaviour** rather than by the deployments list. That is the right way round regardless: §1 of this file already records that the deployments list is not evidence of what the runtime holds.
>
> **PRODUCTION NOW HAS DOCUMENTS — the first in its history.** Discover was run deliberately small first (limit 3 → 6 documents, 0.69s), then wider (limit 25 → 32 documents, 1.6s); extract processed 6 then 32, with 3 and 10 format-related failures. **This discharges SP4's one unrun, non-deferred criterion bullet, open since that slice.**
>
> **The production click-through, in a real browser over CDP.** Queue at `/`: card *"300 FW Goose Creek Farm Lease"*, counter **8008**, status bar *"7 SOURCES · 0 DEGRADED · 0 ROT SUSPECTED"*. **No score strip (D13 live). Cost panel empty with its note (D15 live).** Record 2148: `qa_closes_at` **2026-09-30, origin document, 60%**, quoting *"Question: If the September 30, 2026 delivery date canno…"* — **bullet 5**; and beneath its winner, *"2026-08-24 — document 60% | 'Questions related to this RFQ shall be received by … Monday, August 24, 2026'"* — **bullet 6**. Four fields read *absent from bundle*, so the three states are distinguishable. Two documents, **no inline viewer** (D12 live).
>
> **So SP4 §10.1's deferral is fully discharged: a citation is no longer merely stored, it is readable — by a person, on production.**
>
> **Two things the live run surfaced, neither a defect in this slice:** the same Q&A sentence conflicts *two* fields and renders as two identical-looking rows with nothing saying which field each belongs to (cosmetic, real); and that same sentence being offered as a conflict for `closes_at` is live evidence that `fields.ts`'s cue vocabulary is imprecise — the widening work already parked with the labelling task. The precedence rule itself behaved exactly right: the listing won, the loser stayed visible.
>
> **1. ~~This docs pass was never reviewed.~~ ✅ IT WAS — the review landed moments after this block was first written, and it is CLEAN.** Task 14's first reviewer stalled without a verdict; its replacement returned **Spec ✅ / Approved**, having verified all ten claims *against the repository* rather than against the diff's prose. Confirmed true: D1–D16 strictly sequential with no duplicate or skip; the score strip genuinely absent from `Queue.tsx`; the cost panel genuinely `note`-only with no children; the record's documents section genuinely `<pre>` + external link with no embed; `ORDER BY s.closes_at ASC NULLS LAST`; `ScoreBar`'s `number | null` empty state; **SP4 §10.1's original text intact — the hunk is pure addition, zero deleted lines**; the route table; the gate figure cross-checked against an independent file count of 68; and the zero-documents warning stated plainly under its own heading. It also confirmed nothing was improperly deleted — the old production-click-through warning was *relocated and expanded*, not lost, and the vestigial-score claim was struck through in place per convention. **This block is no longer unverified; the sentence above was true for about ten minutes.**
>
> **2. ~~The final whole-branch review has not run.~~ ✅ IT HAS — verdict READY WITH FIXES, and all of them are fixed.** It found one **Critical** that per-task reviews structurally could not: **the client never sent `decided_by`**, so every row the gate counts would have been written `NULL`, unbackfillable, with Task 15 writing real rows immediately after. The server accepted and stored it and had tests; Task 7 built the parameter, Task 12 built the keypress, and the wire between them was nobody's scope. Also four Importants (a 401 never clearing the secret and so bricking a session; drawn items silently vanishing from the sample queue when their deadline passed; a "Queue cleared" screen that was a literal dead end; a metrics test passing on an md5 coin flip) and six Minors. **All twelve fixed and re-reviewed clean.**
>
> ⚠️ **It also corrected the flaky-gate diagnosis recorded above.** Not pool contention: `runSuffix()` gave *every* local run the suffix `local`, so two concurrent local gates resolved to the same schema and each file's `resetSchema()` dropped the other's tables mid-run. Ruling 3 closed that for CI (distinct `GITHUB_RUN_ID`s) and did nothing locally — and the false belief was written down **as fact** in `schema.test.ts`'s comment, which is what sent the diagnosis to the wrong place. Fixed via a per-run `TENDERFOOT_RUN_ID`; the comment is corrected. ⚠️ That fix in turn silently disabled `npm run test:clean` (it computed the suffix in its own process), leaking a schema per test file into the shared branch — also found, also fixed, by having `check.mjs` run cleanup itself.
>
> **3. ◐ Task 15 — the demo criterion — RAN ON `test`, ALL SEVEN BULLETS PASSED. The production half has not run, and that decision is Matt's.**
>
> **The database was identified positively, not inferred: 77 documents present, and production has zero.** Gate proved live (unauthenticated POST → `401`, not `503`). Browser driven over CDP with `sessionStorage` seeded for both the admin secret and `decided_by` **before** navigating, so `window.prompt` never fired.
>
> Sample id 1, SAM.gov, seed `gate-2026-08-31`, **population_size 1018 recorded at draw time**. The queue announced itself on screen — *"SAMPLE · 25 of 1,018 · SAM.gov · seed gate-2026-08-31"* — while the ordinary queue stayed a separate, larger thing (1040), so sampling changed nothing about what the product returns. Decisions were made **from the keyboard**: `I` advanced the card 25→24, `U` restored it, and the database holds **two `pursuit` rows for solicitation 1403 — `Interested` then `New`, both surviving, latest winning, `decided_by` populated on both.** A bare `P` with no reason correctly refused and did not advance.
>
> **Interested-per-hundred: population 1018 · drawn 25 · decided 5 · interested 3 · rate 60** — all three numbers shipped together, as designed.
>
> ✅ **RESOLVED 2026-08-31 — and the cause was ours, not SAM.gov's.** `merge.ts` wrote exactly four solicitation columns (`external_id, title, source_id, closes_at`); the only writer of `posted_at` anywhere in the server was `ingest/corpus.ts`. **So no row arriving via live ingestion had a posting date, on any branch, from any source** — this was never a SAM.gov data gap. `merge/posted-at.ts` now reads it from the payload, exactly as `closes-at.ts` reads the deadline, and merge backfills existing rows. **Measured on `test`: posted_at coverage 140 → 1,864 of 1,925 rows; the volume series' exclusions fell 1,785 → 61; and SAM.gov now has a week bucket where it had none — 1,724 notices in the week of 2026-08-17.** Half of the gate's required output exists for the first time. The original entry follows, wrong diagnosis and all:
>
> ⚠️ ~~**And the gate produced its first real finding, which is about the DATA and needs Matt.** **1,724 SAM.gov solicitations carry `posted_at = NULL`**~~ (plus 61 corpus rows = exactly the 1,785 excluded). Verified with the product's own predicate: 140 parseable, 1,785 excluded, **zero malformed-but-present** — so the metrics code is correct and the exclusion is entirely *absent* values. But **SAM.gov is the only enabled source, so volume-per-source-per-week cannot measure it at all.** That is an ingestion gap, not a metrics bug, and it is exactly what this instrument was built to surface loudly rather than average away.
>
> **Bullets 5 and 6 landed on a real conflict rather than a fixture** — record 459, *Building 333 - Roof Repair*: `prebid_at` **2026-08-17 at 60%** quoting *"To move the Site Visit day and time…"*, with **2026-08-13** preserved beneath it, origin `document`, quoting *"Site Visit: A site visit is scheduled for August 13, 2026 at 1:00 PM Central"*. An original date and the amendment moving it, both kept, the disagreement shown. **That is the FSSA near-miss shape occurring in live data — seen by a person for the first time.**
>
> **Merged and live.** `sp6-triage-record` is fully merged into `main` (`19688be`, `--no-ff`) and pushed; the branch is kept, as `sp4-fetch-extraction` was. Production runs SP6.
>
> **The full session ledger — every ruling, every deferred finding, and the eleven defects the implementers found in my own briefs — is at `.superpowers/sdd/2026-08-30-sp6-triage-record/progress.md`.** It is git-ignored scratch, so `git clean -fdx` will destroy it; the commits it names survive in `git log` either way.

**Branch `sp6-triage-record`, 24 commits before this one, branched from `main` at `34c0035`.**
Working tree clean, gate green at **520 tests / 68 files** (baseline entering the slice was
**430 / 58**), `npm run check` exit 0.

### What SP6 built
Migration **012** — `triage_sample`, `triage_sample_item`, and the `pursuit_latest` index (decisions
are append-only; reads take latest-row-per-solicitation). New server modules:
`triage/eligibility.ts`, `triage/latest.ts`, `triage/queue.ts`, `triage/sample.ts`,
`triage/decide.ts`, `triage/metrics.ts`, `routes/triage.ts`. New client: `shell/Shell.tsx`,
`triage/Queue.tsx`, `triage/useQueueKeys.ts`, `record/Record.tsx`; `Button` gained
`onClick`/`ariaLabel`/`type="button"` (it shipped at SP2 with no click handler at all —
Task 10). **Routes now:** `/` → the queue, `/solicitation/:id` → the record, `/health` → the old
health page (moved off `/`), `/admin` unchanged. `GET /api/health` — what production
verification actually calls — is untouched.

### Where the design lives, and what deviated
**Seven rulings, all made in one 2026-08-30 brainstorm with Matt** —
`docs/superpowers/specs/2026-08-30-sp6-triage-record-design.md` §1: the gate triages a
*materialised random sample*, never the queue itself, so the queue stays judgment-free; scope is
queue + record only (`View 2.1 : Brief` and `View 1.2 : Saved Views` are out, §2.2); default
order is deadline-soonest-first; decisions are append-only (undo writes a reversal, nothing is
overwritten); the sample is materialised, migration 012, so its denominator outlives the session;
the score strip does not compose onto the queue card; the pursuit-cost panel renders empty and
says so. **Five deviations came out of it, `docs/admin-deviations.md` D12–D16** — D11 was already
taken at Task 9 (the StatusBar "Failing"/"DEGRADED" health-vocabulary note), so this slice's five
are D12–D16, not D11–D15 as the plan first numbered them before that collision was found.

### ✅ A stale claim is corrected, not just noted
STATUS used to say *"how 'vestigial' should look is undesigned and stays that way until Matt
specifies it."* **That is false — SP2 built it.** `ScoreBar` (`app/client/src/primitives/ScoreBar.tsx`)
takes `value: number | null`, renders `—` with no fill under a `score-bar--empty` class, and its
own comment records *"null is the V1 case (assessment table empty by design, spec §1.1)."*
D13's actual ruling is narrower: the strip does not **compose** onto the queue card — a placement
decision on top of a look that already existed, not an unbuilt look. Struck through and corrected
in place at STATUS's own "Decided this week" entry rather than deleted.

### ✅ SP4's deferred demo bullets are discharged
`docs/superpowers/specs/2026-08-28-sp4-fetch-extraction-design.md` §10.1 deferred two demo-criterion
bullets into SP6 — a field shows its value, confidence and the quoted passage; a conflict renders
beneath the winner rather than being resolved away. **Both are built**, `app/client/src/record/Record.tsx`,
tested in `Record.test.tsx`. A dated line was appended recording this; §10.1 itself is preserved
exactly as written, because what the deferral cost is the point of keeping it.

### ⚠️ The sequencing fact Task 15 cannot skip
**Production holds ~9,883 solicitations and ZERO documents.** Discover has never run there — SP4's
one unrun, non-deferred criterion bullet. The record view's citations (design spec §14 bullets 5
and 6) have nothing to show against a production solicitation until Discover runs on production;
the 79 extracted documents with cited fields that exist today sit on the `test` branch. **Task 15
must do one of two things, and say which:** run Discover on production first, or take the record
half of the demo on `test` and report it as a `test`-branch demo. **What must never happen: the
demo taken on `test` and reported as production.** ⚠️ The first Discover click on production
writes `document` rows into a database that currently has none.

### ⚠️ The gate flaked twice under concurrent load — a caveat, not a fix
During Task 13, two full `npm run check` runs each failed one unrelated test inside
`app/server/src/extract/*` — a **different** test each time — while isolated re-runs of the same
files passed clean and a third full run was clean. Reads as Neon test-branch connection-pool
contention under full concurrent load, not anything this slice's own code touched, and it was not
chased further. Recorded because this project's own standard has been *"green-on-CI means what
green-on-laptop means"* since 2026-08-15, and an intermittently red gate is exactly the kind of
thing that gets explained away twice and then trusted without evidence. **If a future full-gate
run fails inside `extract/*` with no nearby code change, re-run it before treating it as a
regression — but a recurrence is worth escalating, not re-running away indefinitely.**

### Deferred minors, carried rather than lost in `progress.md`
A dozen smaller findings accumulated across the thirteen tasks and are flagged in
`.superpowers/sdd/2026-08-30-sp6-triage-record/progress.md` (search `minor (deferred)`) for the
whole-branch review still to come: test-order fragility from shared fixtures across two files
(Tasks 3, 6), an unbound `LIMIT` interpolation in `sample.ts` (Task 5, numerically clamped, no
injection risk), thin mutation coverage in a couple of files (Tasks 11, 12), a stray-reason-text
edge case in the undo flow (Task 12), and an untested DOM-order assumption in the timeline
(Task 13). None of them block Task 15; triaging them is what the whole-branch review is for.

### Still Matt's, none blocking
Whether Vercel's build should fail on type errors; the staging-branch decision; deleting the
abandoned `preview/sp3-federal-ingestion` Neon branch **from the console, not the MCP**.

### ⚠️ One thing not to undo
**The labelling task is still PARKED** (next block down). Do not restart it, and do not quote
**12.5% recall** as measured — it is an unvalidated lower bound.

---

## ⏸ PARKED — the deadline labelling task. Ruled by Matt, 2026-08-30.

**`docs/2026-08-30-deadline-labelling.md` is built and committed, and is NOT the next task.**
Nobody is working it. It is out of the sequence until Matt takes it up again.

**Why it could be parked cleanly:** it gates nothing. SP6's gate measures *"discovery and volume,
not precision"* (Plan of Action §6), so extraction recall is not an input to the GO / NO-GO
decision the next slice exists to make. And SP6 will surface the question better anyway — the
citation display deferred into it shows value, confidence and the quoted sentence per record, so
paging through real solicitations gives a feel for recall that the worksheet cold does not.

### ⚠️ WHAT DIES WITH IT — the recall figure is now formally UNVALIDATED

**`recall 12.5%` is a LOWER BOUND, not a measurement, and every place it appears now says so.**
It is `2 ÷ 16`, and the 16 assumes **all fourteen misses were ours** — that every one of those
documents states a deadline we failed to read. Nobody has checked; a first skim of the worksheet
suggests several genuinely never state one, in which case the true denominator is smaller and the
real recall materially higher.

**This is the same class of error `corpus/calibration/README.md` already legislates against** — a
figure whose base rate is wrong by construction. That rule bans the *flattering* version. This is
the unflattering one, which is easier to leave standing because it feels like caution, and is
just as untrue. **Do not quote 12.5% as the system's measured recall** — not in a report, a demo,
or a threshold decision.

**Also parked with it:** widening the cue vocabulary in `fields.ts` (we know `"must be returned
no later than"` is missed, and not what else), and **setting the accuracy threshold** — spec §9
deferred that until a real number existed, and there still is not one.

**Nothing here is pre-specified.** When the task comes back it starts from the worksheet as
built; no design decisions were taken in advance of it.

---

> ✅ **SP4 IS MERGED TO `main`, 2026-08-30** (`cc8babe`, `--no-ff`, sixty-one commits), and
> **deployed to production and verified**. The working tree is on `main`; `sp4-fetch-extraction`
> still exists and is fully merged. The long-standing warning that lived here — *you are on a
> slice branch and production is deployed from it* — is retired. ⚠️ One correction it earned on
> the way out: a **CLI deploy uploads the working tree, not a git ref**, so the branch was never
> what production ran *from*, only what it was built *out of*.

**Working tree CLEAN. Gate green at 430 tests / 58 files, `npm run check` exit 0.** Production is deployed and healthy (`/api/health` returns `ok`, migrations 001–010). **The pinned block above has no outstanding rulings** — read it first, then this.

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

### ✅ 2026-08-30 — THE FIRST LIVE RUN, and the bug only it could find

**`bbe0992`.** Ran against the Neon `test` branch — identified **by data** first (1,724 SAM.gov solicitations; production has 9,682) and by endpoint identity against `DATABASE_URL_PRODUCTION`. **The queue was 79 pending documents, not the 53 this block previously claimed.** Every one belonged to an already-CLOSED solicitation (deadlines 08-21 to 08-29) — **a live vindication of the §4.3 call**: with `closes_at >= now()` implemented, the whole queue would have been invisible and `remaining` would have sat at 79 forever.

**🔴 A NUL BYTE KILLED THE WHOLE BATCH, and no fixture could have produced it.** `B3001G-Modernize Foyer Scope Drawings 3.13.26 - Copy.pdf`, a real SAM.gov drawings PDF, parses to text containing `0x00`. Postgres `text` cannot hold one — `invalid byte sequence for encoding "UTF8": 0x00` — and it is the **one** character with that property. **Two defects, not one:** the text was not sanitised, and the throw came from the `UPDATE`, which sat **outside** the try/catch around `parse()`, so it escaped `runExtract` and took every remaining document with it. ⚠️ **"One bad document does not kill the batch" stayed green throughout** — all of *its* bad documents fail at PARSE time and never reach a write. Both fixed, two mutants, both killed.

**What the per-document commit was worth, measured:** the crashed batch left 6 extracted and 2 failed **committed**, 71 pending, and the document that threw still `pending` — consistent, resumable, retried successfully next run. **Nothing rolled back.** And the budget stop fired unprompted on real data: 32 documents in 125.9s against a 120s budget, then a clean stop reporting `remaining: 14`.

**📊 FIRST LIVE ACCURACY READING — all 79 documents, 0 pending at the end.** `closes_at`: **agreed 2, disagreed 0, missed 14, opportunities 16** — precision **100%**, recall ⚠️ **12.5% UNVALIDATED — a lower bound, not a measurement** (the 16 assumes all fourteen misses were ours; see the PARKED block at the top). Both hits match the portal exactly; the clearer quotes *"Proposals are due no later than: August 31, 2026 at 10:00 AM Central"*. **The misses are self-describing:** 53 of 69 rows carry no note (no date in the text — Q&A sheets, wage determinations, forms: clean true negatives) and **16 carry "a date was present but no cue placed it in this field"**. Those 16 are the actionable recall signal for `fields.ts`, and they are exactly what Task 7's note was built to make visible. **Not chased** — the instrument's job was to surface them, and it did. The other five fields do not appear at all: the `truth` CTE needs a STATED listing value and the listing states none of them either, so there is no opportunity to miss.

**✅ The three small things are FIXED, same day.** Each reason the run recorded was true and useless, in a different way. `unsupported type: current request for proposal` came from splitting a filename on `.` and taking the last part — the whole name, when there is no dot. `download failed: HTTP 400` was indistinguishable from SAM.gov being down; **probed live, the body says `{"errors":{"message":"The resource has been deleted."}}`** on all four — permanent, never worth retrying, and sitting unread. And `parsed but produced no text` was indistinguishable from a corrupt file or an unpdf fault: **pages but no text is a scan**, so `parsePdf` now reports the page count and the fail-closed branch carries the parser's explanation into `source_note`, without which the fact stops at the parser. **Verified on the nine real failed rows, re-queued and re-run**, not only on fixtures — 9 of 79 documents fail (11.4%), all nine permanent and all nine now self-explaining.

⚠️ **The page counts surfaced a category nobody had named:** three of the "scans" are **photo attachments** — `Canopy Pictures` (8 pages), `Pictures - Set 1` (20), `Pictures - Set 2` (20). OCR would not help those; they are photographs, not scanned text. "Image-only PDF" is at least two categories and only one could ever repay OCR.

### ✅ 2026-08-30 — SP4 Task 12, the screen and the seam test

**`c75d080` + `f5b959c`.** The two batch controls on `/admin`, and the FSSA regression test. **Browser click-through RUN over CDP** against the `test` branch — both controls enabled, both clicked, both reported, no console errors, no failed API requests.

**🔴 THE BRIEFED SEAM TEST CANNOT PASS, and finding out why was the work.** It asserts a conflict over the real FSSA bundle; there is none, because every value today's extractor states is `2026-09-17`. **FINDINGS §1 is not wrong** — two of the three PDFs really do carry `August 26, 2026`. ⚠️ **The extractor misses it because the cover pages read `Submission Due Date and Time:
August 26, 2026` — cue and date on DIFFERENT LINES — and `fields.ts` clamps the lookback at a block boundary.** The schedule tables put cue and date on one line, which is why 17 September *is* found. **So the extractor is blind to the label-above-value layout, and is safe here BY ACCIDENT.** Relax that clamp — a natural-looking improvement — and these documents begin stating the stale date, at which point precedence becomes load-bearing for real. ⚠️ **I claimed this "very likely explains much of" the live run's 16 unplaced-date notes. MEASURED 2026-08-30: it explains ZERO of them.** Not one of those sixteen documents has a deadline cue near a date, on the same line or across one. The clamp blindness is real and the FSSA bundle proves it; it is simply not what the live misses are made of. **See the parked entry below for what they actually are.**

Split into three tests, none of which lies: the premise (the stale date really is in the bundle, checked first), the real files (listing wins, and at least one document was actually read), and the protection itself with the documented values fed in directly. **Deliberately not pinned: the absence of a conflict** — that is today's accident, and pinning an accident makes a future improvement look like a regression. Mutating precedence fails with *"expected 2026-08-26 to be 2026-09-17"* — the near-miss itself.

**Two more brief defects.** Both buttons were spelled `disabled={busy}`, and `busy` is a `Record<number, boolean>` — always truthy, so they would have shipped **permanently disabled** (D10). And the readout flattened both endpoints into `data.processed ?? data.documents ?? 0`, printing a zero for a key the endpoint never sends.

**The click-through found a third thing, in my own readout.** A real Discover reported *"0 document(s) from 10 solicitation(s)"* and nothing could say whether those notices carry no attachments or whether **all ten requests failed**. `discover.ts` added `skipped` for exactly that distinction and I had left it off the only surface that shows it. Fixed and re-run: *"0 skipped"*, so the answer is genuinely "no attachments".

### ✅ RULED 2026-08-30 — criterion bullets 2 and 3 go to SP6

**Matt's call.** Both need a solicitation **record view**; no SP4 task builds one and the slice table puts the record in **SP6 (Triage + record)**. Recorded at the criterion itself — `docs/superpowers/specs/2026-08-28-sp4-fetch-extraction-design.md` §10.1 — so a future reader of §10 does not conclude SP4 failed it.

⚠️ **What dies with it, named there in full and summarised here.** SP4 can no longer demonstrate its own headline — the slice is *"fields **cited**"*, and deferred it proves a citation is **stored**, never that it is **readable**. `precedence.ts` keeps rejected values on the explicit ground that *"a rejection you cannot inspect is a bug you will never find"*, and the only person who can now inspect one holds a `psql` prompt. The FSSA near-miss stays theoretical inside the product. **And the expensive one: whether these citations are USEFUL — quote long enough, confidence meaningful, six fields the right six — is now first tested at SP6, which is the GO/NO-GO gate.** Nothing about the record view is pre-specified here; that is SP6's to design.

**SP4 still passes bullets 1 and 4 on its own**, and both were run: nothing processed stays `pending`, and the accuracy query returns a number per field.

### ✅ 2026-08-30 — THE REVIEW, and fix round 1

**`f181aca`** (plus `221c1db` for the spec-conformance pass). The whole unreviewed range `3ce778d..HEAD` reviewed at once — Task 9's six post-review additions, the gate hygiene, and Tasks 10/11/12. **Seven findings, all seven correct** on my own check of the source. Gate **426 tests / 58 files**. Every fix written test-first, each watched red.

**🔴 DISCOVERY COULD NOT ADVANCE (finding 2).** `NOT EXISTS (document)` was the only thing retiring a candidate, and a notice that legitimately carries no attachments never gets a document row — so it re-qualified on every run, forever. Ten such notices at the head of the queue stall the phase completely under the screen's `?limit=10`. ⚠️ **I had already seen this and misread it:** the click-through's *"0 document(s) from 10 solicitation(s), 0 skipped"* went into this file as the benign case when it was **also the stuck case**. `skipped: 0` proved the requests succeeded; nothing proved discovery could ever move on. **A number that answers one question is not evidence about a different one.** Migration 011 adds `attachments_checked_at`, stamped only after SAM.gov actually answers — the cheaper "retire once listing rows exist" would have retired notices whose request merely *timed out*, since those rows are written before the fetch. **Proven on real data: two consecutive runs now ask about different notices.**

**🔴 REFRESH REPAIRED ONLY THE MOST-EXPIRED ROWS, FOREVER (finding 1).** It copied the candidate query's `ORDER BY closes_at ASC` but not its live filter, and ascending order over an unfiltered set puts the longest-closed notices first — so the listing rows for **live** solicitations, the only ones `accuracyByField` uses, were never repaired. **`run-extract`'s queue had the identical defect (finding 4), in reasoning I had defended at length.** Two-key sort in both: live first, nearest within.

**🔴 FOUND WHILE FIXING FINDING 6, AND WORSE THAN IT — the queue is a SNAPSHOT.** A bundle and one of its own member rows could both be in one batch: the bundle expanded and correctly extracted the member, then the loop reached that same member as a stale entry, found no `source_url`, and **overwrote the good extraction with a failure.** Live, not latent. Members are now excluded from the fetch queue entirely — a member has no URL by construction and its parent is responsible for it.

**The rest.** A partial unique index stops duplicate members after a platform kill (6). **The gate guard checked the variable the build discards** (3): `refuseToRunAgainstProduction` compared `DATABASE_URL` while the build step substitutes `DATABASE_URL_TEST` — so the value `migrate:deploy` connects to was never compared to anything. **Proven live**: with `DATABASE_URL_TEST` pointed at production for one command, the new guard exits 1 and names the endpoint. `/discover` gained the budget its handler comment already assumed (5), and `remaining` now shares the queue's predicate (7).

**Also fixed before the review landed, from a spec-conformance pass:** design §7's **"a 429 stops the batch cleanly"** was missing entirely — the old code treated 429 as an ordinary failure and kept firing at a host that had just asked us to slow down, marking the document permanently `failed` when a 429 is the most transient failure there is. And §8's **resumability row** had no test: the budget test used `budgetMs: 0`, proving only the all-pending case, never the mixed one that 2026-08-27 got wrong.

**Three reviewer notes ruled and not fixed:** a 429 on the first document reads on screen as `processed 0, 0 failed, N remaining` — indistinguishable from an idle run, accepted as a real gap but it wants a contract change Task 12's readout is already carrying two of; `refreshed` is returned but never displayed; and `Candidate.value_cents` is typed `string` while the oid-20 parser makes it a number at runtime (harmless, `String()` masks it).

### ✅ 2026-08-30 — REVIEW ROUND 2, and fix round 2

**`2e8bff7`.** Six findings on the fix round itself, **two Major — one of them a regression round 1 created.** All six correct on my own check. Gate **430 tests / 58 files**.

**🔴 I BROKE SAME-NAMED BUNDLE MEMBERS (finding 2).** The unique index added to stop *duplicate* members made `filename` load-bearing — and `parseZip` flattens every entry to its basename. A bundle shipping `Volume 1/SOW.pdf` and `Volume 2/SOW.pdf` — **ordinary** in federal solicitations, which ship per-volume folders — produced two members with **one** name, so the second collided with the first and its bytes, text and fields were discarded with nothing recorded anywhere. Before the index, both files got their own row and both were read. **The fix meant to prevent duplicate rows was silently deleting real files.** Members now carry the full archive path: unique within an archive by construction, and a better record besides.

**Migration 011 now de-duplicates before building that index (finding 1).** Its own comment asserts the duplicates it prevents have already been produced — and if any pair existed, `CREATE UNIQUE INDEX` raises 23505, **blocks the deploy permanently** (every retry hits the same rows), and takes the `ADD COLUMN` in the same migration down with it, leaving the newly deployed candidate query reading a column that does not exist.

**The rest.** Excluding members from the queue opened a hole at the far end — a member left pending by a parent that failed mid-expansion was reachable by nothing and uncounted in `remaining`; a **reconciliation pass** at the top of `runExtract` surfaces it, chosen over a catch-local sweep because a platform kill runs no catch at all (3). `attachments_checked_at` gained a **bounded re-check window**, so a notice amended tomorrow with new attachments is asked again rather than retired forever (4). And the sort grew a **third key**: the second left the expired group ascending, and on 2026-08-30 *every* queued document was expired, so the live-first key selected nothing and the ordering collapsed to the one it had just replaced (5). Finding 6 accepted and largely dissolved by 4's fix.

⚠️ **The typecheck, not the test run, caught a test that could not have asserted what it claimed** — `stub.mock.calls[0]?.[0]` against a stub declaring no parameters, so `calls` was a list of empty tuples.

### ✅ DEPLOYED TO PRODUCTION — 2026-08-30

**Deployment `7wwFyW2DE6CbQgUacfAgpEM5JdAi`, status Ready**, holding the production alias `tenderfoot-tau.vercel.app`. Deployed from `sp4-fetch-extraction` @ `a0f289d` by CLI (`vercel deploy --prod`), which uploads the working tree rather than a git ref.

**Verified, in four separate ways rather than one:**
- `/api/health` returns `ok` and lists **all eleven migrations, 011 included**.
- ⚠️ **That only says a file was RECORDED as applied.** Checked read-only against production that the schema it describes actually EXISTS: `solicitation.attachments_checked_at` is `timestamptz NULL`, and `document_member_unique` exists with the exact partial predicate `WHERE (parent_document_id IS NOT NULL)`.
- **Data intact**: 9,883 solicitations, 11,121 sightings, 0 documents, 0 extracted_fields — the zeroes are expected, discover has never run on production.
- Both new endpoints are live and gated: `POST /api/admin/discover` and `/api/admin/extract` answer **401** with no secret.

**Two things worth not re-deriving.** The first `vercel --prod` attempt failed `Not authorized`; passing `--scope koehler-partners` explicitly fixed it, even though `vercel whoami` already reported that account and the project's `orgId` **is** that team's id. And piping the deploy through `head` killed the local CLI with exit 134 — **the build was unaffected and completed server-side**, so the right response to a truncated deploy is to INSPECT the deployment, never to redeploy. ⚠️ The `list_deployments` MCP tool answers **403** for this project's token, matching what the runtime-log API already does; `vercel inspect` works.

### ✅ MERGED TO `main` — 2026-08-30 (`cc8babe`, `--no-ff`, 61 commits)

Gate green on `main` at **430 tests / 58 files**, trees identical to the branch, `git branch --merged main` lists `sp4-fetch-extraction` with nothing outstanding. **SP4 is closed.**

### ⏭ START HERE — SP6, and two things that outlive SP4

**The next slice is SP6 — Triage + record, the GO / NO-GO gate.** It now also carries **two bullets of SP4's own demo criterion**, deferred to it by ruling because they need a record view SP6 owns; the spec's §10.1 names what that deferral costs, and the short version is that SP4 proved a citation is *stored*, never that it is *readable*.

**Two things carried out of SP4, neither blocking:**

1. **The click-through on production.** The one non-deferred criterion bullet still unrun. ⚠️ **The first Discover click on production will ask SAM.gov about live notices and write `document` rows into a database that currently has none** — production holds 9,883 solicitations and **0 documents**. Bounded by `?limit=10` and the clamp, but it is the first write of its kind there.
2. ~~**The deadline labelling task**~~ **⏸ PARKED 2026-08-30 by ruling — see the block at the top of RESUME HERE.** Worksheet built and committed at [`docs/2026-08-30-deadline-labelling.md`](docs/2026-08-30-deadline-labelling.md) — 14 blocks, one per recall miss, each with the portal's value, every document read, and every date-bearing line in context, with a `VERDICT` field per block. **The 12.5% recall figure assumes every miss was ours**, and nobody has checked; a first skim suggests several are clean `NOT-IN-DOC`, which would mean the extractor is doing considerably better than the number says.

**Still Matt's, unchanged:** whether Vercel's build should fail on type errors; the staging-branch decision (`.env`'s `DATABASE_URL` and `DATABASE_URL_TEST` are the SAME string, both `test`, which ci.yml mirrors deliberately); and deleting the abandoned `preview/sp3-federal-ingestion` Neon branch from the console, **not** through the MCP. **Now also actionable:** the accuracy threshold spec §9 deferred until there was a real number — there is one.

**Parked, not scheduled — and the lead changed once it was measured.**

**What I first claimed, and it was wrong.** `fields.ts` is blind to the label-above-value layout — a cue on one line and its date on the next falls outside the block-clamped lookback — and I wrote that this "very likely explains a large share" of the live run's **16 "a date was present but no cue placed it"** notes. **Measured against those sixteen documents: it explains 0 of 16.** None of them carries a deadline cue near a date at all. The blindness is real (the FSSA cover pages prove it) and worth fixing on its own terms; it is not the cause of the live recall figure.

**🔴 What the misses ACTUALLY are — a cue vocabulary gap.** Two of them (`QTR 1 Halal` and `QTR 1 Bread Combined Synopsis`) say, in plain language: *"completed solicitation package must be returned **no later than** 7:00 a.m. Central Time on August 31, 2026."* That is a deadline, sitting well inside the lookback window, missed because the cue list is `due | deadline | closing | submitted by | received by` and **"returned no later than" is not in it.** Widening the vocabulary against real phrasings is the cheap, high-yield change; relaxing the clamp is the expensive one, and it now has to justify itself separately.

**Several of the sixteen are genuine true negatives** and should stay missed: a date in a drawing's title block (`MARCH 13, 2026`), a FAR clause effective date (`January 1, 2030`), a date in an address block. The instrument scoring them as misses is the cost of counting per solicitation rather than per statement — known, and not a defect.

⚠️ **The real recall denominator is still unmeasured.** 12 of the 14 missed solicitations have at least one document containing *some* deadline word, but "contains the word due" is a weak proxy — boilerplate is full of it. **Only hand-labelling answers it**, which is the highest-value thing a human can do for this slice.

**Open, and Matt's:** ② whether Vercel's build should fail on type errors; ③ the staging-branch decision — `.env`'s `DATABASE_URL` and `DATABASE_URL_TEST` are the SAME string, both pointing at `test`, which ci.yml mirrors deliberately; ④ delete the abandoned `preview/sp3-federal-ingestion` Neon branch from the console, **not** through the MCP. **Standing:** execute the slice sequence in order, no shortcuts (ruled 2026-08-29).

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
   - **Why CI never saw any of it, and it is not luck.** ~~`runSuffix()` is `GITHUB_RUN_ID ?? "local"`.~~ **CORRECTED 2026-08-31 (SP6 residual fix wave): `runSuffix()` is now `GITHUB_RUN_ID ?? TENDERFOOT_RUN_ID ?? "local"`, and `check.mjs` mints a fresh `TENDERFOOT_RUN_ID` per invocation — so a local run no longer falls back to the constant `"local"` either.** CI gets a **fresh, never-before-used** schema name every run and drops it at the end (`npm run test:clean`, `if: always()`), so its `DROP SCHEMA IF EXISTS` is a no-op on a name that never existed. ~~Locally the suffix is the constant `"local"`, so `test_corpus_local` **persists populated between runs** and every local gate pays to drop it.~~ **CORRECTED: locally the suffix is now a fresh random id per run, same as CI, so each local gate gets its own distinct schema too — `test_corpus_local` no longer exists, and `check.mjs` now runs `test:clean` itself after the suite so the leak this bullet describes doesn't return.** **CI green is not evidence this is fixed, and never was.**
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

**2. ~~🟡 §6.4 A3: does source health move in front of the GO gate?~~ ✅ RULED YES 2026-08-16 — it moves.** A read-only liveness surface lands BEFORE SP6, not alarms, and not in SP7. **The volume data sharpened the case the same day it was ruled:** SAM returned 530 open notices one day and 57 the next, and nothing in the sequence could have told that swing apart from a source that had quietly died. ~~⚠️ This is a slice-boundary change and `docs/Tenderfoot-Plan-of-Action.md` §6 does NOT yet reflect it.~~ ✅ **Done 2026-08-16, confirmed 2026-08-30** — §6.4 records the amendment and the sequence now reads `… SP3.5 → source health → SP4 …`. *Original framing:*  `Region A.2 : Status Bar` rules `Pri 4` — higher than the shell that contains it — and §6 currently puts health in SP7, *after* SP6. **The tension is whether the gate's number means anything:** SP6 measures volume and Interested-per-hundred, known risks record four silent-failure instances across three platforms, and nothing in the sequence would distinguish a quiet market from a dead source. Proposed: a read-only liveness surface before SP6, not alarms. **A slice-boundary change, so it is Matt's.** If declined, SP6 must name how source liveness gets verified instead. **✅ NOW BUILT, 2026-08-18 (SP3.6, branch `sp3.6-source-health`, not yet merged).** The liveness surface exists — migration 006, the probe subsystem, Check and Run on `/admin` — but `Region A.2 : Status Bar` from the original framing above is still not built; A3 named it likely unbuildable on its own (a shell region, and the shell is a hard SP-ordering dependency), and SP3.6 put health on the registry column instead of waiting on it. ~~The `docs/Tenderfoot-Plan-of-Action.md` §6 re-sequencing edit is still outstanding.~~ ✅ **It was done on 2026-08-16; this sentence was stale for a fortnight and is corrected 2026-08-30.**

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
| **SP4** | Fetch + extraction — documents parsed, fields cited | ✅ **MERGED to `main` 2026-08-30** (`cc8babe`, `--no-ff`), built and deployed the same day. Twelve tasks, 61 commits, gate **430 tests / 58 files**. Migrations 010 and 011. **Run live**: 79 documents processed on the test branch, 0 pending; first accuracy reading `closes_at` agreed 2 / disagreed 0 / missed 14 / opportunities 16 — precision 100%; ⚠️ **recall 12.5% is UNVALIDATED, a lower bound rather than a measurement** (the denominator assumes every miss was ours; validating it is PARKED). Browser click-through done over CDP. **Two review rounds, thirteen findings, all fixed** — including a regression the first round created. Demo criterion bullets 2 and 3 **deferred to SP6** by ruling; what dies with that is in the spec's §10.1. ⏭ Remaining: the click-through on PRODUCTION, and the deadline-labelling task |
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
| ~~🟡 **§6.4 A3: source health in front of the GO gate?**~~ | ✅ **RULED YES 2026-08-16 — source health moves in front of the GO gate.** A read-only liveness surface, not alarms. **Sharpened by measurement rather than argument:** 530 open SAM notices one day, 57 the next — a swing the sequence had no way to distinguish from a dead source. ~~⚠️ `docs/Tenderfoot-Plan-of-Action.md` §6 still places health in SP7 and has not been re-sequenced.~~ ✅ **FALSE since 2026-08-16, corrected 2026-08-30** — §6.4 carries the amendment (*"AMENDED 2026-08-16 — one does"*) and the sequence at §6 reads `… SP3.5 → source health → SP4 …`. SP7's row still says *health alarms*, which is **correct and not stale**: A3 ruled a read-only liveness surface, and alarms were always SP7's. **✅ BUILT AND MERGED 2026-08-18 — SP3.6 (`a110e93`, `--no-ff`), demo criterion fully run the same day, including the browser half that found two defects the server half could not.** *(This cell said "not yet merged, demo criterion not yet run" until 2026-08-30.)* `Region A.2 : Status Bar` remains unbuilt |
| ~~Prototype V1.2 — wordmark, mobile breakpoints~~ | ✅ **Both closed 2026-08-13.** V1.2 landed and was verified against V1.1 rather than trusted (colours 132→132, media queries 0→0, `display:flex` 74→73 — exactly the one disclosed wrapper). **The wordmark item turned out to be a deletion, not a design** — the logo already existed; only the 8px placeholder *label* was provisional. **Mobile ruled desktop-only** by measurement, not instinct; a separate mobile client is now plan of record |
| 📎 **`THOUGHTS.md`** — ✅ **tracked 2026-08-14**, committed verbatim. Four ideas from 08-11. **Two bear on open questions:** *levels of research and qualifying against that research* collides with the qualification work spec §1.1 parks as **undesigned** — note the collision, don't resolve it — and *what analysis 20+ years of historical data enables* is real against the 2,160-contract corpus (Illinois backtests to 2018). The other two are V2-shaped, past SP8. **Still to decide: promote the live two into backlog, or leave filed** | Nothing |

## Waiting on Claude

| | |
|---|---|
| ~~B3 for SP0~~ · ~~B3 for SP1.5~~ · ~~B3 for SP2~~ | ✅ written and executed. SP2's scope grew 2026-08-13 — the parked intelligence chrome is built inert, so it was never "mostly transcription" |
| ~~SP1 T12–T15~~ | ✅ **BUILT 2026-08-16.** Five deviations logged in `docs/admin-deviations.md` — ⚠️ **the frozen bundle renders both admin screens READ-ONLY**, with no toggle, no posture editor, no profile input and no scrape trigger in 700KB, so every control on this screen is invented and numbered. **D5 was the one to know then: §9.6's scrape trigger was still unhoused — ✅ housed 2026-08-18 by SP3.6, see below** |
| **B3 for SP3** | **Next, and now fully UNGATED as of 2026-08-15** — §9.6 ruled *and* the scaffolding brainstorm specced. Both questions the ruling handed the plan are answered: over-ask is **checkpoint-and-resume**, and the trigger lives on **T12–T15's admin UI**. What still lands *in* the plan: the round-trip fix, **SP3.5**, and the spec's two remaining open items |
| ~~**SP3.6 — source health + the run trigger**~~ | ✅ **BUILT AND MERGED to `main` 2026-08-18** (`a110e93`, `--no-ff`), 263 tests / 42 files, **demo criterion fully run the same day**. *(This cell read "NOT YET MERGED, demo criterion NOT YET RUN" until 2026-08-30.)* Thirteen tasks. D5 finally housed: `POST /api/admin/run` does scrape → import → merge in one request, artifact alive only inside it. `app/shared`'s `SourceHealth`/`SourceRow` reconciled to migration 006 (Task 13) — narrowing `health` to the real enum surfaced no defect. Left deliberately alone: `PATCH /api/sources/:id` still unauthenticated; `Region A.2 : Status Bar` still unbuilt. ~~**Next: run the design spec §10 demo end to end, then merge**~~ ✅ **both done 2026-08-18** |
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
- **The intelligence chrome is BUILT, inert — decided 2026-08-13.** Score strips, AI-assessment panels, smart-filter controls and their settings are all constructed and rendered, none wired. A build that omitted them would not be a subset of the product but a different one, with holes where screens were composed around content. **Supersedes fidelity mandate §7.10 clause 2**, which said parked regions are not built. **Affects SP2 scope directly.** The guard that comes with it: *a rendered control may never become a live filter or score until qualification is designed* — same shape as the Capacity rule, artifact permitted, data flow forbidden. ~~**How "vestigial" should look is undesigned and stays that way until Matt specifies it**~~ **CORRECTED 2026-08-30/31, SP6 T14: it was already built, at SP2.** `ScoreBar` (`app/client/src/primitives/ScoreBar.tsx`) takes `value: number | null`, renders `—` with no fill under a `score-bar--empty` class, and its own comment records *"null is the V1 case (assessment table empty by design, spec §1.1)."* What SP6 ruled is narrower and different: the strip still does not **compose** onto the queue card (`docs/admin-deviations.md` D13) — a placement decision made on top of a look that already existed, not an unbuilt look
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
