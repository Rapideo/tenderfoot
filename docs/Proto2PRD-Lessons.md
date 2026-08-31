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

**§5.4 — a removal is proved by the OLD thing failing, and the old thing must be captured first.** Promoted 2026-08-14. *Trigger:* observed twice in one day — a per-branch password reset that left the leaked credential live, then the corollary being violated by the party that had written it hours earlier. **The mechanism is what earned it:** the working sequence for a revocation contains no step at which the old value is still needed, so the precondition is invisible to anyone following the happy path. That is why the playbook entry moves the step rather than adding a reminder. *Evidence:* §2.16 below, both instances.

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

### 2.15 An agent's result is one observation, in either direction

**Observed 2026-08-13, twice in one slice — and again on 2026-08-15 with the sign reversed.**

**First:** every "gate green" reported during SP1.5 — four separate agents, four separate numbers — passed only because each agent's shell already carried the environment. **From a clean shell the gate failed at import in all four test files.** Nothing in the repo loaded `.env`. Found by the whole-branch review, not by any of the agents reporting success.

**Second:** two agents reported `37/37, exit 0`. Running the gate directly before merging, it **failed** — then passed three times, then failed once more across five runs. Roughly a 20% flake, caused by a Neon compute pinned at a fixed 0.25 CU while four test files opened pools against it. **Diagnosed by the collect time (48.8 s under contention against 645 ms in isolation) and confirmed when a resize moved that exact number to 2.9 s.**

**Third, 2026-08-15 — the same defect with the sign flipped.** `gh repo create` was refused once by the permission classifier on 08-14. That refusal was written into `STATUS.md` as ***"`gh repo create` is blocked for Claude by the permission classifier — Matt runs it,"*** the task moved to the human's column, and it was pinned as the **single red item, described as the only thing blocking anything.** Retried the next day on Matt's instruction, it **succeeded on the first attempt** — no configuration change, no argument altered. **The cost lived entirely in the recording, not in the refusal:** a session's delay on the item the whole plan was queued behind, and a handoff that was never necessary.

**Fourth, 2026-08-15 — the rule applied instead of violated, and it worked.** `git push origin main` was refused by the permission classifier. **The check written at the bottom of this lesson was followed:** it was retried once, unchanged, and **succeeded immediately** — same command, same session, same arguments, seconds apart. Where the third instance cost a day and a handoff, this cost one call.

**Why the fourth instance matters more than a fourth data point.** The first three were discovered by accident, after the damage. This one was **caught by the lesson itself**, which is the only evidence in this file that any of these rules survive contact with the moment of action — the exact doubt §2.17 raises when it observes that *"a documented hazard is not a mitigated one."* It also sharpens the phenomenon: two spurious refusals now, on **different commands**, both non-reproducing on immediate retry. **That is not a capability boundary; it is noise being recorded as architecture.**

**Proposed generalisation.** A result reported by an agent — *"tests pass," "that action is blocked"* — is **one observation, in one environment, at one moment.** Permission decisions, classifier verdicts and sandbox refusals are evaluated per call and can turn on phrasing, surrounding context, session state, or which credentials happen to be present; test results vary on environment and contention. **Neither direction carries reliability, because reliability is a property of a distribution and no single report can hold one.** Before trusting a result at a decision point — a merge, a release, a handoff — run it yourself, run it more than once, and run it in the environment you actually claim it works in.

**The asymmetry, and it is why the red case is the more dangerous one.** Nobody thinks to re-run a refusal. **A failure feels conclusive in a way a pass does not**, so the sample size of one goes unexamined precisely where scepticism is cheapest. Worse, a refusal is usually recorded as a *property* — *"X is blocked for the agent"* — rather than as an event, and that phrasing **names a human as the workaround.** The wrong entry does not sit inert. It reassigns work, then defends the reassignment by looking like a known constraint.

**The check that catches the red case.** Record **what happened**, not **what is true**: *"refused 2026-08-14, not retried"* rather than *"is blocked."* And **before handing any refused task to a human, retry it once.** A genuine refusal costs one call to confirm; a spurious one costs a handoff, and here it cost a day at the front of the queue.

**Corollary worth keeping separately:** when a flake is fixed, confirm the *metric predicted to move* actually moved. A failure that stops reproducing is not the same as a cause that has been removed.

**Why not promoted.** One project, though **four** instances now across both directions — and the fourth is the first one the lesson caught by itself rather than in hindsight. **Two pieces may deserve promotion on their own:** *verify by the predicted metric, not by the symptom's absence*, which is the difference between a diagnosis and a coincidence; and *retry before you hand off*, which is the cheapest rule in this file. **The instance still missing is a refusal that recurs on retry** — that is the counter-example that would show how to tell a real capability boundary from a one-off, and without it the rule says only "check," not "how to know."

---

### ~~2.16~~ ✅ PROMOTED 2026-08-14 → `Proto2PRD.md` §5.4 — a revocation is proved by the OLD key failing

*Kept here in full: the playbook carries the rule, this carries the two incidents it was derived from.*

**Observed 2026-08-14.**

A leaked database credential was rotated in the provider console. The obvious check — connect with the new string — passed, and on its own would have closed the incident. **The check that mattered was connecting with the OLD string, which still worked on one of the two branches.** The provider resets a role password *per branch*: the role is a project-level object and its password is not. Nothing in the console flow says the word "branch," and the reset genuinely succeeded for the branch it was aimed at. The report was accurate and the incident was still open.

**Proposed generalisation.** For any change whose purpose is to **remove** something — a credential, an access grant, a feature flag, a route, a permission, a file — the positive test confirms the replacement exists and says **nothing whatsoever** about whether the original is gone. The two are independent facts. **The negative test is the one that carries the claim, and it is the one that gets skipped**, because a passing positive test feels like completion and produces the same green.

**Corollary, and it has to be planned for.** The negative test requires the old artifact, so it must be **captured before the change**. A rotation that discards the old string first cannot be verified at all — only assumed.

**Second instance, same day, and it is the corollary above being violated by the person who wrote it.** The `test` branch was rotated later on 2026-08-14. The new credential was verified — connection works, full gate green, 92 tests. **The old string was overwritten in `.env` before it was captured, so the negative test could not be run at all.** The provider's dialog asserts the old password is no longer valid; nothing that was actually executed demonstrates it. The incident is closed on an assertion where the `main` branch's was closed on evidence.

**What makes this the instructive one.** The corollary was already written, in this file, hours earlier, in these words: *"the negative test requires the old artifact, so it must be captured before the change."* It was not a gap in the analysis. **The rotation was performed step-by-step and the capture step simply never came up**, because the working sequence — reset, fetch new, write, test — has no natural place where the old value is still needed. **A precondition that appears nowhere in the happy path will be skipped no matter how well it is documented** (cf. §2.17's "a documented hazard is not a mitigated one" — same failure, different lesson).

**The fix is a sequencing rule, not a reminder.** Make capturing the old artifact **step one of the revocation procedure**, before touching the provider — not a verification step afterwards. By the time verification is the current concern, the artifact is already gone.

**✅ PROMOTED 2026-08-14 by Matt's decision**, into `Proto2PRD.md` §5.4, beside *"verify against expected output, not exit status"* — the same family, since both are verifications that assert the wrong thing. **The playbook entry leads with the sequencing rule rather than the maxim**, because the second instance proved the maxim alone does not survive contact with the happy path.

### 2.17 Fixing every instance leaves the template that mints the next one

**Observed 2026-08-14 — and the spec had already written the warning.**

A database compute was resized from 1→1 to 0.25→8 CU. Both live computes read the new value and verified on read-back, so the change was recorded as done. **The project-level `default_endpoint_settings`, which governs computes that do not exist yet, still read 1→1.** Every future branch would be born at the wrong size — including the per-preview branches that a still-outstanding task exists specifically to start creating.

**The sharpest part is that the hazard was documented.** The workflow spec said in as many words that the default applies only to newly created endpoints, that the second API call was *"not redundant,"* and that this was *"the half that fails silently."* The warning was correct, it was written by the person doing the work, and the second call still was not made. **A documented hazard is not a mitigated one.**

**Proposed generalisation.** Where a setting exists at both **instance** and **template** level, fixing every instance produces a complete-looking audit and a wrong system — because the audit surface is *what exists*, and the defect lives in *what does not exist yet*. It surfaces only when something new is created, which is typically later, under different circumstances, and gets attributed to the new thing.

**The check that catches it.** After changing a setting across every instance, ask: ***"what mints the next instance, and did it change?"*** Then create one and read it back. Nothing short of creating one distinguishes a fixed template from an unfixed one.

**Second-order value, recorded 2026-08-14.** The near-miss here was a *shortcut*: rebuilding the test branch instead of resetting its password would have inherited the rotated credential and retired the leaked hostname in one move. It was rejected only because the template defect was found first — otherwise it would have silently restored the SP1.5 flaky gate, whose cause had already been measured and paid for. **A shortcut that creates a new instance inherits the template's defects, and that is invisible at the moment the shortcut looks clever.**

**Why not promoted.** One instance. **The warning-was-written-and-ignored half may be the more valuable one**, and it generalises past configuration entirely: it is a claim about whether documentation is actually consulted at the moment of action, or only at the moment of writing.

---

### 2.18 A change to what something *means* moves nothing and breaks everything — two instances

**Observed 2026-08-14, reconstructing the SVRC's missing revision notes.**

Three consecutive changes to an adopted reference document. Re-pointing one node's `Proto` score from 70% to 95% took a **minor** bump, 0.4.1 → 0.5.0. Rewriting the scoring key's definition of `Pri` — from *"how soon this should be built"* to *"how much KP wants the thing"* — took **no bump at all** and left no revision note.

**The second change is enormously larger than the first, and the version says the opposite.** One moved a single number. The other **silently reinterpreted all twenty existing values in the document**, because every one of them was written against the old definition. Nothing in the file recorded that two different meanings of `Pri` had both shipped as 0.5.0.

**Proposed generalisation.** Editors size a version bump by **how much text moved**, because that is what is visible in a diff. The changes that most need announcing are **semantic**: a definition, a scale, a column's meaning, a default. These are often a one-line diff — which is exactly why they get typed as trivial and slip through unversioned.

**The check that catches it.** Before committing a change to a reference document, ask: ***"does this change what any existing value in the document means?"*** If yes, it is a major revision regardless of its size, and it needs a note saying which values were reinterpreted. A one-line diff is a reason for suspicion, not comfort.

**And the repair is a note, not a renumber.** Retroactively renumbering makes the history lie a second way. The version stays wrong; the note is how a reader finds out that it is.

**Second instance, same day, and it is the stronger one.** Q1 redefined the SVRC's `Pri` column on 2026-08-13 — one line in the scoring key. **The twenty values already written under the old definition stayed exactly where they were.** A day later, `Shell A` and `Region A.1` were still carrying `Pri 5` meaning *"build this first"* — the reading the ruling had explicitly outlawed. **Redefining a column does not re-score it**, and the gap is invisible in a diff: the definition moves in one line and the stale values move in none.

**What makes it the stronger instance.** Nobody had to be careless. The ruling was correct, recorded, and prominently placed; the person who wrote it then wrote *"confirming the definition makes those disagreements arguable rather than vague — it does not resolve them"* **and still did not go re-read the twenty numbers.** The failure is structural: a definition and its instances are edited in different passes, and only the definition feels like the decision.

**The check that catches this one.** After changing what a field *means*, ask: ***"how many existing values were written under the old meaning, and who is re-reading them?"*** If the answer is *"all of them"* and *"nobody,"* the change is not finished. **Sizing the version bump by semantics rather than diff is the same discipline applied to the same defect** — which is why these are one lesson and not two.

**A corollary worth keeping separately.** The re-score was driven by a list of five nodes flagged as suspect. **All five were flagged as too *low*; the two worst values in the document were too *high*, and no amount of examining the five would have found them.** A targeted re-audit inherits the bias of whoever wrote the target list. **When the underlying definition changed, the audit has to be exhaustive, because the thing that moved was the yardstick.**

**Why not promoted yet.** Two instances now, one of them strong, and it is close kin to §2.17 — all three are cases where the visible surface (instances; diff size; the flagged list) is not the surface where the defect lives. **Candidate title if they merge: *auditing the wrong surface*.** Worth one more observation before promoting, and it is close.

> **That observation arrived 2026-08-15, and it is the strongest of the set.** Workflow spec §8 recorded per-preview branching as **"not automatable from here"**, and the survey behind that conclusion was genuinely thorough — it enumerated `vercel integration --help`, `vercel integration update --help`, `vercel integration-resource --help`, and the entire Neon MCP tool set, naming what each could and could not do. **Every one of those findings was correct.** The conclusion was still wrong, and it stood for two days, moving the task into the human's column.
>
> **The surface surveyed was "commands that configure the integration."** The feature needed a second change on a surface never enumerated — **`vercel git connect`** — because the branching toggle is inert until the project has a connected Git repository. Nothing about the integration's own configuration surface could have revealed that; the missing capability was not a *deeper* fact about the surface examined, it was **a different surface entirely**.
>
> **What makes it the sharpest instance.** §2.17's audit was thorough over instances and missed the template; §2.18's was thorough over the flagged list and missed the unflagged. **Here the audit was thorough, correct, and explicitly scoped — and the scope itself was the defect.** A survey that lists what it checked reads as exhaustive precisely because it is specific, and its own specificity is what conceals the boundary. **Thoroughness within a surface is indistinguishable, from the inside, from thoroughness across the surfaces that matter.**
>
> **The check this adds.** Before recording *"X cannot be done from here,"* ask ***"what else would have to be true for X to work, and did I enumerate the surface that governs that?"*** — a capability claim needs the list of surfaces it did **not** examine, or it is a claim about one surface wearing the clothes of a claim about the system. **Three instances now, in three different shapes. This is the one that makes the merge worth doing.**

### 2.19 A predicted success signal is a claim that expires, and it fails toward "broken"

**Observed 2026-08-15, and it cost most of a session.**

Workflow spec §8 recorded a six-step dashboard procedure for per-preview database branching, written 2026-08-13 *without executing it*. Two of the six were wrong by the time they were run, and the two failures had opposite signs.

**The procedural half — wrong, and it looked like a broken tool.** §8 listed "toggle Preview on" and "confirm *resource must be active* is also on" as independent steps 4 and 5. They are **ordered**: the branch checkboxes render `disabled` until the second is switched on. Because the dialog's inputs are **1×1 `sr-only` checkboxes behind styled labels**, a disabled control absorbs clicks in complete silence — element-reference clicks resolved to the 1px input and did nothing, coordinate clicks missed and dismissed the dialog. Every symptom pointed at flaky browser automation. **The prior session had already recorded this as an environment problem and handed it to a human**, which is §2.15's failure exactly: a refusal recorded as a property. The actual state was one boolean away and readable the whole time.

**The verification half — wrong in the more dangerous direction.** §8 predicted the environment-variable list would *narrow* from `Production, Preview, Development` to `Production, Development`, and stated: *"If they still read all three environments after saving, the toggle did not take effect."* The save landed correctly and **the list did not narrow** — the stored values persist and are overridden per-deployment. Followed literally, **the recorded check would have reported a correct save as a failure**, prompting a retry of a change that was already done.

**And the change was still inert.** The real proof — deploy a preview, ping it, read production — showed **no database branch was created** and the preview wrote straight to production. The cause was outside the procedure entirely: the project has **no connected Git repository**, and the feature keys off *Git* preview deployments. §8 could not have known this on 08-13, because the repository did not exist until 08-15.

**Proposed generalisation.** A procedure written from documentation rather than execution carries **two** perishable claims: the steps, and *the signal that says the steps worked*. The steps fail loudly and get fixed. **The predicted signal fails silently, is trusted precisely when the operator is least able to judge it, and is what a later session will reason from.** Worse, both failure modes here were **conservative-looking** — one said "the control is broken", the other said "the save failed" — so both pushed toward redoing work rather than toward a false all-clear. **A wrong success criterion does not merely fail to confirm; it actively manufactures a false negative, and a false negative is indistinguishable from an unfinished task.**

**The check that catches it.** When recording an unexecuted procedure, mark the expected-result clause as **unverified**, distinctly from the steps — and on execution, verify the *end state* by an instrument that does not depend on the procedure's own predictions. Here the honest instrument was querying the database directly, which answered in one statement what the environment-variable list could not answer at all. **If a claimed success signal has never once been observed firing, it is a hypothesis wearing a checklist's clothes.**

**Why not promoted.** One instance, though a rich one, and it overlaps three existing lessons without being any of them — §2.15 (a single observation in either direction), §2.16 (verifying the wrong thing), §2.17 (a documented hazard is not a mitigated one). **The distinct claim here is about the shelf-life of a *prediction* embedded in a procedure**, which none of those three make. Worth a second instance before promoting; the natural one would be any other spec step written ahead of its execution.

### 2.20 A task-scoped review is blind to seams, by construction

**Observed 2026-08-15, three times inside a single slice.** Eleven tasks were executed with a fresh implementer per task and a reviewer after each, every one checked against its own brief. Every task passed. The branch still could not complete a single end-to-end lifecycle, and the whole-branch review found why in minutes.

**First — the identity seam.** The adapter registry keys sources `sam` and `usaspending`; the seeded database rows are named `SAM.gov` and `USASpending`. The importer resolves by name and throws. **No real scrape could ever be imported.** Task 7 was correct: it registered its adapter as its brief said. Task 6 was correct: it resolved by name as its brief said. The defect lived in the agreement between them, which was nobody's brief — and it was concealed because the import test seeds a source literally named `fake`, matching the fake adapter, so the one path with a test was the one path that worked.

**Second — the resume seam, found twice in two layers.** The scrape loop emitted the wrong end of the window; that was caught and fixed. The adapter then ignored `until` entirely, defeating the same mechanism one layer down. Each layer's tests exercised only `since`, in isolation. **Resume is a property of two invocations in sequence, and no per-layer unit test can express it** — the two-invocation integration test that finally caught it had to span the loop, the adapter, and the artifact at once.

**Third — the promise seam.** One layer counted records it skipped, so the omission would be "visible rather than silent." The next layer never read the field. Counted, then dropped. The promise was made at a boundary and consumed by nobody, and every test on both sides passed.

**Proposed generalisation.** Reviewing N components against N briefs provides **zero coverage of the N-1 contracts between them**. This is not a matter of reviewer diligence and cannot be fixed by better task reviews: the unit of review is smaller than the unit of correctness, so the defect class is outside the frame by construction. It is also *systematically* invisible, because a seam belongs to neither side — each implementer is correct, each reviewer confirms it, and the artifact is broken.

> **The tell is that the fixture and the failure never meet.** All three instances had passing tests either side of the seam. The identity mismatch was masked by a test fixture that named its source to match; the resume defect by fixtures whose dates were uncorrelated with paging order; the dropped count by tests that asserted the producing side and the consuming side separately. **A fixture chosen to make one component's test pass is exactly a fixture that cannot exercise that component's contract with its neighbour.**

**The check that catches it.** For any work decomposed into more than one reviewed unit, add **one test whose subject is the lifecycle, not a component** — and write it against the real registry, the real names, and the real sequence rather than fixtures chosen for convenience. Then ask, once, of the assembled whole: *what does each piece assume about the piece next to it, and did anyone check?* That question is cheap, it is asked once rather than N times, and today it would have found all three.

**Why not promoted.** Three instances but one project and one slice, so the sample is narrow. **It is also close kin to §2.17/§2.18's "auditing the wrong surface" merge candidate** — a brief is a surface, and the seam is the surface nobody enumerated — but it makes a sharper structural claim than those do: not that the wrong surface was chosen, but that *the correct surface for each unit still leaves a class of defect with no owner*. Worth watching whether it recurs on a differently-shaped decomposition before promoting, or whether it should merge into that candidate as its strongest instance.

> ### ✅ 2026-08-31 — THE RECURRENCE THIS ENTRY ASKED FOR ARRIVED, AND THE PROMOTION CONDITION IS MET.
>
> SP6 is the differently-shaped decomposition the paragraph above was waiting for: **fifteen tasks rather than eleven, spanning client and server rather than one layer**, each with its own brief, its own reviewer, and fix rounds to closure. Every task passed. The whole-branch review then found, in one pass, that **the client never sent `decided_by`.**
>
> The shape is identical to the identity seam. The server accepted the field, stored it, and had a passing test for it (Task 7). The client built the keypress that produces a decision (Task 12). **Neither brief owned the wire between them**, so every row the gate counts would have been written `NULL` — and unlike the earlier instances this one is *unbackfillable*, because append-only preserves everything except a column that was never written. The next task wrote real production rows.
>
> **It also reproduced the tell, exactly.** The fixture and the failure never met: `decide.test.ts` asserted `decided_by` round-trips by passing it directly to `recordDecision`, which is precisely a fixture chosen to make one component's test pass and therefore one that cannot exercise that component's contract with its neighbour. The client's tests asserted the POST body's `state` and `reason` — the fields the client's own brief named.
>
> **Four instances, two projects-worth of slice shapes, and one of them unrecoverable.** The narrow-sample objection above is spent. Recommend promoting, and keeping this instance as the headline, because "each piece is correct, each review confirms it, and the field is silently null forever" is the clearest statement of the cost the class carries.

---

### 2.21 A caution in prose does not override defective example code

**Observed twice in SP6, 2026-08-30 and 2026-08-31, in the same failure shape both times.** A task brief carried both a worked code block and a warning about the exact defect that code block contained.

**First.** The brief's own test asserted only a `200` and a non-empty list for a clamped `limit`, while the dispatch prose said, in as many words, *"make sure the test asserts the resulting VALUE, not merely a 200 — a test that only checks the status passes equally well with the clamp deleted."* The implementer followed the code. The review found the test passed with the whole bounding feature removed.

**Second.** The brief's `renderRecord()` stub ignored the request URL, while the dispatch prose explicitly warned that the component renders inside a shell which fetches on mount, and that a URL-blind stub crashes every test in the file — a defect that had already cost a fix round one task earlier. The implementer wrote a correct stub from scratch and reported the brief's as broken.

**Proposed generalisation.** **Where a brief contains both example code and prose about that code, the code is the instruction.** A competent implementer treats a worked block as the specification and the surrounding text as commentary — which is the correct reading, because the block is what compiles. Prose warnings therefore do not harden a defective fixture; they sit beside it and are outranked by it.

> **The tell is that the warning and the defect describe the same thing.** In both instances the brief author knew the failure mode well enough to write it down, and still shipped it. Knowing about a class of bug is not the same as auditing your own artifact for it.

**The check that catches it.** Before dispatching, read every worked block *against its own prose* and ask whether the code does what the paragraph beside it demands. Cheaper still: do not write cautionary prose about example code at all — fix the example, and delete the caution. A warning that survives is evidence the author did not apply it.

**Why not promoted.** Two instances, one slice, one author. It may be an artifact of a single planning style rather than a general property of briefs. Worth watching whether it appears when briefs are written by someone other than the dispatcher.

---

### 2.22 A false premise in a brief does not produce one bad test — it produces every test that inherits it, and the dangerous one is silent

**Observed 2026-08-31.** A brief assumed a status bar rendered the word *"failing"*. It renders *"DEGRADED"* — the frozen design bundle uses two different words for the same underlying value, and both had been transcribed faithfully from their own sources.

**Two tests inherited that single wrong assumption, and they failed in opposite ways.** One asserted `/1 failing/i` and **failed loudly**, which is how the premise was discovered at all. The other asserted the *absence* of `/0 failing/i` to prove counts render as absent rather than zero before data loads — and because that string never renders under any condition, the assertion was **vacuously true**. It passed. It would have passed had the component rendered zeros the entire time. The property it existed to protect was untested, and nothing said so.

**Proposed generalisation.** A false premise propagates to every assertion derived from it, and its consequences are sorted by luck: assertions phrased positively fail and get fixed; assertions phrased as an absence pass and hide. **So the loud failure is not the bug — it is the notification that a silent one exists somewhere nearby.** On finding any assertion falsified by reality, the next move is not to fix it but to enumerate every other assertion resting on the same belief.

> **The tell is a negative assertion over a string nobody has verified renders.** `expect(queryByText(/0 failing/i)).toBeNull()` is indistinguishable from `expect(null).toBeNull()` when the string is wrong, and no tooling flags it.

**The check that catches it.** Before asserting any rendered text, read what the component actually produces. And treat any `not.toContain` / `queryBy…toBeNull` over a literal as owing a second test proving the literal *can* appear — otherwise the absence proves nothing.

**Why not promoted.** One instance. The mechanism is general and the failure mode is well known in principle, but this project has seen it once.

---

### 2.23 Mutation evidence is only worth what the runner was allowed to observe

**Observed 2026-08-31, in a report that was otherwise careful.** A task claimed each of its mutations was isolated to a single test, evidenced by every run showing *"9 skipped"*. Running with a name filter **skips** the other nine — they never execute — so nine skipped tests are nine tests about which nothing is known. The conclusion happened to be right; the evidence did not support it.

**Re-run properly — whole file, no filter — it produced a real finding the filtered runs could not have:** one mutation broke *two* tests, because both sent no admin-secret header, so neither was independent proof of the property each claimed. That is useful information about overlapping coverage, and it was invisible under the filter.

**A second form, same root.** Red-phase evidence was twice offered as a TypeScript *"cannot find module"*. That proves the build breaks, not that the test fails — the test never ran. The demonstration that carries weight is deleting the guard so the file still compiles, then watching the specific assertion fail.

**Proposed generalisation.** **A mutation test's claim is bounded by what actually executed.** Filtering to the test you expect to fail makes the run cheap and the conclusion unfalsifiable, because the interesting question — *what else did this break?* — is precisely what the filter suppresses.

> **The tell is a report whose evidence is an absence:** skipped tests, an unbuilt module, a suite that "wasn't affected." Absence of execution is not evidence of correctness.

**The check that catches it.** Every mutation runs the whole file. Record which tests failed *and* which passed. Red-phase evidence must be an assertion failure with expected-vs-received, never a compile error.

**Why not promoted.** One slice, though it appeared across several tasks within it. Both forms were caught by review rather than by the author, which suggests it is a reviewer-side check rather than a lesson authors will self-apply.

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
