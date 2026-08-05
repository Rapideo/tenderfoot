# Proto2PRD — The Complete Playbook

> From a set of reference images and a screen outline, to a prototype precise enough to be
> read as a literal specification, to production software that matches it.

**Written:** 2026-08-04 · Internal Rapideo playbook
**Supersedes:** nothing — it *merges* `methodology.md` and `case-study-2026-08-02.md` and adds
the prototype phase, which neither document describes.

---

## 0. What this document is, and why it exists

`methodology.md` describes four stages: Brainstorm → Design Spec → Implementation Plan →
Execution. It is accurate and it works.

It also has a hole. The case study's own closing summary says:

> "Two things made that possible: **a prototype precise enough to be read as a
> specification**, and plans detailed enough to be executed without context. Everything else
> in this document is scaffolding around those two."

One of those two mechanisms has no written procedure anywhere. The prototype appears in the
case study's replay checklist as "Phase 0" and is never explained. The methodology's four
stages do not include it at all.

This document closes that gap. Everything in `methodology.md` is carried forward here, the
case study's corrections are folded in, and **§4 — the prototype phase — is reconstructed from
forensic examination of the IMPACT prototype repository**, because that was the only surviving
record of how it was actually done.

### Provenance of each claim

| Marker | Source |
|---|---|
| *(M)* | `methodology.md` — the generalized playbook |
| *(CS)* | `case-study-2026-08-02.md` — the IMPACT post-mortem |
| **(R)** | **Recovered 2026-08-04 from `C:\projects\impact-internship-portal\impact-prototype` git history — not previously documented anywhere** |

Where the recovered record *contradicts* the written documents, that is called out explicitly.

---

## 1. The two load-bearing mechanisms

Everything else is scaffolding. *(CS §11)*

**1. Promote an artifact to literal specification.** Not "inspired by." Not "approximating."
Name the artifact, declare it authoritative, define concretely what *matching* means, and
enumerate the acceptable deviations. Ambiguity about authority is what produces drift.

**2. Write plans containing complete, paste-able code with per-task verification.** This is
what makes a task executable by a fresh agent with no accumulated context, which is what
enables both parallelism and cadence.

The IMPACT numbers behind this: plans were **1.65× larger than the code they produced** —
54,558 lines of plan yielding ~33,000 lines of application and database code. That sounds like
waste and is the opposite. **The plan is the code, written once in a form that is reviewable
before it is executable.** You pay the cost either way; writing it as prose first means the
expensive review happens where changing your mind is cheap.

---

## 2. When to apply this, and when not to *(M §2)*

**Apply it when:**

- The project is multi-week or longer.
- More than one stakeholder cares about the outcome.
- The code is production software, not a one-off script.
- Multiple sub-systems interact and the interactions deserve thinking through.
- Reviewers will need to audit the decisions later.

**Skip it when:**

- The task is a one-day bug fix or a focused refactor with clear scope.
- The code is exploratory and will be thrown away.
- The work is purely operational.
- A spec and plan already exist and the work is straightforward execution.

The dividing line: if you can hold the entire change in your head at once and the cost of
getting it wrong is "redo a few hours," skip it. If you cannot, apply it.

### 2.1 Boundary conditions — where this playbook's assumptions hold

This playbook is derived from a single project. IMPACT was a role-scoped assessment portal:
forms, admin screens, a question engine, and a permission model. Four of its properties are
baked into the procedure without ever being stated. Check them before assuming the whole thing
transfers.

**1. It assumes the product is UI-shaped.** Phase 0 is screens, design directions, tokens, and
primitives, because for IMPACT the screens largely *were* the product — a running prototype was
a near-complete specification.

When the value lives in an engine — a pipeline, a matcher, a model, a solver — the prototype
still earns its place: it settles the data model (§4.1.1), the interface, and the vocabulary.
But **it does not touch the actual risk.** A prototype can render a beautifully-scored result
and say nothing about whether the score is right. If that describes your project, plan a
*second* instrument for the engine and do not let a polished prototype create false confidence.

**2. It assumes correctness is binary.** Every verification in this document is a yes/no: a
test passes, a curl returns `abc`, a console prints `5`. That works when a feature either
functions or does not.

Some components are never "correct" — only better or worse than the last version. Ranking,
matching, extraction, classification, forecasting. For those, the per-task verification format
cannot express the gate. You need three things the playbook does not describe: **a scored
baseline set, a version stamp on the component that produced each score, and a regression gate**
(*"quality did not drop against version N-1"*). Build all three as **test infrastructure early**,
not as a deliverable late — otherwise there is no way to tell an improvement from a regression,
and tuning becomes guesswork.

**3. It assumes the project will be finished.** IMPACT's sub-projects march to launch; the only
question was how long. When feasibility is genuinely uncertain — when the honest answer might
be "this does not work well enough to be worth building" — **insert an explicit go/no-go gate**
at the earliest point that produces real evidence, and be willing to stop there. Sequence the
work so that gate arrives early and cheap. A playbook that only describes finishing will
happily march you past the moment you should have stopped.

**4. It assumes you own your dependencies.** IMPACT's stack was chosen, provisioned, and
controlled. Its one platform surprise (§5.2, free-tier auto-pause) was still a documented
property of a vendor it had selected.

When a substantial share of your inputs belongs to other people — third-party APIs, scraped
sites, partner feeds, public data portals — **source rot becomes a first-class concern with no
counterpart in this document.** Those inputs change without notice, rate-limit without warning,
and fail *silently* by returning zero rows rather than an error. That needs volume baselines,
staleness alarms, and graceful degradation designed in from the first adapter, plus a legal
posture recorded per source.

---

## 3. The pipeline at a glance

Six phases. Each produces a written, version-controlled artifact. The hand-off between phases
is explicit.

| Phase | Produces | Gate before proceeding |
|---|---|---|
| **0 — Prototype** | Running HTML/CSS/JS, frozen | Stakeholder stops asking for changes |
| **1 — Planning** | Design spec + workflow spec + one plan per sub-project | Everything committed before any app code |
| **2 — Infrastructure** | Repo, CI, environments, hello-world deployed | Full deploy path exercised end to end |
| **3 — Design system** | Tokens + primitives, from the frozen prototype | **Human sign-off before any feature work** |
| **4 — Features** | Sub-projects, small PRs | Named-evidence gate per phase |
| **5 — Launch** | Production | Auth verified live; every env var present |

The single most important ordering rule, and the one IMPACT got wrong: **Phase 3 comes before
Phase 4.** *(CS §9.1)* Details in §7.

---

## 4. Phase 0 — The Prototype **(R)**

**This entire section is newly recovered.** It is the part of the process that made IMPACT
work and the part that was never written down.

### 4.1 What the prototype actually is

Not a mockup. Not a clickable wireframe. **A running application with a mock data layer, whose
mock layer encodes the real business rules.**

The IMPACT prototype at freeze: **36 static HTML pages, a 3,427-line stylesheet, a 1,634-line
shared JavaScript module. No build tooling, no framework, no test runner.** *(CS §2.1)*

Its job is to be *promoted to specification* later. That only works if it specifies behaviour,
not just appearance — which is why the mock layer matters more than the pixels.

> **The 15-table production data model is essentially the prototype's mock dataset,
> normalized.** *(CS §2.3)*

The prototype settled, in `sessionStorage`, where changing your mind costs nothing:
the minimum-PII policy, the composite-key identity model, three-tier competency stitching,
soft-delete tombstone semantics, and role scoping. Every one of those is a data-modelling
decision that most teams discover in production.

### 4.1.1 How the mock layer is actually built **(R)**

`app.js` is 1,634 lines. Its construction is worth copying precisely, because this is the
artifact that becomes the production data model.

**One IIFE, one namespace, no build step.**

```js
(function (window) {
  // -------- Mock dataset (single source of truth for demo) --------
  const EMPLOYERS = [ ... ]
  ...
  window.IMPACT = { ... };
})(window);
```

Every page loads the same `app.js` via a plain `<script>` tag and reaches everything through
`window.IMPACT`. No modules, no bundler, no imports to maintain.

**The data is realistic, not lorem ipsum.** The seed employers are Eskenazi Health, Indy Tech
Trades, Habitat Indianapolis, Elevate Ventures — real Indianapolis organisations with plausible
contacts, phone numbers, and domain-specific notes:

```js
{
  id: 'eskenazi-health',
  name: 'Eskenazi Health',
  contactName: 'Maya Reyes',
  contactEmail: 'maya.reyes@eskenazihealth.edu',
  phone: '(317) 555-0148',
  notes: 'Primary-care MA placements across 4 clinics. Quarterly cohorts.'
}
```

This is not decoration. Realistic records of realistic *length* surface truncation, wrapping,
and column-width problems that placeholder text hides entirely — and they make stakeholder
review meaningful, because the reviewer is looking at their own world rather than at
`Lorem ipsum dolor`.

**Defaults plus an overlay, computed at init, written through named functions.**

```js
// PROGRAM_INFO is the live record (defaults + sessionStorage overlay).
// Reads sessionStorage at module init; writes happen via saveProgramInfo().
```

Each mutable collection is wrapped in its own immediately-invoked function that merges a
hard-coded default set with whatever the user has changed. Reads happen once; every write goes
through a named `save*` function. Storage keys are namespaced — `impact.settings.programInfo`,
`impact.settings.questionSets` — and per-record keys are generated by a helper
(`assessmentStorageKey(type, internId)`).

**Two storage tiers, chosen deliberately.** `sessionStorage` for editable configuration and
in-progress work; `localStorage` for intern identity, so a confirmed intern is not asked to
re-identify. That distinction is a product decision made in the prototype and carried into
production.

**Comments state the rule and its reason, not the mechanics.** These are the actual comments,
and each one is a data-model decision:

```js
// Roles are scoped to their parent employer (mirrors the Cohort → Employer relationship).

// Intern record stores only the minimum PII required to identify the intern at
// assessment time: first initial, last name, and cohort (which itself implies the
// employer). No first name, no date of birth, no zipcode are persisted.

// Look up an intern by the composite identity the public-side flow collects:
// first initial (case-insensitive), last name (case-insensitive), and cohort.
// Employer is implied by cohort, so it isn't part of the match.

// Per-set merge: fall back to defaults for any default missing from sessionStorage,
// EXCEPT explicit tombstones (parsed[id] === null) which mean "deleted by admin;
// do not resurrect from defaults".
```

`lookupInternByIdentity` became a production function of essentially the same name and shape.
The tombstone rule is a genuinely subtle persistence decision, settled here for the price of a
comment.

**The abstraction that mattered most was proven here.** All five question-bearing forms shared
one data-driven pipeline: `_render*` helpers each take a question record plus a container, and
emit a wrapper carrying `data-qid="<question.id>"` so a single `collectAnswers` can harvest the
whole form generically. Production inherited that wholesale as the question-set engine.

> That was not convergent evolution — it was the prototype having already proven the
> abstraction was correct. *(CS §2.4)*

**The rule to take away:** if a decision would be expensive to reverse after a migration
exists, make it here, and leave a comment saying why.

### 4.2 The five inputs **(R)**

The IMPACT prototype's first commit (`e70fcbf`, 2026-04-16, 32 files, 8,474 insertions)
carried exactly five kinds of input. Reproduce all five.

| # | Input | IMPACT artifact | Size | Job |
|---|---|---|---|---|
| 1 | **PRD** | `PRD.md` | 261 lines, 16 sections | Rules, roles, permissions, non-goals |
| 2 | **Per-view outline** | `IMPACT ... App Outline.md` | 283 lines | Field-level screen/view inventory |
| 3 | **Design-language references** | `References/ref1–ref5.png` | 5 images | Aesthetic vocabulary |
| 4 | **Brand source artifact** | `References/IMPACT LOGO.png` | 1 image | Colour, by measurement |
| 5 | **Domain source material** | Sample rubrics `.docx`, placeholder questions `.md` | — | Real content from the client |

Inputs 3 and 4 are **different inputs with different jobs**, and conflating them is a mistake.
The references supply *how it should feel*. The brand artifact supplies *what colour it is*.

#### 4.2.1 The PRD's shape

Sixteen sections: Overview, Goals, Non-Goals (v1), Users & Roles, Unique Identifier, Core
Entities (one subsection per entity), Business Rules (one subsection per rule), User Journeys
(one per role-task), Screens (reference), Validation & Error Handling, Authentication & Access
Control, Data Retention, Open Questions, Out of Scope / Deferred, Assumptions, Success
Criteria.

Note what is present: **Non-Goals appear third**, before entities. Open Questions and
Assumptions are first-class sections, not footnotes.

#### 4.2.2 The per-view outline's shape

A strict four-level hierarchy, with UI elements listed in caps:

```markdown
# SHELL:
## NAVBAR: Top
LOGIN BUTTON
LOGOUT BUTTON (ADMIN)
SELF-ASSESSMENT BUTTON

## MODAL: Delete Confirmation
## MODAL: Submit Confirmation

# SCREEN: Landing
## VIEW: Landing
LOGO and CONTENT

## VIEW: Login
EMAIL ADDRESS FIELD
PASSWORD FIELD
SUBMIT BUTTON
CANCEL BUTTON
RECOVER BUTTON
```

`SHELL` holds anything global — navbar, modals. Then `SCREEN` groups `VIEW`s. Elements are
bare, capitalised nouns with optional role qualifiers in parentheses.

This is deliberately crude and that is the point. It is unambiguous about *composition* while
saying nothing about *appearance*, which leaves the design directions genuinely free to differ.
The CLAUDE.md written alongside it says: *"The outline is authoritative for component
composition; the PRD covers rules and permissions."*

#### 4.2.3 What the reference images actually were **(R)**

All five are drawn from **one single design case study** — a communications agency called
*svyazi* — sampled across five different views:

| File | Content |
|---|---|
| `ref1.png` | Tablet mockup of the landing page in context |
| `ref2.png` | Type-and-colour specimen card — Druk Wide Bold display, Montserrat Medium body, three swatches |
| `ref3.png` | Component detail — rounded cards, circular solid-black icon badges, accent treatment |
| `ref4.png` | The complete landing page, full scroll — section rhythm, card grids, alternating light/dark/accent bands |
| `ref5.png` | Closing slide — logo lockup on a full-bleed accent panel |

**One coherent system, sampled at multiple zoom levels** — specimen, component, page, and
in-situ mockup. Not five unrelated screenshots.

The design language they carry: a heavy geometric display face paired with a clean humanist
body; near-monochrome with exactly one saturated accent; generously rounded cards; solid
circular icon badges; a warm off-white canvas; full-bleed alternating sections.

#### 4.2.4 Expect the references to lose **(R)**

**Stated intent** (from the author, 2026-08-04): *"My intention was always to get as close to
the image design reference as possible."*

**What shipped diverged from them substantially.** The svyazi references are heavily rounded
and green. The selected IMPACT direction is sharp — 2px/4px/8px radii — and navy. Variation
`01-warm-editorial` used 10/18/28px plus pills and was by far the closest to the references;
it lost.

This is not a criticism of the intent. It is the most useful thing in this section, because it
identifies a force nobody plans for. **Reference images are the weakest of the three inputs
competing to define the look**, and they get overridden by two stronger ones:

1. **The brand artifact wins on colour.** Once the palette is *measured* from a logo (§4.5),
   it is not a preference and cannot yield. The references' green was never going to survive
   contact with a navy/cyan/gold logo.
2. **The content type wins on form.** Dense admin tables and long multi-question forms are
   served badly by generous radii, large padding, and airy card rhythm. A marketing landing
   page — which is what the references were — has the opposite requirements. The moment the
   bake-off rendered a real data table, roundness stopped paying for itself.

What *did* survive is structural rather than superficial: one disciplined accent colour, a
heavy-display-plus-clean-body type pairing, dark full-bleed sections, and card-based section
rhythm. Those are the transferable parts of a reference, and they transferred.

**The practical guidance:** supply references and aim to match them. But expect the bake-off to
reveal where they cannot hold, and treat that as the bake-off doing its job rather than as a
failure to follow the brief. Finding out on three screens is the cheapest possible place to
find out.

### 4.3 The bake-off: N competing directions **(R)**

**This is the single most important undocumented step.**

The first commit did not contain *a* prototype. It contained **three complete, competing design
directions**, each built across the same three representative screens, each with its own
stylesheet:

| Direction | Stylesheet | Canvas | Radii | Typography |
|---|---|---|---|---|
| `01-warm-editorial` | 917 lines | `#F6F1E6` warm cream | 10 / 18 / 28 + pill | Fraunces serif + Instrument Sans |
| **`02-civic-minimal`** | **1,065 lines** | **`#EFF1F5` cool grey** | **2 / 4 / 8** | **Archivo Black + IBM Plex Sans + IBM Plex Mono** |
| `03-modular-dashboard` | 1,042 lines | `#FAFAF7` warm white | 10 / 16 / 22 + pill | Be Vietnam Pro |

The three screens each direction had to render: **`index.html` (public landing),
`dashboard.html` (an admin data table), `self-assessment.html` (a long form).** Landing, list,
form — the three archetypes that between them exercise nearly every visual decision a business
application needs to make.

> **Unrecorded:** how the bake-off was briefed — why three directions rather than two or five,
> and how each was characterised — is not preserved in the repository, and the author does not
> recall it. The named slugs (`warm-editorial`, `civic-minimal`, `modular-dashboard`) are the
> only surviving evidence that the directions were framed as distinct *registers* rather than
> as arbitrary variations. Brief the next one deliberately, and write the brief down.

#### 4.3.1 Hold the brand constant; vary the style **(R)**

All three variations shipped with **byte-identical brand hues**:

```css
--navy: #1B2B8F;  --navy-deep: #0F1B5C;  --cyan: #2EA7E0;  --gold: #F5C518;
```

What varied was canvas temperature, corner radius, typography, and shadow depth. What did not
vary was hue.

This is good experimental design. If the variations differ on everything, the choice becomes
"which do you like," which is unresolvable. If they differ on one axis — here, *formal
register*: editorial warmth vs civic sharpness vs modular softness — the choice becomes
answerable, and the answer means something.

### 4.4 Selection, promotion, and archiving **(R)**

The winner is promoted to `Prototypes/PROTOTYPE/`. The losers move to `Prototypes/archive/`
**and are also zipped to `archive.zip`** — kept, not deleted.

CLAUDE.md then carries an explicit rule:

> `Prototypes/archive/` (and `archive.zip`) hold discarded earlier variations.
> **Don't modify archived files.**

Verification that this is what happened: diffing the promoted `self-assessment.html` against
each archived variation gives **6 differing lines against `02-civic-minimal`**, versus 642 and
669 against the other two. The shipped stylesheet still carries its origin in a header comment
— *"IMPACT Internship Assessment Portal — Civic Minimal (02)"* — which survived all the way
into production.

**Keep the losers.** They are the record of what was considered, and they cost nothing.

### 4.5 Measure the palette *after* selection, not before **(R)**

**This corrects a widely-repeated claim.** Both `methodology.md` and the case study say the
palette was "sampled from pixels in the IMPACT logo," which is true — but both imply it
happened up front. It did not.

The variations were generated with **estimated** brand colours. Only the winner had its palette
replaced with **measured** values:

| Token | Variations (estimated) | Shipped (measured) | Sampled from |
|---|---|---|---|
| `--navy` | `#1B2B8F` | **`#153A98`** | wordmark royal blue |
| `--navy-deep` | `#0F1B5C` | **`#051028`** | logo dark background |
| `--navy-mid` | — | **`#2947A8`** | state-shape secondary blue |
| `--cyan` | `#2EA7E0` | **`#00A6F6`** | state-shape bright stripe |
| `--gold` | `#F5C518` | **`#FFD71F`** | state-shape gold stripe |

Every shipped token carries an inline comment naming **which part of the logo it came from**.
That per-token provenance is what makes the palette unarguable. *(CS §7.2)*

> "Deriving the palette from an artifact nobody controls removes colour from the space of
> things that can be relitigated. There is no 'what if the blue were softer' conversation,
> because the blue is not a preference — it is a measurement."

The sequencing is correct and worth preserving deliberately: **choose the direction while
colour is still approximate, so the choice is about form rather than hue. Then measure.**

#### When no brand artifact exists

IMPACT inherited a logo. A new product often has nothing to measure — no mark, no palette, no
name treatment. The mechanism still works, with one substitution.

Its value was never that nobody chose the artifact; someone chose IMPACT's logo too, at some
point. **The value is that once an artifact is named, colour becomes derivable instead of
debatable.** So name one:

1. **Designate a single source before sampling** — one specific reference image, not "the
   references" collectively. Naming a set defeats the purpose, because a set still requires a
   choice at sampling time.
2. **Sample per token with a comment naming the source element**, exactly as if it were a logo.
3. **Do not revisit it.** The discipline lives in the not-revisiting.

And note what moves: a project with an existing logo gets its **wordmark and name treatment as
an input**. A project without one gets them as a **Phase 0 output** — each design direction
should render the product name in its own register, because that is part of what the bake-off
is choosing between.

### 4.5.1 Constraints fall out of the source artifact

Measuring the logo also produced a hard rule that survived into production: **never place the
logo PNG on the light canvas**, because the source art has glow baked in and reads as a dirty
halo on anything but its native dark background. The workaround — a typographic wordmark in
Archivo Black — became a permanent component.

Expect the brand artifact to impose at least one constraint like this. Write it down where it
will be read.

### 4.6 CLAUDE.md is the prototype's specification **(R)**

The prototype repo's `CLAUDE.md` existed **in the first commit**, at 79 lines, and was updated
continuously — many commit bodies do nothing but record a CLAUDE.md page-count bump.

**This answers the tooling question definitively.** Line 3:

> "This file provides guidance to **Claude Code** (claude.ai/code) when working with code in
> this repository."

Not Claude Design. Note that git authorship would never have told you this: **all 177 commits
are authored by Matthew Smith with no `Co-Authored-By` trailers.** The only durable record of
how the work was done is CLAUDE.md itself.

Its sections, which are worth copying as a template:

1. **What this project is** — two sentences plus what the app tracks.
2. **Source-of-truth documents** — an explicit list, with a line stating which document wins
   on which question: *"The outline is authoritative for component composition; the PRD covers
   rules and permissions."* Plus the instruction: *"Check these before inventing answers about
   scope, field names, or flows."*
3. **Prototype** — where the selected direction lives, how to open it, what each page is, and
   the don't-touch-the-archive rule.
4. **Brand & style system** — the token table with roles, the sampled-not-estimated note, the
   logo-on-light-canvas prohibition, and the font stack.
5. **Product rules to know** — the PRD compressed to the dozen rules that actually affect
   markup decisions.
6. **Working conventions** — e.g. *"CSS tokens are the primary knob for palette changes; don't
   hardcode hex values inline"*, *"New screens should be based on an existing page"*, and a
   note that the navbar/footer full-bleed asymmetry against a 1240px container **is
   intentional**.

That last category matters more than it looks. Recording that an oddity is deliberate prevents
a later session from helpfully "fixing" it.

> **A caution, by example.** That same CLAUDE.md contains the line *"Not a git repo — no
> version control commands apply."* The repository has 177 commits. It was true when written
> and nobody revisited it. This is *(CS §8.7)* — documentation drift — caught in the wild, in
> the very file whose job is to be current.

### 4.7 Iteration runs the same four stages, at prototype scale **(R)**

The prototype was not built ad hoc. The May 6 commit sequence shows the full methodology
running *inside* Phase 0:

```
Add design spec for intern assessment chooser + Personal Goals + Midpoint Reflection
Add implementation plan for intern assessment chooser feature
Add sessionStorage helpers for assessment completion tracking
Add CSS for assessment chooser cards and free-form question cards
Add intern-assessments.html chooser hub
Add personal-goals.html — free-form Personal Goals assessment form
Add midpoint-reflection.html — free-form Midpoint Reflection assessment form
Parameterize assessment-confirmation.html via ?type= query param
Re-point index.html entry points to intern-assessments.html
Re-point login.html entry points to intern-assessments.html
Delete self-assessment.html — superseded by chooser + two new forms
Update CLAUDE.md for chooser + Personal Goals + Midpoint Reflection rollout
```

Spec → plan → implement → **re-point everything that referenced the old thing** → delete what
was superseded → update CLAUDE.md. A complete cycle, in one day, on a static prototype.

**These are not metaphorical specs and plans. They exist as documents**, and they are the same
size and shape as production ones:

| Prototype-phase document | Lines |
|---|---|
| `docs/plans/2026-04-16-prototype-enhancements.md` | **1,002** |
| `docs/superpowers/specs/2026-05-06-intern-assessment-chooser-design.md` | 207 |
| `docs/superpowers/plans/2026-05-06-intern-assessment-chooser.md` | **1,771** |
| plus six more spec/plan pairs across May 6–7 | — |

A **207-line spec produced a 1,771-line plan** — an 8.6× ratio, steeper than production's 1.65×.
Seven spec/plan pairs were written for a static HTML prototype with no build step.

#### 4.7.1 The prototype plan uses the same execution machinery

The April 16 plan opens with this, verbatim:

> **For agentic workers:** Use `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

Its header sections are exactly a production plan's: **Goal · Architecture · Tech stack ·
Out of scope (stated in PRD) · File map · Phase overview**, then numbered tasks grouped into
phases — `Task 1.1` through `Task 5.3` across five phases, ending with **Execution notes**.

The Architecture line does real work, protecting what has already been decided:

> "Existing CSS token system is untouched; new patterns (toast, empty-state, print rules) are
> appended to `styles.css`."

And the Tech stack line sets the verification standard:

> "Pure static HTML + CSS + vanilla JS. No build step, no framework, no test runner.
> **Verification is manual (click-through in the browser). Commits after each task.**"

#### 4.7.2 The task format, including the commit

Each task decomposes into checkbox steps carrying complete code, a concrete verification with
an **expected value**, and — notably — **the commit command and message**:

```markdown
- [ ] **Step 1: Author `app.js`**

Place at top of `Prototypes/PROTOTYPE/app.js`:

  ```js
  (function (window) {
    // -------- Mock dataset (single source of truth for demo) --------
    const COHORTS = [ ... ]
  ```

- [ ] **Step 2: Verify module loads**

Add to the bottom of `readiness-detail.html` (temporary smoke check):
`<script src="app.js"></script><script>console.log(IMPACT.INTERNS.length);</script>`.
Open the page, confirm DevTools console shows `5`. Revert the smoke console.log; keep
the `<script src="app.js">` import.

- [ ] **Step 3: Commit**

  ```bash
  git add Prototypes/PROTOTYPE/app.js Prototypes/PROTOTYPE/readiness-detail.html
  git commit -m "Add shared app.js with mock dataset and modal helper"
  ```
```

**The plan dictates the commit message.** That is why the prototype's 177-commit log reads as
cleanly as it does — the log was authored in the plan, before the work.

Note the verification: not "check it works," but *"confirm DevTools console shows `5`."* Manual
click-through is still a verification standard when it names the expected value.

#### 4.7.3 The prototype spec format

Different from a production design spec, and worth its own template:

**Goal · Page inventory · Routing · [one section per page] · Data flow — sessionStorage ·
CSS additions · Edge cases & decisions · Manual test plan · Out of scope**

Two sections carry disproportionate weight. **"Data flow — sessionStorage"** is where the
persistence model gets settled — the thing that becomes the production data model.
**"Edge cases & decisions"** is where the business rules that the PRD left open get closed,
cheaply, before anything depends on them.

#### 4.7.4 What to take from this

**Structural demolition is expected.** Deleting `self-assessment.html` outright, and
re-pointing every entry point to a new chooser hub, is exactly the kind of change you want
happening here rather than after a migration exists.

**CLAUDE.md is updated as part of the change**, in the same commit sequence — not afterwards,
and not "when we get round to it."

**The prototype is not a lower-discipline environment.** It is the same discipline applied
where mistakes are cheap. That is the whole point of doing it first.

### 4.8 The rhythm **(R)**

177 commits across six active days:

| Date | Commits | What happened |
|---|---|---|
| Apr 16 | 24 | Bake-off inputs, three directions, selection, entire first-pass app |
| May 6 | 42 | Chooser flow; assessment restructuring |
| May 7 | 85 | **The day it became a specification** — competency consolidation, settings shell restructure, identity capture moved to the chooser |
| May 8 | 18 | Refinement |
| May 10 | 3 | *(not mentioned in the case study)* |
| May 11 | 5 | *(not mentioned in the case study)* |

Three weeks of calendar silence between April 16 and May 6 — that gap is stakeholder review,
not idleness.

The case study singles out May 7: *"where the prototype stopped being a mockup and became a
specification. Each of those changes carried directly into production unmodified."*

Scale note: the bake-off ran on **3 screens**; the frozen prototype had **36**. You do not need
a complete application to choose a direction. You need a landing, a table, and a form.

### 4.9 Freeze it

When stakeholders stop asking for changes: **freeze the prototype and stop editing it.**
*(CS §10)* Separate repository. From this point it is a specification, and specifications that
move are not specifications.

On IMPACT the prototype lived in its own git repo, nested inside the production repo directory
but tracked independently, and was seeded into the production repo as reference in that repo's
very first commit — *"chore: seed repo with planning docs and prototype reference."*

### 4.10 Phase 0 checklist

- [ ] Write the PRD — rules, roles, permissions, entities, journeys, **non-goals**, open questions, assumptions.
- [ ] Write the per-view outline — `SHELL` / `SCREEN` / `VIEW` with elements in caps. Composition only, no styling.
- [ ] Gather design-language references — one coherent system sampled at several zoom levels, not a grab-bag. Aim to match them, but expect the brand artifact and the content type to override them (§4.2.4).
- [ ] **Write down the bake-off brief** — how many directions, and what register each one represents. IMPACT's was lost.
- [ ] Identify the brand source artifact — logo or equivalent, something nobody controls.
- [ ] Collect real domain source material from the client.
- [ ] Pick three representative screens: **a landing, a data table, a long form.**
- [ ] Generate **three named design directions** across those screens. Hold brand hue constant; vary canvas, radii, typography, shadow.
- [ ] Select one. Promote it. **Archive the losers; do not delete them.**
- [ ] **Now** sample the palette from the brand artifact, per token, with a comment naming the source element.
- [ ] Record any constraints the artifact imposes.
- [ ] Write CLAUDE.md — source-of-truth list with precedence, prototype location, token table, product rules, working conventions.
- [ ] Build out the full prototype. Encode business rules in the mock layer, with comments explaining each rule.
- [ ] Iterate with stakeholders using **real spec/plan pairs** — the prototype gets the same discipline as production (§4.7), including plan-authored commit messages.
- [ ] Update CLAUDE.md as part of each change, not afterwards.
- [ ] Freeze.

---

## 5. Phase 1 — Planning *(M §3, CS §3)*

Two days produced 12 design specs and 18 implementation plans on IMPACT — 54,558 lines.

### 5.1 Three artifacts, three audiences

**Design spec** — `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. Answers *what* and
*why*. Stack, topology, data model, permission model, migration strategy, phasing. Every
load-bearing technology choice carries a one-sentence rationale. IMPACT's was 855 lines.

**Workflow spec** — separate document, 441 lines on IMPACT. The SDLC layer: branching, commit
format, review, CI, deployment topology, secrets, branch protection. Separating "what the app
does" from "how we build it" is correct — they change at different rates and are read by
different people.

**Implementation plan** — `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`. Answers *how*. One
per sub-project. IMPACT's largest was 6,105 lines for Admin Core alone.

**The distinction is enforced.** A spec that drifts into implementation detail and a plan that
relitigates architecture are both failures.

### 5.2 Two things that must be in the spec from the start

**The fidelity mandate** *(CS §9.2)*. Copy this into the architectural spec before sub-project
1 begins — not after an audit discovers it is missing:

> **The frontend MUST look and behave exactly like the prototype. Pixel-for-pixel parity is
> the non-negotiable success criterion. Every other consideration — abstraction reuse,
> component elegance, developer ergonomics — is subordinate to it.**

Then define the terms, because a mandate without a definition is inspiration rather than
instruction. *Matching* means: same semantic elements, nesting, and class names; same tokens,
spacing scale, radii, shadows; same typography; same container width, nav height, and mark
size; **copy verbatim** — titles, button labels, micro-labels, modal bodies, toast messages,
empty states.

And enumerate the **acceptable deviations**: real data replacing mock, production URLs
replacing `.html` links, framework form components replacing `onsubmit`, non-visual
accessibility additions. Anything else requires an explicit `Deviation:` entry in the PR
description with justification.

> "A mandate without an escape hatch gets quietly violated. A mandate with a *documented*
> escape hatch gets followed, because compliance is easier than the paperwork of deviating."

**The platform-properties section** *(CS §9.6)*. Document the limits and behaviours of the
specific tier you are on: pause behaviour, rate limits, cold starts, email deliverability caps,
connection limits. Note which are acceptable and which need upgrading before real use.

IMPACT's production went down thirteen days after launch because both Supabase projects were
free tier and auto-pause after ~7 days of inactivity. Not a bug — a documented property of the
plan, never written down. It surfaced as *"Invalid email or password"* on correct credentials.

### 5.3 Sub-project decomposition *(M §6, CS §3.2)*

**The splitting rule: a plan exceeding roughly fifty tasks becomes two plans.** Past that the
execution graph stops being trackable and the document stops being navigable.

Each sub-project ends in something demo-able and depends only on its predecessor. IMPACT's
seven (plus one unplanned):

| # | Name | Tasks | PRs |
|---|---|---|---|
| 0 | Project Infrastructure | 58 | 14 |
| 1 | Foundation | 60 | 16 |
| 2 | Admin Core | 37 | 11 |
| 3 | Question Engine | 38 | 8 |
| 4 | Assessment Forms | 31 | 6 |
| 5 | Employer Shell | 38 | 12 |
| 6 | Polish & Launch | 52 | — |
| 7 | **Frontend Rebuild** *(unplanned — see §9.1)* | — | 9 |

### 5.4 Task-writing standard

Not a task: *"implement the auth flow."* That is a phase.

A task: *"create `src/lib/auth/session.ts` with the contents below, and verify with
`npm test src/lib/auth/session.test.ts`."*

- Exact file paths.
- **Complete, paste-able code** — no pseudo-code, no placeholders. If the executor has to
  invent syntax, the plan failed.
- A concrete verification command, not "check it works."
- Checkbox format: `- [ ]`, flipped to `- [x]` on completion.

Commit everything before writing application code.

---

## 6. Phase 2 — Infrastructure

Before a single line of application code. On IMPACT this was 58 tasks and 14 PRs, buying:
branch protection, a five-job CI pipeline, Conventional Commits enforced by commitlint and
Husky, lint-staged pre-commit hooks, two Netlify projects, two Supabase projects, a management
dashboard, and the methodology document itself.

> "Front-loading this is uncomfortable because it produces nothing demo-able. It is also what
> made the following six sub-projects boring in the right way."

**Deploy a hello-world on day one** *(CS §9.5)*. Push a trivial page through the *complete*
production path — commit, CI, build, deploy, live URL, and a request that touches the database
and returns. Every integration failure at IMPACT's launch was in a link of that chain that had
never once been exercised end to end. `build_settings.installation_id` was `null` while every
dashboard showed a correctly linked repository.

**Every CI job gates from the first PR that has something to test** *(CS §9.4)*. IMPACT ran the
entire build with `Playwright — skipping` on every PR; the first green end-to-end run in CI was
after the application was feature-complete. **A skipped job reads as a passing job.** If a
suite is not gating, it is documentation.

---

## 7. Phase 3 — Design system: primitives before features

**The single highest-value correction in the entire playbook** *(CS §9.1)*, and the reason
IMPACT needed an eighth sub-project it never planned for.

### 7.1 What went wrong, so it is clear why this matters

Sub-projects 1 through 5 treated the prototype as *reference material*. They shipped a
completely functional application in about four working days — every route rendering, every
form submitting, row-level security scoping correctly, tests green.

A visual audit then found **P0-severity gaps on essentially every route.** The app worked
perfectly and looked wrong. The production landing page was:

```html
<main style="max-width:720">
  <h1>IMPACT Internship Assessment Portal</h1>
  <p>The production app is under construction.</p>
</main>
```

Worse: **the design system existed and was simply unwired.** `AuthShell` had been built with a
docstring reading *"Mirrors the prototype's login.html aesthetic"* — and `/login` itself was
never refactored to use it. Every token was defined in `tokens.css` and not consumed.

The failure was not carelessness. **"Working" was the stated bar and "matching" was assumed to
follow from it. It does not.** Fidelity is a separate requirement and has to be stated as one.

### 7.2 The correct order

1. Port design tokens from the frozen prototype **verbatim**.
2. Port global and base CSS verbatim.
3. Wire fonts and print styles.
4. Build every shell and presentation primitive against a **dev-only demo route** that renders
   them in isolation.
5. Build the form primitives.
6. **Gate on human sign-off.**
7. **Then** build features, composing only primitives that already exist.

> "The dev-primitives demo route is the trick that makes this work — it lets the design system
> be reviewed and signed off in one place, before any feature depends on it. A feature built on
> approved primitives is correct by construction."

### 7.3 The rebuild-vs-patch heuristic

When IMPACT faced the audit, the plan's reasoning for rebuilding rather than patching
generalizes:

> "A patch-by-patch fix campaign would touch nearly every component file anyway. At that volume
> of change, **rebuilding from the prototype as the literal spec is cheaper and produces a
> better result** than translating audit findings into surgical edits."

Patches converge on "close enough." A rebuild converges on "same."

The rebuild closed 51 of 57 audit entries in **two days**, with 75 side-by-side screenshots
filed as durable evidence.

---

## 8. Phase 4 — Features

### 8.1 Cadence

99 pull requests in roughly seven working days. Every PR: branch from `main`, implement one or
more plan tasks, Conventional Commit, push, open PR, CI runs, review, squash-merge, delete
branch. `main` branch-protected, direct pushes rejected. This held for all 99. PR-to-commit
ratio 0.86.

### 8.2 The gate protocol

> "This is the mechanism most likely to be undervalued, and the one that made agent-driven
> execution safe at this volume."

Between phases, execution **stops** and waits for explicit human sign-off. A real example:

> **Step 4: Request Gate G1 sign-off** — Comment in the PR requesting Matt's gate sign-off.
> Include a brief screenshot of the tokens.css diff and a DevTools screenshot showing computed
> body styles. **Do NOT start Phase B until Gate G1 is signed off.**

Sub-project 7 alone defined eight gates across 991 lines of plan. Each names the **specific
evidence required** — not "looks good?" but "confirm tokens match prototype `:root` exactly,
font links load Latin-subset Plex, print stylesheet present."

Gates work because they are **cheap and frequent**. A gate every few tasks bounds how far
execution can drift before a human sees it. *Specify the evidence, or the gate degrades into a
rubber stamp.*

### 8.3 Seam tests before features *(CS §9.3)*

Identify the two or three places where the architecture could fail catastrophically, and write
tests proving those boundaries hold **before** building features on top of them.

IMPACT had 204 unit tests, and the launch blocker was a JWT hook returning the wrong claim
shape — because **no test exercised a PostgREST write path at all.** The riskiest seam in that
architecture was always the boundary where a JWT claim becomes a row-level-security decision,
and that is where tests were thinnest.

**Not more tests. Earlier and better-aimed ones.** Test count is a poor proxy for coverage of
the things that can actually take you down.

### 8.4 One real-user session per sub-project *(CS §9.7)*

The most important item in the entire case study, and its biggest failure.

No real user touched IMPACT until **seven weeks after launch.** When one finally did, the first
round surfaced: a tester entering a competency assessment, being prompted to save, saving,
receiving confirmation, submitting — and finding the record later showing only a date with
every response field blank. A potential data-loss defect, found by the first person to use the
software in anger.

The same round found that Save vs Submit is not clear to users, that marking a barrier is
ambiguous about whether it applies, that "Not Yet Tracked" has no discoverable meaning, and
that the available outcome statuses do not cover real situations the program encounters.

> "None of these are implementation defects against the spec. **They are defects in the spec**,
> and the only instrument that detects them is a real user. The process built the right thing
> correctly and had no mechanism for asking whether it was the right thing."

Budget one user session per sub-project, starting at the first demo-able milestone. It is the
cheapest defect detection available and it finds a class of problem nothing else does.

---

## 9. Phase 5 — Launch

- Bootstrap production; verify auth end-to-end with a live sign-in producing a correctly-claimed token.
- Confirm **every required environment variable is present in every context.** IMPACT shipped
  with `APP_URL` unset, breaking password reset, employer invites, and the anonymous
  identity-confirm step — invisible to tests, because tests run with a fake env block.
- Verify the deploy trigger actually **fires**, rather than that a dashboard says it will.
- Stamp closed plans as history *(CS §9.8)*.

---

## 10. File and naming conventions *(M §4)*

```text
docs/
  methodology.md
  Proto2PRD.md                                      <- this file
  case-study-YYYY-MM-DD.md
  superpowers/
    specs/
      YYYY-MM-DD-<topic>-design.md                  <- one per design spec
    plans/
      YYYY-MM-DD-<topic>.md                         <- one per sub-project plan
```

- Always prefix `YYYY-MM-DD` — **date of creation**, not date of the work described. Gives
  chronological listing in a file explorer.
- Lowercase hyphen-separated topic slugs.
- Specs end in `-design.md`; plans have no suffix. Impossible to confuse at a glance.
- One spec per architectural domain. One plan per sub-project.
- Flat directories, not nested-by-topic.

---

## 11. Execution modes *(M §7)*

**Subagent-driven** (`superpowers:subagent-driven-development`) — recommended. A fresh agent
per task or small batch. The main session orchestrates: picks the next task, dispatches with
only the context that task needs, reviews, merges. Keeps the main context clean across many
tasks. Best for many small independent tasks; the IMPACT plans were designed for it.

**Inline** (`superpowers:executing-plans`) — same agent executes everything in one session.
Simpler operationally. Best for plans under ~20 tasks or where tasks are tightly coupled.

Trade-off: inline is simpler but more vulnerable to context drift; subagent is more reliable
for long projects at slightly higher orchestration cost.

---

## 12. Amendment patterns *(M §8)*

A plan is a model of the future; reality diverges. Three responses, in increasing severity.

**12.1 PR-description deviation notes.** Small, project-local deviations go under a
`### Deviations from plan` heading in the PR description. Captured in git history; the plan is
not modified.

**12.2 Inline spec or plan amendments.** For deviations that change the canonical what or how,
append to the bottom of the document. **The original body stays intact** so the historical
decision is preserved; the amendment overrides.

```markdown
## Amendment 2026-05-11 — Use three Supabase environments, not two

The original spec (§2.3) called for two Supabase projects (dev + prod). After scoping the
CI integration tests we are switching to three: impact-dev, impact-test, impact-prod.
See PR #12 for the affected code changes.

The original two-environment rationale (§2.3) is preserved for context. This amendment
supersedes it.
```

IMPACT amended its spec three times during sub-project 0 alone.

**12.3 Project-memory updates.** For lessons that should outlast the project, capture them in
`MEMORY.md` or equivalent. These inform the *next* project's Phase 0.

**12.4 Mark plans as history when they close** *(CS §9.8)*. On sub-project close, stamp the
plan with a status header: executed, on what date, superseded by what. Keep exactly one
document as current truth and treat `plans/` as an archive.

IMPACT ended at 57,742 lines of markdown against 33,000 lines of code — a genuine strength
during the build with a real carrying cost after it. Several plan documents describe CSS
classes and component names that never existed, which actively misleads anyone replaying them.
**Conflating "committed plan" with "current truth" is how a documentation asset becomes a
documentation liability.**

---

## 13. The load-bearing mechanisms, consolidated

The case study named eight. The prototype forensics add four more, marked **(R)**.

1. **Promote an artifact to literal specification.** Name it, declare it authoritative, define
   matching concretely, enumerate acceptable deviations.
2. **Derive the design language from something external and fixed.** Colours sampled from a
   logo cannot be relitigated.
3. **Make the prototype executable, so it specifies behaviour.** The production data model
   should be the prototype's mock dataset, normalized.
4. **Separate spec from plan, and commit both before coding.**
5. **Write plans containing complete code with per-task verification.** Expect the plan to
   exceed the code in volume. That is correct.
6. **Decompose into sub-projects with demo-able endings.** Fifty tasks is the splitting
   threshold.
7. **Gate phases on explicit human sign-off with named evidence.**
8. **Buy the infrastructure before you need it.**
9. **(R) Compete three design directions before committing to one.** Cheap, and it converts an
   unanswerable aesthetic question into an answerable one.
10. **(R) Hold brand constant across the variations; vary only formal register.** A choice
    between options differing on one axis is decidable; a choice between options differing on
    everything is not.
11. **(R) Measure the palette after selection, not before.** Choose form while colour is still
    approximate.
12. **(R) Keep a CLAUDE.md from the first commit, listing source-of-truth documents with
    explicit precedence.** It is the only durable record of how the work was done — git
    authorship will not tell you.

---

## 14. What went wrong on IMPACT *(CS §8)*

Listed so it costs less next time.

| | Failure | Cost |
|---|---|---|
| 8.1 | **Function-first ordering** — prototype treated as reference, not spec | An entire unplanned sub-project |
| 8.2 | **Test suite large but not aimed at the riskiest seam** — no test touched a PostgREST write path | Launch blocker |
| 8.3 | **Playwright gated off in CI for the entire build** | Green meant nothing for months |
| 8.4 | **Deployment assumed working until needed** — `installation_id: null` behind a correct-looking dashboard | Launch-day scramble |
| 8.5 | **Platform properties never specced** — free-tier auto-pause | Production down 13 days post-launch, with a misleading symptom |
| 8.6 | **No real user for seven weeks after launch** | A class of spec defects nothing else detects |
| 8.7 | **Documentation outgrew maintainability** — 1.75:1 markdown to code | Stale plans that actively mislead |

---

## 15. What this is NOT *(M §9)*

- **Not a substitute for thinking.** The four stages do not guarantee good decisions. They
  guarantee the decisions are written down.
- **Not a process for every PR.** A typo fix does not need this pipeline.
- **Not a guarantee the plan survives contact with reality.** It will not. §12 exists because
  plans are models, and models are wrong.
- **Not a replacement for code review, testing, or operational rigour.** This is the front end
  of the pipeline; the downstream gates are still required.
- **Not a marketing methodology.** These artifacts are technical communication.

---

## 16. Master replay checklist

**Phase 0 — Prototype** *(expanded — see §4.10 for the full version)*
- [ ] PRD, per-view outline, design references, brand artifact, domain source material.
- [ ] Three directions across landing / table / form. Brand held constant.
- [ ] Select, promote, archive losers.
- [ ] Sample palette per token with source comments.
- [ ] CLAUDE.md with source-of-truth precedence.
- [ ] Build out; encode business rules in the mock layer with comments.
- [ ] Iterate with stakeholders. Freeze.

**Phase 1 — Plan**
- [ ] Architectural design spec.
- [ ] Workflow spec, separately.
- [ ] **Fidelity mandate in the architectural spec** (§5.2).
- [ ] **Platform-properties section** (§5.2).
- [ ] Decompose into sub-projects of ≤50 tasks, each ending demo-able.
- [ ] One plan per sub-project, complete code and per-task verification.
- [ ] Commit everything before application code.

**Phase 2 — Infrastructure**
- [ ] Repo, branch protection, Conventional Commits, hooks, **CI with all jobs gating**.
- [ ] All environments provisioned.
- [ ] **Hello-world through the full production deploy path.**

**Phase 3 — Design system**
- [ ] Tokens, global CSS, fonts, print styles — verbatim from the frozen prototype.
- [ ] All shell, presentation, and form primitives against a dev-only demo route.
- [ ] **Gate on human sign-off before any feature work.**

**Phase 4 — Features**
- [ ] **Seam tests before features.**
- [ ] Plan tasks, one or few per PR, squash-merged into protected `main`.
- [ ] Gate every phase on named evidence.
- [ ] **One real-user session per sub-project.**

**Phase 5 — Launch**
- [ ] Bootstrap production; verify auth end-to-end with a live sign-in.
- [ ] Every required env var present in every context.
- [ ] Verify the deploy trigger fires.
- [ ] Stamp closed plans as history.

---

## 17. Superpowers skills referenced *(M §10)*

- `superpowers:brainstorming` — Phase 0 inputs and Phase 1 design spec. Q&A-driven scope
  discovery; produces the spec.
- `superpowers:writing-plans` — Phase 1 plans. Decomposes a spec into executable tasks.
- `superpowers:subagent-driven-development` — Phase 4, recommended mode.
- `superpowers:executing-plans` — Phase 4, inline mode.
- `superpowers:verification-before-completion` — evidence before assertions, at PR completion.
- `superpowers:requesting-code-review` / `receiving-code-review` — both sides of the review gate.
- `superpowers:systematic-debugging` — when reality diverges confusingly.
- `superpowers:writing-skills` — when a prompt pattern repeats across projects.

**No skill covers Phase 0.** That is what §4 is for.

---

## 18. Source evidence

Everything marked **(R)** in this document was recovered on 2026-08-04 by direct examination
of `C:\projects\impact-internship-portal\impact-prototype` — a git repository of 177 commits,
tracked independently and nested inside the production repo directory.

Primary evidence:

| Claim | Evidence |
|---|---|
| Claude Code, not Claude Design | `CLAUDE.md` line 3, present in first commit |
| No AI attribution in git | `git log --format="%an"` → 177 × Matthew Smith; zero `Co-Authored-By` trailers |
| Three competing directions | First commit `e70fcbf` file list: `Prototypes/archive/{01-warm-editorial,02-civic-minimal,03-modular-dashboard}/` |
| `02-civic-minimal` selected | Diff of promoted `self-assessment.html` vs each archive: 6 / 642 / 669 lines |
| Brand held constant in variations | Identical `--navy: #1B2B8F` etc. across all three `styles.css` |
| Palette measured after selection | Shipped `#153A98` ≠ any variation's `#1B2B8F` |
| Per-token provenance | Inline comments in shipped `styles.css` `:root` |
| References are one design system | `ref1`–`ref5.png` — all svyazi communications agency, five views |
| Intent was to match the references closely | Author, 2026-08-04. The divergence in §4.2.4 was therefore an outcome, not a design philosophy |
| Bake-off brief not preserved | Author does not recall it; no document in the repo records it |
| Methodology ran inside Phase 0 | May 6 commit sequence: design spec → implementation plan → implement → update CLAUDE.md |
| Commit rhythm | `git log --format="%ad" --date=short \| sort \| uniq -c` |
| Mock-layer construction | `Prototypes/PROTOTYPE/app.js` — 1,634 lines: IIFE + `window.IMPACT` namespace, realistic seed data, defaults+overlay merge, namespaced storage keys, rule-bearing comments |
| Prototype-phase specs and plans exist | `docs/plans/2026-04-16-prototype-enhancements.md` (1,002 lines); `docs/superpowers/{specs,plans}/2026-05-0[67]-*` — seven spec/plan pairs |
| Prototype used the same execution skills | Header of the 04-16 plan names `superpowers:subagent-driven-development` |
| Plans authored the commit messages | Task steps contain literal `git commit -m "..."` commands matching the observed log |

A second copy of the same repository (identical first commit `e70fcbf`, identical 177-commit
count) exists at
`C:\Users\matts\OneDrive - Koehler Partners\Projects\IMPACT\Internship Assessment\IMPACT Intretnship Assessment Portal`,
alongside the original client feedback documents — including a session dated 2026-04-20, which
falls inside the April 16 → May 6 calendar gap and confirms that gap was stakeholder review.

Companion documents:

- `docs/methodology.md` — the four-stage playbook this merges and extends
- `docs/case-study-2026-08-02.md` — the IMPACT post-mortem, with the honest failure list
- `docs/launch-todo.md` — open items after IMPACT's launch
