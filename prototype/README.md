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
    src/app.js                       mock layer — EXTRACTED FROM V1, now stale
    src/tokens.css                   palette — EXTRACTED FROM V1, now superseded
  archive/       the losing bake-off directions, kept unmodified
  CLAUDE.md      the prototype's own source-of-truth document (§4.6) — to be written
  README.md      this file
```

> ### `src/` is stale as of V1.1 — read this before using it
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
> **The generator closed the token gap by itself.** V1.1 defines 67 tokens and uses them 774 times. `src/tokens.css` — extraction-by-hand from V1 — is therefore **superseded as a token layer.** Its only remaining value is as a *naming* proposal: the generated names are terse and positional (`--acc`, `--brd`, `--text3b`, `--brdctl4`, `--accbg2/3/4`), which tells you a value was added when one was needed rather than designed as a scale. Mine name by role. Neither is authoritative until someone decides.
>
> **The radius problem got worse, not better** — twelve values now, including a new 2 and 12. Still no scale.
>
> **The gap that did not close is the one that matters.** V1.1's DSL is 25 KB larger, gained an `ENTITIES` structure, and still carries **zero comments**. That is exactly the finding in `../docs/Proto2PRD.md` §4.3.2.1: the generator produces data, not rules. It will keep producing better data and never produce a rule, because the rules are things only a person in the room knows.
>
> So `src/app.js` needs re-extracting against V1.1 — the data moved — but **the comments in it are still the only copy of the reasoning** and must be carried forward, not regenerated. That is the shape of every future round.
>
> **Also unchanged in V1.1:** the `fonts.googleapis.com` preconnect, and the `Capacity` reason chip that contradicts §1's capacity-agnostic rule.

`PROTOTYPE/src/` is the one that moves. The bundle and `archive/` never do.

**Why the bundle is frozen.** Its template is a JSON string inside a `<script>` tag; editing it in place is possible and pointless, because a re-export from Claude Design discards the edits. It stays as the record of what the direction looked like before anyone cleaned it up. Extraction goes *out* of it, into `src/`.

The extraction procedure is written down: [`../docs/ClaudeDesign_Proto_Cleanup.md`](../docs/ClaudeDesign_Proto_Cleanup.md).

**Two things `src/` hands back rather than decides.** The radius scale — the direction used ten values and collapsing them changes how it looks, which makes it a design call. And the reason-chip vocabulary, which the generator invented and which must be replaced by categories that emerge from the hand-run, in the scorer's own words.

## Three rules, all from the recovered IMPACT record

**1. Commit every bake-off direction, not just the winner.** IMPACT's first commit contained *three* complete competing directions across the same three screens. The losers were archived, never deleted, and the archive carries a standing instruction: **do not modify archived files.** They are the evidence for why the winner won, and they are the only surviving record of what was rejected. If directions were generated outside this repo, commit all of them here before promoting one (§4.3, §4.4).

**2. The mock layer is the specification.** Not a data file — an architecture: an IIFE exposing a single namespace, realistic seed data, a defaults-plus-overlay merge, namespaced storage keys, and **comments that state the business rule each block enforces.** Those comments are what production is built from (§4.1.1).

Tenderfoot's seed data should be a curated subset of the real corpus — actual solicitations from `corpus/`, with their genuine 140-character titles and ugly scopes. Not synthetic. Not a path reference into `corpus/` either: the prototype carries its own copy, because that dataset is what becomes the schema.

**3. Freeze means frozen.** When stakeholders stop asking for changes, stop editing (§4.9). A specification that moves is not a specification.

> **Deviation from IMPACT, recorded deliberately.** IMPACT's prototype was its **own git repo**, nested inside the production repo and tracked independently — which gave 177 iteration commits their own history and made the freeze a hard boundary rather than a convention. Tenderfoot's lives in this repo instead, decided 2026-08-10, because there is no production repo to nest inside yet.
>
> **What that costs:** prototype iteration commits interleave with planning and corpus commits, and "frozen" becomes a rule people follow rather than a property of the filesystem. If the log gets noisy, splitting this directory into its own repo later is the fix — and doing it after a hundred commits is more annoying than doing it now. Resolves `docs/Tenderfoot-Plan-of-Action.md` §9 item 3.

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
