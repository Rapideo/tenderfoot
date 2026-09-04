# What the EDS `startDate`/`endDate` query parameters actually filter on

**Date:** 2026-09-03
**API:** `POST https://secure.in.gov/apps/idoa/contractsearch/api/contracts/search`
**Method:** live measurement against production, concurrency 1, ≥800ms between requests,
`user-agent: Tenderfoot/0.1 (Koehler Partners; procurement research)`. 30 total requests made.
All responses 2xx; no retries were needed.

**Baseline confirmed:** an unfiltered request (`{page:1, pageSize:2000}`) returns
`pagination.totalResults: 204991`, matching the previously-measured figure. Note pagination
data lives at `response.pagination.{pageNumber,pageSize,totalResults,totalPages}`, not at the
top level of the response.

## Finding: the filter is "fully contained within", not "overlaps with"

A query's `startDate`/`endDate` do not select contracts that are *active during* that window.
They select contracts whose **own** `startDate` AND `endDate` both fall **inside** the query
window. A contract that starts before the window or ends after it is excluded entirely, even if
its span covers the whole window.

### Step 1 — cross-year contract

From a 2000-row unfiltered sample, 1518 of 2000 rows (76%) already cross a calendar-year
boundary — multi-year contracts are the norm here, not the exception. Selected:

- `SPAN_ID = A6-6-CO-006`
- `SPAN_START = 2005-10-01` (Y1 = 2005)
- `SPAN_END = 2006-09-30` (Y2 = 2006)

### Step 2 — which window(s) claim it

| Query | `totalResults` | Contains `A6-6-CO-006`? |
|---|---|---|
| `{startDate:"2005-01-01", endDate:"2005-12-31"}` | 18 | **No** |
| `{startDate:"2006-01-01", endDate:"2006-12-31"}` | 967 | **No** |
| `{startDate:"2005-01-01", endDate:"2006-12-31"}` (both years, one window) | 1495 | **Yes** |
| `{startDate:"2005-10-01", endDate:"2006-09-30"}` (exact bracket) | 710 | **Yes** |

**Neither single-year window claims it (the "neither" row of the brief's table) — this is a
GAP, not an overlap.** It only appears once the query window is widened to fully contain both
its own start and end dates. This is conclusive evidence for the "fully contained within"
semantics, not a coincidence of this one record — see Step 3, which shows the same effect at
full scale.

### Step 3 — do per-year totals reconcile to 204,991?

Sum of `totalResults` for `{startDate:"YYYY-01-01", endDate:"YYYY-12-31"}`, one request per
year, `YYYY` from 2004 through 2027 (24 windows, `pageSize:10`, `page:1` on every request):

| Year | totalResults | | Year | totalResults |
|---|---|---|---|---|
| 2004 | 9 | | 2016 | 1316 |
| 2005 | 18 | | 2017 | 1096 |
| 2006 | 967 | | 2018 | 1067 |
| 2007 | 1312 | | 2019 | 1098 |
| 2008 | 1655 | | 2020 | 1334 |
| 2009 | 1385 | | 2021 | 1113 |
| 2010 | 1446 | | 2022 | 1239 |
| 2011 | 1431 | | 2023 | 985 |
| 2012 | 1185 | | 2024 | 1005 |
| 2013 | 1087 | | 2025 | 915 |
| 2014 | 1141 | | 2026 | 594 |
| 2015 | 1523 | | 2027 | 12 |

**SUM = 24,933**
**BASELINE = 204,991**
**SHORTFALL = 180,058 (88.0% of the register is missing from the per-year sum.)**

This is not a rounding gap or an edge-case gap. **Under calendar-year windowing, roughly
seven-eighths of the register is unreachable**, because most contracts run longer than one
calendar year (consistent with the 76% cross-year rate seen in the Step 1 sample) and are
therefore excluded from every single-year window — they never start and end inside the same
`Jan 1–Dec 31` bracket.

### Sanity check — does widening the window recover the baseline?

A single wide query, `{startDate:"2000-01-01", endDate:"2030-12-31", pageSize:10}`, returns
`totalResults: 203,160` — 99.1% of the 204,991 baseline, and 8.1x the 24,933 the 24 one-year
windows summed to. This confirms the shortfall in Step 3 is a **windowing-granularity** problem
(one-year brackets are too narrow to fully contain most contracts), not a range problem (almost
all contracts' start and end dates already fall within 2000–2030).

The residual 1,831-record gap (204,991 − 203,160) between the unfiltered baseline and the
2000–2030 wide window was not further investigated — plausibly a handful of records with a
null/out-of-range `startDate` or `endDate`, since the filter requires both fields to be present
and in-range. Flagged as an open question, not resolved here — out of scope for this task.

## The rule for Task 3

**Task 3 cannot chunk the fetch by calendar-year date windows** — `startDate`/`endDate` is a
fully-contained-within filter, not an overlap filter, so any window narrower than a contract's
own span drops that contract entirely, and one-year windows recover only 12% of the register;
Task 3 must chunk on a field the API applies as a straightforward filter across the whole
register instead of a "contains-my-span" date window — `businessUnit` is already confirmed
honoured and is the candidate to key on, or the date window must be made wide enough to
guarantee every contract's full span fits inside it (which pushes back toward "one very wide
window," reopening the pagination question, since `page` is silently ignored and `pageSize` is
only confirmed honoured up to 25,000 against a 204,991-row register).
