# Tenderfoot — status

**Updated 2026-08-18.** One screen. The reasoning lives elsewhere; this is only where things stand.

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

## 🔖 RESUME HERE — updated 2026-08-18

**You are on `main`, SP3.6 IS MERGED, and the working tree is clean.** Merge commit `a110e93` (`--no-ff`, matching this repo's convention), branch `sp3.6-source-health` deleted after merging. Gate green **on the merged result**: **266 tests / 42 files**, `npm run check` exit 0. Thirteen tasks, each implemented and reviewed by a fresh agent; nineteen controller rulings, each recorded with what it costs if wrong; a whole-branch review that returned **Ready to merge** after a five-finding fix wave (`9be2280`).

✅ **THE BUTTONS HAVE NOW BEEN CLICKED — 2026-08-18 — AND BOTH OF THEM WERE BROKEN.** The click-through that SP3.6 still owed finally ran, in real Chrome, and it found two defects that 266 passing tests and a whole-branch review had all missed. **The Run control had never worked once, in any browser, for any source.** Both are fixed; gate is **292 tests / 43 files**, `npm run check` exit 0. See the DONE entry below. ⚠️ **Uncommitted** — the fix is in the working tree, not yet a commit.

*(The paragraph this replaced described `main`'s state on 2026-08-17, before SP3.6 existed — 193 tests / 36 files, gate 94s. Accurate for that date, preserved further down this section, and superseded here because SP3.6 has since merged into it.)*

✅ **The local gate's fragility is mostly gone — `corpus.test.ts` went 81.7s → 3.44s (`2cac516`).** ⚠️ **Mostly, not entirely**: the ~73s transaction that caused it is fixed, the 48.3s `DROP SCHEMA` is not. See item 1.

⚠️ **Five merged slice branches still exist and have never been deleted** — `sp0-infrastructure`, `sp1-entity-graph`, `sp1.5-postgres-port`, `sp2-design-system`, `sp3-federal-ingestion` (the last two also on `origin`). Only `sp1-admin-ui` and `sp3.5-org-resolution` were cleaned up. **Deleting `sp3-federal-ingestion` is the cheap way to settle the Neon preview-branch question below**, since it is the one with a live `preview/` branch attached.

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

### ⏭ START HERE — commit the fix, then decide what SP3.6 owes production

**The two fixes above are in the working tree and NOT committed.** Gate is green on them: **292 tests / 43 files**, `npm run check` exit 0. Files touched: `app/server/src/scrape/window.ts` + `window.test.ts` (both new), `app/server/src/health/check.ts` + `check.test.ts`, `app/server/src/routes/admin.ts` + `admin.test.ts`, `app/client/src/admin/Admin.tsx` + `Admin.test.tsx`.

**Then the question this raises and does not answer: production has neither migration 006 nor 007.** It is 13 rows, all `unknown`, with no `health_checked_at` and no `probe_url` — so `/admin` against production would fail on the missing columns exactly as it would have before SP3.6 existed. **The slice is merged; it has not landed anywhere a user could see it.** `npm run build` runs `migrate:deploy`, so a deploy applies them — but that is a deliberate act nobody has taken, and D5's Run now genuinely writes to whatever database it is pointed at.

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
3. **Auth in V1 — still open, and now half-answered rather than fully open.** `/admin` is a real product route. Check and Run sit behind `requireAdminSecret` as of SP3.6, but `PATCH /api/sources/:id` (the Enable toggle) does not — the design spec calls the secret itself "a shared bearer secret typed into a browser tab, not authentication" (§7), so even the two gated controls are a compromise, not a solution. Production is gated only by Vercel Deployment Protection.
4. **`Region A.2 : Status Bar` — still unbuilt.** A3 flagged it as likely unbuildable on its own terms: it is a shell region, and A1 makes the shell a hard dependency of the views it contains. SP3.6 gave the registry a health column instead; the status bar does not exist yet and nothing in SP3.6 changes that.
5. **SP4** — extraction runtime and blob provider, both still Matt's to rule. SP3.6's Run control proved the artifact-in-request pattern can defer this further, but does not answer it.

### Two decisions still on Matt

**Extraction runtime** (Node / Python sidecar / smart mode — the largest open question in the stack) and **the blob provider**. Both gate SP4. `THOUGHTS.md`'s two live ideas are also still unfiled.

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

**3. Two SP4 decisions, not yet needed.** Extraction runtime (Node / Python sidecar / smart mode — the largest open question in the stack) and the blob provider.

**4. `THOUGHTS.md`** — whether the two live ideas become real backlog items.

### ✅ Ruled 2026-08-15 — where long ingestion runs

**Ingestion runs on Vercel, invoked by hand, with the operator setting the scope of each run — which sources, how deep.** It does not pick one of the three options; it removes the constraint that made them necessary. Scope becomes an input rather than a constant, so a run fits the 300-second ceiling by construction and nothing has to survive an invocation boundary.

> **What it defers, loudly, to SP7.** Unattended ingestion does not exist. **Nothing scrapes unless a human asks it to**, the 8,000-record register cannot be taken in one action, and no source stays current on its own. **Vercel Cron is not exercised in V1** — the platform can still do it, so the closed-laptop risk stays retired, but SP3 does not use it and SP7 must.
>
> Recorded in workflow spec §9.6. **B3 for SP3 is unblocked.**

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
| **Extraction runtime** — Node / Python sidecar / smart mode | **SP4** |
| ~~🟡 **Rotate the Neon credentials**~~ | ✅ **BOTH BRANCHES DONE 2026-08-14.** `main` proved by the old string failing; `test` reset and `DATABASE_URL_TEST` re-derived, gate green. ⚠️ **`test` is asserted, not proved** — the old string was overwritten before capture, so the negative test could not run. See `Proto2PRD.md` §5.4 |
| ~~🔴 **Per-preview database branching**~~ ✅ **CLOSED 2026-08-15 — AND PROVEN, NOT ASSERTED.** Two halves, and only one was the dialog. The setting (`Require Active Resource` on, `Preview` checked, **`Production` deliberately unchecked**) did nothing on its own: a preview deploy created no Neon branch and its ping moved production's `last_ping`. The missing half was **the Git connection** — `vercel git connect`, which is **not** dashboard-only, unlike the toggle. With `Rapideo/tenderfoot` connected, the identical test on a Git preview deployment: **production `main` unchanged at `18:07:16.838Z`, the write landed on `preview/verify-preview-branching` at `21:01:14.521Z`.** Only the trigger changed, which is what isolates the cause. ⚠️ **Still live for CLI deploys:** `vercel deploy` from a laptop has no Git branch to key on, so it is still branchless and still points at production. **The safe path is a Git push; the quick path is the dangerous one** | SP2 onward |
| ~~🟡 **Set the project compute DEFAULT**~~ | ✅ **`0.25 → 8` CU, done 2026-08-14**, read back on the settings page. New branches are now born right |
| ~~◐ **A git remote**~~ | ✅ **DONE 2026-08-15 — public at `Rapideo/tenderfoot`, `main` and `sp2-design-system` pushed.** Decided 08-14, executed 08-15. **The classifier block did not recur** — Claude created it directly, `gh` already authenticated as `Rapideo`. The first push turned CI on for the first time ever and it failed on the missing test-DB secret; see the new row below |
| ~~🔴 **`DATABASE_URL_TEST` as a GitHub Actions secret**~~ | ✅ **DONE 2026-08-15 — Matt ruled Claude sets it; set from `.env`, CI green at 92/20 on both branches.** The rejected option was gating the DB tests off in CI, which would have made green-on-CI weaker than green-on-laptop. **Accepted residual: a live `test` credential is in a public repo's secret store, exfiltratable by anyone with write access.** Blast radius is the `test` branch only |
| ~~Express or framework route handlers?~~ | ✅ **Ruled 2026-08-13: Express stays.** Workflow spec §9.5 stays open on its own terms; the port did not decide it by momentum |
| **Which blob provider** — Vercel Blob / S3 / R2 | **SP4** |
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
