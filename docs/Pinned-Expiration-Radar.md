# PINNED — the expiration radar, and the watch list

**Parked 2026-09-03 on Matt's idea. Nothing is built.** This file exists so the
slice is not rediscovered in three weeks, and — more importantly — so that
**whoever picks it up does not redesign the half that is already specified.**

Matt, 2026-09-03, verbatim:

> *"We also at some point have an area of the app that shows upcoming CONTRACTS
> that are expiring, and we do a similar Triage for appropriateness, and then add
> them to a watch list. Just an idea to add to our roadmap."*

---

## ⚠️ HALF OF THIS IS ALREADY DESIGNED — read before designing anything

Four places already specify it. **None of them is a sketch.**

| Where | What it already says |
|---|---|
| **Design spec §4.6** | *"Expiration radar: contracts ending in 6–18 months, at Organizations matching geography, in categories matching the Profile, held by displaceable Vendors."* |
| **§7.4 Radars** | Expiration and Teaming, **browsable and filterable**. *"Pure graph queries with no email equivalent; they exist only because of the entity model."* |
| **§6.5 mode 3** | *"**What's coming?** — the expiration radar (§4.6), **scored identically but against a predicted solicitation**"* |
| **The frozen V1.2 bundle** | The cleared-queue card already reads *"3 contracts expire inside your sectors."* |

And the schema was built for it. `002_entity_graph.sql:137` carries the comment
on `contract.ends_at`:

> *"The contract end date is the highest-value field in the system (§4.3). It is
> the entire answer to problem #2, and the expiration radar is a query over this
> column."*

**So the radar is not a new feature request. It is a specified feature that has
never had data to run on.** `contract` has never held a row.

---

## What IS new in Matt's framing, and both parts are real

### 1. A triage on contracts

The spec has the radar as **a query and a browsable screen**. It does not have a
*queue you clear with recorded decisions*. Matt's version adds the triage habit —
the same ten-second Interested / Not Interested with a captured reason that the
solicitation queue already uses.

That is a genuine addition, and a cheap one: it is the existing triage interaction
pointed at a different table.

### 2. A watch list — and it is a NEW ENTITY, not a reuse

**It cannot be a `pursuit` row, and this is a schema fact rather than a
preference.** `pursuit.solicitation_id` is `integer NOT NULL REFERENCES
solicitation(id)` (`002_entity_graph.sql:246`). A watched contract has no
solicitation — that is the entire point of watching it. The solicitation is the
thing that has not happened yet.

It is also a different state machine:

| | `pursuit` | a watch |
|---|---|---|
| Anchored to | a solicitation that exists | a contract that is **ending** |
| The decision | bid or don't | *tell me when this comes around* |
| Trigger | the deadline, now | **`ends_at` minus a lead time — in the future** |
| Terminal state | Interested / Not Interested | a solicitation appears, and a `pursuit` begins |

**The last row is the interesting one.** A watch's success condition is that it
*becomes* a pursuit — which makes the watch list the first thing in the system
that would close the loop from contract → predicted re-compete → real
solicitation → decision. That is §4.3's entity chain running forwards.

---

## 🔴 The tension to carry, stated rather than resolved

**§6.5 already says the radar is *"scored identically"* to the solicitation
funnel.** The spec expects a scorer here. Matt's triage is the **un-scored version
of that same screen**.

**Building the un-scored version first is the correct order**, and for a reason
worth writing down: the scorer §6.5 anticipates would need labelled examples of
what a KP-shaped contract looks like, and **the triage is what produces them.**
Scoring first would mean inventing the ground truth the score is meant to learn.

**But it must be built knowing it sits one commit from the parked design.** §7.10
clause 2: *"A rendered control may never become an active filter, ranking, or score
without qualification being designed first."* A radar screen with a triage on it,
sorted by anything that resembles fit, is exactly the *"one small commit away from
existing"* case that clause names — *"not the wrong answer, but the unratified
one."*

**Sort by `ends_at`. Nothing else.** Any other ordering is a ranking.

---

## Hard dependency: the contract ingest, which does not exist

**Nothing in the merge layer reaches `contract`.** Every extractor —
`closes-at.ts`, `posted-at.ts`, `description.ts`, `title.ts`, `place.ts`,
`org-chain.ts` — terminates in `solicitation`. A contract is not a solicitation
and **must not enter the triage queue**; there is nothing to decide about work
already awarded. This is a **new write path, not a new source**
(`docs/Pinned-Indiana-Contract-Register.md`).

The radar therefore sits behind:

1. **The Indiana EDS contract register ingest** — ~205k rows, a PDF each, and
   `amount` is a per-amendment delta that goes negative, **not** a contract value.
   The running total is EDS form field 7 and exists only inside the PDF.
2. **Vendor resolution** — `vendor_alias` anticipates that `TIMOTHY WARRICK` and
   `Timothy Warrick, Inc.` are one vendor. Unimplemented. "Held by displaceable
   Vendors" is not answerable until it is.
3. **A lead-time rule** — §4.6 says 6–18 months. Whether that is a constant, a
   Profile setting, or per-contract is undesigned.

---

## 💡 Why this idea is strategically bigger than a roadmap item

**It is the answer to the ratification question, made concrete.**

Asked what the contract corpus is FOR, Matt answered **"somewhere between"** a
live product surface *(2)* and calibration for qualification *(3)*
(`docs/Pinned-Indiana-Contract-Register.md`). "Somewhere between" reads as
indecision — **but the radar IS the live product surface.** So the answer may
simply be accurate, and it points at a ruling that can actually be built against:

> **The corpus serves both. The radar surfaces expiring contracts, a human triages
> them, and those judgements accumulate as evidence toward a qualification design.
> Nothing scores until that design exists.**

That keeps §7.10 clause 2 intact — the human decides, the machine only surfaces —
and it requires no new machinery, because it is exactly how the solicitation queue
already works.

**This is a candidate ruling, not a ruling.** It has not been put to Matt in those
words. Decision 01 is still open.

---

## Open design questions, none of them answered here

1. **Does a contract go through `sighting` / `merge` at all, or write direct?**
   Change detection over an historical record may be meaningless.
2. **What does "first seen" mean for a record that is already historical?**
3. **What is the watch's own state vocabulary?** `Watching` / `Dismissed` /
   `Converted`? And does dismissing a watch carry a reason, as a pursuit does?
4. **What happens when the re-compete appears?** Automatic link, or a human
   confirming *this is the one I was waiting for*? The second is more honest and
   is the only one that produces a clean training example.
5. **Where does it live in the shell?** §7.4 puts Radars alongside the queue.
   `Region A.2 : Status Bar` is still unbuilt and the shell is a hard dependency.

---

## What decides whether this gets built

**Decision 01 — what the contract corpus is for** — see
`docs/Pinned-Indiana-Contract-Register.md` and the 2026-09-03 decision sheet.
The radar is buildable under *(2)* and under the "both, nothing scores" ruling
above. It is **not** buildable as specified under §6.5's scored version without
qualification being designed first.

**Sequence, if it goes ahead:** contract ingest → vendor resolution → radar as a
read-only `ends_at` query → triage on it → watch list. **Five slices, not one**,
and only the first two are data plumbing.
