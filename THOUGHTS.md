# THOUGHTS — parked backlog

**Filed 2026-08-18 on Matt's ruling.** These were four loose notes; they are now
backlog items carrying an explicit **PARKED** marker — the same convention
`three_open_questions.md` Q2 established for SVRC nodes, and for the same reason:
**planning excludes a parked item by the marker, not by a number.**

> **What filing them does and does not mean.**
>
> **Does:** they are recorded, they cannot be lost between sessions, and each one
> names what V1 gives up by not having it.
>
> **Does NOT:** nothing here is designed, scoped, estimated or sequenced. **None of
> it is in V1.** A parked item that quietly acquires a design is no longer parked,
> and three of the four below are close enough to the retired matching engine that
> this is a live risk rather than a formality.

**Why three of these are one idea.** Items 1–3 are all *qualification* — deciding
whether an opportunity is worth something — which is exactly what **SP5 (matching
engine) was, and it was removed from the sequence on 2026-08-11**: *"V1 returns
everything (spec §1.1); qualification is undesigned and will be re-imagined after
ingestion runs."* That ruling is unchanged. These items do not reopen it; they
record what will want re-imagining when it is reopened. **Item 4 is a different
animal** and is parked on its own terms.

---

## 1. Post-selection research — **PARKED**

After the system surfaces a bid that looks good, do additional research that helps
with *responding to it*, not with finding it.

**What V1 gives up:** nothing, by construction. V1 stops at *here is what exists*;
everything downstream of "this one looks good" is a human with a browser today.

**Why it is not V1:** it presumes a selection step. V1 has no scores and makes no
selection (§1.1), so this has nothing to trigger it.

---

## 2. Levels of research, and qualifying against them — **PARKED**

Define tiers of research depth, and qualify opportunities against the tier they
have reached.

**What V1 gives up:** the ability to say *why* one opportunity deserves more
attention than another. V1 deliberately cannot say this.

**Why it is not V1:** this **is** the matching engine, restated as a ladder rather
than a score. It inherits SP5's removal note in full, including the part that
matters most — qualification is **undesigned**, not merely unbuilt, so there is
nothing here to implement yet even if it were wanted.

---

## 3. Analysis over the historical data — **PARKED**

There are 20+ years of historical contract data reachable (Indiana EDS records
204,439 contracts back to 2005; USASpending reaches FY2001). What analysis over it
would make for a better product?

**What V1 gives up:** any use of history at all — base rates, incumbency patterns,
who actually wins what, whether a solicitation resembles work KP has won before.

**Why it is not V1:** it is the most seductive item on this list and the one most
likely to be started by accident, because the data is *right there* and the
ingestion machinery to reach it already exists. ⚠️ **Volume counting is not this.**
Counting rows per run (530 / 57 / ~1,724) measures whether the pipe is alive and is
squarely mechanics — A3's 2026-08-16 ruling put source health in front of the GO
gate for exactly that reason. **The line is: counting what arrives is instrumentation;
forming a view about what arrived is this item.**

---

## 4. A NotebookLM-style chat and document interface — **PARKED**

An interface for asking questions across the collected material and generating
documents related to responding.

**What V1 gives up:** any conversational surface. V1 is seven screens and a triage
queue; there is nowhere to ask a question.

**Why it is not V1:** it is a whole product surface, not a feature — and it depends
on documents being fetched, extracted and cited, which is SP4 and does not exist
yet. **It is the only item here that is not qualification in disguise**, and the
only one whose dependency is mechanical rather than a parked design.
