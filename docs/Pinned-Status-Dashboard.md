# PINNED — a project status dashboard

**Raised 2026-08-12 by Matt. Not designed, not scheduled. Possibly its own project rather than part of Tenderfoot.**

> *"I would love for us to come up with a status dashboard that explains where we are in any project… a formatting document that Claude Code could update the JSON in and have a local webpage read that. At a glance I could see where we were in the project and learn more about the project from a planning standpoint."*

---

## Why it is less pie-in-the-sky than it sounds

**`STATUS.md` — written the same day — is already the v0.** It exists because the reasoning had buried the status: `Tenderfoot-Plan-of-Action.md` is meant to be the status document, and a week of decision history made it unusable for that. Matt lost the thread, said so, and the fix was a one-screen summary.

**So the problem is real and already demonstrated**, not hypothetical. The dashboard is the same fix with two improvements: machine-readable, and legible at a glance rather than by reading.

## The insight worth keeping

**The data model falls out of `STATUS.md` rather than needing invention.** Everything in it is already structured:

- **Stages and slices** — id, name, one-line description, status, blocking relationships
- **Owed items** — owner, what it blocks, whether it is blocking anything *now*
- **Decisions** — date, what was decided, link to where the reasoning lives
- **Risks** — statement, trigger that makes it real
- **Artifacts** — path, what it is, whether it is current

That is a small schema. **The interesting question is not the format — it is which fields make a project legible to someone returning to it after a week away**, which is the actual failure this addresses.

## What it must not become

**Not a task tracker.** Those exist, they are good, and this is not that. The gap it fills is *orientation* — where am I in the shape of this project — which task trackers are specifically bad at because they show leaves and hide the tree.

**Not a thing that needs maintaining separately.** If it drifts from reality it is worse than nothing, because it looks authoritative. Either it is generated from documents that are already being kept current, or an agent updates it as part of the work that changes it.

## Shape, if it happens

Agent writes `status.json`; a static local page reads it. No server, no build step, opened from disk. Same discipline as the explainer: self-contained, regenerable in one command, refuses to publish something stale.

**Cross-project by design.** The point is a format that works for Tenderfoot, IDE8, and whatever comes next — which means the schema has to be general and the vocabulary has to survive projects that do not use Proto2PRD's stage/slice structure at all.

## Status

**Pinned.** A candidate side project, like the terms-of-art glossary (`C:\Users\matts\Desktop\GLOSSARY-PROJECT-PROMPT.md`). **`STATUS.md` stands in until then and is worth keeping current regardless** — if it turns out to be enough on its own, that is a result too.
