# PINNED — a scraping console in the admin area

**Raised 2026-09-02 by Matt, during the IDOA adapter brainstorm. Not designed, not scheduled.**

> *"Right now we have that pretty limited list of our agents in our admin area. I'd like to see
> that fleshed out as its own scraping area, where we list the adapters we have active and some
> manual options for scanning. I'd like to see us expand that and make it look a little nicer at
> some point when we need to."*

---

## What exists today, so the gap is concrete

`/admin`'s **Source Registry** is a table of the 13 `source` rows with `ENABLED`, `LEGAL`,
`HEALTH`, and — from SP3.6 — **Check** and **Run** controls per row, plus two batch controls at
the foot of the card (D10).

**What it is NOT is a view of the ADAPTERS.** The registry lists *sources*; the adapter layer is
invisible from the UI. Today that gap is nearly harmless because there are three adapters and one
of them is a fixture. It stops being harmless the moment sources outnumber adapters in a way a
reader has to reason about — which is already true: **`Indiana IDOA solicitations` reads health
`ok` and has no adapter at all**, and nothing on the screen says so. A person looking at that row
would reasonably conclude it is one toggle away from working.

## Why this is its own thing and not part of the IDOA slice

The IDOA work changes the adapter *contract* (two source shapes, §5.5-adjacent). This is a
*surface* for that layer. They inform each other but neither blocks the other, and folding a
screen into an adapter slice is how SP6's record screen got hand-rolled — see `CLAUDE.md` §3.

## What it would plausibly hold, from Matt's description

- **The adapters we actually have**, and which sources each binds to — the thing no screen shows.
- **Which sources have no adapter**, stated plainly rather than left to be inferred from a
  health value that looks reassuring.
- **Manual scan controls**, and this is the half with real design in it: Matt has separately
  asked for *"just grab me 1,000 records"* — a row LIMIT alongside the existing time budget,
  which today is expressed only as a date window (the two production ingests were "12-hour" and
  "seven-day", which is a clumsy way to say "a manageable amount").
- **Last run, what it returned, and whether it completed** — `run.ts` already computes
  `done` / `noProgress` / `nextUntil`; none of it reaches a screen.

## ⚠️ Two constraints it must not be designed around

**The fidelity mandate applies.** Any screen here is matched against the frozen V1.2 bundle
(`CLAUDE.md` §1). The bundle has a Source Registry; **whether it has anything adapter-shaped is
UNVERIFIED** — that check is the first task, not an afterthought, and if the bundle is silent the
invention gets a numbered deviation (§7.10, and the `ship-with-numbered-deviations` habit).

**The vestigial-chrome guard applies.** §7.10 clause 2: a rendered control may never become a
live filter or trigger without the thing it triggers being designed first. A "Run adapter" button
for an adapter that does not exist is exactly the failure that clause exists to stop.

## Related

`docs/Pinned-Ingestion-Scaffolding.md` — unattended ingestion, deferred to SP7. A scraping console
is the *manual* half of the same surface, and the two should be designed knowing about each other.
