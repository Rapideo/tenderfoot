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

### 2.14 A defect can live between two individually-correct diffs, where no scoped review can see it

**Observed 2026-08-13, SP1.5.** Nine task-scoped reviews each judged one diff against one brief, and all nine passed. The whole-branch review then found four defects, the worst of which no scoped review *could* have found:

- One batch correctly changed `source.enabled` from an integer to a real `boolean`.
- Another batch correctly deleted the now-redundant `typeof v === "boolean" ? (v ? 1 : 0) : v` coercion.
- **Neither diff was wrong. Between them,** `PATCH {"enabled":"true"}` began enabling a source whose legal posture is `out` — excluded by its terms of service — with no legal note and no ingestion window, because Postgres coerces `"true"` to `true` while the guard tested `=== 1 || === true`. **Under the old engine the same request was inert.**

**Proposed generalisation.** A review scoped to one change is the right tool for *"is this change correct"* and structurally cannot answer *"is the system still correct."* **Any migration that changes a type, a contract or an engine needs a pass whose unit is the whole change, not the individual commits** — and that pass is a different *kind* of review, not a larger one. Two other findings that day fit the same shape: a stale engine reference in a client file **no task's brief listed**, and the absence of `.env` loading, which is a defect of *omission* that no diff contains.

**Why not promoted.** One project. **But the mechanism is structural rather than circumstantial** — scoped review cannot see across its own scope, by definition — and that argues it will recur anywhere the same method is used. Strong candidate on a second sighting.

### 2.15 An agent's "green" is a sample of one, and nobody reports flakiness they never ran twice

**Observed 2026-08-13, twice in one slice.**

**First:** every "gate green" reported during SP1.5 — four separate agents, four separate numbers — passed only because each agent's shell already carried the environment. **From a clean shell the gate failed at import in all four test files.** Nothing in the repo loaded `.env`. Found by the whole-branch review, not by any of the agents reporting success.

**Second:** two agents reported `37/37, exit 0`. Running the gate directly before merging, it **failed** — then passed three times, then failed once more across five runs. Roughly a 20% flake, caused by a Neon compute pinned at a fixed 0.25 CU while four test files opened pools against it. **Diagnosed by the collect time (48.8 s under contention against 645 ms in isolation) and confirmed when a resize moved that exact number to 2.9 s.**

**Proposed generalisation.** *"Tests pass"* from a subagent is one observation, in one environment, at one moment. **Before trusting a gate at a decision point — a merge, a release — run it yourself, run it more than once, and run it in the environment you actually claim it works in.** Reliability is a property of a distribution and no single report can carry it.

**Corollary worth keeping separately:** when a flake is fixed, confirm the *metric predicted to move* actually moved. A failure that stops reproducing is not the same as a cause that has been removed.

**Why not promoted.** One project, though two instances. **The second half — verify by the predicted metric, not by the symptom's absence — may deserve promotion on its own**, since it is the difference between a diagnosis and a coincidence.

---

### 2.16 A revocation is proved by the OLD key failing, not by the new key working

**Observed 2026-08-14.**

A leaked database credential was rotated in the provider console. The obvious check — connect with the new string — passed, and on its own would have closed the incident. **The check that mattered was connecting with the OLD string, which still worked on one of the two branches.** The provider resets a role password *per branch*: the role is a project-level object and its password is not. Nothing in the console flow says the word "branch," and the reset genuinely succeeded for the branch it was aimed at. The report was accurate and the incident was still open.

**Proposed generalisation.** For any change whose purpose is to **remove** something — a credential, an access grant, a feature flag, a route, a permission, a file — the positive test confirms the replacement exists and says **nothing whatsoever** about whether the original is gone. The two are independent facts. **The negative test is the one that carries the claim, and it is the one that gets skipped**, because a passing positive test feels like completion and produces the same green.

**Corollary, and it has to be planned for.** The negative test requires the old artifact, so it must be **captured before the change**. A rotation that discards the old string first cannot be verified at all — only assumed.

**Why not promoted.** One instance. **But it is a shape rather than an accident** — the same structure as 2.5 (instrument for silent failure) and 2.9 (ask what was removed). A second instance in any project should send it straight to the playbook.

### 2.17 Fixing every instance leaves the template that mints the next one

**Observed 2026-08-14 — and the spec had already written the warning.**

A database compute was resized from 1→1 to 0.25→8 CU. Both live computes read the new value and verified on read-back, so the change was recorded as done. **The project-level `default_endpoint_settings`, which governs computes that do not exist yet, still read 1→1.** Every future branch would be born at the wrong size — including the per-preview branches that a still-outstanding task exists specifically to start creating.

**The sharpest part is that the hazard was documented.** The workflow spec said in as many words that the default applies only to newly created endpoints, that the second API call was *"not redundant,"* and that this was *"the half that fails silently."* The warning was correct, it was written by the person doing the work, and the second call still was not made. **A documented hazard is not a mitigated one.**

**Proposed generalisation.** Where a setting exists at both **instance** and **template** level, fixing every instance produces a complete-looking audit and a wrong system — because the audit surface is *what exists*, and the defect lives in *what does not exist yet*. It surfaces only when something new is created, which is typically later, under different circumstances, and gets attributed to the new thing.

**The check that catches it.** After changing a setting across every instance, ask: ***"what mints the next instance, and did it change?"*** Then create one and read it back. Nothing short of creating one distinguishes a fixed template from an unfixed one.

**Second-order value, recorded 2026-08-14.** The near-miss here was a *shortcut*: rebuilding the test branch instead of resetting its password would have inherited the rotated credential and retired the leaked hostname in one move. It was rejected only because the template defect was found first — otherwise it would have silently restored the SP1.5 flaky gate, whose cause had already been measured and paid for. **A shortcut that creates a new instance inherits the template's defects, and that is invisible at the moment the shortcut looks clever.**

**Why not promoted.** One instance. **The warning-was-written-and-ignored half may be the more valuable one**, and it generalises past configuration entirely: it is a claim about whether documentation is actually consulted at the moment of action, or only at the moment of writing.

---

### 2.18 A version number that tracks how much prose changed will miss the change that matters

**Observed 2026-08-14, reconstructing the SVRC's missing revision notes.**

Three consecutive changes to an adopted reference document. Re-pointing one node's `Proto` score from 70% to 95% took a **minor** bump, 0.4.1 → 0.5.0. Rewriting the scoring key's definition of `Pri` — from *"how soon this should be built"* to *"how much KP wants the thing"* — took **no bump at all** and left no revision note.

**The second change is enormously larger than the first, and the version says the opposite.** One moved a single number. The other **silently reinterpreted all twenty existing values in the document**, because every one of them was written against the old definition. Nothing in the file recorded that two different meanings of `Pri` had both shipped as 0.5.0.

**Proposed generalisation.** Editors size a version bump by **how much text moved**, because that is what is visible in a diff. The changes that most need announcing are **semantic**: a definition, a scale, a column's meaning, a default. These are often a one-line diff — which is exactly why they get typed as trivial and slip through unversioned.

**The check that catches it.** Before committing a change to a reference document, ask: ***"does this change what any existing value in the document means?"*** If yes, it is a major revision regardless of its size, and it needs a note saying which values were reinterpreted. A one-line diff is a reason for suspicion, not comfort.

**And the repair is a note, not a renumber.** Retroactively renumbering makes the history lie a second way. The version stays wrong; the note is how a reader finds out that it is.

**Why not promoted.** One instance, and it is close kin to §2.17 — both are cases where the visible surface (instances; diff size) is not the surface where the defect lives. **They may eventually merge into one lesson about auditing the wrong surface**, but not on two observations.

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
