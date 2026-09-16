# The explainer addendum

**Built 2026-09-16.** Output: [`../Tenderfoot-Explainer-Addendum.pdf`](../Tenderfoot-Explainer-Addendum.pdf) — 4 pages, letter. Same content as [`../Tenderfoot-Explainer-Addendum.md`](../Tenderfoot-Explainer-Addendum.md), which is the fuller wording; the PDF is trimmed to fit.

A companion to [`../explainer/`](../explainer/README.md), written for management: what the explainer promotes, what the software actually does today, and where the team is. **A status document, not a specification** — it is dated, and it will be wrong within weeks. Every figure in it was read from `STATUS.md`, `DOOGIE - TENDERFOOT.md`, the plan of action, and the fitness and platform-comparison documents on the day it was built.

## Rebuilding

```
python build.py            # render the PDF
python build.py --proof    # also write proof/page-N.png for eyeballing
```

Needs `playwright` and a Chrome channel. Render-only — there are no screenshots. Fonts are the explainer's, shared by relative path rather than copied. The build **refuses to emit a PDF if any page overflows its box**, and prints each page's overflow so a fit is a measured fact.

`proof/` is a build byproduct and is gitignored. **Look at the proofs, not just the overflow numbers** — the first render of this document had a fact block jammed against the paragraph above it with zero overflow reported.

## When to rebuild

Whenever the state it describes moves: the go / no-go, the HigherGov subscription decision, a post-gate slice landing. Change the date in the band and the footer when you do.
