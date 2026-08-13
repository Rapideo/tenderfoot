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

> **One consequence that is easy to miss.** Preview deployments get their own environment variables. **A preview branch pointed at the production database is a footgun**, and Neon's branching exists precisely to avoid it: a preview deploy should get a database branch, not production. Settle this when the port lands, while there is almost no data to lose.

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

**6. Where long ingestion actually runs — now the load-bearing one.** **New 2026-08-13.** §5.3 fetches in three hops and was written assuming a process that could run for minutes. A capped function invocation may not hold that. Options: bound each invocation with the candidate-scrape idea (`Pinned-Ingestion-Scaffolding.md` proposal 2, which stops at hop 1 and already exists for other reasons), a durable workflow that survives across invocations, or run ingestion off-platform. **Must land before SP3, which is the first slice to touch a live source.**

> **Sharpened by Matt the same day**, and it reframes what the hosting decision actually bought. **Scraping is a background process; it could never have run locally** — that is the closed-laptop problem, and it is the reason the host exists at all. **So the host solves *when* ingestion runs and leaves *how long it may run* wide open.** The two are easily confused, and confusing them would leave SP3 discovering the cap rather than designing around it.
>
> **Consequence: this item is not one of six equal open questions.** It is the one the hosting decision created and did not answer, and it sits directly in front of the next real slice.

---

## 10. Platform properties

`Proto2PRD` §5.2 requires this section. **Revised 2026-08-13 — it no longer inverts.**

This section used to open *"we have no hosting platform, so it has no properties to document."* **We now have two, and they are exactly the class of platform the IMPACT failure came from: a managed database that suspends when idle, behind functions with plan-dependent limits.**

### 10.1 Our platforms — TO BE MEASURED, not recalled

> **Deliberately unfilled.** Writing plan limits from memory is how the IMPACT failure happened: *"a documented property of the plan, never written down."* Guessing at them here would be the same mistake with more confidence. **Each row is measured against the actual account and plan, and the measurement is dated.** The gate is SP7 for the cron rows and SP4 for the duration rows; earlier is better.

| Platform | Property to establish | Why it is load-bearing | Measured |
|---|---|---|---|
| **Vercel** | Function `maxDuration` ceiling on the chosen plan | §5.3 ingestion "runs for minutes." Configurable per function in `vercel.json`; the ceiling is not | — |
| **Vercel** | Cron minimum frequency and behaviour on the chosen plan | SP7 is scheduled ingestion. This is the whole reason for the host | — |
| **Vercel** | Request/response body limits | 21 MB bundles pass through the API on the way to blob storage, unless they don't — which is itself a design decision | — |
| **Neon** | Autosuspend delay, and cold-start latency after it | Triage "must feel instant." One user means the database is *usually* idle, so this is the common path, not the rare one | **Partial 2026-08-13** — see below |
| **Neon** | Connection limit, pooled vs direct endpoint | Serverless concurrency against a connection ceiling is the classic failure. Pooled endpoint by default | ✅ **2026-08-13 — pooled by default, confirmed.** `DATABASE_URL` resolves to the `-pooler` host and `DATABASE_URL_UNPOOLED` to the direct one. **The integration got this right without being asked**, so the requirement is satisfied by construction rather than by discipline. The connection *count* ceiling is still unread |
| **Neon** | Compute-hour and storage allowance on the plan | The thing that silently stops working, exactly as Supabase did | **Partial 2026-08-13** — see below |

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
| Neon project | `wispy-tooth-06225229`, currently named **`neon-lime-button`** (auto-generated) | ⬜ **rename to `tenderfoot-db` OUTSTANDING** |
| Billing plan | **`launch_v3` (Launch), subscription** | ✅ Taken by default rather than chosen — see `DOOGIE` 2026-08-13 |
| Compute | `ep-super-bonus-auoe43hj`, branch `br-super-breeze-aun4swjv`, **1 → 1 CU** | ⬜ **resize to 0.25 → 8 OUTSTANDING** |
| `DATABASE_URL` | resolves to the **`-pooler`** host | ✅ Correct as provisioned |
| Point-in-time restore | **24 hours** — longer than `kp-web-prod`'s 6 | ✅ |
| Postgres | 17, `aws-us-east-1`, same region as the website | ✅ |

> ### ⬜ Two changes decided 2026-08-13 and NOT YET APPLIED
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
> **The Vercel resource name is a separate string** from the Neon project name; both currently read `neon-lime-button`. Renaming the Neon project will probably not rename the Vercel resource, which is cosmetic and changeable only in the Vercel dashboard.

> **The compute default is worth noting as a platform property rather than a preference.** A fixed floor of 1 CU on a database that idles most of the day is the wrong end of the trade for one user, and **nothing about the provisioning flow surfaces that choice** — it is simply what you get. That is the same class of fact as an auto-pausing free tier: a documented default with a cost, invisible unless someone reads it.

> **One value deliberately left unresolved.** `kp-web-prod`'s `suspend_timeout_seconds` reads **`0`**. In Neon's API `0` means *use the default* and `-1` means *never suspend* — **but this section exists precisely because reading a value's meaning from memory is the failure mode it guards against.** The effective delay is confirmed against the console or by observation before it is written here as a number.
| **Blob provider** | Per-object size cap and egress cost | Thousands of bundles up to 21 MB. This is now a bill | — |

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
