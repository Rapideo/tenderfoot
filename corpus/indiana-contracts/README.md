# Indiana contract data — the Expiration Radar's source

**Probed:** 2026-08-10 · **Status:** working, anonymous, undocumented
**Answers the open question** left in `../calibration/README.md`.

Indiana does not archive closed *solicitations*. It does publish every executed *contract*,
back to 2005, through an undocumented JSON API behind the public contract search SPA.

**204,439 contracts. No credentials. No rate limit encountered.**

---

## The endpoint

```
POST https://secure.in.gov/apps/idoa/contractsearch/api/contracts/search
Content-Type: application/json

{"pageNumber":1, "pageSize":2000, "businessUnit":"00503", "endDate":"2028-02-10T00:00:00"}
```

Recovered from the SPA bundle (`assets/index-*.js`), which registers named routes
`contracts.search`, `contracts.getContract`, and `agencies.search` against a base injected at
runtime. `GET .../api/contracts/:contractId` and `POST .../api/agencies/search` also work; the
agency endpoint returns all **248** agencies with their `businessUnit` codes in one call.

`pageSize: 2000` is honoured.

### Fields returned

`id` · `agencyName` · `businessUnit` · `vendorName` · `amount` · `startDate` · **`endDate`** ·
`zipCode` · `actionType` · `amendment` · `contractTypeFlags` · `pdfUrl` · `approvals[]`

**`endDate` is the field §4.6 calls the system's highest-value one, published in the clear for
every contract the state holds.**

### Filters — verified, because on this class of API you cannot assume

Same two-request test as SAM.gov: vary one parameter, watch `totalResults` move.

| Parameter | Behaviour |
|---|---|
| `businessUnit` | **Works.** 204,439 → 49 on a real unit, → 0 on a bogus one. |
| `startDate` | **Works.** Means *starts on or after*. |
| `endDate` | **Works.** Means *ends on or before* — an upper bound only. |
| `contractId`, `zipCode`, `contractTypeFlags` | Present in the client's criteria object; untested. |
| `description` | **Silently ignored** — total unchanged at 204,439. |
| `vendor` | **Silently ignored** — total unchanged at 204,439. |

`description` and `vendor` are ignored because they are not fields — the client's criteria object
holds only `contractId`, `contractTypeFlags`, `startDate`, `endDate`, `zipCode`, `businessUnit`.
**There is no keyword or vendor search.** Subject matter is not in the index at all.

This is the third independent government API to discard unknown parameters rather than reject
them. It is no longer a SAM.gov quirk; treat it as the default posture of this class of source
and verify every facet before trusting it.

**Consequence for the radar:** `endDate` is an upper bound only, so "expires in the next N
months" cannot be expressed server-side. Bracket it — filter `endDate <= horizon`, then apply the
lower bound client-side. Results sort by agency then contract id, never by date, so paging to
find recent records does not work; filter by `businessUnit` instead.

---

## What the first pull found

16 agencies matched to KP's sectors (health, human services, education, workforce, technology,
administration). Horizon 18 months.

**2,700 rows · 2,160 distinct contracts expiring by 2028-02-10.** Every one carries a `pdfUrl`.

Expiry is sharply clustered, and the clusters are the state's fiscal calendar:

| Month | Contracts | |
|---|---|---|
| 2026-09 | 754 | Indiana FY ends June 30; September is the amendment tail |
| 2027-06 | 633 | FY boundary |
| 2026-12 | 275 | **includes the Medicaid managed care book** |

**231 contracts across 149 distinct vendors end on 2026-12-31**, among them Indiana's Medicaid
MCO capitation contracts — Anthem, MDwise, Coordinated Care. That is the same managed care
programme the FSSA External Quality Review RFP in the live corpus exists to review, and it is
KP's stated sector verbatim. Whatever re-procurement surrounds that date is visible now, four
months out, from a public endpoint.

### A trap in the `amount` field

`amount` is **"total amount this action"** — EDS form field 6, a per-amendment delta that is
routinely **negative**:

```
contract 00000000000000069654  MDWISE INC
   amendment 0  New        $ 4,962,607,189
   amendment 1  Amendment  $  -289,812,216
   amendment 2  Amendment  $ 4,977,918,432
   amendment 3  Amendment  $-1,657,838,839
```

Summing rows double-counts. Taking the highest amendment can select a negative. **The running
contract total is EDS field 7, "New contract total", and the API does not expose it** — it exists
only inside the PDF. Any Value score built on this field without reading the form will be wrong,
sometimes by billions and sometimes with the wrong sign.

`expiring-18mo.json` therefore keeps **all 2,700 rows with amendments intact**. Collapsing them
would fabricate a number the source does not publish.

`contractTypeFlags` came back `0` for all 2,700, so it is not populated in search results even
though the client offers it as a filter. Do not rely on it.

---

## The PDFs are the subject-matter layer

`pdfUrl` resolves without credentials to the executed contract, which opens with **State Form
41221, the Executive Document Summary** — a structured cover sheet. From it, mechanically:

| EDS field | What it gives Tenderfoot |
|---|---|
| 13 · Method of source selection | Bid/Quotation · Negotiated · Emergency · Special Procurement — **whether it was competitively bid at all** |
| 29–32 · M/WBE status, prime **and sub**, with percentages | The Teaming Radar (§4.6) and KP's WBE positioning, as published fact |
| 33–34 · Renewal and termination language | Whether an end date is a real re-compete or an automatic extension |
| 6–12 · Amounts by fiscal year, period covered | The Value inputs the search index withholds |
| 3 · Contract type checkboxes | Professional/Personal Services vs Grant, Lease, Maintenance |

Field 29–32 is the notable one. **Incumbent WBE status is published for every contract in the
state**, which turns "who do we team with" from guesswork into a query.

---

## What this changes

The calibration pull established that federal is not KP's market — 3,357 federal solicitations in
KP's own service-line codes, zero with an Indiana place of performance. This probe supplies the
other half: **Indiana's market is fully visible, just not through solicitations.**

Revised source picture:

| Source | Solicitations | Archive | Contract history | Expiry dates |
|---|---|---|---|---|
| SAM.gov | Yes | To 2019 | Award notices | Weak |
| Indiana IDOA portal | Yes, open only | **None** | No | No |
| **Indiana contract search** | No | **To 2005** | **204,439** | **Yes, every one** |

Two consequences worth carrying into the spec:

1. **The Expiration Radar is buildable now, before any solicitation ingestion works.** It needs
   one endpoint, no credentials, and no scraping. It is also the feature with the longest lead
   time — 6–18 months ahead of an RFP — which is the whole §1 argument about finding out too late.
2. **The pre-RFP layer, not the solicitation feed, is where Indiana coverage actually lives.**
   Ordering in §5.6 and the SP-slice sequence should reflect that.

**Still open:** whether a licensed platform (Periscope, Ivalua, CGI Advantage) retains closed
solicitations. Under §5.7 one positive answer covers Illinois, Ohio, Michigan, and Kentucky at
once.
