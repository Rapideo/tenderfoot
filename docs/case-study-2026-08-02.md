# Case Study — Prototype to Production in Sixteen Working Days

**The IMPACT / HirePath Internship Assessment Portal**
Written 2026-08-02 · Internal Rapideo playbook · Covers 2026-04-16 → 2026-06-19

---

## Executive summary

In sixteen days of actual work spread across nine weeks, this project went from a
per-view outline, a design language, and a handful of requirements to a live,
production, role-scoped web application that is visually indistinguishable from
the prototype it was designed against.

That outcome is real and it is repeatable. But the reason it worked is not the
reason most people would guess, and getting it right next time depends on
understanding the difference.

**The finding:** fidelity was not achieved by careful work. It was achieved by
promoting an artifact to the status of *literal specification*.

Sub-projects 1 through 5 treated the prototype as **reference material** and
shipped a completely functional application in about four working days — every
route rendering, every form submitting, row-level security scoping correctly,
tests green. A visual audit conducted immediately afterward found **P0-severity
gaps on essentially every route**. The app worked perfectly and looked wrong.

Sub-project 7 changed one word. The prototype stopped being reference and became
"the design specification, literally" — same class names, same copy, verbatim.
Fidelity immediately became a mechanical exercise instead of an aspirational one,
and closed 51 of 57 audit entries in two days.

**The implication for next time:** the correction *is* the improvement. Build the
design primitives from the prototype first and hang function on them, and
sub-project 7 never needs to exist. That single reordering is the highest-value
change available to the process, and §9 specifies it.

This document is candid by design. It is an internal playbook, not a sales
artifact. §8 names real failures with PR numbers because that is the part that
makes it useful the second time.

---

## 1. The numbers

| Phase | Span | Active days | Output |
|---|---|---|---|
| Prototype | Apr 16 → May 11 | 6 | 177 commits · 36 pages · 5,061 lines HTML/CSS/JS |
| Planning | May 10 → May 11 | 2 | 12 specs · 18 plans · 54,558 lines |
| Build | May 11 → May 20 | 7 | 99 PRs · ~33,000 LOC app + db |
| Launch & after | May 26 → Jun 19 | 3 | Production live · reports · user management |

**Totals:** 16 active working days across a 64-day calendar span. 292 commits
across two repositories. 180 application files, 73 test files, 247 tests at the
2026-05-20 launch-readiness snapshot (204 unit, 21 RLS, 22 Playwright).

Three ratios explain more than the totals do:

**Plans were 1.65× larger than the code they produced.** 54,558 lines of
implementation plan yielded roughly 33,000 lines of application and database
code. This sounds like waste. It is the opposite — it is the central mechanism,
and §4 explains why.

**Documentation outweighs code 1.75:1.** 57,742 lines of markdown against 33,000
lines of code. This is a strength that became a liability; see §8.7.

**PR-to-commit ratio is 0.86.** 99 pull requests against 115 commits on the
production repository. Squash-merge discipline held for the entire build; almost
every commit on `main` is a reviewed, CI-green pull request.

---

## 2. Act I — The prototype as specification (Apr 16 → May 8)

### 2.1 What was actually built

The prototype is 36 static HTML pages, a 3,427-line stylesheet, and a 1,634-line
shared JavaScript module. No build tooling, no framework, no test runner. It was
built in four bursts: 24 commits on April 16 that produced the entire first-pass
application, then 42, 85, and 18 commits on May 6, 7, and 8 refining it against
stakeholder feedback.

The May 7 spike — 85 commits in one day — is where the prototype stopped being a
mockup and became a specification. That day consolidated the competency
assessment, restructured the settings shell, and moved intern identity capture to
the chooser page. Each of those changes carried directly into production
unmodified.

### 2.2 The design language came from a fixed, external source

The palette was **sampled from pixels in the IMPACT logo** — five tokens, each
with a defined role:

| Token | Hex | Role |
|---|---|---|
| `--navy` | `#153A98` | Primary brand |
| `--navy-deep` | `#051028` | Dark surfaces (nav, footer) |
| `--cyan` | `#00A6F6` | Secondary, info, focus |
| `--gold` | `#FFD71F` | Highlight, CTA, active state |
| `--canvas` | `#EFF1F5` | Body background |

This matters more than it appears to. Deriving the palette from an artifact
nobody controls removes colour from the space of things that can be relitigated.
There is no "what if the blue were softer" conversation, because the blue is not
a preference — it is a measurement. Every subsequent decision inherits that
settledness.

The same logic produced a hard constraint that survived into production: *never
place the logo PNG on the light canvas*, because the source image has glow baked
in and reads as a dirty halo. The workaround — a typographic wordmark in Archivo
Black for light surfaces — became a permanent component.

### 2.3 The prototype encoded business rules, not just appearance

This is the part that is easy to miss and that made everything downstream
cheaper. `app.js` was not a pile of mock data. Read its comments:

```js
// Intern record stores only the minimum PII required to identify the intern at
// assessment time: first initial, last name, and cohort (which itself implies
// the employer). No first name, no date of birth, no zipcode are persisted.
const INTERNS = [ ... ]

// Look up an intern by the composite identity the public-side flow collects:
// first initial (case-insensitive), last name (case-insensitive), and cohort.
function internByIdentity(firstInitial, last, cohortId) { ... }

// Per-set merge: fall back to defaults for any default missing from
// sessionStorage, EXCEPT explicit tombstones (parsed[id] === null) which
// mean "deleted by admin; do not resurrect from defaults".
```

In 1,634 lines the prototype had already settled:

- **The minimum-PII policy** — which fields persist and which are collected for
  usability but discarded.
- **The composite-key identity model** — first initial + last name + cohort, with
  employer implied by cohort. This became `lookupInternByIdentity` in production
  essentially verbatim.
- **Three-tier competency stitching** — program-core, per-cohort, per-intern
  overlays, including runtime-authored `competency-cohort-*` sets.
- **Soft-delete tombstone semantics** — an explicitly deleted item must not be
  resurrected from defaults. This is a genuinely subtle data-modelling decision
  that most teams discover in production.
- **Role scoping** — roles belong to their parent employer, mirroring the
  cohort→employer relationship.

**The 15-table production data model is essentially this mock dataset
normalized.** The prototype was a working specification of behaviour that
happened to also be a picture.

### 2.4 Why this is the load-bearing act

A prototype that only shows appearance leaves every behavioural question open,
and those questions get answered *during* implementation — which is the most
expensive place to answer them. A prototype that runs forces the awkward
questions early, in the cheapest possible medium, where changing your mind costs
a `sessionStorage` key rather than a database migration.

The five question-bearing forms all shared one data-driven
render/collect/validate/restore pipeline in the prototype. Production inherited
that architecture wholesale as the question-set engine. That was not convergent
evolution — it was the prototype having already proven the abstraction was
correct.

---

## 3. Act II — Planning (May 10 → May 11)

Two days produced 12 design specs and 18 implementation plans totalling 54,558
lines. The structure is deliberate and worth reproducing exactly.

### 3.1 Three artifacts, three audiences

**Design spec** (`docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`) answers
*what* and *why*. The production rebuild spec is 855 lines covering stack,
topology, a 15-table data model, a three-tier permission model, the question-set
engine, migration strategy, and phasing. Every load-bearing technology choice
carries a one-sentence rationale.

A separate 441-line **workflow spec** covers the SDLC layer — branching, commit
format, review, CI, deployment topology, secrets, branch protection. Separating
"what the app does" from "how we build it" was correct; they change at different
rates and are read by different people.

**Implementation plan** (`docs/superpowers/plans/YYYY-MM-DD-<topic>.md`) answers
*how*. One per sub-project. The largest is 6,105 lines for Admin Core alone.

**The distinction is enforced.** A spec that drifts into implementation detail
and a plan that relitigates architecture are both failures. Keeping them separate
is what lets a non-technical stakeholder review the spec and an executing agent
consume the plan without either being confused by the other's content.

### 3.2 Sub-project decomposition

Seven sub-projects, each ending in something demo-able, each depending on the one
before:

| # | Name | Tasks | PRs |
|---|---|---|---|
| 0 | Project Infrastructure | 58 | 14 |
| 1 | Foundation | 60 | 16 |
| 2 | Admin Core | 37 | 11 |
| 3 | Question Engine | 38 | 8 |
| 4 | Assessment Forms | 31 | 6 |
| 5 | Employer Shell | 38 | 12 |
| 6 | Polish & Launch | 52 | — |
| 7 | Frontend Rebuild | (added May 18) | 9 |

The splitting rule that produced this: **a single plan exceeding roughly fifty
tasks needs to become two plans.** Past that size the execution graph stops being
trackable and the document stops being navigable.

### 3.3 Why the plans are larger than the code

Because they contain complete, paste-able code — not pseudo-code, not
descriptions of code. Every task names exact file paths and carries a concrete
verification command.

This is the mechanism that made the whole thing work. A task written to that
standard can be executed by a fresh agent with no accumulated context in a couple
of minutes. That property is what enables both parallelism and a sustained ~10
PRs/day cadence, and it is what stops long sessions from degrading as context
fills with irrelevant history.

The 1.65× ratio is therefore not overhead. **The plan is the code, written once
in a form that is reviewable before it is executable.** You pay the cost of
writing it either way; writing it as a plan first means the expensive review
happens in prose, where changing your mind is cheap.

---

## 4. Act III — Execution (May 11 → May 20)

### 4.1 The cadence

99 pull requests in roughly seven working days. May 11 alone carries 50 commits —
sub-project 0, the entire infrastructure layer, in a single session.

Every PR: branch from `main`, implement one or more plan tasks, Conventional
Commit, push, open PR, CI runs five jobs, review, squash-merge, delete branch.
`main` is branch-protected; direct pushes are rejected. This held for all 99.

### 4.2 The gate protocol

This is the mechanism most likely to be undervalued, and the one that made
agent-driven execution safe at this volume.

Between phases, execution **stops** and waits for explicit human sign-off. From
the sub-project 7 plan:

> **Step 4: Request Gate G1 sign-off** — Comment in the PR requesting Matt's gate
> sign-off. Include a brief screenshot of the tokens.css diff and a DevTools
> screenshot showing computed body styles. **Do NOT start Phase B until Gate G1
> is signed off.**

Sub-project 7 alone defines eight such gates across 991 lines of plan. Each names
the specific evidence required — not "looks good?" but "confirm tokens match
prototype `:root` exactly, font links load Latin-subset Plex, print stylesheet
present."

Gates work because they are **cheap and frequent**. A gate every few tasks bounds
how far execution can drift before a human sees it. Ninety-nine PRs of unattended
agent work would have compounded small misreadings into large ones; ninety-nine
PRs punctuated by fifteen gates could not.

### 4.3 The infrastructure investment came first

Sub-project 0 — 58 tasks, 14 PRs, before a single line of application code —
bought: branch protection, a five-job CI pipeline, Conventional Commits enforced
by commitlint and Husky, lint-staged pre-commit hooks, two Netlify projects, two
Supabase projects, a GitHub Pages management dashboard, and the methodology
playbook itself.

Front-loading this is uncomfortable because it produces nothing demo-able. It is
also what made the following six sub-projects boring in the right way. Every
subsequent PR landed into a pipeline that already worked.

---

## 5. Act IV — The fidelity correction (May 18 → May 19)

This act is the most instructive in the entire project and it exists because of a
mistake.

### 5.1 The audit

On May 18, with sub-projects 1 through 5 complete and the application fully
functional, a route-by-route visual audit compared production against the
prototype. Its headline finding:

> Production was built **function-first** across the board: every shipped route
> renders correct data and handles its action surface, but the brand language
> (Archivo Black headlines, IBM Plex Mono micro-labels, navy/cyan/gold tokens,
> dark-surface nav + footer shells, sticky action bars, sectioned rubric panels,
> mono receipts) is **applied unevenly or not at all**.

Concretely, the production landing page was:

```html
<main style="max-width:720">
  <h1>IMPACT Internship Assessment Portal</h1>
  <p>The production app is under construction.</p>
</main>
```

Against a prototype with a navy nav, wordmark, hero with a gold corner glyph and
accent underline, a three-card pillars section with numbered mono labels, and a
dark footer.

Worse, the components existed. `AuthShell` had been built in sub-project 5 with a
docstring reading *"Mirrors the prototype's login.html aesthetic"* — and `/login`
itself was never refactored to use it. The tokens were all defined in
`tokens.css` and simply not consumed. **The design system was present and
unwired.**

### 5.2 The decision

The plan's own reasoning for rebuilding rather than patching:

> A patch-by-patch fix campaign would touch nearly every component file anyway.
> At that volume of change, **rebuilding from the prototype as the literal spec
> is cheaper and produces a better result than translating audit findings into
> surgical edits.**

This is a generalizable heuristic. When a corrective campaign would touch most of
the surface anyway, the campaign is more expensive than the rebuild *and* worse,
because patches converge on "close enough" while a rebuild converges on "same."

### 5.3 The mandate

The sub-project 7 spec opens with this, in bold, as §1:

> **The rebuilt frontend MUST look and behave exactly like the prototype.
> Pixel-for-pixel parity is the non-negotiable success criterion of this project.
> Every other consideration — abstraction reuse, component elegance, developer
> ergonomics — is subordinate to it.**

And then defines its terms, which is what makes it operable rather than
inspirational. Matching means: same semantic elements and nesting and class
names; same tokens, spacing scale, radii, shadows; same typography; same 1240px
container and 100px nav height and 64px wordmark; **copy verbatim** — titles,
button labels, micro-labels, modal bodies, toast messages, empty states.

Critically, it also enumerates **acceptable deviations** — real data replacing
mock, production URLs replacing `.html` links, React Router `<Form>` replacing
`onsubmit`, non-visual accessibility additions. Anything outside those classes
requires an explicit `Deviation:` entry in the PR description with
justification.

A mandate without an escape hatch gets quietly violated. A mandate with a
*documented* escape hatch gets followed, because compliance is easier than the
paperwork of deviating.

### 5.4 The order of the rebuild

Phase A ported tokens, then global CSS, then fonts, then print rules. Phase B
built shell and presentation primitives against a dedicated dev-primitives demo
route. Phase C rebuilt the form primitives. Only then — Phases D, E, F — did
pages get rebuilt.

**Primitives before pages. This is the ordering that sub-projects 1–5 lacked**,
and reproducing it from the start is the single highest-value change in §9.

### 5.5 The result

51 audit entries closed. 4 deferred to a manual test pass because they require
hard-to-reach state (a live Supabase recovery token, an unconsumed invite link).
2 residual entries. 75 side-by-side screenshots filed at
`docs/superpowers/visual-fidelity-screenshots/2026-05-19-final/` as the durable
evidence.

Elapsed: two days.

---

## 6. Act V — Launch and after (May 26 → Jun 19)

Production went live May 26. The bootstrap sequence — schema, 32 RLS policies,
the JWT custom-access-token hook, reference-data seed, admin account — ran
against an empty database and was verified end-to-end with a live sign-in
producing a correctly-claimed JWT.

Three things happened after launch that belong in the record:

**Auto-deploy was not actually wired.** The Netlify project showed a repo URL,
branch, and build command, and looked linked. `build_settings.installation_id`
was `null` — the GitHub App installation had never completed, so Netlify had no
repository access. Fixed by re-linking through the UI.

**Three routes were 500-ing in production on a missing environment variable.**
`env.server.ts` is a lazy Proxy that throws on access of a missing required var.
`APP_URL` was unset, which broke password reset, employer invites, and the
anonymous intern identity-confirm step. Not caught by any test, because tests run
with a fake env block.

**Production went down thirteen days after launch.** Both Supabase projects are
free tier and auto-pause after roughly seven days of inactivity. Paused presents
as `<ref>.supabase.co` dropping out of DNS, which `supabase-js` returns as a
generic error, which the login action maps to *"Invalid email or password."* Every
login — with correct credentials — was rejected with a message indicating the
opposite of the actual problem.

Subsequent work: reports dashboards and admin user management (Jun 8), a
keep-alive cron and CI hardening (Jun 19). Then the first real user testing, in
July.

---

## 7. The eight load-bearing mechanisms

Extracted and generalized. These are what to carry to the next engagement.

**1. Promote an artifact to literal specification.** Not "inspired by," not
"approximating." Name the artifact, declare it authoritative, define what
matching means concretely, and enumerate the acceptable deviations. Ambiguity
about authority is what produces drift.

**2. Derive the design language from something external and fixed.** Colours
sampled from a logo cannot be relitigated. Anchoring subjective decisions to
measurements removes an entire category of recurring conversation.

**3. Make the prototype executable, so it specifies behaviour.** A running
prototype forces identity models, persistence semantics, and edge cases to be
settled in the cheapest medium available. The production data model should be the
prototype's data model, normalized.

**4. Separate spec from plan, and commit both before coding.** Spec answers what
and why for stakeholders; plan answers how for executors. Different audiences,
different change rates, different documents.

**5. Write plans containing complete code with per-task verification.** This is
what makes tasks executable without context, which is what makes parallelism and
cadence possible. Expect the plan to exceed the code in volume. That is correct.

**6. Decompose into sub-projects with demo-able endings.** Fifty tasks is the
splitting threshold. Each sub-project should be independently valuable and depend
only on its predecessor.

**7. Gate phases on explicit human sign-off with named evidence.** Frequent cheap
gates bound drift. Specify what evidence the gate requires, or the gate degrades
into a rubber stamp.

**8. Buy the infrastructure before you need it.** Branch protection, CI, hooks,
environments, and deploy targets before the first feature. It produces nothing
demo-able and it makes everything after it boring.

---

## 8. What went wrong

The parts that cost time, listed so they cost less next time.

### 8.1 Function-first ordering cost an entire sub-project

Sub-project 7 exists only because sub-projects 1 through 5 treated the prototype
as reference instead of specification. Roughly two days of rebuild, plus the
audit that preceded it, plus nine PRs — all recoverable work that produced no new
capability.

The failure was not carelessness. Every one of those sub-projects shipped working
software with green tests. The failure was that **"working" was the stated bar and
"matching" was assumed to follow from it.** It does not. Fidelity is a separate
requirement and needs to be stated as one, in the original spec, with the same
force it eventually got in sub-project 7's §1.

### 8.2 The test suite was large but not aimed at the riskiest seam

204 unit tests, and the launch blocker was a JWT hook returning the wrong claim
shape (PR #107). CI could not see it because **no test exercised a PostgREST
write path at all.** The coverage gap was closed by PR #108 — written after the
bug, to prove the fix.

The lesson is about aim, not volume. The riskiest seam in this architecture was
always the boundary where a JWT claim becomes a row-level-security decision. That
is where tests were thinnest. Test count is a poor proxy for coverage of the
things that can actually take you down.

### 8.3 Playwright was gated off in CI for the entire build

Every PR displayed `Playwright — skipping`. The specs existed and passed locally.
The first green Playwright run in CI happened in sub-project 6, PR #105 — after
the application was feature-complete.

**A skipped job reads as a passing job.** For months the pipeline showed green
with its most realistic signal disabled. If a suite is not gating, it is
documentation.

### 8.4 Deployment was assumed working until it was needed

`installation_id: null` while the Netlify UI showed a linked repository is a
precise example of a broader failure: the deploy path was configured through an
API, looked correct in every dashboard, and had never once been exercised
end-to-end. The same applies to `APP_URL` — a required variable, absent, breaking
three production flows on first contact with a real user.

### 8.5 Platform properties were never specced

Nobody wrote down that the database tier auto-pauses. It is not a bug and not an
outage in the traditional sense — it is a documented property of the plan the
project was on. It took production down for an unknown period thirteen days after
launch, and the symptom actively misdirected diagnosis by reporting an
authentication failure.

Infrastructure specs cover topology and secrets. They should also cover **the
limits and behaviours of the tier you are actually on.**

### 8.6 No real user touched the product until seven weeks after launch

This is the most important item on the list.

The July 2026 testing round produced feedback that no amount of spec rigour would
have surfaced. A tester reported entering a competency assessment, being prompted
to save, saving, receiving confirmation, submitting — and finding the record
later showing only a date with every response field blank. That is a potential
data-loss defect, and it was found by the first person to use the software in
anger.

The same round surfaced that the difference between **Save** and **Submit** is
not clear to users, that it is ambiguous whether marking a barrier means it
applies or does not apply, that "Not Yet Tracked" has no discoverable meaning,
and that the available outcome statuses do not cover real situations the program
encounters — an intern losing eligibility temporarily, or transferring between
employers.

None of these are implementation defects against the spec. **They are defects in
the spec**, and the only instrument that detects them is a real user. The process
built the right thing correctly and had no mechanism for asking whether it was
the right thing.

### 8.7 Documentation outgrew maintainability

57,742 lines of markdown against 33,000 lines of code. This was a genuine
strength during the build — every decision traceable, every plan replayable — and
it has a carrying cost. `CLAUDE.md` has itself become dense enough to need
curation, and several plan documents describe CSS classes and component names
that never existed, which actively misleads anyone replaying them.

Plans are write-once artifacts describing an intended future. Once executed, they
are history and should be marked as such. Conflating "committed plan" with
"current truth" is how a documentation asset turns into a documentation
liability.

---

## 9. Playbook v2

Concrete changes for the next engagement, in priority order.

### 9.1 Reorder: primitives before function

**The single highest-value change.** Sub-project 7's Phase A and Phase B become
sub-project 1's Phase A and Phase B.

1. Port design tokens from the prototype verbatim.
2. Port global and base CSS verbatim.
3. Wire fonts and print styles.
4. Build every shell and presentation primitive against a dev-only demo route
   that renders them in isolation.
5. Build the form primitives.
6. **Then** build features, composing only primitives that already exist.

The dev-primitives demo route is the trick that makes this work — it lets the
design system be reviewed and signed off in one place, before any feature depends
on it. A feature built on approved primitives is correct by construction.

### 9.2 Put the fidelity mandate in the original spec

Copy sub-project 7's §1 into the architectural spec of the next project, before
sub-project 1 starts. Include all four parts: the bolded mandate, the concrete
definition of matching, the enumerated acceptable deviations, and the requirement
that anything else be documented as an explicit deviation in the PR.

### 9.3 Write the seam tests before the features

Identify the two or three places where the architecture could fail
catastrophically — here, the JWT-claim-to-RLS boundary and the anonymous
submission path. Write tests that prove those boundaries hold **before** building
features on top of them. Not more tests; earlier and better-aimed ones.

### 9.4 Never merge with a skipped job

Either the end-to-end suite gates from the first PR that has something to test,
or it is deleted and the pretence dropped. A permanently-skipped job is worse
than no job because it renders green meaningless.

### 9.5 Deploy a hello-world on day one

Before sub-project 1, push a trivial page through the complete production path —
commit, CI, build, deploy, live URL, and a request that touches the database and
returns. Every integration failure at launch was in a link of that chain that had
never been exercised end to end.

### 9.6 Spec the platform, not just the architecture

Add a section to the infrastructure spec covering the properties of the specific
tier in use: pause behaviour, rate limits, cold starts, email deliverability
limits, connection caps. Note which are acceptable and which need upgrading
before real use.

### 9.7 Get a real user in at the first demo-able milestone

Not at launch. At the end of the first sub-project that produces something
touchable — here, that was Admin Core, roughly six weeks before anyone outside
the build actually used it.

The July feedback is the proof. Every question in it could have been asked in
mid-May against a half-built admin shell, and several would have changed the data
model while changing the data model was still cheap. **Budget one user session per
sub-project.** It is the cheapest defect-detection available and it finds a class
of problem that nothing else does.

### 9.8 Mark plans as history when they close

On sub-project close, stamp the plan with a status header: executed, on what
date, superseded by what. Keep one document — here, `CLAUDE.md` — as the single
current-truth artifact, and treat everything under `plans/` as an archive.

---

## 10. Replay checklist

For starting the next project from zero.

**Phase 0 — Prototype**
- [ ] Extract the design language from a fixed external artifact; define tokens with roles.
- [ ] Build the prototype as running HTML/CSS/JS, not static mockups.
- [ ] Encode the real data model and business rules in its mock layer, with comments explaining each rule.
- [ ] Iterate with stakeholders until they stop asking for changes.
- [ ] Freeze it. Separate repository, no further edits.

**Phase 1 — Plan**
- [ ] Write the architectural design spec: stack, data model, permissions, topology, non-goals.
- [ ] Write the workflow spec separately: branching, commits, review, CI, deploy, secrets.
- [ ] **Include the fidelity mandate in the architectural spec** (§9.2).
- [ ] **Include the platform-properties section** (§9.6).
- [ ] Decompose into sub-projects of ≤50 tasks, each ending demo-able.
- [ ] Write one plan per sub-project with complete code and per-task verification.
- [ ] Commit everything before writing application code.

**Phase 2 — Infrastructure**
- [ ] Repo, branch protection, Conventional Commits, hooks, CI with all jobs gating.
- [ ] All environments provisioned.
- [ ] **Hello-world through the full production deploy path** (§9.5).

**Phase 3 — Design system**
- [ ] Port tokens, global CSS, fonts, print styles verbatim from the prototype.
- [ ] Build all shell, presentation, and form primitives against a dev-only demo route.
- [ ] **Gate on human sign-off before any feature work** (§9.1).

**Phase 4 — Features**
- [ ] **Seam tests before features** (§9.3).
- [ ] Execute plan tasks, one or few per PR, squash-merged into protected `main`.
- [ ] Gate every phase on named evidence.
- [ ] **One real-user session per sub-project** (§9.7).

**Phase 5 — Launch**
- [ ] Bootstrap production, verify auth end-to-end with a live sign-in.
- [ ] Confirm every required environment variable is present in every context.
- [ ] Verify the deploy trigger actually fires — not that the dashboard says it will.
- [ ] Stamp closed plans as history (§9.8).

---

## 11. The honest summary

The process produced an excellent result: a live, secure, role-scoped production
application, visually indistinguishable from its prototype, built in sixteen
working days with a full test pyramid and a complete written record of every
decision.

Two things made that possible: **a prototype precise enough to be read as a
specification**, and **plans detailed enough to be executed without context.**
Everything else in this document is scaffolding around those two.

The process also had one structural flaw and one blind spot. The flaw was
ordering — function before fidelity — which cost a sub-project and is fully
correctable by §9.1. The blind spot was that no real user touched the product
until seven weeks after launch, which meant the process could verify the product
was built correctly but had no way to learn whether it was built right. The July
feedback is what that blind spot looks like from the outside, and closing it —
§9.7 — is the change most likely to matter on the next engagement.

---

## References

- `docs/methodology.md` — the generalized four-stage playbook
- `docs/superpowers/specs/2026-05-10-production-rebuild-design.md` — architectural spec
- `docs/superpowers/specs/2026-05-11-development-workflow-design.md` — SDLC spec
- `docs/superpowers/specs/2026-05-18-frontend-rebuild-design.md` — the fidelity mandate
- `docs/superpowers/visual-fidelity-audit-2026-05-14.md` — route-by-route delta inventory
- `docs/superpowers/visual-fidelity-screenshots/2026-05-19-final/` — 75 side-by-side captures
- `docs/launch-todo.md` — open items after launch
- `docs/cicd-overview.md` — pipeline walkthrough
- `KP Feedback July 2026/` — first real-user testing round
