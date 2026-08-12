# The explainer

**Built 2026-08-12.** Output: [`../Tenderfoot-Explainer.pdf`](../Tenderfoot-Explainer.pdf) — 10 pages, letter.

A sell-the-user walkthrough of the main views. **Marketing collateral, not a specification** — the specification is `../superpowers/specs/2026-08-03-tenderfoot-design.md` and the screen outline is `../../reference/Tenderfoot SVRC.md`. If they disagree, they are right and this is wrong.

## Two decisions it embodies

Both were settled from existing decisions rather than asked again. Recorded here so a later revision does not quietly reverse them.

**1. It sells the finished product, not V1.** The prototype was defined on 2026-08-11 as representing the final released product and serving as demo material, so the document is measured against the destination. It therefore shows scoring, evidence citations, and the gated drawer — **none of which ship in V1** (spec §1.1).

> **The risk this carries, stated so it is not discovered later.** A reader who sees page 5 and then gets V1 has been shown something the first release does not do. Page 10 exists to manage exactly that, and it is the page not to cut.

**2. It is written for KP internally** — the person who would use it daily and the person who signs off, which at this size is one room. An external pitch would lead with outcome rather than pain, and would not carry page 10 in its current form.

## Honesty rules it follows

Every figure is real and traceable: 9-of-61 and the 85% irrelevance rate from `../../corpus/manifest.md`; the 38-day margin and the two-deadline near-miss from `../../corpus/FINDINGS.md`; 231 December expiries, 2,160 expiring contracts, and the 204,439-row register from `../../corpus/indiana-contracts/`.

**Nothing is invented sample data**, which is the same rule the corpus itself was collected under and for the same reason: neat data hides every problem worth finding.

**The closing page states what is not built.** That V1 collects and prepares without ranking, and why judgment comes last. A document that oversells becomes a liability the first time someone opens the real thing.

## Rebuilding

```
python build.py            # capture screens from the bundle, then render
python build.py --render   # render only, reuse shots/
```

Needs `playwright` and a Chrome channel. The build **refuses to emit a PDF if any page overflows its box**, so a copy edit that pushes content off a page fails loudly instead of silently truncating.

Screens are captured by driving the frozen V1.1 bundle in headless Chrome. **Nothing is written back into `prototype/`** — that directory is reference-only. Typography is the IBM Plex faces extracted from the bundle's own manifest, so the document matches the product rather than approximating it.

**Re-run after any prototype iteration.** The screenshots are as stale as the bundle they came from, and there is nothing in the PDF that says which version it was built against.

## Open item — on the V1.2 punch list

**The wordmark reads `WORDMARK — PLACEHOLDER` in all six screenshots.** It is honest and it is the only visible sign the product is unfinished. Building this document is what established that the mark is still an open Phase 0 output rather than a delivered one — the plan of action §A1.1 claimed otherwise until 2026-08-12.

**Added to Matt's V1.2 prototype punch list 2026-08-12.** So the sequence is: V1.2 lands with a real mark → re-run `build.py` → the PDF is externally shareable. Until then it stays internal.
