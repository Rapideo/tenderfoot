# Tenderfoot prototype

**Created 2026-08-10.** Phase 0 of `docs/Proto2PRD.md`, applied per `docs/Tenderfoot-Plan-of-Action.md` Stage A.

This is not a demo. Per Proto2PRD, the prototype is **a specification written in HTML** — precise enough that production is built by reading it, and its mock dataset normalized becomes the production schema (§4.1.1).

---

## Layout

```
prototype/
  PROTOTYPE/
    Tenderfoot UI Mockups V1,1.html  CURRENT — Claude Design export, frozen source
    Tenderfoot UI Mockups.html       V1 — superseded, kept for the diff
    src/tokens.css                   palette + radii — RE-EXTRACTED FROM V1.1, current
    src/app.js                       mock layer — EXTRACTED FROM V1, still stale
  tools/extract-tokens.py            regenerates src/tokens.css from the bundle
  tools/verify-tokens.py             checks every token round-trips to the bundle
  archive/       the losing bake-off directions, kept unmodified
  CLAUDE.md      the prototype's own source-of-truth document (§4.6) — to be written
  README.md      this file
```

## Decisions taken 2026-08-11

Three questions that V1.1 raised were left open overnight and are now closed. All three were Matt's calls.

**1. The radius scale is twelve steps, adopted as-is.** V1 used ten values; V1.1 added a 2 and a 12 rather than converging. Extracting the usage settled it the other way from what "no scale" suggested — **the ramp tracks element size.** An 8×8 checkbox mark takes 1px, a 22×22 checkbox 3px, a chip 4px, a button 7px, a card 9px, a 540px modal 12px. That is a legible rule, just a dense one, so the tokens are named for the element (`--radius-chip`, `--radius-modal`) and a new component picks its radius by asking what it *is*. `--radius-round: 50%` is a separate primitive, not a thirteenth step.

**2. Tokens are named by role, and the generated names are kept as aliases.** `src/tokens.css` now defines all 67 colours under role names and maps every generated name onto its role name in a compatibility block at the foot. The frozen bundle keeps rendering unchanged; new code is written against role names; when nothing references a generated name the block deletes in one step. **No value changed** — a verifier resolves the alias chain back to the bundle and asserts byte-equality.

**3. The prototype stays in this repo.** Not split into its own, notwithstanding the IMPACT precedent recorded below. The cost stands as written: iteration commits interleave with planning commits, and "frozen" stays a convention rather than a property of the filesystem.

> ### `src/tokens.css` is current. `src/app.js` is still stale.
>
> **V1.1 landed hours after the V1 extraction, and moved underneath it.** This is the re-extraction cost that `../docs/Tenderfoot-Plan-of-Action.md` §9 question 5 raised, arriving immediately and answering itself: **every Design iteration invalidates the extraction.**
>
> | | V1 | V1.1 |
> |---|---|---|
> | Template | 114 KB | 160 KB |
> | DSL script | 44.8 KB | 70.0 KB |
> | CSS custom properties | **0** | **67**, with 774 `var()` usages |
> | Raw inline hex | ~700 | 136 |
> | Distinct radii | 10 | **12** |
> | DSL comments | 0 | **0** |
>
> **The generator closed the token gap by itself**, which is why step 3 of the cleanup procedure is now scripted rather than hand-run: `tools/extract-tokens.py` reads values out of the bundle, so a re-extraction costs one command instead of an afternoon. What the script cannot produce is the comment on each token, and that is the part worth keeping.
>
> **The gap that did not close is the one that matters.** V1.1's DSL is 25 KB larger, gained an `ENTITIES` structure, and still carries **zero comments**. That is exactly the finding in `../docs/Proto2PRD.md` §4.3.2.1: the generator produces data, not rules. It will keep producing better data and never produce a rule, because the rules are things only a person in the room knows.
>
> So `src/app.js` still needs re-extracting against V1.1 — the data moved — but **the comments in it are the only copy of the reasoning** and must be carried forward, not regenerated. That is the shape of every future round.
>
> **Also unchanged in V1.1:** the `fonts.googleapis.com` preconnect, and the `Capacity` reason chip that contradicts §1's capacity-agnostic rule.

## What the token extraction turned up

Two findings recorded in `src/tokens.css` rather than fixed, on the standing rule that cleanup never changes a colour.

**Ninety colour pairs sit below the just-noticeable-difference threshold** (ΔE76 < 2.3). Most are harmless — a background and a border may share a value. Four are the same job at an indistinguishable distance, and one looks like an actual defect: `--ground-hover` is 0.44 ΔE from `--ground-recess-3`, which means a hover state a fifth of a JND away from a resting surface and will not read as feedback.

**`--signal-neg` is doing three jobs**: the data-conflict flag (*DEADLINE DISAGREEMENT — NOT RESOLVED*), destructive actions (*Delete view*), and low scores. Those don't co-occur — a record can carry a deadline conflict and still score well — so one red means the interface cannot distinguish "this is wrong" from "this is bad news." That matters more here than it would elsewhere, in a system where §4.5 holds that the reason outranks the decision.

Both are handed back, same as the radii were.

> ## The whole directory is reference. Nothing in it is edited.
>
> **Matt, 2026-08-11:** *"the prototype is a reference ONLY. We can copy code from it as a starting point, but we never change the prototype itself."*
>
> That is stronger than the frozen-bundle rule this file previously carried, and it supersedes it. **Every file under `prototype/` is read-only** — the bundle, `archive/`, and `src/`. Production code **copies out** into the production tree and evolves there. Nothing is edited in place, and the production tree never points back into this directory at runtime.
>
> **New Design versions arrive as new files alongside the old ones**, which is not a change to anything existing. `src/` is regenerated wholesale from the current bundle by `tools/extract-tokens.py` rather than hand-patched.
>
> **One consequence that needs a home and does not have one yet.** `src/app.js` carries the rule-bearing comments — the business rules behind each field, which `../docs/ClaudeDesign_Proto_Cleanup.md` identifies as the only artifact in the whole cleanup that *accumulates* rather than being replaced. **A frozen reference cannot accumulate anything.** So when the production tree exists, those comments move with the code on the first copy-out and live there from then on, and this file's copy stops being the authority. Until that tree exists, `src/app.js` is the only home they have — worth knowing, because it is the one place where "reference only" and "the comments must accumulate" genuinely pull against each other.

**Why the bundle in particular can never be edited.** Its template is a JSON string inside a `<script>` tag; editing it in place is possible and pointless, because a re-export from Claude Design discards the edits. It stays as the record of what the direction looked like before anyone cleaned it up. Extraction goes *out* of it, into `src/`.

The extraction procedure is written down: [`../docs/ClaudeDesign_Proto_Cleanup.md`](../docs/ClaudeDesign_Proto_Cleanup.md).

**What `src/` hands back rather than decides.** The radius scale — resolved 2026-08-11, see above. And the reason-chip vocabulary, which the generator invented — **now parked rather than pending** (spec §1.1): with qualification deferred, nothing consumes reasons, so V1 records free text and there is no vocabulary to derive.

> ### The prototype shows the finished product, not V1
>
> **Stated by Matt 2026-08-11 and it settles a question this document was about to get wrong.** The prototype renders a scoring layer V1 does not have — score strips, four-component scores, gated items. **Those stay. All of them.** The prototype represents the final released product and doubles as demo material, so it is measured against the destination rather than against the first shippable slice.
>
> **So the prototype is not ahead of the plan; it is the plan's endpoint.** V1 (spec §1.1) builds a subset of what is drawn here. That is a normal relationship between a specification and a first release, and it is worth naming because the obvious reading — *the prototype is out of date, trim it* — is exactly backwards. **Nothing here gets trimmed to match V1's scope.**
>
> **Two things follow.** Iteration in Claude Design continues against the full product, not against V1, so a future version adding more intelligence surface is on-plan rather than scope creep. And the SVRC's parked nodes (1.1.2, 1.1.5, 2.2) are parked **for V1**, not removed from the product — they describe screens that ship eventually and are drawn already.
>
> **The one place this still needs care is the schema.** Proto2PRD §4.1.1 makes this dataset the production data model, and V1's migrations should not carry fields nothing populates for a year. Read the header of `src/app.js`: `scores[]` and the chip vocabularies are flagged as **later-phase, not V1 schema** — a phasing note, not a defect report.

## Three rules, all from the recovered IMPACT record

**1. Commit every bake-off direction, not just the winner.** IMPACT's first commit contained *three* complete competing directions across the same three screens. The losers were archived, never deleted, and the archive carries a standing instruction: **do not modify archived files.** They are the evidence for why the winner won, and they are the only surviving record of what was rejected. If directions were generated outside this repo, commit all of them here before promoting one (§4.3, §4.4).

**2. The mock layer is the specification.** Not a data file — an architecture: an IIFE exposing a single namespace, realistic seed data, a defaults-plus-overlay merge, namespaced storage keys, and **comments that state the business rule each block enforces.** Those comments are what production is built from (§4.1.1).

Tenderfoot's seed data should be a curated subset of the real corpus — actual solicitations from `corpus/`, with their genuine 140-character titles and ugly scopes. Not synthetic. Not a path reference into `corpus/` either: the prototype carries its own copy, because that dataset is what becomes the schema.

**3. Freeze means frozen.** When stakeholders stop asking for changes, stop editing (§4.9). A specification that moves is not a specification.

> **Deviation from IMPACT, recorded deliberately.** IMPACT's prototype was its **own git repo**, nested inside the production repo and tracked independently — which gave 177 iteration commits their own history and made the freeze a hard boundary rather than a convention. Tenderfoot's lives in this repo instead, decided 2026-08-10, because there is no production repo to nest inside yet.
>
> **What that costs:** prototype iteration commits interleave with planning and corpus commits, and "frozen" becomes a rule people follow rather than a property of the filesystem. If the log gets noisy, splitting this directory into its own repo later is the fix — and doing it after a hundred commits is more annoying than doing it now. Resolves `docs/Tenderfoot-Plan-of-Action.md` §9 item 3.
>
> **Reaffirmed 2026-08-11**, with the "do it now or regret it later" argument put explicitly and declined. The cost above is accepted rather than unnoticed.

## Bake-off notes

Three screens, chosen because between them they exercise nearly every visual decision a business application makes (`docs/Tenderfoot-Plan-of-Action.md` §A3):

| Screen | Archetype | What it exercises |
|---|---|---|
| Triage queue | Dense list | Table density, four-score display, scanning rhythm |
| Opportunity brief | Document-heavy detail | Evidence and citation pattern, fact panels, long-form reading |
| Firm Profile editor | Long varied form | Every form primitive |

**Hold brand hue constant across directions; vary canvas, radii, typography, shadow** (§4.3.1). If the directions differ on everything, the choice collapses to "which do you like," which is unresolvable.

**The palette is measured after selection, not before** (§4.5) — from one named source, sampled per token, with a comment naming the source element. There is no Tenderfoot mark yet, so the **wordmark is an output of the bake-off**, not an input: each direction renders the name in its own register, and that is part of what is being chosen (§A1.1).

**Write the bake-off brief down.** How many directions, and what register each represents. IMPACT's brief was lost, and it is the one part of its Phase 0 that did not survive.
