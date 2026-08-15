# Tenderfoot

**Tenderfoot SVRC — version 0.6.0, 2026-08-14.**
**Adopted.** This is the working outline, not a draft.

> ### Eight decisions adopted from the prototype — 2026-08-12
>
> Matt, reviewing the `Proto` audit: *"the prototype fleshes out details that aren't specified. Sometimes they're wrong, sometimes they're right, but that's exactly why we're doing this review process."* The method is now written up as `docs/Proto2PRD.md` §4.7.5.
>
> **Four ratified** — the prototype answered a question this document asked, and the answer stands: queue ordering (View 1.1, and *switchable* is the part worth having), scorer version stamped on every score (View 2.2), reason-on-Pass demoted from law to default (Region 1.1.4), and `Drafting` added to the pipeline state machine (Screen 7).
>
> **Four promoted** — net-new, asked for by nobody: per-buyer incumbent retention and procurement cycle (View 4.1), vendor aliases with an explicit *"no aliases found"* (View 4.2), absence distinguished from low confidence (View 2.3), and the timeline recording entity-resolution decisions rather than only document changes (View 2.5).
>
> **~~Three left open deliberately~~ — ALL THREE RATIFIED 2026-08-13 by Matt.** They were held open for two days precisely so silence could not adopt them; they are now adopted **by decision**, which is the only difference that matters.
>
> | | What the prototype did | Ratified |
> |---|---|---|
> | **View 1.2 — saved views** | A **first-class object**: named views, counts, a create affordance | ✅ **Confirmed.** The node asked *filter or first-class object?* and flagged the second as a much larger commitment. **It is a schema decision wearing a UI costume** — a first-class object needs storage, naming, editing, deletion and eventually sharing; remembered filter state needs one blob. Taken with eyes open |
> | **Region A.2 — rot in the chrome** | `1 ROT SUSPECTED` in words, in the persistent status bar | ✅ **Confirmed.** The node asked whether a silent-failure suspicion belongs in persistent chrome at all. **It does, and the reason is V1's entire failure mode:** a source quietly returning less than it used to. Persistent chrome says *this interrupts you*; a settings screen says *this is administration*. Those are different products |
> | **View 1.3 — the cleared state** | Points at the expiration radar: *"3 contracts expire inside your sectors"* | ✅ **Confirmed.** Makes the radar the natural next action after triage, which **promotes it from a reporting feature to part of the daily loop.** That is a real claim about how the product is used, and it is now a claim we are making on purpose |
>
> **The `Proto` scores were filled before these decisions and are unaffected by them** — they measure distance from what we wanted at the time of V1.1, and adopting a prototype behaviour does not retroactively make the artifact more faithful.
>
> **Nothing changes in the prototype.** Ratification confirms what it already drew; had any been overturned it would have become a V1.2 punch item instead. **SP2 now builds against three decided answers rather than three provisional ones**, which was the point of asking before it starts.

> ### V1 has no scores — read this before the screen tree
>
> **Decided 2026-08-11.** The application returns everything every active source returns: no ranking, no scoring, no filtering (spec §1.1). Qualification is parked and will be re-imagined after ingestion runs.
>
> **Three nodes below describe machine judgment and are therefore parked**, not cut: Region 1.1.2 (Score Strip), View 2.2 (Scores and Evidence), and Region 1.1.5 (Gated Items Drawer). **Each carries a bold `PARKED` marker above its grid** — ruled 2026-08-14 and written into the scoring key. Grids stay filled and `Imp`/`Pri` stay true, because they are judgments about the finished product. **Planning excludes these nodes by the marker, not by the number.**
>
> ~~Read their `Pri` as zero for V1.~~ **Superseded, and it was wrong rather than merely fragile** — it asked a reader to mentally rewrite a number that was never zero. The priority is not zero; the node is outside V1's scope.
>
> **Parked for V1, not removed from the product.** Matt, 2026-08-11: the prototype represents the final released product and serves as demo material, and it renders all three of these. **This outline describes the destination; V1 builds a subset of it.** So these nodes are not candidates for deletion in a later revision, and a Design iteration that develops them further is on-plan rather than scope creep.
>
> **What replaces them in V1 is already in this document and needs no new nodes.** Region 1.1.1 (the four deciding facts), Region 1.1.3 (the pursuit-cost fact panel), Region 1.1.4 (the decision bar), and View 2.3 (extracted fields) carry the entire triage screen on their own. That is worth noticing: **the outline survives the removal of the scoring layer largely intact**, which suggests the screens were built around facts and decisions rather than around scores.
>
> **One node gets more important, not less.** View 2.3, Extracted Fields. With no scores, extraction accuracy is the only thing V1 can be right or wrong about (§8.4), and this is where a person sees it.

> **Adopted 2026-08-10** (Matt), pending small edits. It was drafted by Claude from the design spec and used to generate the first prototype direction before adoption — which is the strongest thing that can be said for it: **it was precise enough to build from.**
>
> Three things a reader still needs to know.
>
> ~~**`Imp` and `Pri` were placeholders and are now load-bearing.**~~ **REVIEWED IN FULL 2026-08-14 by Matt — all twenty nodes. `Imp` and `Pri` are now rulings, not proposals.** They had been filled by Claude because the scoring key forbids a half-filled grid, not because they were known, and adoption had quietly promoted them from guesses to inputs. **Fourteen of the twenty moved.** `Eff` remains a Claude estimate; `Conc` reflects how settled the spec is.
>
> **The two largest errors were not the ones flagged in advance, and they point the same way.** `Shell A` and `Region A.1` both carried `Pri 5` — the old *"build this first"* definition that Q1 had already outlawed on 08-13, still sitting in the values a day later. **Q1 changed what the column meant and nobody re-read the twenty numbers against the new meaning.** The five nodes flagged before the pass were all *too low*; nobody had thought to look for *too high*.
>
> ~~**`Proto` is stale everywhere.**~~ **Filled 2026-08-12 against V1.1**, **re-pointed 2026-08-13 to V1.2**, by driving the bundle and comparing each node's `Overview` and `Known gaps` to what is actually drawn. **Mean 85.2%; thirteen of twenty at 90% or above; nothing below 55%.**
>
> **Only one node moved, and the re-score cost minutes rather than a day.** V1.2 changed six lines — deleting the wordmark placeholder and its now-single-child wrapper — so `Region A.1` went **70% → 95%** and the other nineteen nodes were confirmed unaffected by diffing the bundles rather than re-reading them. **That is the argument for re-scoring at every freeze**: against a surgical change it is nearly free, and skipping it is how the column silently stops describing anything.
>
> Three nodes score low and all three for the same honest reason — *the prototype declines to draw what has not been decided.* View 2.4 renders `DOCUMENT RENDER — PLACEHOLDER` and states the undecided question on the screen. That is not a shortfall; it is the artifact refusing to invent a decision. **Scored as a gap anyway, because `Proto` measures distance from what we want, not the prototype's good judgment.**
>
> **This column goes stale on every prototype iteration.** V1.3 will invalidate it. Fill it once at each freeze rather than continuously — and V1.2 showed the cost of doing so scales with the size of the diff, not the size of the outline.
>
> **The register is plain, deliberately.** IDE8's SVRC is dictated in Matt's voice, and its hedges carry which decisions are settled — the 0.2.0 revision note there says so explicitly. Writing Tenderfoot's in that voice would have made a guess indistinguishable from a ruling. Now that it is adopted, edits in his own voice are the natural next layer.
>
> **Everything traces to the design spec.** Every Overview comes from `docs/superpowers/specs/2026-08-03-tenderfoot-design.md` §7 and the component inventory in `reference/Tenderfoot - Concept Outline.md`, cited inline as `§x.y` and component IDs like `4A`. Where something was invented rather than derived, the node says so in Open questions.

# Overview

Tenderfoot finds government contract opportunities Koehler Partners could plausibly win, and does it early enough to matter. The application is where a person decides. Everything upstream — adapters, extraction, scoring — exists to make a ten-second decision possible and well-informed.

The shape of the product follows from one asymmetry: **the expensive part is not finding documents, it is judging them**, and judging cannot be automated away because there is no bid history to learn from (§8.2). So the app is built around capturing judgment cheaply and repeatedly, and around showing enough evidence that the judgment is fast.

There are six screens plus a shell. Five use the shell; the triage queue uses a reduced variant of it, for reasons recorded on that screen. One screen — the pipeline board — is specified and deliberately not built, because pursuit *management* is deferred to a later phase (§9) while pursuit *seeking* is the current project.

A note on what is missing from this outline by design. The scoring engine, the adapters, the entity graph, and the backtest are the bulk of the work and appear nowhere below, because they have no UI. `docs/Tenderfoot-Plan-of-Action.md` §6 carries them. This document is only the part a person looks at.

#######################################################

# Shell A

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 2   | 4   | 3   | 2   | 90%   | 70%  |

**Overview** — The persistent application frame. Tenderfoot is a small app with a strong daily habit attached to one screen, so the shell's job is mostly to stay out of the way and to make the queue count visible from anywhere. It is scored as a parent because it says something its regions do not: it is built once, early, and everything else assumes it.

**Known gaps** — Navigation model is unsettled. Six screens is too few for a sidebar and too many for a flat header bar, and I have assumed a header. If the area outline disagrees, this is the cheapest thing in the document to change.

**Open questions** — Does Tenderfoot need authentication in the first version? It is an internal tool with one customer and, eventually, a portability story (§1). Single-user with no login is defensible now and expensive to retrofit later.

## Region A.1 : Main Header — side: top

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 2   | 4   | 3   | 2   | 95%   | 90%  |

**Overview** — Wordmark, primary navigation, and the queue counter.

**Known gaps** — ~~The wordmark does not exist.~~ **CLOSED 2026-08-13 against V1.2.** `Proto` **70% → 95%**, `Conc` 75% → 90% — this node was the outlier, and the wordmark placeholder was the entire reason.

> **The wordmark existed the whole time; only its label said otherwise.** V1.1's header carried a finished lockup — a 22×22 rounded square with a 1.5px accent border containing an 8×8 accent square, beside `TENDERFOOT` in IBM Plex Sans 600 / 13.5px / `.16em` — with an 8px mono line beneath reading `WORDMARK — PLACEHOLDER`. **The placeholder was announcing the mark next to it as provisional.** V1.2 deletes that line and the now-single-child wrapper; nothing else in the lockup moved.
>
> **The mark is a checkbox.** 22×22 outer at 3px radius, 8×8 filled centre at 1px radius — the exact geometry of a checked checkbox elsewhere in this design, which is why `--radius-mark` is commented *"the 8×8 inner square of a checked box."* For a product whose whole job is *take this one, pass on that one*, that is a good mark. **It was nearly redesigned away:** the punch item read "replace with a real mark," and a Design round given that instruction would very likely have thrown it out. It survived because the header was read rather than inferred from its own placeholder text.
>
> **Not 100%**, because §A1.1 still frames the mark as an *output of a design bake-off* that never ran with N>1. The mark is good and adopted; it was never comparatively chosen. That is a five-point gap between *this is right* and *this was selected*.

### Region A.1.1 : Wordmark

Tenderfoot's own mark. Not KP's. See §A1.1 of the plan of action for why this is a rule and not a preference — no fact about Koehler Partners appears in the product, and a KP-branded header was the largest remaining violation of that.

### Region A.1.2 : Primary Nav

Triage, Opportunities, Radars, Entities, Reports, Admin. The pipeline board joins this list when the management phase starts and not before.

### Region A.1.3 : Queue Counter

How many opportunities are waiting. This is the single most important element in the shell, because the working habit the whole system depends on is **"clear the queue"** (§7.1), and a count that is visible from every screen is what makes a queue reaching zero feel like an accomplishment rather than a coincidence.

It should show zero proudly. An empty queue is the goal state, not an empty state.

## Region A.2 : Status Bar — side: bottom

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 2   | 4   | 4   | 3   | 90%   | 60%  |

**Overview** — Ingestion health at a glance: when adapters last ran, and whether any are failing.

**Known gaps** — What counts as "failing" is not defined anywhere yet. §5.4 specifies rot detection — an adapter that returns plausible results for a query it is silently ignoring — and we now have three confirmed live instances of exactly that on two different government APIs (`corpus/manifest.md`, `corpus/indiana-contracts/README.md`). The status bar is where that surfaces, and the detection rule it displays does not exist yet.

**Open questions** — Should a silent-failure suspicion be shown here, or is it too alarming for a persistent chrome element? A source that has quietly stopped returning real results is the worst failure the system has, and it is also the one least suited to a small red dot.

### Region A.2.1 : Source Health Indicator

~~Green, degraded, or failing~~ — **corrected 2026-08-14 at the SP2 sign-off gate. Four states, not three, and "degraded" was never one of them.** The bundle's own Source Registry vocabulary is **`Healthy` (green) · `Rot suspected` (yellow) · `Failing` (red) · `Not ingested` (grey)**, and the built `StatusDot` now uses those names exactly.

**The discarded word caused a real false alarm.** `degraded` had been invented here, bound in code to the bundle's *"Failing"*, and carried to the sign-off gate as a suspected colour inversion — because "degraded" reads as *less* severe than "rot," so degraded=red beside rot=yellow looks backwards. **It never was.** A suspicion warns; a confirmed failure errors. **Inventing a state name next to a source that already had one is what produced a bug report about a bug that did not exist.**

Deep-links into the Source Registry (`4J`). Derived from the per-source yield figures §5.4 requires the adapters to record.

### Region A.2.2 : Last Run

When ingestion last completed. Deliberately a timestamp rather than a relative string — "2 hours ago" hides a clock that stopped yesterday.

#######################################################

# Screen 1 - Triage Queue

#######################################################

**Overview** — The daily driver, and the screen the product lives or dies on. One opportunity at a time, keyboard-driven, decision in under ten seconds (§7.1). Responsive, because a ten-second decision should work on a phone.

The app earns its login over a daily email by capturing three things email cannot: the four scores **with their supporting evidence**, the pursuit-cost fact panel that makes the light/moderate/heavy judgment possible on the spot, and — most importantly — **the no-bid reason as one tap on a chip.** Email reduces a no-bid to a binary and loses the reason, which is the single most valuable training signal in the system (`4B`, §4.5).

That last point is worth stating sharply because it inverts the obvious priority: **the reason chip matters more than the decision.** With no bid history to seed the scorer, reasons are load-bearing from decision one.

**Revised 2026-08-11 — the argument for this screen changes, and gets weaker before it gets clearer.** With matching parked (spec §1.1), two of the three things above are gone: there are no scores, and the reason is free text feeding nothing rather than a training signal. **Stated honestly, V1's triage queue earns its login on the pursuit-cost panel, the extracted facts, and being a system of record** — problem #4, which email genuinely cannot do.

That is a thinner claim than the one above and it should be allowed to look thin, because the alternative is pretending a parked feature is still carrying the argument. **The reason still matters more than the decision** — it is just no longer true that it matters because it teaches the scorer. It matters because in six months the question *"why did we pass on this"* has an answer, and because the accumulated answers are what qualification eventually gets designed against.

**Uses Shell** — YES, reduced. The queue wants the full width and no competing affordances; primary nav collapses while triaging. This is the one place I have departed from the shell being uniform, and it is an assumption worth challenging.

---------------------------------------------------------------------------------------------------------------

## View 1.1 : The Queue

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 3   | 5   | 5   | 2   | 95%   | 85%  |

**Overview** — The card stack itself. One opportunity fills the screen; a decision advances to the next; the count in the shell decrements. Keyboard first — the whole design assumes someone clearing forty items, not browsing three.

This is the best-specified screen in the document because §7.1 is the most-argued part of the spec, and because the hand-run is currently doing this job by hand in a published page, which has already taught us things about it.

~~**Known gaps** — Queue ordering is undecided.~~ **CLOSED 2026-08-12 — the prototype's answer is adopted, and it is better than the one this node was reaching for.**

The gap argued against ranking by score (it front-loads easy yeses and leaves the borderline items for when attention is worst) and proposed no replacement. The prototype ships **`ORDER · AMBIGUITY FIRST` as the default, and makes the order user-switchable** — *ambiguity first / score, highest first / deadline, soonest first*.

**Switchable is the part worth ratifying.** This node was trying to pick one ordering and would have picked wrong for somebody: a person clearing forty items wants ambiguity first, a person checking what closes this week wants deadlines. Making it a control ends the argument instead of settling it — and the default still carries the opinion. **Ambiguity-first is the default, and that is a decision rather than a fallback.**

**Open questions** — Should a decision be undoable, and for how long? At ten seconds per item a mis-tap is certain, and a system whose entire value is decision quality cannot silently keep a wrong one.

### Region 1.1.1 : Opportunity Card

Title, buyer, deadline, and estimated value — the four facts that decide most items without anything else being read.

Deadline gets special treatment. It is the highest-consequence extracted field (§8.4), and the FSSA bundle in `corpus/` demonstrated that a bundle can ship three documents carrying two different deadlines with the correct one in the least-specifically-named file (`corpus/FINDINGS.md`). Where the listing metadata and the document text disagree, the card shows the disagreement rather than silently picking a winner.

### Region 1.1.2 : Score Strip — PARKED

**PARKED 2026-08-11** with §6 — V1 has no scores, so this region does not render.

The four machine scores — Fit, Winnability, Value, Timing (§6.3) — each expandable to its citation. Collapsed by default. The scores are a reading aid, not a verdict, and a strip that demands attention would turn triage into score-review.

**Nothing takes its place in the card** — the deciding facts are already in 1.1.1 and the cost facts in 1.1.3, and inventing a substitute strip would be adding a judgment surface by the back door. The row is shorter in V1, which is the honest consequence.

### Region 1.1.3 : Pursuit-Cost Fact Panel

Not a score. A panel of countable facts that lets a person make the light/moderate/heavy judgment themselves: number of required forms, whether a pre-proposal conference is mandatory, how many references are demanded, whether anything needs notarizing.

These are directly countable from a bundle — `corpus/FINDINGS.md` established that on real documents — which is why this is facts rather than a fifth score. Cost-to-pursue is the one input the spec deliberately leaves human (§6.3).

### Region 1.1.4 : Decision Bar

Interested / Pass, and the reason chips. Reason capture defaults to mandatory on Pass and optional on Interested, because a rejection with no reason is the one event that teaches nothing.

**Mandatory-on-Pass is a default, not a law — decided 2026-08-12.** The prototype exposes `requireReasonOnPass` as a setting, and that is adopted rather than removed. The rule was stated absolutely in this document; in practice a queue of forty items where three are obvious junk should not be able to stall on a required text field. **The cost is real and accepted:** a firm that switches it off loses the corpus a reason vocabulary would later be derived from, and loses it silently. Default on, and the setting should say plainly what turning it off gives up.

Chips need a free-text escape hatch. The hand-run is currently producing reasons in Matt's own words precisely because pre-set categories would have flattened them, and the chip vocabulary should be *derived from* that hand-run rather than invented before it.

**Revised 2026-08-11 — chips are parked; free text is V1.** With qualification parked, no recorded reason feeds anything, so there is no vocabulary to get right and the argument above resolves itself: V1 records free text only. **Mandatory-on-Pass still holds**, for the system-of-record reason rather than the training reason. The accumulating free-text reasons become the corpus a chip vocabulary is eventually derived from — which is the order this node was already arguing for, now enforced by circumstance rather than discipline.

**And one constraint the eventual vocabulary inherits.** §1 is a mandate on the *system*, not on the user: a person may record *"too big for us right now"* and should, because it is often the true reason. What may never happen is that reason becoming model input. **So when chips return, they carry a class on the way in**, and the capacity class is excluded from anything that learns. A count may be surfaced; it may not be acted on. This is a data-flow rule, not a word ban — nothing is forbidden from being said here.

### Region 1.1.5 : Gated Items Drawer — PARKED, AND THE REASON IT EXISTS DID NOT GO AWAY

**PARKED 2026-08-11** — V1 has no gates, so nothing is gated and the drawer has no contents.

Items eliminated by Stage 0 hard gates (§6.1), filed rather than deleted.

This region exists because of a documented near-miss, not a principle. A stale deadline extracted from the wrong PDF would have silently killed KP's single best-fit opportunity three weeks before it actually closed. §6.2's "gated items are filed, not deleted" is the only thing that makes that recoverable, and a rejection you cannot inspect is a bug you will never find.

Low traffic by design. It needs to exist, not to be prominent.

**But the near-miss it was built for is an extraction failure, not a gating failure**, and V1 is fully exposed to it. A bundle shipping two deadlines still ships two deadlines; the wrong one still kills the best-fit opportunity three weeks early. What protects against it in V1 is Region 1.1.1's rule — *show the disagreement rather than silently picking a winner* — which is now carrying this risk alone. **Reinstate this drawer the same day anything gates**, and until then treat 1.1.1's conflict display as the higher-priority node it has become.

---------------------------------------------------------------------------------------------------------------

## View 1.2 : Saved Views

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 2   | 4   | 4   | 3   | 85%   | 45%  |

**Overview** — Persisted custom queries (§7.7, `4I`). Scope the queue to a sector, a jurisdiction, a value band.

**Re-scored 2026-08-14 by Matt: `Imp 2 → 4`, `Pri 2 → 4`.** The old scores assumed a matching engine would make the volume tractable. **V1 returns everything and never ranks, so saved views are the only way the firehose gets carved** — a primary interaction, not a convenience.

**Known gaps** — ~~Nothing establishes that anyone wants this yet… genuinely a candidate for cutting.~~ **Struck 2026-08-14 — that assessment was written against a system with a matching engine and it inverted.** The real gap now is the one the numbers expose: **`Conc` is 45%, the lowest in the document, and this node is scored `Imp 4`.** Those are hard to hold together. The reading taken is that the old 2s were *"we have not thought about this"* wearing the costume of *"this does not matter"* — **but that diagnosis was made by Claude about a judgment of Matt's, and it is the least-evidenced claim in the re-score.** Worth revisiting once anything is designed.

**Open questions** — ~~Is this a queue filter or a first-class saved object?~~ ✅ **Answered 2026-08-13: a first-class object**, ratified from the prototype. **It is a schema decision wearing a UI costume** — named views need storage, naming, editing, deletion and eventually sharing; remembered filter state needs one blob. **That is what `Conc 45%` is measuring**: the *shape* is decided, almost nothing beneath it is.

---------------------------------------------------------------------------------------------------------------

## View 1.3 : Queue Cleared

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 1   | 3   | 4   | 2   | 90%   | 55%  |

**Overview** — What the screen shows at zero. Treated as a real view rather than an empty state because reaching zero is the habit the product is trying to build, and the moment it happens is the only reward the system has to offer.

Cheap to build and disproportionately worth getting right.

**Known gaps** — What it should actually say. "Nothing to review" is a dead end; something pointing at the radars, or at what is coming, keeps the session alive. Undesigned.

#######################################################

# Screen 2 - Opportunity Detail

#######################################################

**Overview** — Everything known about one opportunity, and the screen a real bid/no-bid conversation happens in front of. Reached from the queue, from search, or from a radar.

The centrepiece is the **brief** (§7.3, `4D`), and its value is easy to mistake. The brief is not a summary of the RFP — anyone can read an RFP. It is the connection between the RFP and **KP's past performance library**: which specific past projects to cite, what is missing that would need a partner, what the real risks are. That connection is the tedious part of every bid/no-bid call, and it is the part a machine can genuinely do.

**Uses Shell** — YES

---------------------------------------------------------------------------------------------------------------

## View 2.1 : Brief

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 3   | 3   | 3   | 2   | 95%   | 75%  |

**Overview** — What it is, why it fits, what is missing and would need a partner, key dates, key risks, the pursuit-cost fact panel, and a recommended posture.

*Rescored 2026-08-10 when past-performance citation was cut. `Imp` 5 → 3 and `Eff` 4 → 3, both because the largest piece of it left. `Vol` 4 → 2 and `Conc` 60% → 75% because a cut is a decision: this node is smaller and considerably more settled than it was.*

**Known gaps** — **Past-performance citation is cut. The brief ships without it.**

*Decided 2026-08-10: the records are not accessible to this project.* Not deferred pending a decision, not blocked on analysis — unavailable. So nothing in this document may be designed assuming them, and the two open questions this node carried (where the records live, how many there are) are withdrawn rather than parked.

**What the brief is now:** what it is, why it fits, what is missing and would need a partner, key dates, key risks, the pursuit-cost fact panel, and a recommended posture. All of that is buildable from the solicitation itself plus the Firm Profile.

**What it is not:** the thing that told you which past projects to cite. §7.3 called that *the tedious part of every bid/no-bid call*, and it was the clearest answer to *why open an app instead of reading the RFP*. That answer is gone, and the honest replacement is weaker — a well-organised summary with its evidence attached.

The app's remaining case is the triage queue's reason capture (§7.1), which is untouched and was always the larger claim. Worth being clear that this node got quieter and Screen 1 did not.

**One thing preserved from the cancelled brainstorm**, in case access ever changes: the library would hold **engagement records, not proposal text** — what a bid *cites*, not what a writer *pastes*. A reusable-narrative store would turn Tenderfoot into a proposal-authoring product. The Firm Profile field stays in the model and stays empty (§4.2), so the capability could return without a migration.

**Open questions** — Is the recommended posture useful or presumptuous? A machine recommending "pursue as prime" to a firm with one competitive bid in its history may be claiming authority it has not earned. Showing the ingredients and withholding the recommendation is a defensible alternative.

---------------------------------------------------------------------------------------------------------------

## View 2.2 : Scores and Evidence — PARKED

**PARKED 2026-08-11** with spec §6 — V1 has no scores, so this view does not ship. **In the finished product it is worth what the grid says.** The marker is what holds it out of the V1 sequence; the numbers are not lowered to do that job (scoring key).

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 3   | 4   | 4   | 3   | 90%   | 70%  |

**Overview** — The four scores at full width, each with the evidence that produced it, quoted and linked back into the source document.

A score without a citation is an assertion, and the spec's position throughout is that assertions are worth nothing here — this is the screen that enforces it.

**What survives the parking** — the principle, applied one layer down. V1 has no scores to cite, but every *extracted field* has exactly the same obligation: a deadline without a pointer to the document and page it came from is an assertion. View 2.3 inherits this view's job, and §8.4 makes it measurable.

**Known gaps** — ~~Assessments are versioned by scorer version (§6.4) and this view has no treatment for that.~~ **Half closed 2026-08-12, adopted from the prototype:** every score carries its scorer version inline — `Fit 43 · scorer v0.3.1` — so a number is never shown without the thing that produced it. Ratified.

**The other half is still open, and it is the harder half.** When a rescore *changes* a verdict, the previous value and the reason for the change are more interesting than the current number, and there is still nowhere to show that. Stamping the version makes the comparison possible; it does not make it visible.

---------------------------------------------------------------------------------------------------------------

## View 2.3 : Extracted Fields

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 3   | 5   | 4   | 2   | 75%   | 75%  |

**Overview** — Every extracted field with its confidence and a pointer to where it came from. Deadlines, values, set-asides, eligibility requirements, contacts.

**Absence is a distinct state from low confidence — adopted from the prototype, 2026-08-12.** Estimated value renders as `—` with the source `absent from bundle`, sitting beside fields at 72% and 94%. *"We looked and it is not there"* is a different fact from *"we are unsure what we read"*, and collapsing them into one low number is how a missing ceiling quietly becomes a guessed one. **Three states, not two: found with a confidence, absent, and not yet looked for.**

**Known gaps** — Disagreement between sources needs a visual treatment and does not have one. Real bundles disagree with themselves — established, not hypothetical — and the honest display is both values with their provenance, not a resolved winner. A field that quietly picked one is how the near-miss in `corpus/FINDINGS.md` would have happened in production.

---------------------------------------------------------------------------------------------------------------

## View 2.4 : Documents

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 4   | 4   | 3   | 3   | 55%   | 55%  |

**Overview** — The bundle inline, with extraction highlights pointing back into the source.

**Known gaps** — There is no such thing as "the document." Real bundles run to 22 files across `.pdf`, `.docx`, `.xlsx`, `.pptx`, and nested `.zip`, and **the scope of work — the single most important file for fit scoring — is frequently a `.docx`** (`corpus/FINDINGS.md`). An inline viewer that handles PDF only covers about half of what matters. Whether non-PDF formats render inline or download is undecided and materially changes the effort.

---------------------------------------------------------------------------------------------------------------

## View 2.5 : Timeline

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 3   | 4   | 4   | 2   | 65%   | 80%  |

**Overview** — Every Sighting and addendum in order. This is what the Sighting table exists for (§4.4), and it is what makes an extracted deadline trustworthy in seconds — you can see when it changed, in which source, and whether anything said so.

**Scope widened 2026-08-12, adopting the prototype.** The timeline also records **what the system decided about the record**, not only what the documents did. The prototype's own example: *"Buyer resolved to NY OGS, not the hosting jurisdiction — Organization link corrected on ingest."*

That is a machine decision with consequences — it moves the opportunity under a different Organization, and every buyer-level number in View 4.1 moves with it. **Entity resolution is the least visible thing the system does and the easiest to get silently wrong**, and this is the only place a person would ever watch it happen. Cheap to add while the timeline is being built; effectively impossible to reconstruct afterwards.

**Known gaps** — Addenda cannot be trusted to describe themselves. A real addendum in the corpus enumerates its own changes, omits the deadline move entirely, and quietly renames the solicitation. So the timeline shows a **diff**, not a summary-of-changes, and the diffing does not exist yet.

#######################################################

# Screen 3 - Radars

#######################################################

**Overview** — Pre-RFP intelligence (§7.4, §4.6). Pure graph queries with no email equivalent; they exist only because of the entity model.

Both radars are **post-gate work** — slice SP8, after the go/no-go — and the reasoning is recorded in `docs/Tenderfoot-Plan-of-Action.md` §6.0. The short version: Matt's answer to whether KP would act on a lead a year early was *"not likely, but possible, especially for Medicaid-related RFPs."* A capability used rarely does not justify jumping the gate; a capability used decisively in one sector does justify designing for that sector specifically.

**Uses Shell** — YES

---------------------------------------------------------------------------------------------------------------

## View 3.1 : Expiration Radar

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 2   | 4   | 4   | 3   | 95%   | 75%  |

**Overview** — Contracts approaching their end date, read as predicted re-competes months ahead of any RFP (`4E`). The lead-time advantage, and the direct answer to problem #2, *finding out too late* (§1).

Its data is already collected. `corpus/indiana-contracts/` holds 2,160 Indiana contracts expiring within 18 months, each with a retrievable PDF, pulled from one anonymous endpoint. Low effort, and unusually low for something this far down the priority list — the score reflects the gate, not the difficulty.

**Known gaps** — **Expiry alone must not generate a lead.** 2,160 expiring contracts a year would produce a feed that gets muted inside a week, which is problem #3 — noise — rebuilt in a new place. The radar fires on expiry **within a Firm-Profile sector of interest**, and that sector-matching rule does not exist yet.

There is a live fixture waiting for it: 231 contracts across 149 vendors all expire 2026-12-31, including Indiana's Medicaid MCO capitation book. Whatever this radar would have said about that date can be checked by hand now, which makes it the natural seam test.

**Open questions** — Does an end date mean a re-compete? EDS field 33 records whether renewal language exists, so the answer is retrievable per contract — but it lives in the PDF, not the search index, and nothing reads it yet.

---------------------------------------------------------------------------------------------------------------

## View 3.2 : Teaming Radar

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 3   | 3   | 3   | 4   | 80%   | 50%  |

**Overview** — Who wins work KP could sub on. KP's WBE certification makes it attractive to primes carrying participation goals (`4F`, §4.6), which turns some unreachable opportunities into reachable ones.

**Known gaps** — Better than it looked when the spec was written. Indiana's EDS form publishes M/WBE status for **the prime and the subcontractor, with percentages**, on every executed contract. That makes "which primes carry participation and on what work" a query rather than guesswork. The spec assumed this had to be inferred; it does not, at least in Indiana. The extraction that would read it does not exist.

**Open questions** — Is this a radar or a report? It is browsed occasionally, not monitored, which is a different shape from the expiration radar it is currently paired with.

#######################################################

# Screen 4 - Entity Browser

#######################################################

**Overview** — Organizations and Vendors with their histories (§7.5, `4G`). *This agency competes work every four years and the incumbent has never lost* is worth knowing before writing anything, and it is the kind of fact that only exists once awards and contracts are modelled as entities rather than fields.

Win history infers capability without anyone maintaining a taxonomy — which is the argument for the entity model generally, made visible in one screen.

**Uses Shell** — YES

---------------------------------------------------------------------------------------------------------------

## View 4.1 : Organizations

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 2   | 4   | 3   | 2   | 95%   | 65%  |

**Overview** — Buyers, with what they have bought, from whom, how often, and on what cycle.

**Two columns promoted from the prototype, 2026-08-12. Both are net-new — neither this document nor the spec asked for them.**

**`INCUMBENT RETAINED` — a per-buyer retention rate, shown as `9 OF 11`.** How often this buyer re-awards to the sitting vendor. **This is the most useful thing the prototype invented**, because it answers the question that decides most bid/no-bid calls before any scoring happens: *does this buyer ever actually switch?* A buyer at 9-of-11 and a buyer at 4-of-9 are different propositions at identical nominal fit, and nothing else in the system carries that distinction. It is a stronger winnability input than anything in §6.3, and it is computed from award history rather than judged.

**`CYCLE` — the buyer's procurement cadence, shown as `≈4 years`.** This generalises the expiration radar (View 3.1). Where a contract record exists you know the end date; where one does not, cadence predicts roughly when the work comes round again. It extends pre-RFP lead time to buyers you hold no contract for — which is most of them.

> **Both carry a dependency this document cannot satisfy.** Retention needs award history with the incumbent resolved to a Vendor entity; cadence needs enough award history per buyer to be more than noise. **Neither has a component in `reference/Tenderfoot - Concept Outline.md`.** Promoted here as screen intent; the data-model work behind them is a separate and currently unwritten item.

**Known gaps** — The buyer is not always the jurisdiction hosting the listing. The first corpus pull surfaced a NASPO ValuePoint RFP issued by New York State OGS and listed on Indiana's portal — inside the first 61 records. The Organization ↔ Solicitation relationship has to carry that, and this view has to display it without implying Indiana is buying.

---------------------------------------------------------------------------------------------------------------

## View 4.2 : Vendors

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 2   | 3   | 3   | 2   | 90%   | 65%  |

**Overview** — Competitors, incumbents, and potential primes. KP is a Vendor row too (§4.2), which is what makes the Firm Profile a configuration record rather than a special case — and what makes the whole thing portable to another firm.

**Known gaps** — Vendor identity resolution is unaddressed *as a mechanism*. Government data spells the same company several ways, and 1,293 distinct vendor names in the Indiana pull is certainly an overcount. Nothing in the spec says how names collapse into one entity.

**The display half is settled, adopted from the prototype 2026-08-12.** A vendor row carries its absorbed spellings inline — *"also: MAXIMUS INC · Maximus Federal Services"* — so a merge is visible on the row rather than buried in the pipeline that performed it.

**The part worth keeping is the negative state:** *"no aliases found."* That separates *this vendor has one spelling* from *nobody has looked*, and without it an unmerged duplicate is indistinguishable from a clean record. **A merge is a claim the system makes about the world, and it should be as inspectable as any extracted field** — View 2.2's argument, applied to entities instead of scores.

#######################################################

# Screen 5 - Reports

#######################################################

**Overview** — Phase 0 market sizing as a live view (§7.6, `4H`): how many qualified prospects exist, at what value, from which sources. Plus source-yield reporting.

Win rate becomes a report once there is enough history to populate one. **It is never a system objective** (§8.6) — a scorer optimised for win rate learns to recommend only safe bids, which is the opposite of the point.

**Uses Shell** — YES

---------------------------------------------------------------------------------------------------------------

## View 5.1 : Market Sizing

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 3   | 5   | 4   | 3   | 90%   | 70%  |

**Overview** — The backtest as a standing view. The output the whole project is judged against: *"63 opportunities you were eligible for. 22 strong fits, combined value $4.1M. You saw one of them."* (§3.1)

Highest impact in the document and mid priority, which is not a contradiction — it is the SP6 go/no-go artifact, so it arrives when the gate does.

**Known gaps** — The report states a recall figure, and recall requires knowing what was missed. That is only knowable for the population that was adjudicated, so the honest version carries its own denominator and this view has no treatment for that yet. A market-sizing number quoted without its sampling basis is exactly the failure `corpus/README.md` exists to prevent.

---------------------------------------------------------------------------------------------------------------

## View 5.2 : Source Yield

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 2   | 4   | 4   | 2   | 80%   | 80%  |

**Overview** — What each source actually produced: records ingested, survived gates, reached triage, marked interested. Retires sources that do not earn their maintenance.

**Known gaps** — Yield measures a working adapter. It does not detect one that has silently started returning plausible nonsense, which is the failure mode we have now hit three times on two government APIs. The detection §5.4 asks for — vary one parameter, watch the total move — is cheap, specified nowhere, and belongs here.

#######################################################

# Screen 6 - Admin

#######################################################

**Overview** — Firm Profile and Source Registry (§7.8, `4J`). Unglamorous and structurally load-bearing: these two screens are the entire portability story.

**Uses Shell** — YES

---------------------------------------------------------------------------------------------------------------

## View 6.1 : Firm Profile

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 3   | 5   | 4   | 2   | 95%   | 80%  |

**Overview** — **A real screen, not a config file.** This is what makes the system portable (§7.8). Capabilities and service lines as free text, certifications and set-aside status, geography, and the eligibility facts — headcount, revenue — that exist here *only* as gate inputs and never as capacity judgments (§1).

The rule this screen enforces: no fact about Koehler Partners appears in code. All of it lives here. A second customer is a second row, not a fork.

**Known gaps** — Whose profile is it? If the hand-run's ground truth comes from a more senior decision-maker at KP, the profile should encode that person's judgment rather than whoever opens the editor first. Currently unowned, and it should not be settled by default.

---------------------------------------------------------------------------------------------------------------

## View 6.2 : Source Registry

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 3   | 4   | 5   | 2   | 95%   | 80%  |

**Overview** — Sources as **data rows, not code** (§5). Each carries its adapter tier, platform, archive depth, legal posture, and health. Adding a source is a row and a config, not a deploy.

The platform field is what makes this scale: states mostly license about five platforms rather than building portals, so adapters bind to platform plus config rather than to jurisdiction (§5.7). One Periscope adapter covers several states.

**Known gaps** — Legal posture is a first-class field (robots.txt, terms of service, rate limits) and has no interface. Paywalled aggregators are excluded by their terms, and that exclusion should be visible and enforced in the registry rather than remembered.

**Open questions** — Should the registry record *verified facets* per source? We have learned the hard way that a parameter can be accepted and silently ignored, and that knowledge currently lives in markdown rather than anywhere the adapter can read.

#######################################################

# Screen 7 - Pipeline Board — PARKED

#######################################################

**PARKED — deferred to a later phase (§9), not by the V1 scoring decision.** Pursuit *management* comes after pursuit *seeking*. **The cause differs from the other three parked nodes and the consequence is identical**, which is the first evidence the marker generalises: it was written for machine judgment and it fits a phase deferral without amendment.

| Eff | Imp | Pri | Vol | Proto | Conc |
|:---:|:---:|:---:|:---:|:-----:|:----:|
| 4   | 3   | 4   | 5   | 60%   | 30%  |

**Overview** — Pursuits across their states: `Watching → Bid/No-Bid → Drafting → Submitted → Outcome`, with ownership and assignment (§7.2, `4C`). The system of record, and the answer to problem #4 — opportunities living in email and memory.

**State machine revised 2026-08-12, adopting the prototype's.** It was `Watching → Bid/No-Bid → Submitted → Won/Lost`. Two changes, both kept:

- **`Drafting` added.** The gap between deciding to bid and submitting is where a pursuit actually dies, and the original machine had no state for it — a decided-but-unwritten proposal was indistinguishable from one nobody had started. This is the longest-lived state on the board and it was missing.
- **`Won/Lost` → `Outcome`.** One state holding a result, rather than two terminal states. It also absorbs the results the original pair could not express: withdrawn, cancelled by the buyer, no award made. All three occur in real procurement records.

**Specified and deliberately not built.** Pursuit management is deferred to a later phase (§9). Tenderfoot's current job is contract *seeking*; seeking *and* management comes later. It is scored as a leaf because it has no views yet.

~~`Pri 1` is the whole point.~~ **Corrected 2026-08-14 to `Pri 4`, and this node is the cleanest example of why Q1 mattered.** `Pri 1` did not mean *KP does not want a pipeline board* — it meant *we are not building one yet*, which is the circular definition Q1 outlawed. **KP wants this: it is the answer to problem #4**, opportunities living in email and memory, and the 08-11 revision above concedes that being a system of record is one of the three things V1's triage queue earns its login on. **The number went up and the schedule did not move**, which is exactly what the `PARKED` marker exists to make possible.

**Known gaps** — Everything below the state machine. Volatility is 5 because a year of using the triage queue will change what this needs to be, and designing it now would mostly produce something to throw away.

**Open questions** — Does the triage decision's lifecycle stub (`4B`: `New → Triaged → Interested / Not Interested`) grow into this, or get replaced by it? The stub ships in the current phase and the answer changes what it should record.

**Uses Shell** — YES

#######################################################

# ENDNOTES:

**Email is not a screen and is not in this document.** §7.9 gives it two jobs — a scheduled summary saying whether the queue is worth opening, and genuinely time-critical tripwires (a deadline moved on an active pursuit, an addendum posted, an award announced). Two kinds of interruption and only two; everything else is pull. It has no views, so it has no home here, but it is real work and `4K` carries it.

**No landing or launch screen is specified.** IDE8 has one because a project has to be chosen. Tenderfoot has one customer and one dataset, so the queue is the landing screen. If authentication arrives, this changes.

**Search is absent deliberately.** The shell has no global search because six screens do not need one and the filters inside each view are more useful. Worth revisiting only if the entity browser grows.

**What is scored `Pri 5` and why.** ~~Only the shell, its header, and the triage queue. Everything else waits, because…~~ **Rewritten 2026-08-14 — the old text was an argument about build order, in a document that no longer keeps build order in this column.**

**`Pri 5` is now carried by exactly two nodes: `View 1.1` (the queue) and `View 6.2` (the source registry).** The queue is the screen the product lives or dies on; the registry is V1's entire control surface — switching a source on or off is the only lever there is. **The shell and its header dropped from 5 to 3**, not because they matter less but because *"built once, early, and everything assumes it"* is a statement §6 owns and this column does not.

#######################################################

# Scoring key

Scored nodes carry the same six-column grid. **All 1–5 scales run low to high** — `5` is the most of the thing, so ~~`Pri 5` means do it first~~ **`Pri 5` means KP wants it most** (corrected 2026-08-14 — this sentence still carried the pre-Q1 definition after the table above had been fixed) and `Eff 5` means it is expensive. **`·` means not yet scored**, which is deliberately not the same as `0`.

**Scores sit at the level where the judgment is made.** Every *leaf* carries a grid — a node with nothing scored beneath it. A screen whose views each carry their own scores is deliberately left without one: a screen-level grid would only roll up judgments already made a level down, and one judgment kept in two places can disagree with itself. Scoring a parent as well is allowed where it says something its children do not — the Shell does. **What is never allowed is an unscored leaf, a half-filled grid, or an ungridded parent whose children are not themselves finished.**

**No build-order column, deliberately.** This document is a reference for what the application *is*; `docs/Tenderfoot-Plan-of-Action.md` §6 is the plan for what gets built *when*. Priority is the input; the slice assignment is worked out from it, once, in the plan.

| Col | Field | Range | What it records |
|---|---|---|---|
| `Eff` | Effort | 1–5 | Cost to build. 5 = expensive. |
| `Imp` | Impact | 1–5 | Value to the user. 5 = high. |
| `Pri` | Priority | 1–5 | **How much KP wants the thing.** 5 = most. **Pure product judgment, independent of what has to be built first.** |

> ### `Pri` is product priority, not build order — ruled by Matt, 2026-08-13
>
> This cell previously read *"how soon this should be built, all things considered"*, which was **circular**: `docs/Tenderfoot-Plan-of-Action.md` §6 derives slice ordering **from** `Pri`, so a `Pri` that already accounted for technical dependency was partly a restatement of the thing it was supposed to inform.
>
> **The rule now: `Pri` is what KP wants. Dependency ordering is applied once, on top, in the plan.** So **a node can legitimately be `Pri 5` and still land in a late slice** because three other things must exist first — and that is not a contradiction to be resolved by lowering the number.
>
> **Consequence worth stating.** The twenty existing values were written by Claude against a system that **had a matching engine**, before V1 was decided to return everything and rank nothing (§1.1). Under this definition several are **wrong rather than merely stale** — five are argued in [`three_open_questions.md`](../three_open_questions.md), most notably `View 1.2 : Saved Views` at `Imp 2 · Pri 2`, which with no ranking is **the only way the firehose gets carved** and is a primary interaction rather than a convenience.
>
> **Confirming the definition makes those disagreements arguable rather than vague. It does not resolve them.**
>
> ✅ **Resolved 2026-08-14** — Matt reviewed all twenty and fourteen moved, `View 1.2` among them (`Imp 2 · Pri 2` → `4 · 4`). **The values above are historical from this date; read the grids, not this note.** And the correction this ruling most needed was not in the five flagged here: `Shell A` and `Region A.1` sat at `Pri 5` under the definition this very blockquote had just outlawed, for a full day, because **changing what a column means does not change the numbers already written in it.**
| `Vol` | Volatility | 1–5 | How likely this is to change. 5 = expect churn. Independent of `Conc`. |
| `Proto` | Prototype accuracy | 0–100% | How close the prototype is to what we actually want. **0% throughout — no prototype exists.** |
| `Conc` | Conceptual completeness | 0–100% | How settled the idea is, whether or not anything is drawn. |

Beneath the grid, four labels, **bold rather than headings** so they never enter the heading tree.

**`Overview` is required on every node; the other three are optional, and omitting one means there is nothing to report.** Silence is the answer, not a gap waiting to be filled.

| Label | What goes in it |
|---|---|
| **Overview** | What this is, and why it exists. |
| **Known UI issues** | What is wrong with it as currently drawn. *Omitted throughout — nothing is drawn yet.* |
| **Known gaps** | What is missing and needs **filling**. |
| **Open questions** | What is undecided and needs **deciding**. Not the same as a gap. |

Levels 3 and below take no grid and no labels.

> ### `PARKED` is a marker, not a score — ruled by Matt, 2026-08-14
>
> **A parked node is deferred out of V1 but still part of the finished product.** Not cut, not deprecated, not a candidate for deletion — the prototype renders it and it ships eventually.
>
> **A parked node keeps its scores.** `Imp` and `Pri` are judgments about the product, and the product still wants the thing. Lowering them so a planning document reads correctly would destroy the judgment and force someone to reconstruct it by guessing when the node un-parks — **which is exactly how the `Imp`/`Pri` problem started**, and is not repeated here.
>
> **Instead the node carries a bold `PARKED` line directly beneath its heading, above the grid**, giving the date, the decision that parked it, and what does not ship. **Planning excludes a parked node by that marker, not by its number** — `docs/Tenderfoot-Plan-of-Action.md` §6 reads the marker first and the `Pri` second.
>
> **Above the grid rather than beneath it, and that placement is the whole fix.** The four labels sit below because they elaborate; this one is not a label and does not elaborate. A reader must not reach the numbers before knowing they describe something V1 does not build.
>
> **The marker is the only element that crosses the level-3 line.** Grids and labels stop at level 2 because that is where judgments are made. Parking is a *fact* about a node rather than a judgment about it, so `Region 1.1.2` and `Region 1.1.5` carry it despite having no grid. A heading may also repeat `— PARKED` as a scanning aid in a long outline; the marker is the part that governs.
>
> **The marker states its cause, because there is more than one.** Three nodes are parked by the V1 scoring decision (§1.1) — Region 1.1.2, Region 1.1.5, View 2.2. **`Screen 7` is parked by a phase deferral (§9)**, and was carrying `Pri 1` for it until 2026-08-14. Different reasons, identical consequence: **out of the sequence, scores untouched.** That the rule fit a case it was not written for, within a day of being written, is the first evidence it generalises.
>
> **Superseded: "read their `Pri` as zero for V1."** That was the previous stopgap, it lived in three places, and it was **wrong rather than merely fragile** — it asked a reader to mentally rewrite a number that was never zero. The priority is not zero; the node is simply outside V1's scope.

#######################################################

# Revision history

*Revision note, 0.5.1 → 0.6.0 — `Imp` and `Pri` reviewed in full and become rulings. Matt, 2026-08-14.*

**Minor by diff size, major by semantics — bumped on the second, per the rule §2.18 of `docs/Proto2PRD-Lessons.md` was written from an hour earlier.** Fourteen numbers moved and the column changed owner; that is not a patch.

- **Q3 answered: all twenty, not the five flagged.** Fourteen moved. **`Imp` and `Pri` are now Matt's rulings rather than Claude's placeholders**, which closes the caveat this document has carried in its preamble since adoption on 2026-08-10.
- **The two largest errors were not on the flagged list, and the flagged list could not have found them.** `Shell A` and `Region A.1` carried `Pri 5` — *"built once, early, everything assumes it"* — which is precisely the build-order reading Q1 had outlawed the previous day. **The five flagged nodes were all too low; nobody thought to look for too high.** A pass that re-examines only the entries you already suspect will confirm your suspicions and miss the rest.
- **The general form, and it is the same shape as §2.18.** Q1 changed what `Pri` *means*; the twenty values written under the old meaning were left standing. **Redefining a column does not re-score it, and the gap between the two is invisible in a diff** — the definition changes in one line and the stale values change in none.
- **`Screen 7` gains a `PARKED` marker and `Pri 1 → 4`.** It was parked by a *phase deferral* (§9) rather than by the V1 scoring decision (§1.1) — a cause the marker was not written for, which it fit without amendment. **First evidence the 0.5.1 rule generalises**, and it arrived within a day.
- **Two sentences elsewhere still carried the pre-Q1 definition** and were corrected: the scoring key's *"`Pri 5` means do it first"*, and the summary claiming `Pri 5` belongs to *"the shell, its header, and the triage queue."* Both had survived the Q1 edit because that edit changed the table row and stopped there. **`Pri 5` is now `View 1.1` and `View 6.2`, and nothing else.**
- **`View 1.2` needed prose surgery, not just numbers.** Its `Known gaps` still read *"genuinely a candidate for cutting"* and its `Open questions` still asked a question ratified on 08-13. **A node can be re-scored and left self-contradicting**, which is the argument for opening the document rather than editing the grids from a list.
- **The one to revisit.** `View 1.2` is now `Imp 4` at `Conc 45%`, the lowest completeness in the document. The reading — that the old `2`s meant *"unexamined"* rather than *"unimportant"* — is **Claude's diagnosis of a judgment of Matt's, and the least-evidenced claim in the pass.**

*Revision note, 0.5.0 → 0.5.1 — parked nodes get a marker instead of a footnote. Claude, 2026-08-14.*

- **Q2 of [`three_open_questions.md`](../three_open_questions.md) ruled by Matt: option (d), a marker outside the grid.** A parked node keeps its product scores and carries a bold `PARKED` line above its grid; planning excludes it by that marker rather than by a lowered number. **Written into the scoring key as a rule**, so it governs the next parked node rather than being a treatment of this one.
- **The previous stopgap is superseded, and it was wrong rather than merely fragile.** *"Read their `Pri` as zero for V1"* appeared in three places — preamble, node, audit trail — and asked a reader to mentally rewrite a number that was never zero. **Three copies of a warning is a warning nobody reads, and the fix is not a fourth copy.**
- **What it buys, concretely.** `View 2.2` (parked, not buildable for a year) and `View 2.3` (ships in V1 and is arguably the most important thing in it) carried near-identical grids and could not be told apart from the numbers. They now can, without either number moving.
- **The marker is the only element that crosses the level-3 line**, because parking is a fact about a node rather than a judgment about it. `Region 1.1.2` and `Region 1.1.5` carry it despite having no grid — which is also why Q2 was a one-node question about scoring and a three-node question about marking.
- **Q3 is still open** — how much of the twenty-node `Imp`/`Pri` set Matt wants to re-score.

*Amendment to 0.5.0, no version bump taken — Q1 ruled. Claude, 2026-08-13.*
**⚠ Reconstructed 2026-08-14 from `9853653`. Not written at the time — that is the point of the note.**

- **The scoring key's definition of `Pri` was rewritten** from *"how soon this should be built, all things considered"* to *"how much KP wants the thing"*, with the ruling blockquote added beneath it. Matt's answer to Q1.
- **It shipped without a version bump, and that is the finding worth keeping.** This is a change to what a column *means* — **every one of the twenty existing values is silently reinterpreted by it.** A semantic change to the scoring key is the largest kind of change this document can take, and it is the one that left no trace in the version.
- **Recorded rather than corrected.** Renumbering retroactively would make the history lie in a second way. The version says 0.5.0 for two different meanings of `Pri`; this note is how a reader finds that out.
- **The near-cause is worth naming too.** The version tracked the *prose* — how much text changed — rather than the *semantics*. `d6b6000` moved one node's percentage and took a minor bump; this moved the meaning of a whole column and took none.

*Revision note, 0.4.1 → 0.5.0 — `Proto` re-pointed to V1.2. Claude, 2026-08-13.*
**⚠ Reconstructed 2026-08-14 from `d6b6000`; not written at the time.**

- **One node moved: `Region A.1`, `Proto` 70% → 95% and `Conc` 75% → 90%.** Mean 84% → **85.2%**; twelve nodes at 90%+ became thirteen. The other nineteen were **confirmed unaffected by diffing the bundles rather than re-reading them.**
- **The wordmark existed the whole time; only its label said otherwise.** V1.1's header carried a finished lockup with an 8px mono line beneath reading `WORDMARK — PLACEHOLDER` — **the placeholder was announcing the mark next to it as provisional.** V1.2 deletes that line and the now-single-child wrapper.
- **It was nearly redesigned away.** The punch item read *"replace with a real mark,"* and a Design round given that instruction would very likely have discarded a checkbox mark that suits this product unusually well. **It survived because the header was read rather than inferred from its own placeholder text.**
- **The re-score cost minutes, not a day** — six changed lines. **That is the argument for re-scoring at every freeze:** against a surgical change it is nearly free, and skipping it is how the column silently stops describing anything.

*Revision note, 0.4.0 → 0.4.1 — the last three prototype answers ratified. Claude, 2026-08-13.*
**⚠ Reconstructed 2026-08-14 from `da95f5c`; not written at the time.**

- **All three ratified by Matt:** saved views as a first-class object, rot suspicion in persistent chrome, and the cleared state's pointer at the expiration radar. **Held open for two days precisely so silence could not adopt them**; adopted by decision instead, which is the only difference that matters.
- **Nothing changed in the prototype.** Ratification confirms what it already drew; had any been overturned it would have become a V1.2 punch item. **SP2 builds against three decided answers rather than three provisional ones.**
- **The desktop-only decision was taken in the same commit but did not touch this document** — it landed in the design spec and the plan of action. Noted so the version gap does not read as a missing SVRC change.

*Revision note, 0.3.1 → 0.4.0 — eight decisions adopted from the prototype. Claude, 2026-08-12.*

- **The review phase produced content, not just scores.** The `Proto` audit surfaced twelve prototype decisions this document had not made; Matt ruled on nine of them in one pass. Method generalised into `docs/Proto2PRD.md` §4.7.5 and marked **(T)**.
- **`View 1.1` — queue ordering closed.** The gap argued against ranking by score and offered no replacement; the prototype defaults to ambiguity-first **and makes the order switchable**. The switch is the real contribution: this node was trying to pick one ordering and would have picked wrong for somebody.
- **`Region 1.1.4` — mandatory-on-Pass demoted to a default.** Stated absolutely here, exposed as a setting in the prototype, and the setting is adopted. The cost is recorded rather than waved off: switching it off silently forfeits the corpus a chip vocabulary would later be derived from.
- **`Screen 7` — state machine revised.** `Drafting` added, because the gap between deciding to bid and submitting is where pursuits actually die and there was no state for it. `Won/Lost` became `Outcome`, which also absorbs withdrawn, cancelled, and no-award — all of which occur in the corpus.
- **`View 4.1` — two net-new columns, and one of them may be the best idea in the artifact.** Per-buyer **incumbent retention** (`9 OF 11`) answers *does this buyer ever actually switch?* before any scoring happens, and is a stronger winnability input than anything in §6.3. **Procurement cycle** (`≈4 years`) generalises the expiration radar to buyers holding no current contract. **Both lack a component in the concept outline** — flagged in the node, not silently assumed.
- **`View 4.2`, `View 2.3`, `View 2.5` — three small promotions that share one principle:** make the machine's claims inspectable. Aliases show what a merge absorbed and say *"no aliases found"* when it absorbed nothing; extracted fields separate *absent* from *unsure*; the timeline records the entity-resolution decision that moved a record under a different buyer.
- ~~**Three answers left unratified on purpose**~~ **— ALL THREE RATIFIED 2026-08-13.** Saved views as a first-class object, rot suspicion in the chrome, and the cleared state's radar pointer. They were held open for two days so silence could not adopt them, and were then adopted by decision. **The method worked exactly as §4.7.5 intended: the answers did not change, the way they were held did.** Details in the preamble.

*Revision note, 0.3.0 → 0.3.1 — `Proto` filled against V1.1. Claude, 2026-08-12.*

- **All twenty `Proto` values written**, replacing 0% throughout. Judged by driving the V1.1 bundle screen by screen and comparing each node's `Overview` and `Known gaps` against what is actually rendered — not by recollection. **Mean 84%, twelve nodes at 90%+, lowest 55%.**
- **The prototype closed six documented gaps by itself.** `View 1.1` implements *ambiguity-first* ordering, which that node's `Known gaps` proposed and argued for against ranking by score. `View 1.3` points at the expiration radar from the cleared state, which its gap called *"undesigned."* `View 2.2` stamps `scorer v0.3.1` on every score, which its gap said had no treatment. `View 3.1` shows `2,160 EXPIRING` beside `14 SECTOR MATCH`, which is the sector-matching rule its gap said did not exist. `View 4.1` labels NY OGS *"Indiana is not the buyer."* `View 6.2` shows GovWin as `EXCLUDED` with legal posture as a column. **Six gaps written in this document, closed in an artifact generated from it.**
- **The three lowest scores are all the same phenomenon, and it is not a defect.** `View 2.4` (55%) renders `DOCUMENT RENDER — PLACEHOLDER` and prints the undecided question on screen. `Screen 7` (60%) draws a state machine that differs from the one specified, on a screen whose `Conc` is 30%. `View 2.5` (65%) shows two sightings and no addendum, because the diffing the node requires does not exist. **In each case the generator declined to invent a decision.** Scored as gaps regardless, because `Proto` measures distance from what we want, not the artifact's restraint.
- ~~**`Region A.1` at 70% is the outlier worth acting on.**~~ **CLOSED 2026-08-13 against V1.2 — 70% → 95%.** The node was structurally complete all along; the wordmark it called missing **already existed**, and the `WORDMARK — PLACEHOLDER` line beneath it was labelling a finished mark as provisional. V1.2 deletes the label. **Worth keeping as a caution:** the punch item said *replace with a real mark*, and executing it literally would have discarded a checkbox mark that suits this product unusually well. It survived because the header was read rather than inferred from its own placeholder text.
- **`View 1.2` at 85% carries a caution.** The prototype answers that node's open question — *filter or first-class object?* — by drawing a first-class object with named views, counts, and a create affordance. **That is a decision made by a generator, not by anyone.** High fidelity to something nobody chose.
- **This column expires.** It describes V1.1 and nothing else. Re-run at each prototype freeze.

*Revision note, 0.2.0 → 0.3.0 — V1 has no scores. Claude, 2026-08-11.*

- **Matching parked in full** (Matt, 2026-08-11). V1 returns everything every active source returns — no ranking, no scoring, no filtering. Recorded in spec §1.1 and §6; SP5 removed from the plan of action's slice sequence rather than reordered.
- **Three nodes parked, none cut**: Region 1.1.2 (Score Strip), View 2.2 (Scores and Evidence), Region 1.1.5 (Gated Items Drawer). **Grids left filled deliberately.** The scoring key forbids a half-filled grid, and blanking a parked node would report it as unestimated rather than as descoped — a different and worse claim. Each carries a prose note instead, and ~~the preamble says to read their `Pri` as zero~~ — **superseded 2026-08-14: the prose note became a `PARKED` marker above the grid, and the read-as-zero instruction was struck as wrong.**
- **The outline survived the removal of its scoring layer largely intact**, which is the most interesting thing this revision found. Screen 1 loses one region of four and still works, because 1.1.1, 1.1.3, and 1.1.4 were built around facts and decisions rather than around scores. That is evidence the structure was sound, reached by deleting a third of the machine's output and seeing what broke.
- **Region 1.1.5's parking exposed a live risk rather than closing one.** The drawer was justified by a real near-miss — a bundle shipping two deadlines, the wrong one three weeks early — but that near-miss is an *extraction* failure, not a *gating* failure. V1 is fully exposed to it and the drawer is gone, so Region 1.1.1's show-the-disagreement rule is now carrying that risk alone and is more load-bearing than its grid suggests.
- **Reason chips parked; V1 records free text.** Region 1.1.4 already argued the vocabulary should be derived from the hand-run rather than invented ahead of it. With nothing consuming reasons, that ordering is enforced by circumstance instead of discipline.
- **`Imp`/`Pri` review is now overdue rather than pending.** Those columns feed slice ordering, and slice ordering just changed materially. Reviewing them against a sequence that no longer contains SP5 is a different exercise from the one flagged at adoption.

*Revision note, — → 0.1.0 — first draft. Claude, 2026-08-10.*

- **Structure derived from spec §7**, not invented. Six screens plus a deferred seventh, mapped from §7.1–§7.8 and cross-referenced to component IDs in the concept outline.
- **`Known UI issues` omitted on every node.** Per the scoring key, omission means nothing to report — and with no prototype, there is nothing drawn to have issues with. `Proto` is 0% throughout for the same reason. These are the two columns in this document that are certainly correct.
- **`Imp` and `Pri` are proposals and should be treated as noise until Matt overwrites them.** They are filled only because the key forbids a half-filled grid. `Eff` is a genuine estimate; `Conc` reflects how settled the spec is, which I can judge.
- **Three nodes carry findings the spec predates**, and they are the parts of this draft most worth keeping: the gated-items drawer (1.1.5) is justified by a real near-miss rather than a principle; the expiration radar (3.1) has its data already collected; and the teaming radar (3.2) turns out to be easier than the spec assumed, because Indiana publishes prime and sub M/WBE status on every contract.
- **The largest gap found while writing this is not a UI gap.** The brief (2.1) rests entirely on a past-performance library that has been planned in one line and collected not at all.

*Revision note, 0.1.2 → 0.2.0 — adopted. 2026-08-10.*

- **Adopted as the working outline** (Matt, 2026-08-10), pending small edits. Filename loses the draft marker; the preamble no longer says "exists to be overwritten."
- **It was used before it was adopted.** The first prototype direction was generated from this document in Claude Design, covering nearly every node — which is the evidence for adoption rather than a consequence of it. Recorded in `docs/Proto2PRD.md` §4.3.2.1.
- **`Imp` and `Pri` are now load-bearing and were never verified.** Flagged prominently in the preamble. Adoption turns placeholder scores into the input to slice ordering, and that transition is exactly what the `·` convention exists to prevent happening silently.
- **`Proto` is knowingly stale at 0% throughout.** A prototype now exists; the column can only be filled by judging each node against it. Left rather than guessed.

*Revision note, 0.1.1 → 0.1.2 — a cut, and what it costs. 2026-08-10.*

- **Past-performance citation removed from the brief** (Matt, 2026-08-10). The records are not accessible to this project. Not parked pending analysis — unavailable, so the two open questions in View 2.1 are withdrawn rather than left waiting, and nothing may be designed assuming them.
- **The cost is recorded rather than absorbed.** §7.3 claimed the brief's value was connecting the RFP to the past performance library, *"the tedious part of every bid/no-bid call"* — the clearest answer to why open an app instead of reading the RFP. That answer is gone. What remains is a well-organised summary with evidence attached: worth having, not decisive. The app's case now rests on the triage queue's reason capture, which is untouched.
- **View 2.1 rescored, downward and more settled.** `Imp` 5 → 3, `Eff` 4 → 3, `Vol` 4 → 2, `Conc` 60% → 75%. A cut removes work and uncertainty at the same time.
- **The Firm Profile field stays in the model and stays empty** (§4.2), which is the only reason to leave it rather than delete it: if access changes, the capability returns without a migration.
- **The negative profile was collateral and has been rerouted.** §8.2 had past proposals feeding both the library and the negative profile. The negative profile has a second source that *is* available — the hand-run's no-bid reasons — and should be built from those.

*Revision note, 0.1.0 → 0.1.1 — one correction, one decision. 2026-08-10.*

- **Corrected an overstated claim in View 2.1.** The draft said nothing planned a past-performance library. The spec plans it — Firm Profile field, §4.2, component `0B`, with §8.2 naming past proposals as a source. The real gap is that nothing has been collected and that one line is the whole specification. Recorded rather than quietly edited, because the original claim was repeated to Matt in conversation.
- **Settled: the library is engagement records, not proposal text** (Matt, 2026-08-10). Two separate stores — what a bid cites versus what a writer pastes. Tenderfoot owes only the first.
- **Two blocking questions left open deliberately**, both waiting on people rather than analysis: where engagement records live today, and roughly how many exist. The second sets whether the brief needs a retrieval layer at all, so guessing it would have designed the wrong system.
