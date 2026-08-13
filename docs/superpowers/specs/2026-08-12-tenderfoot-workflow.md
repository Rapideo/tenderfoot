# Tenderfoot — Workflow Specification

**Date:** 2026-08-12
**Status:** Draft for review
**Closes:** design spec §10.3 — the last open question in that document
**Author:** Claude, for Matt Smith / Koehler Partners
**Reads with:** the design spec (*what* the app does) and `docs/Stack-Requirements.md` (what the stack had to satisfy)

---

## 0. What this document is

The **SDLC layer** — branching, commits, review, CI, deployment topology, secrets, branch protection, and platform properties. Per `Proto2PRD.md` §5.1 this is deliberately separate from the design spec: *"they change at different rates and are read by different people."*

**It is not architecture.** Where this document and the design spec disagree about what the application does, the design spec is right.

> **One honest framing before anything else.** Most workflow specs describe how a team ships to a hosted environment. **Tenderfoot is one developer, working with an AI, shipping a local-first application with no hosting.** Importing team ceremony would produce a document nobody follows. What follows is deliberately thin where thin is correct, and specific where this project has real risk — which turns out to be almost entirely in *other people's platforms* rather than our own.

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
| Persistence | **better-sqlite3 13**, local-first | One user, batch ingestion, no availability requirement. Zero infrastructure, no database secret, backup by copying a file |
| Server runtime | **tsx** | No build step |
| Uploads / CORS | **multer, cors** | As IDE8 |
| ~~Drag and drop~~ | **@dnd-kit dropped** | The only screen wanting it is the pipeline board, and the prototype moves cards with arrow buttons — the better call for a keyboard-first product, on a deferred screen |
| CSS | **Hand-written against the extracted tokens. No framework.** | The prototype is fully specified — 67 role-named tokens, a 12-step radius scale, verified byte-identical to the frozen bundle. A framework would arrive with its own opinions and the work becomes overriding them |

**Four decisions remain open inside this choice** and are listed in §9. None blocks SP0–SP2.

---

## 2. Repository layout

The repository already holds planning artifacts at root. Application code goes in one subtree so the two never tangle.

```
app/
  client/        React + Vite. The routed application
  server/        Express + better-sqlite3. Adapters, extraction, API
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

**CI does not deploy.** See §7.

---

## 7. Deployment topology — and its known expiry date

**V1 has no hosting.** A local-first SQLite application, one user, batch ingestion. "Deploy" means *run it on the machine*: `npm run dev` for the client, `tsx` for the server, one SQLite file on disk.

**This is a real answer rather than a gap**, and it is worth stating plainly because it makes several usual concerns vanish: no environments to keep in sync, no connection limits, no cold starts, no deploy pipeline to break.

> ### It expires at SP7, and that date is knowable now
>
> **SP7 is scheduled live ingestion. A closed laptop does not scrape.** The moment ingestion must run daily without someone present, this section needs a hosting decision — a small always-on host, or a scheduled job somewhere, plus wherever the SQLite file then lives.
>
> **SP7 is post-GO**, so this is genuinely deferred rather than ignored. **But it should not arrive as a surprise**, and it is the single largest change this document will undergo. Whoever writes the SP7 plan owns it.
>
> **The IMPACT lesson applies exactly here.** Production went down thirteen days after launch because free-tier Supabase auto-pauses — *"not a bug, a documented property of the plan, never written down"* (`Proto2PRD` §5.2). The Tenderfoot equivalent is a scheduler that silently stops because the machine was asleep.

**Consequence for SP0.** Its demo criterion reads *"hello-world through the full deploy path, touching the DB."* For a local-first app that means: **client boots, calls the API, the API reads and writes SQLite, a migration has run, and CI is green on all of it.** Not a deployment — a working vertical slice through every layer.

---

## 8. Secrets

**V1's secret surface is very nearly empty, and that is worth recording because it will not last.**

| | |
|---|---|
| Database | **No secret.** A local file |
| SAM.gov | **No credentials.** The search API is anonymous (§5.8) |
| Indiana IDOA / contract register | **No credentials.** Anonymous JSON endpoint |
| Illinois BidBuy | **No credentials.** Public advanced search |

**Two things will populate it, and both are already-identified open decisions:**

1. **Michigan / Kentucky, if the adapter authenticates.** Matt's reading is that authorisation derives from holding a vendor account (§5.7). An authenticated adapter needs those credentials.
2. **Extraction, if smart mode calls a model API.** See §9.

**Handling, from the first secret onward:** `.env`, never committed, `.env.example` checked in with keys and empty values. No secret in the SQLite file. When hosting arrives at SP7, revisit.

---

## 9. Open decisions inside the stack

**Listed as decisions, not gaps.** None blocks SP0–SP2.

**1. Extraction runtime — the significant one.** Node libraries, a Python sidecar confined to extraction, or extraction as a smart-mode API call. With no scores in V1, **extraction accuracy is the only thing the system can be right or wrong about** (§8.4), and Node is the weakest major runtime for `.pdf`/`.docx`/`.xlsx`/`.pptx`/nested `.zip`. **Must land before SP4**, and it interacts directly with mechanical-vs-smart modes (`docs/Pinned-Ingestion-Scaffolding.md`).

**2. Document storage.** Filesystem with paths in SQLite, almost certainly — thousands of bundles reaching 21 MB. Worth writing down before someone adds a blob column.

**3. One SQLite file per firm, or one shared database.** IDE8's pattern is one file per project. One file per *firm* maps interestingly onto §2.1's portability rule (*a second customer is a second row, not a fork*). Invisible until the second customer exists; expensive immediately after.

**4. Authentication in V1.** `Shell A`'s open question. Single-user with no login is defensible; the SVRC notes it is expensive to retrofit.

---

## 10. Platform properties

`Proto2PRD` §5.2 requires this section. **For Tenderfoot it inverts.**

**We have no hosting platform, so it has no properties to document** (§7). What Tenderfoot has instead is **four source platforms belonging to other people**, whose properties are load-bearing and already measured. They live in the design spec §5.7–5.8 and in the Source Registry; the ones that change how code is written:

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

**No staging environment.** Nothing to stage to (§7).

**No release process, versioning, or changelog.** One user, continuously updated, no consumers to notify.

**No performance budget.** One user, tens of thousands of records, batch ingestion. `Stack-Requirements.md` is explicit that **nothing about Tenderfoot is a scale problem**, and inventing budgets would invent constraints.

**No error-monitoring service.** The status bar surfaces source health, which is the failure mode that actually matters here. A crash is visible to the one person using it.

**Each of these becomes real at a different trigger — a second user, a hosted deployment, a second customer.** They are absent because they are not needed yet, not because they were forgotten.
