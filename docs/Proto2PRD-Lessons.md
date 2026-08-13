# Lessons for the playbook

**Opened 2026-08-12.** A staging area for observations from Tenderfoot that should improve [`Proto2PRD.md`](Proto2PRD.md) — the reusable playbook — but are **not yet ready to be written into it.**

---

## Why this is a separate document

Process learnings on this project are already folded into the playbook *as they emerge*, not retrospectively. That is a standing rule and it stays. Section 1 below records what has already gone in.

**But not every observation is ready.** Some are true of Tenderfoot and might not be true of anything else. Some are probably general but have been seen exactly once. Writing those into the playbook would be worse than not writing them, because **a playbook is trusted, and a playbook full of one-off observations stops being trustworthy.**

So this file is the holding pen. Things arrive here when noticed and leave when they earn it.

### The bar for promotion

An observation moves from here into `Proto2PRD.md` when **either**:

- **It has been observed at least twice**, ideally on different projects, **or**
- **It has been observed once and there is a stated mechanism explaining why it generalises** — a reason it *must* recur, not merely a feeling that it will.

That mirrors the playbook's own `(T)` provenance marker, which sits deliberately between `(R)` — recovered from a shipped build — and `(N)` — new and untested.

**Anything promoted gets the marker, a one-line statement of what triggered it, and a pointer back to the evidence.** Anything that fails to earn promotion by the end of the project gets deleted rather than quietly retained, because an observation nobody could confirm in a whole project is probably not a lesson.

---

## 1. Already promoted during this project

Recorded so the end-of-project pass does not re-litigate settled ground.

**§4.3.2 — the tool fork, and §4.3.2.1, first evidence.** Whether the bake-off runs in a design tool or directly in code. *Trigger:* Matt asked the question directly; the answer required evidence, so the section carries measured cost rather than an opinion.

**§4.7.5 — audit what the prototype decided for you.** The most substantial addition. A generated prototype always answers questions the specification left open, and **the risk is not a wrong answer but an unratified right one.** *Trigger:* Matt's observation that the review phase is where prototype decisions get sorted, following an audit that surfaced twelve of them.

**§5.4 — verify against expected output, not exit status.** *Trigger:* a migration command that exited zero, printed nothing, applied nothing, and passed its test suite throughout.

**The `(T)` provenance marker.** Validated-on-Tenderfoot, sitting between recovered and untested. *Trigger:* two mechanisms qualified and `(N)` had stopped being honest about either.

**`ClaudeDesign_Proto_Cleanup.md`** — a companion procedure for turning a generated bundle into a specification-grade prototype, including the re-extraction section added when V1.1 landed hours after V1 was extracted.

---

## 2. Candidate lessons

Each carries the observation, the proposed generalisation, why it has not been promoted, and what would confirm it.

### 2.1 A project needs a one-screen state file, separate from the document that carries reasoning

**Observed.** `Tenderfoot-Plan-of-Action.md` was designed to be the status document. Within a week of heavy decision-making, the status was buried under revision notes, corrections, and reasoning — all of it worth keeping. Matt said plainly that he had lost track of the structure. The fix was `STATUS.md`: one screen, regenerated as things change, with the history left where it was.

**Proposed generalisation.** *"What is true now"* and *"how we got here"* are different documents with different readers and different lifespans. Merging them destroys the first. A project should open a one-screen state file at Stage B, not after someone gets lost.

**Why not promoted.** Seen once. It is possible this is a symptom of an unusually decision-dense fortnight rather than a general property.

**What would confirm it.** The second project reaching the same point and having the same problem — or, more cheaply, someone returning to Tenderfoot after two weeks away and reporting which file they actually opened first.

### 2.2 Never assert a count or a list that is expected to grow

**Observed twice in two days.** A migration test hard-coded `["001_app_meta.sql"]` and failed the moment a second migration existed. A registry test asserted eleven sources and failed because earlier tests in the same file insert their own. Neither failure indicated a defect; both cost time and attention.

**Proposed generalisation.** In the task-writing standard: assert *membership and behaviour*, never totals, for anything the project intends to add to. A test coupled to a growing number cries wolf on every addition, and a suite that cries wolf gets skipped.

**Why not promoted.** Close to ready — this has the two observations. Held back only because both were on the same project in the same week, which is weak independence.

**What would confirm it.** One occurrence anywhere else. Alternatively, promote it now as a sub-point of §5.4, which is where it belongs.

### 2.3 How to park a section without it being resumed by accident

**Observed.** The matching design was parked in full. It was fenced with a preamble stating that nothing in it binds, that it will be re-imagined rather than resumed, and that specific arguments inside it survive independently. The slice implementing it was **removed from the sequence rather than reordered**, because "later in the list" implies a known shape.

**Proposed generalisation.** The playbook has no pattern for parking. It should: keep the reasoning, fence it loudly, remove it from the plan rather than deferring it, and state explicitly what dies with it. **A parked design that stays legible is a design that gets resumed by accident**, which is the mirror image of §4.7.5's unratified-answer problem.

**Why not promoted.** One instance, and it is very recent — we do not yet know whether the fence holds. The test is whether anyone, in three months, treats §6 as a starting point.

**What would confirm it.** Reaching the qualification work and finding that the parked section genuinely did not constrain it.

### 2.4 Build the mechanical version first because it is the measuring stick, not because it is simpler

**Observed.** Matt's instruction was *stay mechanical as long as we can, then get smart.* The reasoning that emerged during the work was stronger than the original one: mechanical and intelligent are not phases but **selectable modes, with the mode recorded in the data**, so the two can be compared on the same hand-checked set.

**Proposed generalisation.** When a project has an "intelligent" component and a "mechanical" one that solve the same problem, build the mechanical one first — **not because it is cheaper, but because without it there is no baseline the intelligent version can be shown to beat.** And record which produced each result, or the comparison is unavailable retrospectively.

**Why not promoted.** The comparison has not been run yet. This is currently a well-argued prediction, not a finding.

**What would confirm it.** Running both extraction modes over the same hand-labelled documents and finding the comparison genuinely informative — or finding it was not worth the plumbing.

### 2.5 Instrument for silent failure in every external dependency

**Observed four times across three independent systems.** Parameters accepted and ignored: a federal sort instruction, a state's date filters in four spellings, and a portal filter returning identical results for three different settings. None returned an error.

The method that catches it is trivial: **vary one parameter and watch the total move.** Two requests. It is now recorded per source, including where it *cannot* run because a source withholds totals.

**Proposed generalisation.** Any project depending on an external system it does not control should verify that the system's controls actually work, at integration time, and record the result. **The failure mode is not an error — it is a plausible wrong answer**, which no amount of error handling catches.

**Why not promoted.** Strong mechanism, but all four instances are government procurement systems. It may be a property of that sector rather than of external dependencies generally.

**What would confirm it.** One instance in a different domain. A commercial API doing the same thing would settle it immediately.

### 2.6 The prototype represents the finished product; the first release ships a subset — say so explicitly

**Observed.** The prototype includes the entire scoring layer, which V1 does not build. Without an explicit statement, two readings compete: *the prototype is out of date, trim it* (wrong), or *V1 must build everything drawn* (also wrong).

**Proposed generalisation.** The fidelity mandate needs a scope clause. Parity applies to **what the release builds**; parked nodes are not built and must match when they are; and nothing is trimmed from the prototype to reflect a narrower release.

**Why not promoted.** This arose from parking a subsystem *after* the prototype was frozen — a specific sequence that may be uncommon.

**What would confirm it.** Any project where scope narrows after the prototype freezes.

### 2.7 A fidelity mandate must name a version

**Observed.** "Match the prototype" is unfalsifiable when the prototype iterates. V1.2 is expected; V1.1 is what the mandate names.

**Proposed generalisation.** Parity is asserted against a **named, frozen artifact**, and re-pointing it is a deliberate act taken alongside the fidelity audit — never an automatic consequence of a new file appearing.

**Why not promoted.** One instance, though the mechanism is strong and the failure is obvious in hindsight. **This is the most likely candidate for early promotion.**

### 2.8 State which viewports the prototype specifies

**Observed.** The prototype was designed and captured at desktop width. The specification requires the triage screen to work on a phone. **Responsive behaviour therefore has no reference to be faithful to**, and would have been designed during the build, silently, by whoever wrote the component.

**Proposed generalisation.** The bake-off brief should state which viewports are specified. Anything unspecified is a decision that will be made by default unless someone names it.

**Why not promoted.** One instance. It is also possible this is simply an omission from the brief rather than a missing rule.

**What would confirm it.** A second project where the brief did not say, and the same gap appeared.

### 2.9 Ask what was removed, at every gate

**Observed.** This project improved substantially by subtraction: an entire matching subsystem parked, a day-long manual exercise cancelled, past-performance citation cut, four sources ruled out, one library dropped. Each removal reduced risk and made the remainder more likely to finish.

**Proposed generalisation.** Add *"what did we remove?"* to phase gates alongside *"what did we build?"* A phase with no removals may indicate scope that has never been challenged.

**Why not promoted.** Genuinely uncertain whether this generalises or whether Tenderfoot simply started over-scoped. **It may be a symptom rather than a practice.**

**What would confirm it.** A second project where deliberately asking the question surfaced a removal that would not otherwise have happened.

### 2.10 Legal posture deserves a decision procedure, not just a field

**Observed.** Recording legal posture per source was in the design from early on. It was not enough — the field had no *procedure*, so the question got re-argued per source until a standing rule was written: ambiguous terms default a source out, documented permission moves it in, evidence recorded on the row, three postures rather than two.

**Proposed generalisation.** Any project ingesting third-party data needs both the field and the rule that decides it. **A field without a decision procedure is a place to record an argument, not a way to end one.**

**Why not promoted.** Domain-specific on its face. The underlying pattern — *a policy field needs a decision procedure or it becomes a debate* — may be much more general, but that broader claim has one instance.

### 2.11 A deferred caveat that names its own trigger deserves one more question: *what if the trigger fires early?*

**Observed 2026-08-13.** The stack assessment identified two caveats to local-first SQLite, reasoned both correctly, and filed both under *genuinely deferred*: **scheduled ingestion needs something always on** (marked *"it should not arrive as a surprise"*), and **a second reader means a second copy.** Both were retired within twenty-four hours by a hosting decision that also invalidated the choice they were caveats to.

**Proposed generalisation.** When a deferred item states the condition that will end the deferral, **that condition is a question to ask now, not a note to read later.** The assessment was correct that the trigger existed and wrong only about when — and it never asked, because "deferred" reads as a decision rather than as a bet on timing.

**Why not promoted.** One instance. **But the mechanism is stated and it is not domain-specific**: writing down a trigger creates the illusion the risk is handled, and the register of deferred items is exactly where nobody looks for a live question. Worth a second sighting before it goes in.

### 2.12 Assess a stack against where it runs, not only against what it must do

**Observed 2026-08-13.** The IDE8 stack was assessed in full against a requirements list — data model, ingestion, documents, application, delivery — and the assessment was *valid*: every claim in it held. It concluded local-first SQLite was **"a good fit, better than a server database."** The deployment target was never named, and when it was named the next morning — Vercel — the conclusion became unusable, because Vercel has no writable persistent filesystem.

**Proposed generalisation.** **A stack assessment that never asks "where does this run" can be entirely correct and still wrong.** Hosting is not a downstream consequence of the stack; for persistence and for anything touching the filesystem, it is upstream of it. The requirements list should carry the deployment target as a hard requirement, and `Stack-Requirements.md` did not have a row for it.

**Why not promoted.** One instance, and arguably a special case of 2.11. **The cheap fix is concrete though** — add "where does it run, and what can it write to" to the requirements template — and that may be worth promoting on its own before the lesson is.

### 2.13 Agent-aware CLIs remove the confirmation prompt for exactly the actor most likely to need it

**Observed 2026-08-13, the hard way.** Claude ran `vercel integration add neon --format=json --non-interactive` intending to *enumerate* available products and billing plans. It provisioned a paid subscription instead — plan, resource name and compute size all taken as defaults, none chosen. The plan's own precondition had said this step was *"the one step Claude does not do — it creates billable resources."*

**The detail that makes this a lesson rather than a blunder.** `vercel`'s own help says of `--non-interactive`:

> *"Run without interactive prompts; **when an agent is detected this is the default**."*

**So the flag was not the cause.** A human running `vercel integration add neon` gets a prompt — choose a plan, confirm the spend. **An agent running the identical command gets no prompt, because the tool detects the agent and suppresses it.** The guard rail is removed precisely for the actor with the least context about what a subscription costs.

**Proposed generalisation, in three parts:**

1. **Assume the confirmation you would have seen is not there.** Agent-mode auto-detection is spreading across CLIs, and it converts *"this command asks first"* into *"this command does it."*
2. **Exploration and mutation frequently share a command surface.** `integration add --help` lists; `integration add` performs. There was no `--dry-run`, and `--format=json` reads like an output flag rather than a commit.
3. **A precondition that says "do not do this" has no mechanism behind it.** A plan cannot enforce its own preconditions. **The only real guard is refusing to run write-capable commands against a live account while exploring** — read the docs, or ask.

**Why not promoted yet.** One instance. **But the mechanism is documented in the tool's own help text**, which is stronger evidence than a single incident usually carries, and it is not specific to Vercel or to this project. **This is a strong candidate for promotion on a second sighting**, and worth watching for on any CLI touching billing, deploys, or deletion.

> ### SECOND SIGHTING, same day — 2026-08-13. This now meets the promotion bar.
>
> During SP1.5's deploy task, a bare `vercel --yes` — issued under an explicit "preview only, never production" instruction, and documented as producing a preview — **came back `target: production`.** Confirmed twice: by `vercel inspect` at the time, and afterwards by `vercel ls`, which still shows that deployment as **Environment: Production, Status: Error**.
>
> **Nothing was promoted only because it died at config validation in 3 seconds, before building.** That was luck. Had the config been valid, an instruction reading *"NEVER `vercel --prod`"* would have shipped to production anyway — because the dangerous default was not on the flag anyone was told to avoid.
>
> **Two independent instances, one session, one CLI**: an agent-detected `--non-interactive` that provisioned a paid subscription, and a `--yes` that targeted production. **The generalisation holds and should be promoted:**
>
> **Never infer a CLI's default from its documentation when the action is irreversible or billable. Verify the target *after* invoking and before relying on it** — `vercel inspect`, `--dry-run`, a status query, whatever the tool offers. And prefer explicitly passing the safe value (`--target=preview`) over trusting that it is the default, because a default is a policy the vendor may change and the docs may lag.
>
> **The deeper form, which is what makes it a playbook lesson rather than a Vercel note:** *a guard rail phrased as "do not use the dangerous flag" only works if the dangerous behaviour requires a flag.* Both instances here were dangerous behaviour reached by **omission**.

---

## 3. Watch items — open questions about the method itself

Not lessons. Questions the project should be able to answer by the end, and would otherwise forget it had asked.

**Does the §4.7.5 audit hold on a second prototype iteration?** The audit ran once, against V1.1. V1.2 is coming. If the second audit surfaces far fewer decisions, the method may be front-loaded rather than repeatable.

**Does the fidelity column expire usefully?** `Proto` was filled at a mean of 84% against V1.1 and expires the moment V1.2 lands. The claim is that filling it once per freeze is the right cadence. Untested.

**Does the three-package workspace earn its ceremony?** Asked by SP0 of itself. If the shared package is still two interfaces after SP1, the answer is no, and the playbook may want a note about premature structure.

**Does the check gate stay fast enough to actually be run?** Currently a few seconds. A gate that gets skipped is worse than no gate, and this is the kind of thing that degrades silently.

**Did building the database layer before the hosting decision cost anything real?** The SQLite→Postgres port cost roughly 600 lines and no data, because SP0 made the database a derived artifact rebuilt from files. **The claim to test is that "make the database rebuildable from committed inputs" is what made a reversal cheap** — not luck, and not the small size of the project. If a later reversal in a different layer is expensive, that tells us the property was specific rather than general.

**Was parking the intelligence layer right?** The strongest claim in this project is that deferring qualification made the mechanical layer measurable. **If volume turns out to be low and the first release is pleasant to use, that claim looks wise. If volume is high and the tool is unpleasant for a month, it looks like a mistake that happened to be well argued.** Either way it is worth writing down which.

---

## 4. The end-of-project pass

When Tenderfoot reaches its go/no-go gate, run this file top to bottom:

1. **Promote what earned it.** Add to `Proto2PRD.md` with the `(T)` marker, a trigger line, and a pointer to the evidence.
2. **Delete what did not.** An observation nobody could confirm across a whole project is not a lesson, and keeping it dilutes the ones that are.
3. **Answer the watch items** in section 3, including the ones whose answer is unflattering.
4. **Check what is missing.** The most valuable lessons are the ones nobody thought to write down at the time — so the last question of the pass is *what did we do differently this project without noticing?*

**Add to this file as things happen.** It is worth much less if it is written at the end, which is the same argument the playbook already makes about itself.
