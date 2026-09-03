# PINNED — the Indiana contract register, found 2026-09-02

**Nothing is built. This file exists so the findings survive the session that produced them.**

Matt's direction, verbatim, and it is the frame for all of it:

> *"Why even worry about live data until we have all that figured out? We've got a great test set of
> data to test against and do analysis from."*

And, on scope:

> *"…because they're two separate problems: the analysis and the contracts themselves."*

---

## What it is

**State of Indiana Public Contract Search** — `https://secure.in.gov/apps/idoa/contractsearch/`

A public JSON API behind a search UI. **Probed directly 2026-09-02; every fact below is observed,
not documentation.**

```
POST https://secure.in.gov/apps/idoa/contractsearch/api/contracts/search
Content-Type: application/json

{ "page": 1, "pageSize": 5 }
```

```jsonc
{
  "results": [ … ],
  "pagination": { "pageNumber": 1, "pageSize": 5, "totalResults": 204991, "totalPages": 40999 }
}
```

⚠️ **An empty body `{}` returns zero results with a zeroed pagination block** — it does not mean
"everything". `page` and `pageSize` are required to get anything at all.

### The row shape, observed

```jsonc
{
  "id": "A6-6-CO-006",                    // contract id
  "vendorName": "TIMOTHY WARRICK",
  "agencyName": "Adjutant General",
  "businessUnit": "00110",
  "startDate": "2005-10-01T00:00:00.0000000",
  "endDate":   "2006-09-30T00:00:00.0000000",
  "amount": 0,
  "actionType": "Amendment",
  "amendment": 1,
  "contractTypeFlags": 0,
  "zipCode": "47441",
  "pdfUrl": "https://contracts.idoa.in.gov/idoacontractsweb/PUBLIC/7612-001.pdf",
  "approvals": []
}
```

### Scale and reach

| | |
|---|---|
| **Total records** | **204,991** |
| Depth | back to **2006** |
| **A PDF per row** | `pdfUrl`, public, no auth |
| Filters in the UI | agency, date range, amount range, vendor, zip, comment text, **contract type** |
| Contract types | Attorney · Procured Service · Grant · Lease · License Agreement · Maintenance · MOU · **Professional/Personal Services** · QPA · Other |
| Also | a CSV export button |

> **36,432 was a FILTERED figure**, not the total — it came from the UI with a contract-type box
> ticked. The unfiltered total is 204,991. Recorded because the smaller number was quoted first
> and would otherwise become the remembered one.

---

## Why it matters more than IDOA's solicitation page did

**IDOA solicitations are RED-FLAGGED as of 2026-09-02** — Matt: *"If we really can only get 76 out
of IDOA at any time, let's just red flag that right now as probably not worth pursuing."* It shows
**71 open and nothing else**: no archive, no closed listings, no history. Depth could only ever
accumulate forward from a first scrape.

This register is the opposite shape: **all history, no live queue.**

- **VALUES.** SAM publishes no estimate for open notices — settled by evidence 2026-09-01, not
  pending. Indiana publishes the contract amount. **This is the only route to the value-weighting
  design spec §8.5 asks for.**
- **WHO WINS.** Vendor per contract. Competitive intelligence, incumbency, and the raw material for
  entity resolution.
- **EXPIRATION RADAR.** End dates mean re-competes are visible months early — which is literally
  what the frozen bundle's cleared-queue card offers: *"3 contracts expire inside your sectors."*
- **A ~200k DOCUMENT CORPUS.** One PDF per row, reproducible, offline. Exactly the material for
  perfecting extraction against something that does not change under you — which is what
  SAM.gov's live queue cannot be.

---

## 🔑 The schema was built for this and then never used

`contract`, `award`, `vendor` and `vendor_alias` all exist and are **empty** (`vendor` has 1 row).
The mapping is near one-to-one:

| `contract` column | Indiana field |
|---|---|
| `external_id` | `id` |
| `vendor_id` | `vendorName` → `vendor` |
| `org_id` | `agencyName` → `organization` |
| `starts_at` | `startDate` |
| `ends_at` | `endDate` |
| `value_cents` | `amount` |
| `renewal_options` | — (no source field observed) |

`vendor` carries an **`is_self`** flag, and the bundle's own mock data already has *Koehler
Partners* as a vendor row — *"this firm — a Vendor row like any other (§4.2)"*, 1 award, $310K,
WBE prime.

---

## ⚠️ Three things that make this NOT a routine adapter

**1. Nothing in the merge layer reaches `contract`.** Every extractor — `closes-at.ts`,
`posted-at.ts`, `description.ts`, `title.ts`, `place.ts`, `org-chain.ts` — terminates in
`solicitation`. A contract is not a solicitation and must not enter the triage queue; there is
nothing to decide about work already awarded. **This is a new write path, not a new source.**

**2. Vendor resolution is unimplemented.** `vendor_alias` anticipates that "TIMOTHY WARRICK" and
"Timothy Warrick, Inc." are one vendor. `org-chain.ts` solved the equivalent problem for buying
organisations and is the precedent to read, not to copy blindly — a vendor name is dirtier than an
agency name.

**3. 204,991 rows is two orders of magnitude past anything ingested so far.** Production holds
9,883 solicitations total. Every budget, page size and time assumption in `run.ts` was written for
that scale.

---

## 🔴 THE OPEN QUESTION, unresolved and deliberately so

Matt, asked what the corpus is for, answered **"somewhere between"**:

- **(2) a live product surface** — expiration radar, vendor records, incumbency
- **(3) calibration for qualification** — ground truth for what a KP-shaped contract looks like

**(3) trips a guard this project built on purpose.** §1.1 parks matching as *undesigned*, not
pending, and §7.10 clause 2 states:

> *"A rendered control may never become an active filter, ranking, or score without qualification
> being designed first."*

Its own note is sharper: shipping inert filter chrome puts a wired-up switch *"one small commit
away from existing"*, and that commit would be *"not the wrong answer, but the unratified one."*
**Calibration data is precisely what makes that commit tempting.**

> ### The question to answer before any of this is built
> **Is this the moment qualification gets DESIGNED — or is the contract corpus evidence gathered
> TOWARD that design, with nothing scoring yet?**
>
> Matt paused the session here rather than answer it quickly, which is the right instinct: it is a
> ratification decision, not a technical one. **Do not start building until it is answered**, and
> do not let an ingest slice quietly answer it by arriving with a score attached.

---

## Where to pick this up

1. Answer the question above. It decides scope.
2. If ingest goes ahead regardless (defensible — the data is useful under either answer), the first
   real design questions are: **does a contract go through `sighting`/`merge` at all, or write
   direct?** and **what does "first seen" mean for a record that is already historical?**
3. `docs/superpowers/specs/2026-09-02-idoa-adapter-design.md` §2 is the precedent for describing a
   source shape. This one is neither *windowed feed* nor *open-set snapshot* — it is a **paginated
   archive**, a third shape, and naming it is part of the design.
