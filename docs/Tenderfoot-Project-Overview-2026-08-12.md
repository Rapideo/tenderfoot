# Tenderfoot — Project Overview

**Prepared 12 August 2026 · Written to be read aloud or listened to**

*Audience: Koehler Partners leadership. Assumes no technical background. Where a term of art appears, it is explained the first time it is used.*

---

## Part One — What Tenderfoot is

Tenderfoot is a system that finds government contract opportunities Koehler Partners could plausibly win, and finds them early enough to matter.

That sentence is doing a lot of work, so it is worth slowing down on each part of it.

**"Finds"** means it goes out and collects. It reads the places where government agencies publish the work they want to buy — state procurement portals, the federal system, contract registers — and it brings back everything they published. It does not wait for an email. It does not depend on anyone remembering to check a website on a Tuesday.

**"Opportunities Koehler Partners could plausibly win"** is the harder half, and it is where most of the thinking has gone. There is no shortage of government work being advertised. On a single day in August, the State of Indiana had sixty-one open solicitations. Nine of them were plausibly Koehler work. The rest were stone, dog food, walleye fingerlings, and correctional food service. Finding the nine is the entire problem.

**"Early enough to matter"** is the part most people underestimate. By the time a Request for Proposals is published, the incumbent vendor has usually been positioning for months. They knew the contract was ending. They talked to the agency. They shaped the requirements. The published document is not the start of the race — it is close to the end of it. So a system that only reads RFPs is always arriving late, no matter how fast it reads them.

Tenderfoot is being built to address all three, in that order of difficulty.

---

## Part Two — The problem, in Koehler's own terms

The design work started by naming four problems. They are worth restating, because every significant decision since has traced back to one of them.

**Problem one: opportunities are missed entirely.** Qualified work is published, sits open for three weeks, and closes without anyone at the firm knowing it existed. This is the most expensive failure because it is completely invisible. There is no report that lists the things you never saw. Nobody walks into a Monday meeting and says "we missed four."

**Problem two: finding out too late.** Described above. The incumbent's head start is the single biggest structural disadvantage a smaller firm faces, and it is not a disadvantage of capability — it is a disadvantage of timing.

**Problem three: noise.** Portal alert emails are overwhelmingly irrelevant. The signal is genuinely in there, but extracting it costs an hour a day, and nobody has the hour. So the alerts become wallpaper and then they become a filter rule.

**Problem four: no system of record.** Decisions live in email and in memory. Six months later, nobody can say what was passed on, or why. This matters more than it sounds, because the reasons a firm declines work are the most concentrated statement of what that firm actually is — and they evaporate.

Three numbers from the research make these concrete.

**Of sixty-one open Indiana solicitations on one day, nine were plausibly Koehler work.** That is roughly fifteen per cent, which means eighty-five per cent of any given day's reading is wasted effort.

**The best-matching opportunity found in a twenty-four-month sample had thirty-eight days left when it was discovered** — and it was discovered by a person, reading a portal, by hand, as part of this research. Not by a system. It had been open for weeks.

**Two hundred and thirty-one Indiana contracts expire on a single day this December**, including the entire Medicaid managed care book. Every one of those is a re-compete that nobody has announced yet. That is problem two in its purest form: the information is public, it is free, and it is sitting there four and a half months early.

---

## Part Three — Where the project stands today

The project has moved through three phases and is now in the fourth.

**The specification is written and approved.** It describes what the system does, why, and what it deliberately will not do. It is a substantial document and it has been revised repeatedly as research changed the facts underneath it.

**The visual design is done and frozen.** There is a working prototype — a real, clickable version of the application showing every major screen. It is not a sketch. It carries real solicitation titles, real dollar figures, real deadlines, and it is precise enough that the production system is being built by reading it.

**The research is complete.** Over three thousand federal solicitations were collected and analysed. Seventy-six live Indiana opportunities were catalogued and eleven full document bundles downloaded and read. A hundred and forty closed federal solicitations were gathered for calibration. Two thousand one hundred and sixty Indiana contracts with their expiry dates were pulled from a public register. Every source that might feed the system has been tested, and the ones that cannot be used have been ruled out with reasons.

**Construction has started.** The first slice of the real application is built and working: a database, an application programming interface, and a browser front end, all connected and verified. The second slice — the data model that everything else depends on — is roughly half complete as of today.

To put that in plain terms: **the thinking is done, the design is done, the research is done, and the building has begun.**

---

## Part Four — How we got here, and why the order mattered

This is the part I would most encourage leadership to pay attention to, because the sequence was not accidental and it is repeatable.

The project followed a documented method. Not one invented for this project — one recovered from a previous successful build and written down as a playbook, so it can be run again on the next thing.

**The first step was a specification, not a design.** Before anything was drawn, the questions answered were: what problem is this solving, for whom, and what will it deliberately not do. That last part matters more than it seems. A system that tries to do everything is a system nobody can finish.

**The second step was a screen outline.** Not pictures — a written structure. Every screen, every view within it, what each is for, what is still undecided about it, and how confident we are. It carries a scoring grid so that effort, importance, and priority are recorded rather than argued about later.

**The third step was a prototype, generated from that outline.** This is where something unexpected happened, and it is the most interesting process finding of the project.

The prototype was produced in a design tool, working from the written outline. It came back covering nearly every screen — and it had *opinions*. It had made decisions the outline had left open, because you cannot draw a screen without deciding things a written outline can leave vague.

Some of those decisions were better than what we would have written.

The outline had said, in effect, "we do not know what order the queue should be in, and ranking by score is probably wrong because it puts all the easy decisions first and leaves the hard ones for when you are tired." It offered no alternative. The prototype shipped an ordering called *ambiguity first* — genuinely hard cases at the top — **and made it switchable**, so the user picks. That is a better answer than the one we were reaching for, because it stops trying to settle an argument that has two right sides.

There were five more like it. In each case the written document had named a gap, and the artifact filled it.

**The fourth step, and the one that turned this into a method rather than a happy accident, was auditing what the prototype had decided.** Every screen was scored against the outline's own record of what was unresolved. Twelve decisions surfaced that no person had made. Nine were reviewed and ruled on. Four were adopted as improvements, four were promoted as genuinely new ideas nobody had asked for, and three were deliberately left open — recorded as *unratified*, so that silence could not be mistaken for agreement.

That last distinction is the important one, and it generalised into the playbook as a rule:

> **The risk is not that the prototype makes a wrong decision. The risk is that it makes a right one that nobody notices.**

A wrong decision drawn on a screen gets argued with, because you can see it. A right one gets adopted by inheritance — and the written record then shows an open question that was never closed, sitting next to an implementation that closed it.

**The fifth step was refining the outline with what the prototype taught us**, which is where the project is now feeding forward into construction.

The whole arc is: **specify, outline, generate, audit, refine, build.** The generation step is cheap and fast. The audit step is what makes it safe.

It is worth being explicit about why this order works, because the obvious order is different and worse.

The obvious order is to design the screens first, because screens are the thing people can react to. The trouble is that a screen shown to a stakeholder invites feedback about the screen. Colour, spacing, wording. Meanwhile the questions that actually determine whether the project succeeds — what is in scope, what the system is forbidden from doing, what happens when two sources disagree — never come up, because nobody can see them.

Writing the specification first forces those questions to be answered while they are still cheap. Every one of the seven decisions described in the next section was made in a document, not in code. Several of them removed work. One of them removed an entire subsystem.

And writing the outline before the prototype means the prototype has something to be measured against. Without it, a generated design is just a design — you like it or you do not. With it, the design becomes *an answer to specific questions you had written down*, and you can grade it question by question. That is what turned a good-looking prototype into a source of eight concrete decisions rather than a mood board.

**This same sequence is now running on a second project.** The pattern held there too: very little starting information, extrapolated into a structured screen outline, generated into a prototype, and then fed back into refining the outline with what the prototype revealed. Two projects is not proof, but it is the difference between a method and an anecdote — and it is the reason the playbook is maintained as a separate document rather than living inside either project.

The playbook itself has gained three new sections during this project. One on choosing between design tools and writing code directly. One on extracting a usable specification out of a generated artifact. And one on auditing the decisions that artifact made on your behalf, which did not exist as a concept anywhere before this month.

---

## Part Five — The decisions that shaped this project

There are seven decisions worth understanding. Most of them were made in the last few days, and several of them made the project smaller and more likely to succeed.

### Decision one: the first version returns everything

This is the biggest decision in the project and it deserves the most explanation.

The original design had a matching engine at its heart — a scoring system that would read each opportunity, compare it against a profile of what Koehler does, and rank the results. Four separate scores: can we do this work, can we realistically win it, what is it worth, and is there enough time.

**That entire layer has been parked.** The first version of Tenderfoot returns everything every active source returns. No ranking. No scoring. No filtering. If a source is switched on, everything it publishes reaches the user.

The reasoning has four strands.

**First, only one of the four problems is a matching problem.** Missing opportunities entirely, and having no system of record, are solved by collecting and showing. Finding out too late is solved by watching contract expiry dates. Only *noise* needs a scorer. So returning everything addresses three of four immediately.

**Second, it addresses the most important one more completely than any scorer could.** Missing things entirely is the first-named pain. And a system that returns everything cannot have a recall problem. It is not possible for it to silently drop something, because it drops nothing.

**Third, every filter is a silent-loss mechanism.** This is the deepest risk in the whole design. If a scoring system wrongly discards a good opportunity, nothing reports it. There is no error, no alert, no line in a log. It simply is not there. Building a scorer on top of a collection layer that has never been verified means debugging two things at once, one of which is invisible.

**Fourth, and most decisive: nobody knows what these sources actually produce.** Not the volume per week. Not the composition. Not the duplication rate. A matching system designed now would be designed against a guess about a distribution nobody has measured.

So the first version is deliberately an instrument. **It measures the problem that qualification exists to solve, and that measurement becomes the input to designing it.**

The cost is stated plainly and accepted: **problem three, the noise problem, is untouched.** If the sources turn out to be loud, reading them is real work and the tool will initially feel like the portal alerts it was meant to replace. That is a known trade, made knowingly, and the position is that the volume is a finding worth having rather than an assumption worth making.

One consequence follows from this and it changes how success is measured. With everything returned, *precision* stops meaning anything — it is just the base rate of the sources, because the system made no selection to be judged on. The measure that survives is **discovery**: how much of what surfaced was work Koehler would pursue and had not otherwise seen. That is a better measure anyway, because unlike precision it cannot be improved by showing less.

### Decision two: the hand-run was retired

A large piece of planned work was cancelled outright.

The plan had called for a *hand-run*: scoring a corpus of two hundred and sixteen real solicitations by hand, marking each would-bid, would-not-bid, or unclear, to establish whether a human expert could reliably separate good fits from bad ones. If a person could not do it, no software would.

With the matching engine parked, that test had nothing left to test. It was retired permanently — not deferred.

**Two things died with it, and both were recorded rather than absorbed.**

The *negative profile* — the record of what Koehler will never bid and why — lost its last source. Past proposals were already unavailable. The hand-run was the fallback. That field now stays in the system and stays empty until real decisions accumulate.

And **inter-rater agreement will never be measured.** The plan was for two people to score the same rows, because the rate at which two experienced people disagree is the ceiling on how accurate any system can be. That number will now never exist, which means when qualification is eventually designed, the question *"how much better than two disagreeing experts does this need to be?"* has no answer.

Both are recoverable — the corpus is still there and still scoreable — but neither happens by default now.

### Decision three: the prototype is reference-only, and it represents the finished product

The prototype is never edited. Code is copied *out* of it into the production system; nothing is ever changed inside it. New versions arrive as new files alongside the old ones, and the difference between versions is itself information.

Crucially, **the prototype shows the finished product, not the first version.** It includes the scoring layer that has been parked. That is deliberate. It is the demonstration artifact — the thing shown to people to explain what this becomes. The first release builds a subset of it.

This creates a specific obligation that has been written into the specification: **the front end must match the prototype exactly.** Same structure, same spacing, same colours, same wording. Button labels and micro-labels are copied verbatim, because several of them carry an argument. The phrase *"Cost to pursue — facts, not a score"* is not decoration; it is a design position about what the machine is allowed to judge.

There is an escape hatch, and it exists because a rule with no escape hatch gets quietly broken. Certain deviations are pre-authorised — real data replacing sample data, working links replacing placeholders, accessibility improvements. Anything else has to be written down and justified. The reasoning is that compliance becomes easier than the paperwork of deviating.

### Decision four: the system is capacity-agnostic, and that rule binds the machine, not the person

This one is subtle and it took a correction to get right.

The specification says the system must never consider whether Koehler has the capacity to take work on. It does not model headcount as a workload limit, or how many pursuits can run at once, or when current engagements end.

The reason is precise: **an opportunity suppressed because the calendar looked full is a miss that never appears in any report.** It is invisible by construction, and recall is the first-named pain.

The prototype included a reason button reading *"Capacity — too large,"* which appeared to contradict this directly. It looked like a defect.

It was not. **The rule binds the system, not the user.** A person looking at a five-million-dollar solicitation is entitled to conclude it is too big for the firm right now, and the record *should* capture that — it is frequently the true reason, and a system of record that cannot hold it is misrepresenting why things were passed on.

The actual defect was elsewhere: the original design had every recorded reason automatically becoming a training example for the scorer. **That is what silently converts one honest human judgment about this quarter into a standing machine preference against large contracts.**

So the rule was rewritten as a constraint on data flow rather than on vocabulary: *a recorded capacity judgment is a journal entry, and may never become model input, a score, a weight, a filter, or a learned rule.* Nothing is forbidden from being said. The machine is forbidden from consuming it.

### Decision five: mechanical and smart are separate, selectable modes

This came from a question about how the system should extract information from documents — with hand-written rules, or with artificial intelligence.

The answer that emerged is better than either: **both, as first-class options within the application, chosen per action.**

The value is not flexibility for its own sake. It is that **it makes comparison possible.** Every extracted piece of information already carries a confidence level and a pointer back to the document it came from. Adding a record of *which mode produced it* means the two approaches can be measured against each other on the same hand-checked set of documents.

There is one condition the whole idea rests on, and it is now enforced by the database itself: **the mode has to be recorded in the data, not merely set in configuration.** A piece of information that does not remember how it was produced cannot be compared against one produced the other way. Without that, this is a preference toggle. With it, it is an experiment — and it is the only mechanism that could ever justify what the artificial intelligence path costs.

It also makes the sequencing permanent rather than transitional. *Stay mechanical as long as we can, then get smart* stops being a phase the project eventually exits, and becomes something the system expresses — including the ability to revert an action to mechanical where the smarter version did not earn its cost.

### Decision six: a standing rule for legal access

This one arose from a genuine surprise during the source research and it now governs every future source.

Michigan's procurement system displays a banner stating it is *"intended for government authorized users only"* and instructing unauthorised users to disconnect. The pages render without a login, so it would have been easy not to notice. Work stopped on the spot, the language was reviewed, and a decision was made by a person — the reading being that authorisation comes from holding a vendor account, which Koehler has or has had.

Out of that came a rule that makes the question decidable once per source rather than re-argued every time:

> **Ambiguous or restrictive terms default a source to *out*. Documented permission moves it to *in*, and the evidence is recorded on the row.**

The argument is that the costs are not symmetric. Being wrong in the *out* direction costs a source you could have had, and is fully recoverable — you switch it on later, exactly as Michigan was. Being wrong in the *in* direction means systematic automated access to something off-limits, at volume, on a schedule, for months before anyone notices. That is not recoverable.

There are three postures, not two: **in**, **manual-only** — a person may read it but no automated access, which is where Ohio sits because of its bot-detection gate — and **out**, which is where the paid aggregator services sit, excluded by their own terms.

This rule is now enforced by the database. A source cannot be marked with a posture that is not one of those three, and the system will refuse to change a posture without a recorded reason.

### Decision seven: the technology

The system is being built on the same technology as Koehler's other active software project, which is worth real weight on its own — one set of conventions, one debugging vocabulary, and components that can move between the two.

Parking the matching engine made this decision dramatically simpler. Everything exotic fell away. What remains is ordinary: a database, a scheduled collector, a document reader, and a web application.

The database is a single file on disk. For one user, batch collection, and no uptime requirement, that is not a compromise — it is genuinely better than a hosted database. No infrastructure, no credentials, and backup is copying a file.

**That decision has a known expiry date, and it has been written down rather than left to be discovered.** When the system moves to running collection automatically every day, a closed laptop does not collect anything. That is the point at which hosting becomes a real question. The previous project this playbook came from went down thirteen days after launch because of exactly this class of problem — a documented property of the platform that nobody had written down.

---

## Part Six — What the prototype decided, and what we did with it

The audit described earlier produced twelve decisions that no person had made. Nine were ruled on. It is worth walking through what they were, because they are a good illustration of where machine-generated design helps and where it must not be trusted.

**Four were adopted because the artifact answered a question we had asked.**

The queue ordering, described earlier — *ambiguity first*, and switchable. The written outline had argued against ordering by score and offered nothing in its place.

Every score now displays which version of the scoring system produced it. The outline had noted this was missing and had no plan for it. When scoring returns, this is what makes it possible to tell whether a change improved anything.

The requirement to record a reason when declining an opportunity was relaxed from an absolute rule to a default that can be switched off. The written specification had stated it absolutely. In practice, a queue of forty items where three are obviously irrelevant should not stall on a mandatory text box. The cost of switching it off was written down alongside it: a firm that disables it silently forfeits the record that any future learning would be built from.

And the pursuit lifecycle gained a stage. It had been *watching, bid or no-bid, submitted, won or lost*. The prototype added **drafting** — the gap between deciding to bid and actually submitting. That is where pursuits genuinely die, and the original had no state for it, meaning a decided-but-unwritten proposal was indistinguishable from one nobody had started.

**Four were promoted because they were genuinely new — nobody had asked for them.**

The most valuable is a per-buyer **incumbent retention rate**: how often this agency re-awards to the sitting vendor, shown as a plain fraction. Nine out of eleven means something very different from four out of nine, and it answers the question that decides most bid decisions *before any scoring happens at all*. It is computed from award history rather than judged, and it is arguably a stronger predictor than anything in the original scoring design.

Alongside it, a per-buyer **procurement cycle** — roughly how often this agency competes its work. That generalises the contract-expiry idea to agencies where no current contract is on file, which is most of them.

Vendor records show the alternative spellings that were merged into them, and say *"no aliases found"* when nothing was merged. That distinction matters: it separates *this company has one name* from *nobody has checked*.

And extracted information now distinguishes **absent** from **uncertain**. "We looked and it is not there" is a different fact from "we are not sure what we read," and collapsing them is how a missing contract ceiling quietly becomes a guessed one.

**Three were deliberately left unresolved**, and recorded as such so that silence could not be taken for agreement. Whether saved searches are a lightweight filter or a first-class object the user manages — the prototype drew the second, which is the larger commitment, and nobody chose it. Whether a suspected source failure belongs in permanent screen furniture. And what the empty-queue screen should say.

The general lesson, now in the playbook: **a generated artifact produces excellent data and never produces a rule.** It will invent a plausible list of reasons for declining work; it cannot know that one of those reasons contradicts a rule written in a specification three weeks earlier. It will draw a beautiful screen; it cannot know which of its choices were decisions. Finding those is human work, and it is the work that makes the speed safe.

---

## Part Seven — What the research found that we did not expect

Five findings materially changed the project.

### The market is thinner than assumed, and that is a finding rather than a defect

Across three thousand three hundred and fifty-seven federal solicitations collected in the initial research, **not one was an Indiana state or local opportunity.** That is not a collection failure — it is what the federal system contains. It reframed the whole geography question and pushed the project toward state-level and contract-level data.

Similarly, the fifteen per cent relevance rate on Indiana's daily postings is not noise to be engineered away — it is the actual shape of the market, and any system claiming otherwise is claiming too much.

### Government systems accept instructions and silently ignore them

This is the most operationally important discovery of the project, and it has now been confirmed **four times across three completely independent systems.**

The federal system accepts a sort instruction and ignores it. Indiana's contract register accepts date filters and ignores them — in four different spellings. Michigan's portal offers a filter with options including *All* and *Recent Awards*, and returns identical results for every one of them.

None of these systems return an error. They return a plausible-looking result set that is quietly wrong.

The consequence is a discipline that is now built into the process: **when adding a source, vary one parameter and watch the total move.** If the number does not change, the parameter is being ignored. That check is recorded per source. Where it cannot run — Michigan withholds result totals entirely — that fact is recorded too, because it means the source needs a different health signal.

An early version of this project's own data collection was affected: a pagination bug caused by sorting on one date field and stopping on another silently dropped about a third of a data pull. It was caught only because a spot check on one category returned one result where a hundred and sixteen were expected.

### A single real document bundle nearly caused a serious miss

The best-matching opportunity found in the entire research corpus — a Medicaid quality review contract for Indiana's Family and Social Services Administration — ships a bundle containing **three documents carrying two different submission deadlines.**

The correct date lives in the file with the least specific name. The file named after the solicitation number carries a date three weeks early.

Every obvious rule for picking the right file picks the wrong one.

Acting on the stale date would have closed out the firm's strongest prospect three weeks before it actually closed — silently, with nothing to indicate it had happened. This one document is now the reason the system displays disagreements between sources rather than resolving them, and it is the test case that the extraction work will be measured against.

### Illinois retains eight years of closed solicitations, with outcomes

The specification had assumed that historical testing was only possible on federal data, and that every state would have to be evaluated using contract records instead.

That assumption was wrong. Illinois publishes **two thousand one hundred and fifty-five closed solicitations, going back to February 2018, anonymously, with the winning vendor shown on each row.**

This was verified rather than assumed — the filter was tested by watching the result count move, precisely because of the silent-ignore problem described above.

Illinois sits in Koehler's secondary geography, and the same platform is used by several other states. This is the single most useful research finding of the project.

### A note on how these were established

None of the findings above came from documentation. Every one came from testing the systems directly, and the method is worth describing because it is now standard practice on this project.

**Facts are established by varying one thing and watching a number move.** If a filter is applied and the result count does not change, the filter is being ignored — regardless of what the interface implies or the documentation claims. Two requests establish it.

**Nothing is trusted because it appeared in a dropdown.** The Illinois discovery is the clearest example. The advanced search offered a status filter with *Closed* among its options. That proves nothing on a platform that might accept and ignore it. So the filter was applied while constrained to open bids only, which returned zero — an empty intersection, which proves the parameter is genuinely honoured — and then applied unconstrained, which returned two thousand one hundred and fifty-five.

**Where a check cannot run, that is recorded too.** Michigan withholds result totals entirely, showing *"twenty of twenty-plus records."* With no number to watch, the standard verification is impossible there. Rather than assume the source is fine, the registry records that its health has to be inferred some other way.

**And corrections are made in place rather than quietly.** During this research a source was recorded as offering deep award history, on the strength of a count of three thousand seven hundred and sixty-two records. Reading the columns afterwards showed those were grant disbursements to counties and conservation districts, not procurement awards. The record was corrected the same day and the error noted, because a number taken at face value is exactly how a wrong assumption gets built on.

### The contract expiry data is real, free, and already collected

Indiana publishes a register of two hundred and four thousand contracts going back to 2005. No account, no licence, no scraping — a public interface.

From it: **two thousand one hundred and sixty contracts expiring within eighteen months.** Two hundred and thirty-one of them ending on the thirty-first of December this year, across a hundred and forty-nine vendors, including the entire Medicaid managed care book — Anthem, MDwise, Coordinated Care, CareSource, the pharmacy benefit administrator, and the payment processor.

One of those is worth naming. **Milliman holds a professional services contract with the Family and Social Services Administration for designing and modelling the service delivery model for the transition from fee-for-service Medicaid to managed care.** That is a consulting engagement, not an insurance contract, and it describes Koehler's service line closely. It expires on the same date as everything else.

That is the pre-RFP capability working before it has been built.

---

## Part Eight — What has actually been built

Two slices of construction are done or underway.

**The first slice is infrastructure**, and it is complete and verified. A web front end that loads in a browser, an interface layer it talks to, a database it reads from and writes to, migrations that create the structure and can be run repeatedly without damage, and a single command that checks all of it.

It sounds modest, and it is meant to. Its entire purpose is that when real data arrives, the plumbing underneath is already proven.

**It found three defects in doing so**, all of which would otherwise have shipped silently. The most instructive: a command that appeared to work — exit code zero, no errors, tests passing — and did nothing at all. It was caught only because the plan specified what the command should *print*, not merely that it should run. That lesson has been written into the playbook: **verify against expected output, not against exit status.**

**The second slice is the data model**, and it is roughly half done. Eleven objects now exist in the database — the organisations that buy, the vendors that sell, Koehler's own profile, solicitations, awards, contracts, sources, sightings, documents, assessments, and pursuits — with the relationships between them enforced by the database rather than by convention.

Three of this week's decisions are now enforced in the structure itself. A source cannot have an invalid legal posture. A piece of extracted information cannot record an invalid production mode. A pursuit cannot enter a state that does not exist.

**And the source registry is seeded with the research.** Eleven sources, each carrying its legal posture, the evidence for that posture, its archive depth, and the record of which of its parameters were verified to actually work. None of them is switched on yet — that is a later, deliberate act.

---

## Part Nine — What happens next

The work is organised into slices, each ending in something demonstrable.

**Finishing the data model** is the immediate task: Koehler's own profile as data rather than as code, an interface for reading and editing sources and the profile, and loading the real research corpus into the real structure.

**The design system** comes next — turning the frozen prototype into reusable interface pieces. This should be unusually cheap, because the colours and dimensions have already been extracted from the prototype and verified. It carries a sign-off gate: the visual language is approved once, formally, before screens are built on it.

**Then collection**, starting with the federal sources, which are the best documented and the most permissive. This is the first slice that touches a live source, and two things must exist before it runs: a collection window so a first run cannot pull two years of data by accident, and a rule that a source with no window configured refuses to run rather than defaulting to everything.

**Then documents and extraction.** This is the hardest technical problem in the first version, and it is where the largest remaining decision sits. Bundles reach twenty-one megabytes across five file formats, and the most important document for judging fit is frequently a Word file rather than a PDF. With no scoring in the first version, **extraction accuracy is the only thing the system can be right or wrong about.**

**Then triage** — the daily working screen, and the point at which the project is honestly evaluated. This is the go or no-go gate. The question it answers is: does reading everything from active sources surface work Koehler would pursue and had not otherwise seen?

It is worth being precise about what that gate measures, because it changed when the matching engine was parked.

It used to ask whether the scoring system's top results were accurate enough. It now asks something more fundamental and, arguably, fairer: **is the collected material worth reading at all?** That question can be answered without any judgment layer, and it has to be answered before building one is sensible. It also cannot be flattered by a scoring system tuned to look good.

Two numbers come out of it. **Discovery** — how much of what surfaced was work the firm would pursue and had not otherwise seen. And **volume** — how much arrives per source, per week, which is the number nobody currently has and which determines whether qualification is urgent or academic.

A negative result there is a legitimate outcome, and it has been accepted in advance. If the answer is that the market simply does not contain enough winnable work, that is worth knowing after a few weeks of building rather than after a year — and it would be a finding about the market rather than about the software.

**After the gate**, and only after it: automatic daily collection, and the radars — the contract expiry watch and the teaming radar that identifies prime contractors carrying participation goals on work Koehler could subcontract.

---

## Part Ten — The risks, stated plainly

**Volume is unmeasured.** If the active sources turn out to publish hundreds of items a week, reading them is real work and the first version will feel worse than the portal alerts it replaces. This is the known cost of returning everything, and the measurement is the point.

**Extraction is the whole quality story.** With no scoring, everything rests on reading documents correctly. The chosen technology is weaker at this than the alternatives, and the decision about how to close that gap has not been made.

**Sources decay quietly.** Four confirmed instances across three systems of instructions being accepted and ignored. The defence is the parameter check and per-source health monitoring, and it must be maintained rather than built once.

**The deployment approach has a known expiry.** Running on a single machine is correct now and stops being correct the moment collection needs to happen daily without someone present.

**Two states are cleared on a reading, not a ruling.** Michigan and Kentucky are in use based on a reasonable interpretation of an ambiguous banner. If challenged, both come out, and the platform work covering them pauses.

---

## Part Eleven — What is still open

Four decisions are outstanding and none of them is blocking current work.

**How documents get read** — hand-written rules, a separate specialised component, or artificial intelligence. Needed before the extraction slice.

**The priority review.** The screen outline carries importance and priority scores that were originally placeholders, and adoption quietly turned them into an input to build order. They need one review pass with that consequence in mind.

**User stories** — a written set of "as a user, I want to, so that" statements. These do not exist yet and have no stand-in.

**Three smaller technical choices** — where large documents are stored, whether each client firm gets its own database file, and whether the first version needs a login at all.

---

## Part Twelve — What I would want leadership to take away

**The scope got smaller on purpose, and the project got more likely to succeed as a result.** Parking the matching engine removed most of the technical risk, most of the exotic infrastructure, and the entire class of failures that are invisible when they happen. What is left is ordinary software solving a specific problem for a firm that has that problem.

**The expensive things have already been found.** The bundle with two deadlines. The systems that ignore instructions. The market being thinner than assumed. The contract data being free and already available. Every one of those would have been a nasty surprise in month four. They are all findings from week one, and they are all written down.

**The process is repeatable, and it is being written down as it happens.** The playbook this project follows was recovered from a previous successful build, and it has gained several sections during this project — on how to work with a generated prototype, on auditing decisions an artifact made for you, and on writing verification steps that can actually fail. The next project starts from a better playbook than this one did.

**The honest positions are written down alongside the optimistic ones.** This document names four risks, four open decisions, and two things that died when the hand-run was cancelled. That is deliberate. A project record that only contains good news is a record that cannot be used for decisions, and the point of keeping one is that somebody can pick it up in six months and understand not just what was chosen but what was given up to choose it.

**And there is something usable today, before any software ships.** The contract expiry data is collected. The December cliff is real. The Milliman engagement is a professional services contract in Koehler's service line, visible four and a half months before anyone will publish an RFP for what replaces it. That is the entire thesis of the project — arriving early — demonstrated by hand, with public data, at no cost, before a single line of the collection system was written.

---

*Prepared by Claude for Matt Smith, Koehler Partners. Every figure in this document traces to collected data or to a recorded decision; nothing is estimated. Source material is in the project repository.*
