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
- **Responsive.** Ten-second triage decisions should work on a phone (§7.1).
- **Saved views persist** and are, per the prototype, first-class objects — *pending ratification, see the SVRC preamble.*

### Delivery

Whatever B2 specifies must cover **CI, environments, deploys, secrets, and branch protection.** Proto2PRD §5.2 additionally requires the spec to carry **platform properties** — which matter more here than usual, because half the inputs belong to other people: SAM.gov quotas, portal rate limits, IP blocks.

---

## Open questions the stack choice will force

**These are decisions, not gaps. Worth answering deliberately rather than discovering.**

**1. Does extraction use an LLM, or rules?** The biggest fork in the list. Pulling a deadline out of a 22-file bundle where three documents disagree is either heuristics plus careful precedence rules, or a model call per document.

> It changes cost, latency, determinism, and — most importantly — **whether §8.4's accuracy measurement is stable between runs.** A rules-based extractor that is 80% accurate is measurable and improvable; a model that averages 90% but varies per run is harder to hold to a number. This is worth deciding on purpose.

**2. Where do the documents live?** Thousands of bundles up to 21 MB each. Blob storage versus the database is a fork with cost and backup consequences, and it is easier to choose now than to migrate.

**3. Authentication in V1, or none?** `Shell A`'s open question, still open. Single-user with no login is defensible for an internal tool with one customer — and the SVRC notes it is **expensive to retrofit.** The portability story (§2.1) eventually implies multiple firms.

**4. Does the prototype's rendering get rebuilt repo-native?** Plan of action §9 item 5, still open. The stack choice constrains the answer: the prototype is plain HTML with inline styles and a 67-token custom-property layer, and how cleanly that ports depends entirely on what is chosen here.

---

## What is deliberately absent

**No performance targets, no scale numbers, no availability requirement.** One customer, one user, tens of thousands of records, batch ingestion. **Nothing here is a scale problem**, and specifying scale requirements for it would be inventing constraints. If a candidate stack is being justified on throughput, that is a signal something has been misread.
