# Calibration corpus — 24 months of closed federal solicitations

**Collected:** 2026-08-10 · **Window:** 2024-08-10 → 2026-08-10
**Why:** the live corpus yields ~5–10 plausible bids in 76 rows. At that base rate, reaching
40 positives costs ~600 rows of reading, almost all of it walleye. This set raises the density.

---

## Two sets, two samplings, one rule

`rows.json` holds 140 records tagged `set: "enriched"` or `set: "unbiased"`. They are **not
interchangeable**, and the distinction is the whole reason this directory exists.

| | `enriched` (80) | `unbiased` (60) |
|---|---|---|
| Feeds | Few-shot example set (3K) — teaching the adjudicator Matt's voice | Backtest measurement (§8.2, SP6) |
| Selection | Top-ranked by PSC weight + service-line keywords | Seeded random sample, `seed=20260810` |
| Positive density | Inflated on purpose | True to the pool |
| May produce a precision/recall number | **No** | Yes |

**The rule: no precision, recall, or hit-rate figure may ever be computed from the enriched
set.** Its base rate is wrong by construction. Reporting a number from it would not be an
approximation, it would be fiction — and a flattering one, which is worse.

**A second, subtler bias in the enriched set.** Ranking uses keywords drawn from KP's own stated
service lines, so it favours solicitations that describe the work in KP's vocabulary. Genuine
fits phrased unusually are systematically under-represented. That is tolerable for few-shot
examples and disqualifying for recall measurement — the same conclusion by a different route.

---

## How it was pulled

Endpoint: `https://sam.gov/api/prod/sgs/v1/search?index=opp`, no credentials.
Notice types `o` (Solicitation) and `k` (Combined Synopsis/Solicitation) — both biddable.

**Facets used, all verified to actually filter:**

- 10 NAICS codes — 541611, 541612, 541618, 541690, 541720, 611430, 541511, 541512, 923120, 541910
- 10 PSC codes — R408, R410, R422, R499, R699, R707, U008, U099, B506, B599

**PSC turned out to be the better instrument.** NAICS 541611 is generic management consulting and
returns mostly defense staff augmentation; PSC `R410` *is* Program Evaluation Services, which is
KP's lead service line stated as a structured code. The scorer weights PSC accordingly — the
facet carries signal that no keyword needs to reconstruct.

| Pool | Unique records |
|---|---|
| NAICS pull | 1,821 |
| PSC pull | 2,224 |
| Merged, deduped | **3,357** (688 found by both) |

Scripts: `pull-naics.py`, `pull-psc.py`, `score.py`. Re-runnable; the random sample is seeded.

### Date bounding is client-side, and this is not optional

Every date parameter on this endpoint is **silently ignored** — see `../manifest.md` for the
four spellings tested. So the window is enforced in the client, and the ordering key matters:

> `sort=-publishDate` is also silently ignored. Only `sort=-modifiedDate` genuinely sorts.
> Since `modifiedDate >= publishDate` always holds, paginating until **modifiedDate** passes the
> cutoff is guaranteed to have already seen every record **published** inside the window.

The first version of this pull sorted on `modifiedDate` but stopped on the first record whose
`publishDate` fell outside the window — an old notice recently amended appears early in the sort
and halted the walk. It cost about a third of the window, silently: 1,486 records instead of
1,821. **The ordering key and the filter key have to be reconciled deliberately, or pagination
terminates early and under-samples without any error.** Worth remembering as its own class of
bug, distinct from the ignored-parameter class.

---

## What the pull says about the market

The archive was collected to solve a sampling problem. It also answered a question nobody asked.

**Across 3,357 federal solicitations in KP's own service-line codes over two years, not one has
an Indiana place of performance.** Of the ~55% that state a location at all, the concentration is
DC (376), Maryland (347), and Virginia (298) — the beltway — followed by USAID missions and
overseas posts. Indiana: zero.

The enriched top-80 shows the same shape from the other side. Its highest-scoring rows are
USAID and embassy programme support, Bureau of Indian Education professional development, and
National Guard evaluation contracts. Genuinely KP-shaped work in that 80 — VA External Peer
Review, PREA auditing, performance monitoring BPAs — numbers under ten.

This confirms the provisional read recorded in `../manifest.md` on 2026-08-04, and upgrades it
from a hypothesis to a measurement:

> **State and local health, human services, and education are KP's ground. Federal management
> consulting is not.**

### The consequence for source priority (§5.6)

The thin positive class in the live corpus is **not a collection defect. It is the market.**
More federal archive will not fix it, because federal is not where the work is.

What would fix it is state and local archive depth, and that is precisely where coverage is
weakest:

| Source | Archive depth | Status |
|---|---|---|
| SAM.gov | Back to 2019, no credentials | Working, and now demonstrably the wrong market |
| Indiana IDOA solicitations | **None** — closed events disappear | Established 2026-08-04 |
| Indiana contract data | Unknown | `secure.in.gov/apps/idoa/contractsearch/` returns 200 — **unprobed** |
| Periscope / Ivalua / CGI states | Unknown | Platform-bound adapters (§5.7) make this one investigation covering several states |

**Recommended next:** probe Indiana's contract search, then test whether one licensed platform
retains closed solicitations. Under §5.7 a single positive answer there covers Illinois, Ohio,
Michigan, and Kentucky at once — which is both better calibration material and the actual
market.
