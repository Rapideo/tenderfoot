# ~~Three open questions — Matt owes answers~~ — ✅ ALL THREE ANSWERED, CLOSED 2026-08-14

**Raised 2026-08-12** by Claude, at Matt's request, so they are not lost between sessions.
**Subject:** the `Imp` / `Pri` columns in [`reference/Tenderfoot SVRC.md`](reference/Tenderfoot%20SVRC.md).

> **CLOSED 2026-08-14. Q1 answered 08-13; Q2 and Q3 answered 08-14.**
> All three rulings are recorded in the SVRC — the two definitional ones in the scoring key, where a reader will actually be, and the re-score in the grids themselves (**v0.6.0, fourteen of twenty values moved**).
>
> **This file is now history and should not be consulted for current scores.** It is kept because the arguments in it are the record of *why* the numbers are what they are, and because the five nodes it flagged turned out to be the wrong five — which is the most useful thing in it.
>
> **Nothing is owed here any more.** The `Imp`/`Pri` review that gated `docs/Tenderfoot-Plan-of-Action.md` §6 reconciliation is done; item 7 there is unblocked.

---

## Background — why these columns need attention at all

The SVRC gives every scored node a six-column grid: `Eff` `Imp` `Pri` `Vol` `Proto` `Conc`.

**`Eff`, `Vol` and `Conc` are Claude's to judge** — cost to build, likelihood of churn, and how settled the idea is. **`Imp` and `Pri` are business judgments about KP** and are Matt's.

They were nonetheless filled in by Claude when the document was drafted, because the format forbids a half-filled grid or an unscored leaf, and `·` on twenty nodes would have broken it. This was flagged in the preamble at the time.

**Adoption then changed their status without changing their content.** `docs/Tenderfoot-Plan-of-Action.md` §6 derives slice ordering from `Pri` — so twenty placeholder guesses became a live input to build order. That is precisely what the `·` convention exists to prevent; the no-half-grid rule simply pushed harder.

**And the ground moved under them on 2026-08-11.** The scores were assigned against a system with a matching engine. V1 has none (spec §1.1). Several nodes are now wrong in a way that can be argued rather than merely suspected — listed at the foot of this file.

---

## Q1 — Is `Pri` product priority, or build priority?

The scoring key defines `Pri` as *"how soon this should be built, all things considered."* But the plan of action derives slice ordering **from** `Pri`. If `Pri` already accounts for technical dependency, the two are circular.

~~**Claude's reading, for confirmation or correction:**~~ ✅ **ANSWERED 2026-08-13 by Matt — the reading is confirmed.**

> **`Pri` is pure product judgment: how much KP wants the thing.** Independent of what has to be built first. Dependency ordering is applied on top, once, in the plan. **A node can legitimately be `Pri 5` and still land in a late slice** because three other things must exist first.

**What this settles, and it is more than the definition.** The circularity is broken: `Pri` is now an *input* to slice ordering rather than a partial restatement of it, so §6's sequence can be reconciled against it without arguing in a circle.

**What it does not settle.** The twenty existing `Pri` values were written by Claude against a system that **had a matching engine**, and several are wrong under that definition rather than merely stale — the five listed at the foot of this file. **Confirming the definition makes those disagreements arguable rather than vague, which is progress, but it does not resolve them.** Q3 is where that gets scoped.

**Recorded in the SVRC's scoring key**, so the next person reading a grid does not have to find this file.

---

## Q2 — How should a parked node be scored?

✅ **ANSWERED 2026-08-14 by Matt — option (d), a marker outside the grid.**

> **A parked node keeps its product scores, and carries a bold `PARKED` line directly beneath its heading, above the grid.** Planning excludes it **by the marker, not by the number.**

**Adopted as a standing rule in the scoring key**, not as a treatment of one node — so `Pri 4` stands on `View 2.2`, and the next node to be parked inherits the convention instead of a precedent someone has to notice.

**Why (d) over the stopgap it replaces.** (a) kept the number honest but put the warning in prose — three copies of it, in the preamble, the node, and the audit trail, none of them where the eye lands. (d) keeps (a)'s virtue and removes its failure mode by moving the warning to where the reader already is. **`View 2.2` and `View 2.3` are now distinguishable without either grid changing.**

**One correction it forces.** *"Read their `Pri` as zero for V1"* is superseded and was **wrong, not merely redundant** — it asked a reader to mentally rewrite a number that was never zero. The priority is not zero; the node is outside V1's scope. Struck in all three places.

**The marker crosses the level-3 line, which grids and labels do not** — parking is a fact about a node rather than a judgment about it, so `Region 1.1.2` and `Region 1.1.5` carry it despite having no grid. Q2 was a one-node question about *scoring* and a three-node question about *marking*.

**Recorded in the SVRC's scoring key** (v0.5.1), so the next person reading a grid does not have to find this file.

<details>
<summary>The original question, kept for the reasoning</summary>

### What "parked" means here

A **parked node** describes functionality that is **deferred out of V1 but still part of the finished product.** It is not cut, not deprecated, and not a candidate for deletion — the prototype renders it, and it ships eventually.

Three nodes are parked, all by the 2026-08-11 decision that V1 returns everything and ranks nothing:

- `Region 1.1.2 : Score Strip`
- `Region 1.1.5 : Gated Items Drawer`
- `View 2.2 : Scores and Evidence`

### **The question is smaller than it first appears — only one of the three is scored**

Per the format, grids sit at levels 1–2 only. `Region 1.1.2` and `Region 1.1.5` are level-3 nodes and carry **no grid at all**, so there is nothing to decide about them.

**So Q2 concerns exactly one node: `View 2.2 : Scores and Evidence`, currently `Pri 4`.**

### A worked contrast — two adjacent Views under Screen 2

| | `View 2.2 : Scores and Evidence` | `View 2.3 : Extracted Fields` |
|---|---|---|
| What it shows | The four machine scores at full width, each with the quoted text that produced it | Every extracted field — deadline, set-aside, forms, references — with confidence and a pointer to the source document |
| In V1? | **No.** V1 produces no scores, so there is nothing to display | **Yes** |
| In the finished product? | Yes. The prototype renders it | Yes |
| Status | **Parked** | **Not parked** |
| Current grid | `Eff 3 · Imp 4 · Pri 4 · Vol 3 · Conc 70%` | `Eff 3 · Imp 4 · Pri 4 · Vol 2 · Conc 75%` |

The two carry near-identical grids today. One ships in the first release and is arguably the most important thing in it; the other cannot be built for a year or more. **A reader cannot currently tell them apart from the numbers**, and that is the whole problem.

### The options

**(a) Score it as the product values it; record the parking elsewhere.** `Pri 4` stands, because in the finished product it genuinely is a 4. Keeps the grid a stable statement about the product rather than about the current sprint. **Cost:** the number on the page is not the operative one for planning, and the prose note saying so is easy to miss.

**(b) Drop `Pri` to 1.** The grid then reads true for planning. **Cost:** it destroys the product-level judgment, and when the node un-parks, someone has to reconstruct what it was worth — probably by guessing, which is how this whole situation started.

**(c) Score it `·`.** Honest that the priority is presently undefined. **Cost:** re-introduces the half-filled grid the format forbids.

**(d) Something else** — for instance a marker outside the grid, since the format already puts bold labels outside the heading tree for exactly this kind of thing.

**Claude's current stopgap is (a)**, with a prose line in the preamble saying to read those `Pri` values as zero for V1. It works and it is fragile.

**Answer needed:** which option, and whether it becomes a standing rule in the scoring key.

</details>

---

## Q3 — How much re-scoring do you want to do?

✅ **ANSWERED 2026-08-14 by Matt — all twenty. "Open the doc; do all 20."**

**Fourteen of the twenty moved.** `Imp` and `Pri` are now rulings rather than placeholders, which closes the caveat this document exists because of. Applied in SVRC **v0.6.0**.

**The choice was vindicated by what it caught, and the five-node option could not have caught it.** The two worst values in the document were `Shell A` and `Region A.1`, both at `Pri 5` — *"built once, early, everything assumes it"* — which is the build-order definition **Q1 had outlawed the day before.** They were not on the flagged list because the flagged list was assembled by asking *"what looks too low?"* **Every one of the five was an under-score. Nobody thought to look for an over-score.**

**The general lesson, staged as `Proto2PRD-Lessons.md` §2.18.** Q1 changed what `Pri` *means*, and the twenty values written under the old meaning stayed put. **Redefining a column does not re-score it, and nothing in a diff shows the gap** — the definition moves in one line, the stale values move in none.

**Opening the document mattered independently of the numbers.** `View 1.2`'s `Known gaps` still read *"genuinely a candidate for cutting"* and its `Open questions` still asked a question ratified on 08-13. Editing grids from a list would have left a node whose numbers and prose contradict each other.

**One item deliberately left unsettled.** `View 1.2` is now `Imp 4` at `Conc 45%` — the lowest completeness in the document. The justification is that the old `2`s meant *"unexamined"* rather than *"unimportant,"* which is **Claude's reading of Matt's intent a year ago and the least-evidenced claim in the pass.** Flagged in the node itself to be revisited once anything is designed.

<details>
<summary>The original question</summary>

| Scope | Cost | Gets you |
|---|---|---|
| The five flagged below | ~5 minutes | Most of the value |
| All twenty scored nodes | ~30 minutes with the doc open | A grid that is entirely yours rather than partly Claude's |

**Answer needed:** which, and when.

</details>

---

## The five nodes Claude believes are now wrong

Offered as argument, not as a recommendation to adopt.

| Node | Now | Why it looks wrong |
|---|---|---|
| `View 1.2 : Saved Views` | `Imp 2 · Pri 2` | **The most under-scored node in the document.** Scored low when a matching engine was going to make the volume tractable. With V1 returning everything and never ranking, saved views are the *only* way the firehose gets carved. Primary interaction, not a convenience. |
| `View 2.3 : Extracted Fields` | `Imp 4` | With no scores, extraction accuracy is the **only** thing V1 can be right or wrong about (§8.4). Arguably a 5. |
| `View 6.2 : Source Registry` | `Pri 4` | Switching a source on or off is V1's **entire** control surface. Arguably a 5. |
| `View 3.1 : Expiration Radar` | `Pri 2` | Too low. `Eff 2`, `Imp 4`, data already collected, and §6.0 concluded its position improves under the V1 decision. |
| ~~`View 2.2 : Scores and Evidence`~~ ✅ | `Pri 4` | ~~Parked. Not defensible as a 4 for planning~~ — **resolved by Q2, and the resolution was not to move the number.** `Pri 4` is a true statement about the finished product; the `PARKED` marker is what keeps it out of the V1 sequence. **Four nodes left, not five.** |

---

## Not blocked on Matt

**`Proto` is 0% on all twenty nodes and stale** — a prototype now exists. The column means *how close the prototype is to what we actually want*, which Claude can assess by looking at it. **Claude will draft these; Matt corrects anything he disagrees with.** No answer needed here.
