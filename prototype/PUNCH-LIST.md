# Prototype punch list

**Opened 2026-08-12.** Changes wanted in the next Claude Design iteration.

**How this works.** `prototype/` is reference-only — nothing here is edited in place (see [`README.md`](README.md)). Changes happen in Claude Design and arrive as a new version alongside the old ones. **This file is the input to that round.**

Items are Matt's to action; anyone may add. **Add the reason, not just the change** — a punch item without a rationale is indistinguishable from a preference by the time it gets built.

---

## ✅ CLOSED — V1.2 landed 2026-08-13

**Both items resolved. Neither the way the list expected.**

Item 1 turned out to need a deletion rather than a design — the mark and wordmark already existed and only their label was provisional. Item 2 was closed **won't-do** after measuring the design system rather than assuming it could stretch.

**Steps 2–6 below all completed against `Tenderfoot UI Mockups V1.2.html`:** tokens verified *unchanged* against the new bundle before regenerating (67 tokens, 13 radii, zero uncovered literals), tooling re-pointed and made to derive its version label so it cannot go stale again, `Proto` re-scored — only `Region A.1` moved, 70% → 95%, mean 84% → 85.2% — fidelity mandate re-pointed deliberately, and the explainer rebuilt and eyeballed. **V1.1 retained alongside V1.2, never replaced.**

**The mock layer did not need re-extracting**: the six changed lines are all in the header lockup, so `src/app.js` is unaffected. SP1 T12 remains outstanding against its original V1 → V1.1 drift, unchanged by this round.

## ~~Open~~ — V1.2

| # | Item | Why | Raised |
|---|---|---|---|
| 1 | ~~Replace `WORDMARK — PLACEHOLDER` with a real mark~~ → **Delete the `WORDMARK — PLACEHOLDER` line. The mark and wordmark already exist and are keepers.** | **Rescoped 2026-08-13 by Matt**, once the header was actually read rather than assumed from the placeholder text. The lockup is a **22×22 rounded square with a 1.5px accent border containing an 8×8 accent square**, beside `TENDERFOOT` in IBM Plex Sans 600 / 13.5px / `.16em`. Only the 8px mono line beneath announces itself as provisional. **Nothing needs designing; one line needs deleting and the lockup re-centring.** Still closes the same things: the only visible sign the product is unfinished, which gates [`../docs/Tenderfoot-Explainer.pdf`](../docs/Tenderfoot-Explainer.pdf) for anything shown outside the firm, and the gap holding `Region A.1` at `Proto 70%` while its neighbours sit at 90–95%. | 2026-08-12, rescoped 2026-08-13 |

> **Worth recording, because it nearly got redesigned away.** The mark is a **checkbox** — 22×22 outer box at 3px radius, 8×8 filled centre at 1px radius, which is the exact geometry of a checked checkbox elsewhere in the same design. It is why `--radius-mark` is commented *"the 8×8 inner square of a checked box."* For a product whose whole job is *take this one, pass on that one*, that is either a deliberate and rather good choice or a lucky accident — **and the V1.2 prompt now says explicitly not to explore alternatives**, because a round asking for "a real wordmark" would very likely have thrown it away.

| 2 | ~~Mobile breakpoints, at least for the triage queue~~ **CLOSED WON'T-DO 2026-08-13.** The prototype **stays desktop-only, by decision.** Mobile is served by a **separate app against the same data**, not by responsive web | **Matt's rule was conditional:** *if the design system supports an easy path to responsiveness, do all of it; if not, stay desktop-only and build a mobile app later.* **Measured rather than guessed — and it is not an easy path.** See the measurement below | 2026-08-12, closed 2026-08-13 |

> ### The measurement behind closing item 2
>
> **The design is fluid but not responsive, and those are different things.**
>
> **What is good:** 69 `minmax()` uses, 33 grids, 74 flex containers, and only **14 fixed pixel widths in the entire document**. That is why it degrades gracefully across desktop sizes.
>
> **What is absent:** **0 `@media` queries. 0 `clamp()`. 0 `auto-fit`/`auto-fill`. 3 `flex-wrap`** across 74 flex containers. There is no responsive foundation to extend.
>
> **What actively blocks it:** the grids have **fixed column counts**. `minmax(0,1.8fr) minmax(0,.8fr) …` over six columns squeezes toward zero rather than reflowing, and several grids mix fixed tracks — `190px minmax(0,1fr) 110px 150px` is **450px of fixed column before any content**, which overflows a 390px phone outright.
>
> **Cost of doing it anyway:** breakpoint structure plus a column-collapse decision for ~33 grids, per screen. That is design work, not a setting.
>
> **This converts a known gap into a decision.** Spec §7.10 named "the prototype specifies desktop only" as its one unclosed hole, and §7.1 asked for responsive triage. **Neither is now a gap** — the answer is a separate mobile client, already pinned in [`../docs/Pinned-Ingestion-Scaffolding.md`](../docs/Pinned-Ingestion-Scaffolding.md), and it is a better fit: triage is the one screen that is a daily habit and the other six are desk work.
>
> **What this costs, stated plainly:** V1 has no phone story at all until that app exists. If someone needs to triage on a phone before then, they cannot.

**That was the whole list until item 2.** The 2026-08-12 review ran twenty nodes and produced **no other prototype changes**, because the review adopted the prototype's answers rather than overturning them — eight decisions written into the SVRC at v0.4.0 rather than back into the artifact.

---

## Not punch items — recorded so they are not raised again

**The three lowest `Proto` scores are not defects.** `View 2.4` (55%), `Screen 7` (60%) and `View 2.5` (65%) score low because **the prototype declined to draw what had not been decided** — the document viewer literally renders `DOCUMENT RENDER — PLACEHOLDER` and prints the open question on screen. Drawing something there would invent a decision. **Do not "fix" these**; they resolve when the underlying question is answered, not when the pixels change.

~~**Three prototype answers are awaiting ratification, not revision**~~ **— ALL THREE RATIFIED 2026-08-13.** Saved views as a first-class object, rot suspicion in the status bar, and the cleared state pointing at the radar. **None was overturned, so none became a punch item** — which was the whole point of asking before V1.2 rather than after. SVRC 0.5.0.

---

## After a new version lands

1. Add the file to `PROTOTYPE/`. **Never replace the old one** — the diff between versions is what says which rule comments still apply (`../docs/ClaudeDesign_Proto_Cleanup.md`).
2. Re-run `tools/extract-tokens.py`, then `tools/verify-tokens.py`.
3. Re-extract `PROTOTYPE/src/app.js`, **carrying the rule comments forward by hand.** They do not regenerate and they are the only copy of the reasoning.
4. Re-run the `Proto` audit against the SVRC — it describes one build and expires the moment a new one lands (Proto2PRD §4.7.5).
5. Re-run `../docs/explainer/build.py` so the explainer's screenshots are not stale.
6. Close the items above and open whatever the new version raises.
