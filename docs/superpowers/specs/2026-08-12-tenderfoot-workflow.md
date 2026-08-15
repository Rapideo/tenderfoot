# Tenderfoot — Workflow Specification

**Date:** 2026-08-12
**Revised:** 2026-08-13 — §1, §2, §7, §8, §9, §10, §12. **Persistence moves from local SQLite to managed Postgres on Neon, and the application gains a host: Vercel.**

> **The revision is marked rather than absorbed.** What this document said on 2026-08-12 was correct *for a local-first application with no hosting*. It stopped being correct the moment a host was chosen, and the record of why it changed is worth more than a clean page (§4: *"where something was corrected, say so plainly rather than quietly fixing it"*).

**Status:** Draft for review
**Closes:** design spec §10.3 — the last open question in that document
**Author:** Claude, for Matt Smith / Koehler Partners
**Reads with:** the design spec (*what* the app does) and `docs/Stack-Requirements.md` (what the stack had to satisfy)

---

## 0. What this document is

The **SDLC layer** — branching, commits, review, CI, deployment topology, secrets, branch protection, and platform properties. Per `Proto2PRD.md` §5.1 this is deliberately separate from the design spec: *"they change at different rates and are read by different people."*

**It is not architecture.** Where this document and the design spec disagree about what the application does, the design spec is right.

> **One honest framing before anything else.** Most workflow specs describe how a *team* ships. **Tenderfoot is one developer working with an AI**, and importing team ceremony would produce a document nobody follows. What follows is deliberately thin where thin is correct, and specific where this project has real risk.
>
> **Revised 2026-08-13.** This paragraph used to continue *"shipping a local-first application with no hosting."* That is no longer true, and the change is not cosmetic — it moved several concerns from *absent* to *live*: connection limits, cold starts, an ephemeral filesystem, function duration caps, and a deploy pipeline that can break. **The risk is still concentrated in other people's platforms; there are now two more of them, and two of them are ours.**

---

## 1. The stack, as decided

**Decided 2026-08-12.** Common with **ideate / IDE8**, Matt's other active project — which is a first-class reason, not a compromise: one set of idioms, one debugging vocabulary, and components that can move between the two.

| Layer | Choice | Why |
|---|---|---|
| UI | **React 19** | Shared with IDE8; the prototype's structure maps to components mechanically |
| Build | **Vite 6** | Shared with IDE8 |
| State | **Zustand 5 + Immer 10** | Triage is overwhelmingly *change one field on one record*, which is Immer's shape |
| Routing | **A router — addition to the IDE8 stack** | Seven screens and a five-tab detail. Without routes there is no URL that opens one opportunity, and problem #4 is *being able to point at a record* |
| API | **Express 4** | Shared with IDE8. The surface is small: list, detail, decide, run-ingest, source config |
| ~~Persistence~~ | ~~**better-sqlite3 13**, local-first~~ | **Superseded 2026-08-13.** See the row below and §7 |
| **Persistence** | **Neon — managed serverless Postgres**, provisioned through the Vercel Marketplace | **Decided 2026-08-13 by Matt.** Follows from the hosting choice rather than competing with it: **Vercel has no writable persistent filesystem, so a SQLite file cannot survive a request there.** Choosing Vercel decides the database |
| **Hosting** | **Vercel** | **Decided 2026-08-13 by Matt.** Retires the largest known expiry in this document (§7): scheduled ingestion needs something always on, and a closed laptop does not scrape |
| Server runtime | **tsx** locally; Vercel Functions in the deployed environment | No build step locally. **Whether the API stays Express or becomes framework route handlers is open — §9.5** |
| Uploads / CORS | **multer, cors** | As IDE8. **CORS narrows** once client and API share an origin |
| **Document bytes** | **Blob storage — not the filesystem** | **Forced 2026-08-13.** The prior answer was *"filesystem, with paths in the DB."* There is no persistent filesystem on Vercel; `/tmp` is per-invocation and ephemeral. Bundles reach 21 MB and there are thousands |
| ~~Drag and drop~~ | **@dnd-kit dropped** | The only screen wanting it is the pipeline board, and the prototype moves cards with arrow buttons — the better call for a keyboard-first product, on a deferred screen |
| CSS | **Hand-written against the extracted tokens. No framework.** | The prototype is fully specified — 67 role-named tokens, a 12-step radius scale, verified byte-identical to the frozen bundle. A framework would arrive with its own opinions and the work becomes overriding them |

**Six decisions remain open inside this choice** and are listed in §9. None blocks SP2; **two now block SP3 and SP4**, where before none did.

> ### Why this changed on 2026-08-13, and why the timing was lucky
>
> Matt recorded the local-first SQLite decision on 2026-08-12 and revised it the following morning, having intended Vercel hosting all along. **The two decisions were made a day apart and could not both hold.**
>
> **What it cost:** roughly 600 lines of server code and four migration files, in the one slice already merged. **What it did not cost: any data.** `*.db` has been in `.gitignore` since SP0 and `tenderfoot.db` was never committed — the research lives in `corpus/` as files and in the seed migrations, and the database has always been a derived artifact rebuilt by `npm run migrate`. **Nothing to migrate, because nothing of record was ever in there.**
>
> **The timing is the part worth recording.** SP1 established the schema; SP2 is the design system and touches no persistence; **SP3 is where adapters begin writing to the database in volume.** A revision arriving one slice later would have cost several times as much, and one arriving after SP4 would have been a rewrite.

---

## 2. Repository layout

The repository already holds planning artifacts at root. Application code goes in one subtree so the two never tangle.

```
app/
  client/        React + Vite. The routed application
  server/        API, adapters, extraction. Postgres via Neon
  shared/        types and the data model shared across both
corpus/          real solicitations (unchanged)
docs/            specs, plans, playbook (unchanged)
prototype/       REFERENCE ONLY — never edited (unchanged)
reference/       SVRC, concept outline (unchanged)
```

**`prototype/` stays read-only forever.** Production **copies out** of it; nothing points back into it at runtime.

> **This is the transfer point named in `docs/ClaudeDesign_Proto_Cleanup.md`.** The rule-bearing comments in `prototype/PROTOTYPE/src/app.js` are the only copy of *why each field exists* — a real bundle shipping two deadlines, a spec section forbidding a category. **They move to `app/shared/` on the first copy-out and live there from then on**, and the prototype's copy becomes a historical artifact. A frozen reference cannot accumulate, and those comments must.

---

## 3. Branching

**`main` is always working.** Feature branches per sub-project, named `sp0-infrastructure`, `sp1-entity-graph`, and so on. Merge when the slice's demo criterion is met.

**Not per-task branches.** A slice is the unit that ends in something demo-able (`Proto2PRD` §5.3); a task inside a slice has no independent meaning and branching per task produces churn without review value.

---

## 4. Commit format

**The convention already exists in this repository and has simply never been written down.** Codifying what is being done rather than importing something new:

```
Short imperative subject, under ~70 chars

Prose paragraphs explaining WHY, not what. What is in the diff. Why is
not, and why is the thing a reader needs in six months.

Where a decision was made, record the alternative that was rejected and
the reason. Where something was corrected, say so plainly rather than
quietly fixing it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

**No conventional-commits prefixes** (`feat:`, `fix:`). They optimise for changelog generation, which this project does not need, at the cost of the subject line — which is the part actually read.

**Every commit that changes a decision updates the document that records it, in the same commit.** Not afterwards. This is `Proto2PRD` §4.7.4's rule applied beyond the prototype.

---

## 5. Review

**One developer and an AI. PR review as ceremony would be theatre.** What replaces it:

- **The plan is the review.** Per `Proto2PRD` §5.1 and §B3, an implementation plan with per-task verification is committed **before** any application code. The design review happens there, when it is cheap.
- **CI green is not optional** (§6).
- **Seam tests before the features that use them** (`Proto2PRD` §8.3, plan of action §6.2). The three seams are sighting identity, date/eligibility extraction, and — reinstated the day anything gates — hard gates.
- **`/code-review` before merging a slice.** Available, cheap, and catches what a self-review does not.

---

## 6. CI

**On every push and every PR:**

| Gate | |
|---|---|
| Typecheck | `tsc --noEmit`, client and server |
| Lint | as configured |
| Unit tests | including the seam tests |
| Build | `vite build` must succeed |
| **Token drift** | `python prototype/tools/verify-tokens.py` — fails if `src/tokens.css` no longer round-trips to the frozen bundle |

**That last gate is Tenderfoot-specific and worth keeping.** It is a cheap standing check that the design system has not silently drifted from the artifact it was extracted from.

~~**CI does not deploy.**~~ **Revised 2026-08-13: it does now.** Vercel builds and deploys on push — a preview per branch, production on `main`. **The gates above stay the gates**, and the one to get right is that a red gate must not produce a green production deploy. **Token drift runs Python**, which the Vercel build image does not necessarily provide; keep that gate in GitHub Actions and let Vercel own the build. See §7.

---

## 7. Deployment topology

**Revised 2026-08-13.** This section previously read *"V1 has no hosting"* and carried a boxed warning that the answer would expire at SP7. **It expired early, and the expiry arrived with its answer attached.** The old text is preserved in git; what follows replaces it.

**V1 deploys to Vercel, with Neon as the database.**

| | |
|---|---|
| **Client** | React + Vite, built and served by Vercel |
| **API** | Vercel Functions. **Express or route handlers is open — §9.5** |
| **Database** | Neon serverless Postgres, provisioned through the Vercel Marketplace so the connection string is injected as an environment variable rather than pasted |
| **Documents** | Blob storage. Not the filesystem — there isn't one (§9.2) |
| **Scheduling** | Vercel Cron |
| **Local development** | Unchanged in shape: `npm run dev`. The database is a Neon branch rather than a file |

### What this closes

**Two risks recorded in `STATUS.md` are retired by this decision, and it is worth naming them because they were real.**

**1. "Deployment expires at SP7. A closed laptop does not scrape."** Vercel Cron answers it. The single largest anticipated change to this document has now happened, four slices ahead of schedule, which is the cheapest moment it could have.

**2. "A second reader means a second copy."** Single-file local-first had no story for two people seeing the same data. Managed Postgres does. Nothing currently needs it — but §2.1's portability rule (*a second customer is a second row, not a fork*) always implied it eventually.

### What this opens — and this is the part to take seriously

**Every concern the old section said vanished has come back.** Listing them plainly, because the IMPACT lesson is that platform properties kill you when they are undocumented, not when they are inconvenient:

| Property | Consequence for Tenderfoot | Status |
|---|---|---|
| **No writable persistent filesystem.** `/tmp` is per-invocation and ephemeral | Document bytes need blob storage. **The `document.path` column now means a blob key, not a path** | **Forced.** Decide the provider before SP4 |
| **Function duration is capped**, configured per-function via `vercel.json` `maxDuration`; **the ceiling is plan-dependent** | §5.3 says ingestion "runs for minutes at a time," and that was written before the cap existed. A 22-file, 21 MB bundle fetch does not obviously fit one invocation | **Open — §9.6.** Verify the actual ceiling for the chosen plan. Do not assume |
| **Serverless concurrency vs Postgres connection limits** | Every function instance wants a connection. Use Neon's pooled endpoint, and `attachDatabasePool` from `@vercel/functions` if Fluid compute is on | **Known, cheap, must not be forgotten** |
| **Neon scale-to-zero / autosuspend** after an idle period | First query after idle pays a cold start | **Acceptable** — one user, no availability requirement (`Stack-Requirements.md`) |
| **Cold starts** | The triage queue "must feel instant" (`Stack-Requirements.md`). Ten seconds per item, forty items a sitting | **Watch at SP6.** Reads are small; this is probably fine and should still be measured rather than assumed |

> ### The IMPACT lesson now applies literally, not by analogy
>
> Production went down thirteen days after launch because free-tier Supabase auto-pauses — *"not a bug, a documented property of the plan, never written down"* (`Proto2PRD` §5.2).
>
> **Tenderfoot is now on a serverless database that also suspends when idle, behind functions that also have plan-dependent limits.** The previous version of this section said the equivalent risk was "a scheduler that stops because the machine was asleep." **The risk is no longer an analogue. It is the same shape, on the same kind of platform.**
>
> **Therefore: the plan limits that apply — function `maxDuration`, cron frequency, Neon compute hours and autosuspend delay — get written into §10 as measured facts before SP7, not recalled from memory.** That is the whole lesson, and this is the project where it gets applied.

**Consequence for SP0, restated.** Its demo criterion reads *"hello-world through the full deploy path, touching the DB."* That was satisfied locally on 2026-08-12 and **is now only half-satisfied**: the full deploy path has grown a deployment. The remainder is folded into the port slice rather than reopening SP0.

---

## 8. Secrets

**Revised 2026-08-13.** This section said the secret surface was *"very nearly empty… because it will not last."* **It did not last, and it was the database that ended it** — not, as predicted, an authenticated adapter or a model API key.

| | |
|---|---|
| **Database** | **`DATABASE_URL` — the first real secret.** Was *"no secret, a local file."* Injected by the Vercel–Neon Marketplace integration rather than pasted by hand, which is the point of provisioning it that way |
| **Blob storage** | **A token, once the provider is chosen** (§9.2) |
| SAM.gov | **No credentials.** The search API is anonymous (§5.8) |
| Indiana IDOA / contract register | **No credentials.** Anonymous JSON endpoint |
| Illinois BidBuy | **No credentials.** Public advanced search |

**Two more will follow, both already-identified open decisions:**

1. **Michigan / Kentucky, if the adapter authenticates.** Matt's reading is that authorisation derives from holding a vendor account (§5.7).
2. **Extraction, if smart mode calls a model API.** See §9.1.

**Handling.** `.env` locally, never committed; `.env.example` checked in with keys and empty values. **In the deployed environment, secrets live in Vercel environment variables per environment — production, preview, development — and `vercel env pull` writes the local file.** No secret in the database, no secret in the client bundle.

> **One consequence that is easy to miss.** Preview deployments get their own environment variables. **A preview branch pointed at the production database is a footgun**, and Neon's branching exists precisely to avoid it: a preview deploy should get a database branch, not production.
>
> **Investigated 2026-08-13 (Task 15), and the footgun is still live.** `vercel env ls` confirms it directly: `DATABASE_URL` (and every other Neon-injected variable) lists one Encrypted value shared across all three environments — `Production, Preview, Development` — not a distinct value per environment. Every preview deployed today, including Task 14's, writes to the same database production reads.
>
> **Not automatable from here, and not attempted.** Checked every CLI and API surface this project has access to: `vercel integration --help`, `vercel integration update --help` (only `--plan`, `--projects`, `--authorization-id` — billing and project access, not per-environment branching), `vercel integration-resource --help` (only `create-threshold`, `disconnect`, `remove`), and the full Neon MCP tool set (branch create/delete/describe/list, run_sql, connection strings — nothing that touches the Vercel↔Neon connection's deployment configuration). Neon's own documentation for this feature (`vercel-native-integration-previews`) says so directly: **it is a dashboard-only setting.** No Neon branch, Vercel resource, or config file was created, deleted, or modified while checking this.
>
> **So: manual steps, to be done by Matt, not scripted here.**
>
> 1. Vercel dashboard → team `koehler-partners` → project `tenderfoot`.
> 2. Storage tab → open the connected Neon resource (`neon-lime-button`, bound to Neon project `wispy-tooth-06225229`).
> 3. Open its **Connect Project** screen for `tenderfoot` (the same flow used for the original connection — revisiting it is how an existing connection gets reconfigured; there is no separate "Manage" screen for this).
> 4. Under **Advanced Options → Deployments Configuration**, toggle **Preview** on. This is Preview Branching.
> 5. Confirm **"Resource must be active before deployment"** is also on — it makes Vercel wait for the branch to exist before it builds.
> 6. Save.
>
> **What the result should look like.** Neon's docs state the per-branch connection variables are injected only at deploy time and *do not* appear in the project's static environment-variable list — so `vercel env ls` will not grow a new row. Instead, the existing rows (`DATABASE_URL` and the rest) should narrow from `Production, Preview, Development` to `Production, Development`, since Preview is no longer served by a static value. If they still read all three environments after saving, the toggle did not take effect.
>
> **The real proof is still the one Task 15's brief specifies, and it needs an actual preview deploy** (out of scope for this batch — see the batch note below): deploy a throwaway branch, `POST $PREVIEW/api/health/ping`, then `GET $PRODUCTION/api/health` and confirm `last_ping` is unchanged. If it moved, the preview is still pointed at production and the toggle did not do what it claims to.
>
> ---
>
> **EXECUTED 2026-08-15. The toggle is on. It does not yet do anything, and the footgun is still live — now proven rather than inferred.**
>
> **Three of the six steps above were wrong about the UI.** Step 3's parenthetical — *"there is no separate 'Manage' screen for this"* — is false as of today: the Projects tab of the resource has a per-row ⋮ → **Update Project Connection**, which opens a **Configure tenderfoot** dialog. Step 4's **Advanced Options → Deployments Configuration** does not exist; the control is **Create Database Branch For Deployment**, with separate `Preview` and `Production` checkboxes. Step 5's *"Resource must be active before deployment"* is now **Require Active Resource Before Deploy**.
>
> **Steps 4 and 5 are ordered, not independent — this is the part that cost the most time.** Both branch checkboxes render `disabled` until **Require Active Resource Before Deploy** is switched on. Neon's own guide has the ordering right and this spec did not: *"toggle Required → Preview"*, then *"Make sure Resource must be active before deployment is also on."* Flipping Required flips both checkboxes from `disabled: true` to `disabled: false` in the same render.
>
> **Why that reads as a broken tool rather than a dependency.** Every input in the dialog is a **1×1 pixel `sr-only` checkbox** behind a styled label. A disabled 1px input absorbs clicks silently: accessibility-tree refs resolve to the 1px input and do nothing, and coordinate clicks miss it and hit the backdrop, closing the dialog. Both failure modes look like flaky browser automation. **The only reliable read is the DOM's own `disabled`/`checked` properties** — screenshots cannot distinguish "did not register" from "is disabled", and that ambiguity is what turned a two-click change into a long session.
>
> **Step 5's predicted signal is wrong — do not use it.** `vercel env ls` did **not** narrow. All eighteen rows still read `Production, Preview, Development` after saving, byte-identical in targeting to the before-state. The save definitely landed (every row's age reset from `10h ago` to `18s ago`). So the prediction above — *"should narrow from `Production, Preview, Development` to `Production, Development`"* — is simply false, and the corollary drawn from it (*"If they still read all three environments after saving, the toggle did not take effect"*) **would have reported a successful save as a failure.** The stored Preview values persist and are overridden per-deployment; the static list is not evidence either way.
>
> **The real proof was run, and it failed.** Baseline: Neon `wispy-tooth-06225229` held exactly two branches (`main`, `test`), with `main.app_meta.last_ping = 2026-08-13T15:28:45.875Z`. A throwaway preview was deployed (`vercel deploy`, `dpl_DHC4L4EH3ypE84g7ohcV3YGf998h`). **No Neon branch was created.** `POST $PREVIEW/api/health/ping` returned `2026-08-15T18:07:16.838Z`, and querying `main` directly returned that same value. **The preview wrote to the production database**, exactly as the footgun predicts.
>
> **Root cause, and it is not this setting.** **The Vercel project has no connected Git repository** (Settings → Git offers the GitHub/GitLab/Bitbucket connect buttons, i.e. nothing is linked). Neon's branch-per-preview keys off **Git-based** preview deployments; a CLI `vercel deploy` produces no branch to attach to, so the deployment falls back to the static Preview variables — production. This was invisible until now because `github.com/Rapideo/tenderfoot` only came into existence on 2026-08-15; every deployment this project has ever made was CLI-driven.
>
> **So the setting is necessary but not sufficient.** It is correctly configured and verified persisted (`Required` on, `Preview` checked, **`Production` deliberately unchecked** — checking it would branch the production database). **The footgun stays live until the Vercel project is connected to the GitHub repo**, which is a deploy-model change (pushes to `main` would auto-deploy to production) and therefore Matt's call, not a mechanical follow-up.
>
> **One side effect, recorded rather than reverted.** Production's `last_ping` now reads `2026-08-15T18:07:16.838Z` — the test write. It was not restored: `last_ping` records when the last ping happened, and back-dating it to `2026-08-13T15:28:45.875Z` would put a false value in the field to make the trace look tidy. The old value is written above if it is ever wanted.

---

## 9. Open decisions inside the stack

**Listed as decisions, not gaps.** None blocks SP2. **Revised 2026-08-13:** two of the four were re-formed by the hosting decision rather than answered by it, and two are new. **Items 2 and 6 now have deadlines they did not have before.**

**1. Extraction runtime — the significant one.** Node libraries, a Python sidecar confined to extraction, or extraction as a smart-mode API call. With no scores in V1, **extraction accuracy is the only thing the system can be right or wrong about** (§8.4), and Node is the weakest major runtime for `.pdf`/`.docx`/`.xlsx`/`.pptx`/nested `.zip`. **Must land before SP4**, and it interacts directly with mechanical-vs-smart modes (`docs/Pinned-Ingestion-Scaffolding.md`).

**2. Document storage — WHICH blob provider, no longer WHETHER.** Was *"filesystem with paths in SQLite, almost certainly."* **That answer died on 2026-08-13**: Vercel has no persistent filesystem. Vercel Blob is the path of least resistance; S3 or R2 are cheaper at volume and portable. **Thousands of bundles reaching 21 MB is now a storage bill rather than free disk**, which is a genuine new cost line. Must land before SP4.

**3. One database per firm, or one shared database — the same question, re-formed.** Was *"one SQLite file per firm."* On Neon the options are a project per firm, a database per firm, a schema per firm, or a `tenant_id` column. **Neon's branching makes per-firm cheaper than it would be on a conventional managed Postgres**, so the option §2.1's portability rule likes best got *more* affordable, not less. Still invisible until the second customer exists; still expensive immediately after.

**4. Authentication in V1.** `Shell A`'s open question, and **it got sharper on 2026-08-13.** Single-user with no login was defensible for an application running on one laptop. **It is a different proposition on a public URL.** At minimum the deployment needs Vercel's deployment protection on; whether the application itself grows a login is still open, and the SVRC notes it is expensive to retrofit.

**5. Does the API stay Express, or become framework route handlers?** ~~New 2026-08-13~~ **— RULED 2026-08-13: Express stays, and the question stays open on its own terms.**

> Express 4 runs on Vercel behind a catch-all function and preserves commonality with IDE8, which §1 treats as a first-class reason rather than a compromise. Route handlers are the grain of the platform and give client and API one origin.
>
> **The argument for doing both at once was real and was rejected knowingly.** The port makes every query site `await`, which means touching every handler; moving to route handlers in the same pass would touch them once instead of twice. **Matt's call was to take the second touch** — because a diff that swaps the driver *and* restructures the API is not reviewable as either, and because deciding §9.5 by momentum is exactly the failure `Proto2PRD` §4.7.5 names: *the risk is not the wrong answer, it is the unratified one.*
>
> **Recorded cost:** if the API does move later, the handlers get rewritten a second time. Roughly 180 lines, and cheap next to an unreviewable slice.

**6. Where long ingestion actually runs — now the load-bearing one.** ~~New 2026-08-13~~ **— RULED 2026-08-15: ingestion runs on Vercel, invoked by hand, with the operator setting the scope of each run.** §5.3 fetches in three hops and was written assuming a process that could run for minutes. A capped function invocation may not hold that. Options were: bound each invocation with the candidate-scrape idea (`Pinned-Ingestion-Scaffolding.md` proposal 2, which stops at hop 1 and already exists for other reasons), a durable workflow that survives across invocations, or run ingestion off-platform. **This unblocks B3 for SP3.**

> **Sharpened by Matt 2026-08-13**, and it reframes what the hosting decision actually bought. **Scraping is a background process; it could never have run locally** — that is the closed-laptop problem, and it is the reason the host exists at all. **So the host solves *when* ingestion runs and leaves *how long it may run* wide open.** The two are easily confused, and confusing them would leave SP3 discovering the cap rather than designing around it.
>
> **The ruling does not pick one of the three options — it removes the constraint that made them necessary.** Scope stops being a constant and becomes an input: the operator names which sources and how deep, and a run is sized to fit 300 seconds by construction rather than by engineering. Nothing has to survive an invocation boundary because nothing is asked to cross one.
>
> **Named "off-platform" in the moment; recorded here by what it does.** What was described keeps execution on Vercel — the scraping logic ships as ordinary application code. The word pointed at the third option, the design pointed at a fourth that was not on the list, and the design is what governs.
>
> **What this defers, loudly, to SP7.** Unattended ingestion does not exist under this ruling. **Nothing scrapes unless a human asks it to**, so the full 8,000-record contract register cannot be taken in one action and no source stays current on its own. **Vercel Cron is not exercised in V1** — the platform can still do it, which is why the closed-laptop risk stays retired, but SP3 does not use it and SP7 must. The long-run question is not answered, it is unasked until a slice needs it.
>
> **Consequence for SP3's plan, which is Claude's to answer and not Matt's.** Two things follow immediately: a scoped run needs defined behaviour when the operator asks for more than fits — a bound on the inputs or a graceful stop, not a 300-second death mid-write — and the invocation needs a surface a human can reach, which lands naturally on **SP1 T12–T15's minimal admin UI** rather than inventing a second one.
>
> **The round-trip fix does not stop mattering; it changes job.** Multi-row `INSERT`/`UNNEST` was a blocker while a full register had to fit one invocation. Under a hand-scoped run it is a **scope multiplier** — every row/second it buys is depth the operator can ask for before hitting the ceiling. Still Claude's, still before SP3 ships.

---

## 10. Platform properties

`Proto2PRD` §5.2 requires this section. **Revised 2026-08-13 — it no longer inverts.**

This section used to open *"we have no hosting platform, so it has no properties to document."* **We now have two, and they are exactly the class of platform the IMPACT failure came from: a managed database that suspends when idle, behind functions with plan-dependent limits.**

### 10.1 Our platforms — TO BE MEASURED, not recalled

> **Deliberately unfilled.** Writing plan limits from memory is how the IMPACT failure happened: *"a documented property of the plan, never written down."* Guessing at them here would be the same mistake with more confidence. **Each row is measured against the actual account and plan, and the measurement is dated.** The gate is SP7 for the cron rows and SP4 for the duration rows; earlier is better.

| Platform | Property to establish | Why it is load-bearing | Measured |
|---|---|---|---|
| **Vercel** | Function `maxDuration` ceiling on the chosen plan | §5.3 ingestion "runs for minutes." Configurable per function in `vercel.json`; the ceiling is not | ✅ **300 seconds, measured 2026-08-13.** Not read from a dashboard — observed by deploying `api/index.ts` with `maxDuration: 800` and reading Vercel's own rejection: *"The value for maxDuration must be between 1 second and 300 seconds, in order to increase this limit upgrade your plan."* `vercel.json` still ships `30` (Task 14's honest placeholder); SP3's ingestion sizing against this 300s ceiling is §9.6's problem |
| **Vercel** | Cron minimum frequency and behaviour on the chosen plan | SP7 is scheduled ingestion. This is the whole reason for the host | — |
| **Vercel** | Request/response body limits | 21 MB bundles pass through the API on the way to blob storage, unless they don't — which is itself a design decision | — |
| **Neon** | Autosuspend delay, and cold-start latency after it | Triage "must feel instant." One user means the database is *usually* idle, so this is the common path, not the rare one | ✅ **~5 min, measured 2026-08-13.** Cold-start latency also measured 2026-08-13, reported unaveraged since the cold path is the normal one for a one-user database: **first request after idle — 1087 ms** (connect 1052 ms + query 35 ms) **vs. an immediate second (warm) request — 317 ms** (connect 282 ms + query 35 ms). One `SELECT 1` round trip via `node --env-file=.env`, direct against `DATABASE_URL` — not through the deployed function, so Vercel's own cold start is not included here |
| **Neon** | Connection limit, pooled vs direct endpoint | Serverless concurrency against a connection ceiling is the classic failure. Pooled endpoint by default | ✅ **2026-08-13 — pooled by default, confirmed.** `DATABASE_URL` resolves to the `-pooler` host and `DATABASE_URL_UNPOOLED` to the direct one. **The integration got this right without being asked**, so the requirement is satisfied by construction rather than by discipline. The connection *count* ceiling is still unread |
| **Neon** | Compute-hour and storage allowance on the plan | The thing that silently stops working, exactly as Supabase did | **Partial 2026-08-13** — see below |
| **Neon** | Whether a role-password reset applies project-wide or per branch | Credential rotation is only complete if it reaches every branch. Getting this wrong leaves a leaked credential live while the incident reads as closed | ✅ **Per branch, measured 2026-08-14** — see below |
| **Blob provider** | Per-object size cap and egress cost | Thousands of bundles up to 21 MB. This is now a bill | — |

**Read from the account 2026-08-13**, via the Neon API rather than from memory. These are **org-level facts and the settings of the existing `kp-web-prod` project**; a newly created Tenderfoot project may not inherit all of them, so the project-level rows are re-checked once it exists.

| | Value | |
|---|---|---|
| Neon org | **`Vercel: Koehler Partners`**, `managed_by: vercel`, plan **`launch`** | A paid tier, already in use. **Tenderfoot lands on the same bill, which is the intent** |
| Second org | `matthew.smith@koehlerpartners.com`, plan `free`, **empty** | Console-managed and unused. **Not where Tenderfoot goes** — worth stating, because `list_projects` defaults to it and reports zero projects, which reads as "no Neon" and is wrong |
| Postgres | **17** — the same major version the migrations target | |
| Region | `aws-us-east-1` | |
| Existing project | `kp-web-prod`, created 2026-05-21 | The precedent. Neon under Vercel is already the working pattern here |
| Compute | autoscaling **0.25 → 8 CU** | |
| Quota | resets **monthly** (`quota_reset_at`) | The allowance exists. **The ceiling itself is still unread** |
| Point-in-time restore | `history_retention_seconds: 21600` — **6 hours** | Shorter than instinct suggests. Relevant the first time a migration is regretted |

**Tenderfoot's own resource, provisioned 2026-08-13.**

| | | Status |
|---|---|---|
| Vercel project | `tenderfoot`, team `koehler-partners`, alongside `kp-web` | ✅ |
| Neon project | `wispy-tooth-06225229`, named **`tenderfoot-db`** | ✅ **Renamed 2026-08-14 — from the VERCEL dashboard, not Neon.** See the callout below: the Neon console refuses outright |
| Billing plan | **`launch_v3` (Launch), subscription** | ✅ Taken by default rather than chosen — see `DOOGIE` 2026-08-13 |
| Compute | `ep-super-bonus-auoe43hj` (default branch) and `ep-withered-base-au6l4cjf` (`test` branch), both **0.25 → 8 CU** | ✅ **Resized 2026-08-13, verified by reading back.** Was 1→1 and **0.25→0.25** respectively — the *test* one was the tighter of the two and nobody had noticed |
| Autosuspend | **300 s**, now explicit on both computes | ✅ **Confirmed twice.** Measured by observation this morning at 5 m 19 s while the value read `0`; the console then wrote `300` outright. The observational reading was right |
| `DATABASE_URL` | resolves to the **`-pooler`** host | ✅ Correct as provisioned |
| Point-in-time restore | **24 hours** — longer than `kp-web-prod`'s 6 | ✅ |
| Postgres | 17, `aws-us-east-1`, same region as the website | ✅ |

> ### ~~⬜ Two changes decided 2026-08-13 and NOT YET APPLIED~~ — ✅ BOTH APPLIED 2026-08-14
>
> *Kept for the reasoning and for the one prediction it got backwards; see the measured callout at the foot of this block.*
>
> **Verified still outstanding at time of writing** — the project name and the compute size are unchanged from provisioning. **Neither the Neon MCP nor the Vercel CLI can make these changes**: the MCP exposes create, delete, describe, list, branch, SQL and auth but no update; `vercel integration-resource` offers only `create-threshold`, `disconnect`, `remove`. So this needs the Neon console or the Neon API.
>
> ```
> PATCH https://console.neon.tech/api/v2/projects/wispy-tooth-06225229
>   {"project":{"name":"tenderfoot-db",
>               "default_endpoint_settings":{"autoscaling_limit_min_cu":0.25,
>                                            "autoscaling_limit_max_cu":8}}}
>
> PATCH .../projects/wispy-tooth-06225229/endpoints/ep-super-bonus-auoe43hj
>   {"endpoint":{"autoscaling_limit_min_cu":0.25,"autoscaling_limit_max_cu":8}}
> ```
>
> **The second call is not redundant, and this is the half that fails silently.** `default_endpoint_settings` applies only to *newly created* endpoints. Change the project alone and the live compute stays pinned at 1 CU while the settings page reads 0.25–8 — which looks done and is not.
>
> ~~**The Vercel resource name is a separate string** from the Neon project name… Renaming the Neon project will probably not rename the Vercel resource.~~
>
> ### ✅ MEASURED 2026-08-14 — both changes applied, and the prediction above was backwards
>
> **The names are one string, not two, and the ownership runs the other way.** Renaming the **Vercel** resource renamed the **Neon** project; confirmed by reading `describe_project` back through the Neon MCP, which now returns `tenderfoot-db`. The guess here was that Neon was upstream and Vercel a cosmetic copy. It is the reverse.
>
> **The Neon console refuses the rename outright.** Editing Project name → Save in the Neon project settings returns:
>
> ```
> action restricted; reason:"organization is managed by Vercel"
> ```
>
> So the `PATCH .../projects/{id}` call above **would very likely also fail for a Vercel-managed org** — untested, because the dashboard route worked. **When a resource is provisioned through a marketplace integration, the marketplace owns its identity**, and the vendor's own console becomes read-only for exactly the fields the marketplace projected. That is worth generalising past Neon: *the surface that created a resource keeps naming rights over it.*
>
> **The rename path that works:** Vercel → Storage → the Neon resource → **Settings → Update Name → Save.**
> ⚠️ **Two Neon resources sit in this team's Storage list** — `tenderfoot-db` (`store_mM0f1r2hzaSn22p5`, Neon `wispy-tooth-06225229`) and **`kp-web-prod` (`store_sZ5Zby3QCVhfWKPT`) — the live company website's production database.** The list re-renders after load and a click landed on the wrong one during this change. Nothing was modified, but **navigate by store ID rather than by position in that list.**
>
> **The compute default is applied:** project settings now read **`.25 ↔ 8 CU`**, read back on the page after saving. Neon's own dialog states the §2.17 hazard in its own words — *"Modifying these defaults does not alter the settings of any existing computes"* — which is why the second `PATCH` above was never redundant.

> **The compute default is worth noting as a platform property rather than a preference.** A fixed floor of 1 CU on a database that idles most of the day is the wrong end of the trade for one user, and **nothing about the provisioning flow surfaces that choice** — it is simply what you get. That is the same class of fact as an auto-pausing free tier: a documented default with a cost, invisible unless someone reads it.

> ### ✅ RESOLVED BY OBSERVATION, 2026-08-13 — the database autosuspends after ~5 minutes
>
> `suspend_timeout_seconds` reads **`0`** on both projects. In Neon's API `0` means *use the default* and `-1` means *never suspend*, and this section was left blank rather than guess which.
>
> **It answered itself within the hour.** Tenderfoot's compute was created at `13:27:52`, last active at `13:27:57`, and reported `suspended_at: 13:33:16` — **5 minutes 19 seconds after its last activity.** So `0` is *the default*, and the default is five minutes. **Not "never."**
>
> **This is the IMPACT failure's shape, now confirmed rather than suspected.** Production went down thirteen days after launch because free-tier Supabase auto-pauses — *"a documented property of the plan, never written down."* **Tenderfoot's database suspends after five minutes idle, and with one user it will be idle nearly always.** The suspended state is the normal state, not the exception.
>
> **Two consequences, and the second is the one that bites:**
>
> 1. **Cold start is the common path for triage.** `Stack-Requirements.md` requires the queue to *"feel instant"* — ten seconds per item, forty items in a sitting. **The first query of every session pays the resume.** That number is still unmeasured and is taken at SP1.5 Task 14.
> 2. **A cron-driven ingestion run wakes a suspended database every time.** Harmless for a nightly job; worth knowing before anyone concludes a scheduled run is "slow."
>
> **What this does NOT justify is disabling autosuspend.** Suspension is why a one-user database is cheap, and paying for an always-on compute to save one resume per session is the wrong trade. **Measure the resume first** (§9.6's sibling question), then decide.

> ### ✅ MEASURED 2026-08-14 — a Neon role password is per BRANCH, not per project
>
> **This was asserted from memory and the assertion was wrong.** Before the rotation it was stated that resetting `neondb_owner` would cover every branch, because the role is a project-level object. The role is; **its password is not.** A branch copies its parent's roles *and their passwords* at creation, and the two are independent from that moment on.
>
> **Measured by connecting, not by reading a dashboard.** After the console password reset on `main`, one probe against both strings:
>
> ```
> DATABASE_URL       (main, pooled)     -> FAILS: password authentication failed for user "neondb_owner"
> DATABASE_URL_TEST  (test, unpooled)   -> STILL WORKS
> ```
>
> **The reset landed on `main` and did not reach `test`.** The two branches now hold different passwords for the same role name.
>
> **Why this is load-bearing rather than trivia.** It is a silent-partial-success — the same shape as `default_endpoint_settings` above, and the same shape as the source platforms that accept a parameter and ignore it. The console reports the reset as done, and it *is* done, for one branch. **Nothing in the flow says the word "branch."** An incident closed on the strength of that report leaves a live credential behind, and the only way to find out is to try the other string.
>
> **The rule that follows: rotation is not complete until every branch is rotated and each one is verified by a failed connection on the old string.** A successful connection on the new string proves the new credential works; only a *failed* connection on the old one proves the old credential is dead. Both halves are required, and the second is the one that gets skipped.
>
> **Rotation is cheap to finish, because `store_passwords: true` on this project.** Neon keeps the role password, so `get_connection_string` returns the live one. Once a branch is reset in the console, the new string can be fetched programmatically — nothing needs copying by hand.
>
> **The tempting shortcut is wrong here, for a reason worth keeping.** Deleting and recreating the `test` branch would inherit `main`'s new password and retire the leaked hostname too, with no console trip. **Do not** — see the next note.

> ### 🔴 LATENT 2026-08-14 — `default_endpoint_settings` is still 1→1 CU, so every NEW branch is born wrong
>
> Read from the project this morning:
>
> ```
> "default_endpoint_settings": { "autoscaling_limit_min_cu": 1,
>                                "autoscaling_limit_max_cu": 1,
>                                "suspend_timeout_seconds": 0 }
> ```
>
> **The 2026-08-13 resize fixed the two existing endpoints and not the project default.** Both live computes read 0.25→8 and verify on read-back, so the change looks complete and, for anything that exists today, is. **The callout above predicted exactly this half and it happened anyway** — the endpoint PATCH was applied, the project PATCH was not.
>
> **Two consequences, and the second is the expensive one:**
>
> 1. **Never rebuild the `test` branch by deleting and recreating it.** Its compute would come up at 1→1 CU. That is not cosmetic: the SP1.5 flaky gate was diagnosed to a fixed test compute, and the fix was verified because the predicted metric moved — collect time 48.84 s under contention → 2.9–4.4 s after the resize. Recreating the branch silently restores the failure and the gate goes flaky again with no change in the code to explain it.
> 2. **Per-preview database branching (§8) is still outstanding, and it creates branches.** Every preview branch will be born at 1→1 CU on a database that idles nearly always — the wrong end of the trade, multiplied by the number of previews. **Fix the project default before §8 is turned on, not after.**
>
> ```
> PATCH https://console.neon.tech/api/v2/projects/wispy-tooth-06225229
>   {"project":{"default_endpoint_settings":{"autoscaling_limit_min_cu":0.25,
>                                            "autoscaling_limit_max_cu":8}}}
> ```


### 10.2 Other people's platforms — already measured

**Four source platforms**, whose properties are load-bearing and already established. They live in the design spec §5.7–5.8 and in the Source Registry; the ones that change how code is written:

| Platform | Property | Consequence |
|---|---|---|
| **SAM.gov** | API returns latest active version only; archived CSVs are separate and weekly | Backfill and live are different sources, not one adapter with a wider `since` |
| **Indiana** | `amount` is a per-amendment delta that goes negative | Contract value cannot be summed. It is in the PDF or nowhere |
| **Illinois / Periscope** | Real query parameters; verified to filter honestly | The cheapest adapter of the four |
| **Michigan / CGI Advantage** | Everything is a form POST to one endpoint with server-side session; **totals withheld** (`20+ Records`) | Page to exhaustion. **§5.4's vary-a-parameter health check cannot run here** — this source needs a different rot signal |
| **Ohio / Ivalua** | CAPTCHA-gated | `manual-only` posture. No adapter |

> ### The property that matters most, and it is not ours
>
> **Four confirmed instances across three independent platforms of a parameter being accepted and silently ignored** (§5.4): SAM.gov's `sort`, Indiana's date parameters, and Michigan's `Show Me` filter, which returns identical results for `Open`, `All`, and `Recent Awards`.
>
> **This is Tenderfoot's version of the IMPACT auto-pause failure** — a documented property of someone else's platform that takes the system down silently. The difference is that we found it before launch rather than thirteen days after, and the detection method is known: **vary one parameter, watch the total move.**
>
> **Every new adapter runs that check as part of being added**, and the result is recorded on the Registry row. Where a source withholds totals, that fact is itself recorded, because it means the check is unavailable and health must be inferred some other way.

---

## 11. Branch protection

**Proportionate to one developer:** `main` requires CI green. No required reviewers — there is no second human, and a rule that cannot be satisfied gets disabled rather than followed.

**Revisit if a second person joins**, at which point required review becomes meaningful rather than ceremonial.

---

## 12. What is deliberately absent

~~**No staging environment.** Nothing to stage to (§7).~~ **Revised 2026-08-13.** There is now something to stage to, and it arrives without being asked for: **a preview deployment per branch.** That is better than a staging environment and costs nothing to adopt — **provided each preview gets its own database branch rather than production's** (§8).

**No release process, versioning, or changelog.** One user, continuously updated, no consumers to notify.

**No performance budget.** One user, tens of thousands of records, batch ingestion. `Stack-Requirements.md` is explicit that **nothing about Tenderfoot is a scale problem**, and inventing budgets would invent constraints.

**No error-monitoring service.** The status bar surfaces source health, which is the failure mode that actually matters here. A crash is visible to the one person using it.

**Each of these becomes real at a different trigger — a second user, a hosted deployment, a second customer.** They are absent because they are not needed yet, not because they were forgotten.
