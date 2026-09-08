# Scoping the working set — label, don't delete

> **STATUS: PROPOSAL, NOT RATIFIED.** Written 2026-09-08 at Matt's request for
> the next session. It has not been through brainstorming and is not a
> `writing-plans` artefact; it is a decision with three small tasks attached.
> Matt's ruling is needed on §5 before Task 3 means anything.

**The question Matt asked:** *"we've got about 1,600 or 2,600 records in there,
but a lot of those aren't needed, were federal, or were incomplete. Do we have a
plan to remove those and use what we got from the API as our real working set?"*

---

## 1. What is actually in there, measured 2026-09-08

| Tier | Solicitations | Biddable | |
|---|---:|---:|---|
| **1. HigherGov, complete days (posted ≥ 2026-08-11)** | **3,154** | 2,774 | every page the vendor reported |
| 2. HigherGov, page-one-only (posted < 2026-08-11) | **84** | 75 | the four exploratory sample days |
| 3. Not HigherGov | 1,970 | 1,970 | SAM.gov 1,724 · corpus 201 · IDOA 71 |

⚠️ **The incomplete tier is far smaller than it looked, and the reason matters.**
The first four-state pull bought fourteen truncated days — but every one of those
days falls inside 2026-08-11 → 09-07, which the paging run later re-bought **in
full**. So the only rows that predate the complete window are the four days
sampled while we were still measuring the source: 2026-06-09, 07-08, 08-05 and
09-02. **84 rows, not the ~1,000 first estimated.**

**So "the API data" and "the working set" are very nearly the same thing already.**
The cleanup is much smaller than the question assumed.

---

## 2. The principle: this is a LABELLING problem, not a deletion problem

The distinction that matters is not *does this row exist* but **what may a
measurement be computed over**. That is a property of the data, and properties
are recorded, not enforced by removal.

Deleting would also destroy two things we are about to need:

1. 🔴 **SAM.gov's rows ARE the evidence for recalibrating F6.** Federal median
   description is **917 characters**; HigherGov's is **156**. That contrast is
   the entire argument for *"the 200-character floor was calibrated on the wrong
   market."* Delete the federal rows and the recalibration loses its basis at
   the moment it is being made.
2. **IDOA's 71 rows cannot be re-fetched.** The source is documented as
   retaining nothing — 60 of them are still open, and they exist nowhere else.

And the timing argument, which applies to all of it: **deleting during a trial we
cannot re-run is irreversible in both directions.** Nothing is gained by doing it
a week early; something is lost if it turns out to have been wrong.

---

## 3. Task 1 — make the measurement window enforceable, not merely documented

**The problem.** `STATUS.md` says in prose that coverage and recall may only be
computed over 2026-08-11 → 09-07. Prose does not stop a future run from
computing a percentage across the 84 page-one-only rows, which would measure
**our purchasing history rather than HigherGov's coverage** — a number that looks
like a measurement and is not one.

**The change.** Record the complete window as data, and have any coverage or
recall computation **refuse** outside it rather than silently widen. The
existing three-state discipline is the model: `unknown` blocks exactly as `fail`
does, and *"we have not measured it"* is not permission to proceed.

**Where it goes** is an open question worth five minutes' thought rather than a
guess: a column on `source`, a row in `ingest_run`, or a ratified constant beside
the floor's thresholds. Whichever is chosen, **the enforcement belongs next to
the computation, not next to the operator** — a warning an operator must remember
is the failure mode this whole project keeps rediscovering (lesson 2.29).

---

## 4. Task 2 — default the queue to the working set

**The problem, seen rather than theorised.** The unscoped queue (1,996 items,
deadline-soonest-first) opens on a `Corpus import — Indiana open` row whose title
renders **`(untitled)`**. The sample-scoped view opens on *Battery Disposal IFB*,
Illinois EPA, with a real three-sentence scope. Same code, same day, different
denominator.

**The change.** The queue's default membership becomes the working set —
HigherGov, complete window, biddable — with tiers 2 and 3 reachable behind a
filter rather than sitting in front of the operator.

⚠️ **`queue.ts` already has a state filter and its own comment calling it *"the
first filter a geographically-bounded firm applies."*** Read that before adding a
second axis: the right shape may be an existing filter's default rather than new
machinery.

**This is a change to what the product shows**, so it is Matt's call whether it
is a default or merely an option, and it may warrant a numbered deviation if the
bundle specifies otherwise.

---

## 5. Task 3 — the deletion decision, deliberately deferred

**Revisit after the triage and the F6 recalibration, not before.** By then:

- The 150-item sample will have produced real decisions, and we will know whether
  tier 3 contributed anything to the judgement.
- F6 will have been recalibrated **using** the federal/state contrast, so SAM's
  rows will have discharged their remaining purpose.
- The trial will be over, so nothing is being decided under a deadline.

**The criteria to decide against, agreed in advance so the decision is not
re-argued from scratch:**

| Keep if | Delete if |
|---|---|
| It is irreplaceable (IDOA) | It is re-ingestable for free (SAM.gov) |
| It is cited as evidence in a ratified decision | Nothing references it |
| It is in the queue's working set | It only ever appears behind a filter nobody uses |

---

## 6. What is NOT proposed here

- **No change to the Indiana EDS contract register** (204,920 rows). It is a
  different table, a different question, and the highest-scoring free source we
  hold. Matt's question was explicitly about *"the opportunities data"*.
- **No re-buying of the 84 page-one-only rows.** They cost ~31 records to
  complete and would add four non-contiguous days to a window that is already
  contiguous — the contiguity is worth more than the days.
- **No deletion in this plan at all.** Task 3 is a decision procedure, not an
  action.
