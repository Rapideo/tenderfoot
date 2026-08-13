# Prototype punch list

**Opened 2026-08-12.** Changes wanted in the next Claude Design iteration.

**How this works.** `prototype/` is reference-only — nothing here is edited in place (see [`README.md`](README.md)). Changes happen in Claude Design and arrive as a new version alongside the old ones. **This file is the input to that round.**

Items are Matt's to action; anyone may add. **Add the reason, not just the change** — a punch item without a rationale is indistinguishable from a preference by the time it gets built.

---

## Open — V1.2

| # | Item | Why | Raised |
|---|---|---|---|
| 1 | **Replace `WORDMARK — PLACEHOLDER` with a real mark** | The only visible sign the product is unfinished. It appears in the header of every screenshot, which makes it gate anything shown outside the firm — including [`../docs/Tenderfoot-Explainer.pdf`](../docs/Tenderfoot-Explainer.pdf). Also the one unclosed gap `Region A.1` names about itself, and what holds that node at `Proto 70%` while its neighbours sit at 90–95%. | 2026-08-12 |

| 2 | **Mobile breakpoints, at least for the triage queue** | The prototype specifies **desktop only** — designed and captured at 1600px. But §7.1 requires triage to work on a phone and the SVRC repeats it, so **responsive behaviour currently has no reference to be faithful to.** Without one, the mobile layout gets designed during the build by whoever writes the component, silently, with nobody deciding it — the §4.7.5 problem, seen coming for once. Closes the hole named in spec §7.10. | 2026-08-12 |

**That was the whole list until item 2.** The 2026-08-12 review ran twenty nodes and produced **no other prototype changes**, because the review adopted the prototype's answers rather than overturning them — eight decisions written into the SVRC at v0.4.0 rather than back into the artifact.

---

## Not punch items — recorded so they are not raised again

**The three lowest `Proto` scores are not defects.** `View 2.4` (55%), `Screen 7` (60%) and `View 2.5` (65%) score low because **the prototype declined to draw what had not been decided** — the document viewer literally renders `DOCUMENT RENDER — PLACEHOLDER` and prints the open question on screen. Drawing something there would invent a decision. **Do not "fix" these**; they resolve when the underlying question is answered, not when the pixels change.

**Three prototype answers are awaiting ratification, not revision** — saved views as a first-class object, rot suspicion in the status bar, and the cleared state pointing at the radar. If any is *overturned*, that becomes a punch item. Until then there is nothing to build. Listed in the SVRC preamble.

---

## After a new version lands

1. Add the file to `PROTOTYPE/`. **Never replace the old one** — the diff between versions is what says which rule comments still apply (`../docs/ClaudeDesign_Proto_Cleanup.md`).
2. Re-run `tools/extract-tokens.py`, then `tools/verify-tokens.py`.
3. Re-extract `PROTOTYPE/src/app.js`, **carrying the rule comments forward by hand.** They do not regenerate and they are the only copy of the reasoning.
4. Re-run the `Proto` audit against the SVRC — it describes one build and expires the moment a new one lands (Proto2PRD §4.7.5).
5. Re-run `../docs/explainer/build.py` so the explainer's screenshots are not stale.
6. Close the items above and open whatever the new version raises.
