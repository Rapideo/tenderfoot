# What the stack has to satisfy

**Written 2026-08-12** to feed the tech stack outline, which feeds the workflow spec (plan of action **B2**) and closes spec **§10.3**.

> **This is not a recommendation and names no technology.** It is the constraint list, pulled from decisions already made, so a candidate stack can be checked against something rather than argued about. **Matt picks the stack.**

---

## First: the V1 decision made this a much smaller problem

Parking matching on 2026-08-11 (spec §1.1) removed most of the exotic requirements. Anything a candidate stack would have needed *only* for scoring is gone:

| Was needed for | Status in V1 |
|---|---|
| Embeddings + vector store | Stage 1 semantic recall | **Not needed** |
| An LLM provider on the critical path | Stage 2 adjudication | **Not needed for scoring** — see the open question below, extraction is a separate matter |
| A job queue | Rescoring the archive | **Not needed** |
| Assessment-versioning machinery | Backtest regression gate | **Schema column only.** Keep the column from the first migration; skip the machinery |

**What remains is ordinary:** a database, a scheduled fetcher, a document parser, and a web app. That is a stack you can choose confidently rather than hedge on — and choosing a smaller one now costs nothing later, because the parked capabilities arrive with their own requirements when they arrive.

---

## Hard requirements

### Data

- **Eleven objects, four groups.** **Entity foreign keys present in the first migration** (§2.2) — retrofitting them is named in the spec as the expensive mistake.
- **Sightings stored separately from canonical records** (§4.4). One solicitation seen on three sources is one record and three sightings. Dedup, change detection, and per-source yield all read from this.
- **Assessment versioning column from day one**, even though nothing writes a score in V1. V1's entire output is recorded judgments, and adding a version column to judgments already made is the same class of mistake as retrofitting FKs.
- **No fact about Koehler Partners in code** (§2.1, §7.8). A second customer is a second row, not a fork. This is a schema and configuration constraint, not an aspiration.

### Ingestion

- **Every adapter takes a `since` parameter** (§3.1). This is what makes backfill and live operation the same code path — it is the single most load-bearing design decision in the ingestion layer.
- **Adapters bind to platform + config, not to jurisdiction** (§5.7). One Periscope adapter serves Illinois and others; one CGI Advantage adapter serves Michigan and Kentucky.
- **Phase 0 is a batch run over an archive.** No scheduler is required to reach the SP6 gate. Scheduling is post-GO (SP7).

### The Source Registry is V1's only control surface

With nothing filtered or ranked, **turning a source on or off is the entire configuration of what a user sees.** That promotes it from a config file to a first-class feature:

- **Editable at runtime, by a person, without a deploy.** When volume turns out wrong, the fix is toggling a source at 9am — not shipping.
- **Versioned**, so "what were we ingesting in September" is answerable.
- Carries per source: adapter tier, platform, archive depth, **legal posture** (robots.txt, ToS, rate limits), and health.
- **Legal posture is enforced, not remembered.** Paywalled aggregators (GovWin, BidNet, BidPrime) are excluded by their terms and the registry is where that exclusion lives.

### Documents — the hardest technical problem in V1

From `corpus/FINDINGS.md`, measured on real bundles:

- **Formats span `.pdf`, `.docx`, `.xlsx`, `.xls`, `.pptx`, and nested `.zip`.** PDF-only extraction covers roughly half of what matters, and **the scope of work — the most important file for judging fit — is frequently a `.docx`.**
- **Bundles reach 21 MB**; one holds 22 files. Thousands of them.
- **Every extracted field carries a confidence and a pointer to its source text** (§5.3).
- **Absence is a distinct state from low confidence** (SVRC View 2.3) — *"we looked and it is not there"* is not the same fact as *"we are unsure."*

**With no scores in V1, extraction accuracy is the only thing the system can be right or wrong about (§8.4).** The parsing choice is therefore the highest-stakes item in the stack outline, where under the old design it was a detail behind the scorer.

### Ingestion regression is the V1 equivalent of a test suite

There is no scorer to regress, so the failure that matters is **a source silently returning less than it did** — which is a direct hit on the one pain V1 exists to solve, and invisible by default.

**This is not hypothetical: it has been hit three times on two government APIs.** Parameters are accepted and silently ignored rather than rejected (§5.4, `corpus/manifest.md`). The stack needs somewhere for expected-volume baselines and per-source health to live, and the detection method is already known — vary one parameter, watch the total move.

### The application

- **Seven screens**, one of them deferred. `reference/Tenderfoot SVRC.md` is the outline; `prototype/` is the visual specification.
- **The triage queue is keyboard-driven** and must feel instant — the working habit is ten seconds per item, forty items in a sitting.
- ~~**Responsive.** Ten-second triage decisions should work on a phone (§7.1).~~ **CHANGED 2026-08-13: desktop-only.** The web client targets desktop and nothing else; phone triage moves to a **separate mobile client against the same data**. Decided by measuring the frozen bundle rather than assuming — no responsive foundation exists (0 media queries, 0 `clamp`, 3 `flex-wrap` in 74 flex containers) and the grids carry fixed column counts, so retrofitting is per-screen design work. **This removes a requirement from the web stack and adds a client that does not exist yet.** Full figures in `prototype/PUNCH-LIST.md` item 2.
- **Saved views persist** and are, per the prototype, first-class objects — *pending ratification, see the SVRC preamble.*

### Delivery

Whatever B2 specifies must cover **CI, environments, deploys, secrets, and branch protection.** Proto2PRD §5.2 additionally requires the spec to carry **platform properties** — which matter more here than usual, because half the inputs belong to other people: SAM.gov quotas, portal rate limits, IP blocks.

---

## Open questions the stack choice will force

**These are decisions, not gaps. Worth answering deliberately rather than discovering.**

**1. Does extraction use an LLM, or rules?** The biggest fork in the list. Pulling a deadline out of a 22-file bundle where three documents disagree is either heuristics plus careful precedence rules, or a model call per document.

> It changes cost, latency, determinism, and — most importantly — **whether §8.4's accuracy measurement is stable between runs.** A rules-based extractor that is 80% accurate is measurable and improvable; a model that averages 90% but varies per run is harder to hold to a number. This is worth deciding on purpose.

**2. Where do the documents live?** Thousands of bundles up to 21 MB each. Blob storage versus the database is a fork with cost and backup consequences, and it is easier to choose now than to migrate. **Narrowed 2026-08-13: blob storage, because there is no filesystem. Which provider is open, and it is now a recurring bill rather than free disk.**

**3. Authentication in V1, or none?** `Shell A`'s open question, still open. Single-user with no login is defensible for an internal tool with one customer — and the SVRC notes it is **expensive to retrofit.** The portability story (§2.1) eventually implies multiple firms.

**4. Does the prototype's rendering get rebuilt repo-native?** Plan of action §9 item 5, still open. The stack choice constrains the answer: the prototype is plain HTML with inline styles and a 67-token custom-property layer, and how cleanly that ports depends entirely on what is chosen here.

---

## What is deliberately absent

**No performance targets, no scale numbers, no availability requirement.** One customer, one user, tens of thousands of records, batch ingestion. **Nothing here is a scale problem**, and specifying scale requirements for it would be inventing constraints. If a candidate stack is being justified on throughput, that is a signal something has been misread.

---

# Candidate assessment — the IDE8 stack

**Assessed 2026-08-12** against the requirements above. Matt proposed reusing the stack from **ideate / IDE8**, his other active project, with the explicit goal of keeping the two common.

> **Verdict: appropriate, with one genuine gap.** Adopt it, drop one library, decide three things, and treat document extraction as the item that needs a real answer rather than an assumption.

> ### ⚠ PARTIALLY SUPERSEDED — 2026-08-13
>
> **The persistence half of this assessment is wrong, and the section arguing for it is wrong in an instructive way.** Matt chose **Vercel hosting with a Neon managed Postgres database** the following morning. Everything below about React, Vite, Zustand, Express, `@dnd-kit`, the router, CSS frameworks and document extraction **stands unchanged**. Everything about SQLite, local-first, and documents-on-the-filesystem does not.
>
> **The superseded passages are marked in place and kept**, per §4 of the workflow spec: the reasoning was sound given a premise that turned out not to hold, and deleting it would hide the one thing worth learning from it. **See "Revision — Vercel and Neon" at the foot of this document.**

**Commonality is a first-class reason, not a compromise.** One set of idioms, one set of muscle memory, one debugging vocabulary, and components that can move between projects. That is worth real weight on its own — enough that the bar for deviating from IDE8 should be a requirement this project actually has, not a preference.

## The candidate

| Layer | | |
|---|---|---|
| **Client** | React 19 · Vite 6 | UI and dev server |
| | Zustand 5 + Immer 10 | application state |
| | @dnd-kit | drag and drop |
| | *no router, no CSS framework* | styling is hand-written CSS against design tokens |
| **Server** | Express 4 | the API |
| | ~~better-sqlite3 13~~ | ~~persistence — one SQLite file per project, local-first~~ **⚠ superseded 2026-08-13 → Neon Postgres** |
| | tsx | runs the server directly, no build step |
| | cors, multer | cross-origin, file uploads |

## Carries over with no concerns

**React + Vite + Zustand + Immer.** Tenderfoot's client state is modest — queue position, saved views, filter state, decisions in flight. Zustand is comfortably sized for it, and Immer suits the shape of triage, which is overwhelmingly *change one field on one record*.

**Express + tsx.** The API surface is small: list, detail, record a decision, run an ingest, read and edit source config.

## Drop @dnd-kit — the prototype already made this decision

The only screen that would want drag is the Pipeline Board, and **the prototype moves cards with `←` `→` arrow buttons rather than drag.** That is the better call for a keyboard-first product, and Screen 7 is deferred regardless (`Pri 1`, `Conc 30%`).

## Three things to decide

### 1. A router — recommended, and IDE8 does not have one

Tenderfoot has **seven screens, and an opportunity detail with five tabs**, plus `Open full detail →` and `← Back to queue` as explicit affordances in the prototype. All of that is achievable in Zustand alone.

**What is lost without routes is deep links** — no URL that opens one opportunity. For a system of record whose stated job is answering *what did we decide about this, and why* (problem #4), being unable to point at a record is a real loss. It is cheap now and awkward to retrofit once the state shape has settled.

### 2. Where documents live ⚠ SUPERSEDED 2026-08-13

> ~~**Filesystem, with paths in SQLite.** Thousands of bundles reaching 21 MB. This is not really a decision so much as a thing to write down before someone puts a blob column in a migration.~~
>
> **Vercel has no persistent filesystem.** The decision is now *which blob provider*, and it acquired a cost line it did not have.

### 3. One SQLite file per firm, or one shared database ⚠ RE-FORMED 2026-08-13

> ~~IDE8's pattern is one file per project. The Tenderfoot analogue is **one file per firm**~~ — the question survives, the units change: a Neon **project** per firm, a database per firm, a schema per firm, or a `tenant_id` column.

The part that still holds: it maps onto §2.1's portability rule (*a second customer is a second row, not a fork*), and it is **the kind of choice that is invisible until the second customer exists and expensive immediately afterwards.** Worth deciding deliberately rather than inheriting.

## ⚠ WRONG — "Local-first SQLite is a good fit, better than a server database"

> **Superseded 2026-08-13, and kept because the way it is wrong is worth more than the conclusion was.** The argument below is *valid* — every claim in it is still true — and its conclusion is *unusable*, because it was measured against the requirements list and never against the deployment target. **A stack assessment that never asks "where does this run" can be entirely correct and still wrong.**

~~Measured against the requirements above: eleven objects with foreign keys, tens of thousands of records, batch ingestion, one user, no availability requirement. **Nothing about Tenderfoot is a scale problem**, as stated at the foot of this document. Local-first buys zero infrastructure, no database secrets, and backup by copying a file.~~

**All of that remains factually true and none of it survives contact with Vercel**, which has no writable persistent filesystem — so a SQLite file cannot outlive a request there. **The hosting choice decides the database; the database was never independently choosable.**

**The two caveats below were filed as "genuinely deferred." Both were retired within twenty-four hours, one of them by the very decision that invalidated the section:**

- ~~**Scheduled live ingestion needs something always on.** A closed laptop does not scrape.~~ **Answered by Vercel Cron.** Filed as the constraint that "eventually forces a hosting decision" and marked *should not arrive as a surprise* — it arrived the next morning, which is roughly the best case for something described that way.
- ~~**A second reader means a second copy.**~~ **Answered by managed Postgres.**

> **The lesson, and it is a candidate for the playbook.** Both caveats were correctly identified, correctly reasoned, and filed under *deferred*. **Neither was treated as a reason to question the choice** — and one of them was, in fact, the reason the choice was wrong. **A deferred caveat that names its own trigger deserves one more question: what if the trigger fires early?** Staged in `docs/Proto2PRD-Lessons.md`.

## The real gap — document extraction

**This is the one place the candidate is under-specified, and it lands squarely on the highest-stakes requirement in this document.**

With no scores in V1, **extraction accuracy is the only thing the system can be right or wrong about** (§8.4). And the corpus demands `.pdf`, `.docx`, `.xlsx`, `.xls`, `.pptx` and nested `.zip` — with the scope of work, the file that decides fit, *frequently a `.docx`*.

**Node is the weakest major runtime for this.** The libraries exist; they are thinner and less battle-tested than Python's equivalents, particularly for `.xlsx` and `.pptx`. IDE8 has presumably never had to parse a 22-file government bundle, so this requirement is new to the stack rather than already answered by it.

Three ways out — **and this is precisely where mechanical-vs-smart modes stop being decorative** (`Pinned-Ingestion-Scaffolding.md`, proposal 4):

| Option | Cost |
|---|---|
| **Node libraries throughout** | One language, one runtime. You will fight `.xlsx` and `.pptx`. |
| **A Python sidecar for extraction only** | A second runtime, confined to one job behind a clean boundary. Strongest parsing story. |
| **Extraction as a smart-mode action** | An API call handles arbitrary formats. Costs money per document, and §8.4's accuracy number stops being stable between runs. |

**Mechanical mode needs real parsers. Smart mode needs a request.** The modes design does not remove this decision, but it does mean the answer can be *both*, with the data recording which one produced each field — which is the only way the comparison ever gets made.

## On frameworks — no CSS framework; build the primitives instead

Matt asked whether the finalized prototype argues for adopting a framework, possibly as an early development task.

**It argues the opposite.** The prototype is not a rough sketch to be fleshed out — it is fully specified: **67 role-named colour tokens, a 12-step radius scale, a considered type scale**, all verified byte-identical to the frozen bundle by `prototype/tools/verify-tokens.py`. A CSS framework arrives with its own opinions, and the work becomes overriding them.

**What is worth doing early is already a slice.** `SP2 — Design system` ends with *"every primitive on a dev-only route"* and carries a **sign-off gate**. Proto2PRD §7 is emphatic that primitives come before features, because getting that order wrong is the documented failure on IMPACT.

**So the prototype being finalized does not argue for a framework — it argues that SP2 will be unusually cheap.** The tokens are extracted and verified; the primitives are already drawn: button, chip, card, table row, score bar, fact panel, keycap, status pill. SP2 is mostly transcription rather than design.

**One consequence for the earlier note about hand-written CSS.** IDE8's *"every view is bespoke"* cost does not transfer at the same rate. Tenderfoot's views are bespoke against **a token layer that already exists and a component set that will exist after SP2** — which is a different proposition from bespoke-from-nothing.

---

# Revision — Vercel and Neon

**Decided 2026-08-13 by Matt**, one day after the assessment above. **Hosting on Vercel, with a Neon managed Postgres database provisioned through the Vercel Marketplace.**

> **This is one decision, not two.** Vercel has no writable persistent filesystem — `/tmp` is per-invocation and ephemeral. **A SQLite file cannot survive a request there.** Once hosting is Vercel, the database is managed by arithmetic rather than by preference, and the interesting question is only *which* managed database.

## What was actually at risk, and what wasn't

**No data.** `*.db` has been in `.gitignore` since SP0; `tenderfoot.db` was never committed. **The research lives in `corpus/` as files and in the seed migrations `003_seed_source_registry.sql` and `004_seed_firm_profile.sql`.** The database has always been a derived artifact, rebuilt from those by `npm run migrate` and the corpus loader. That was a deliberate property of SP0, and it is the reason this revision is inexpensive.

**The code, and it is bounded.** SQLite reaches four TypeScript files and four SQL migrations — roughly 600 lines, all of it inside the one slice that has merged.

| | |
|---|---|
| `app/server/src/db/index.ts` | The entire connection layer. Rewritten |
| `app/server/src/db/migrate.ts` | The runner. Adapts; the design survives |
| `app/server/src/routes/index.ts` | ~14 query sites, all becoming `await` |
| `app/server/src/ingest/corpus.ts` | ~12 query sites and two transactions |
| `app/server/migrations/*.sql` | Four files, translated |
| four test files | Rewritten alongside |

## The porting cost is the async boundary, not the SQL

**`better-sqlite3` is synchronous by design; every Postgres driver is not.** That is the change that touches every call site — `db.prepare(...).get()` becomes `await`, and every route handler and helper that transitively calls one becomes async. **Mechanical, unavoidable, and larger than the SQL translation.**

The SQL itself is small and every item has a direct equivalent:

| SQLite | Postgres |
|---|---|
| `INTEGER PRIMARY KEY` | `GENERATED ALWAYS AS IDENTITY` |
| `datetime('now')` on TEXT columns | `now()`, and the columns become `timestamptz` |
| `INTEGER` used as boolean (`is_self`, `enabled`, `remote_ok`, `prebid_required`) | `boolean` |
| `INSERT OR IGNORE` | `ON CONFLICT DO NOTHING` |
| `lastInsertRowid` | `RETURNING id` |
| `db.transaction(fn)()` | explicit `BEGIN` / `COMMIT` |
| `PRAGMA foreign_keys = ON` | **Unnecessary. Postgres always enforces them** |
| `PRAGMA journal_mode = WAL` | **Unnecessary.** MVCC gives concurrent reads during a long write for free |
| `REAL` | `double precision` |

**Two things get strictly better and are worth naming**, because they are the reason not to treat this as pure cost:

- **Foreign keys are enforced unconditionally.** §2.2 calls entity FKs the expensive mistake to avoid, and the SQLite version depended on a `PRAGMA` set in application code — enforcement that a second connection opened anywhere else would silently lose. **That class of bug becomes impossible.**
- **Machine timestamps become real `timestamptz`.** `created_at`, `updated_at`, `seen_at` are written by `now()` and convert for free.

  > **Corrected the same day.** This bullet originally claimed the *domain* date columns — `closes_at`, `ends_at`, `posted_at` — also become `timestamptz`, and called it a clean win. **The important half of that is wrong.** The corpus carries `MM/DD` with no time and no zone; casting `'2026-08-15'` to `timestamptz` yields midnight **UTC**, which renders as *August 14, 8:00 PM* in Eastern. **A deadline that displays as the previous day is a defect**, and `closes_at` is the highest-consequence extracted field in the system (§8.4).
  >
  > The right model is probably `date` for contract and award dates and `timestamptz` for deadlines — **but that is a decision about timezone semantics, not a driver swap**, and taking it inside the port would be precisely the unratified-decision failure `Proto2PRD` §4.7.5 names. **Domain dates stay `text` through SP1.5**, with the change scheduled before SP4, when extraction starts producing times rather than dates. Recorded in the SP1.5 plan, decision 5.

**One thing to watch.** `value_cents` is `INTEGER` and must become `bigint`, not `integer` — a contract over about $21 million overflows a 32-bit integer, and the corpus contains contracts in that range.

## What this closes

**Two risks recorded in `STATUS.md` are retired.**

1. ~~"Deployment expires at SP7. A closed laptop does not scrape."~~ **Vercel Cron.** The largest anticipated change to the workflow spec has now happened, four slices early.
2. ~~"A second reader means a second copy."~~ **Managed Postgres.**

## What this opens

**Detailed in the workflow spec §7 and §10.1, and summarised here because it is the honest other half of the ledger.** Every concern the local-first answer made vanish has come back: connection limits, cold starts, an ephemeral filesystem, function duration caps, and a deploy pipeline that can break.

**Three carry real deadlines:**

| | By |
|---|---|
| **Where long ingestion runs.** §5.3 fetches in three hops and assumed a process that could run for minutes. Function invocations are capped | **SP3** |
| **Which blob provider.** `document.path` now means a blob key. Thousands of bundles to 21 MB — a bill, not free disk | **SP4** |
| **Measure the plan limits** — function `maxDuration`, cron frequency, Neon autosuspend and compute hours — and write them into workflow spec §10.1 | **SP7, earlier if possible** |

> **The IMPACT lesson stops being an analogy here.** Production went down thirteen days after launch because free-tier Supabase auto-pauses — *"not a bug, a documented property of the plan, never written down."* **Tenderfoot is now on a serverless Postgres that also suspends when idle.** Same shape, same class of platform. §10.1 of the workflow spec is a table of empty cells for exactly that reason: those numbers get **measured and dated**, not recalled.

## What does not change

**Everything above the database.** React 19, Vite 6, Zustand + Immer, the router, no CSS framework, `@dnd-kit` still dropped, and **document extraction is still the real gap** — Node remains the weakest major runtime for `.docx` / `.xlsx` / `.pptx`, and with no scores in V1 extraction accuracy is still the only thing the system can be right or wrong about.

**One caveat on the extraction options, though.** The Python-sidecar option now costs more than it did: a second runtime was cheap when everything ran on one laptop. **On Vercel it is a second deployment target.** That does not settle the question — it moves the answer toward Node libraries or smart mode, and it should be weighed openly rather than discovered at SP4.

**And commonality with IDE8 survives**, which was the reason for adopting this stack in the first place. The client is untouched; the server keeps its shape and changes its driver.
