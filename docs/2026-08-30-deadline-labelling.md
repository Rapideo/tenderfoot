# Deadline labelling worksheet — the 14 recall misses

**Generated 2026-08-30 from the Neon `test` branch.** One block per solicitation the accuracy
instrument scored as a *miss* for `closes_at`: the portal states a deadline, at least one of its
documents was read, and no document stated a deadline back.

## Why this exists

The first live accuracy reading was **precision 100%, recall 12.5%** (`agreed 2, disagreed 0,
missed 14, opportunities 16`). ⚠️ **That recall figure assumes every miss was ours.** The
instrument cannot tell a document that states the deadline and was misread from a document that
genuinely never states it — the difference is invisible to any query, and it is the difference
between an extractor that needs work and one that is doing fine against documents that do not
carry the field.

**Only a person can rule on that**, which is the whole reason this file exists. It is the same
method `corpus/FINDINGS.md` §1 used to produce the most useful finding the project has.

## How to fill it in

For each block: skim the quoted lines — they are every `Month D, YYYY` in the extracted text,
with surrounding context — then set **VERDICT** to one of:

| Verdict | Means |
|---|---|
| `IN-DOC` | A document really does state the submission deadline, and we missed it. **Please paste the phrasing** — the wording is the point, not the date. |
| `NOT-IN-DOC` | No document states it; the portal is the only source. A correct absence, and not a miss in any sense we should be chasing. |
| `UNSURE` | Say why. An ambiguous one is a finding in its own right. |

**What the phrasings are for.** The cue list is currently
`due | deadline | closing | submitted by | received by`. Two known misses say *"must be returned
**no later than** …"*, which is not in it — so the vocabulary, not the parser, is the likely
cheap win. Every `IN-DOC` phrasing you write down feeds that directly.

**Not every date here should be found.** Several blocks contain dates that are genuinely not
deadlines — a drawing's title block, a FAR clause effective date, a date in an address block.
`NOT-IN-DOC` is the right answer for those and is just as useful as an `IN-DOC`.

---

## 5ba448b5090543e589ebcc90e158f0ff

*Graphics & Display Installation for the 249th EN BAT*

**Portal states the deadline is:** `2026-08-21`

- **RFI Answers 08 18 2026 Part 2.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **RFI Answers 08 18 2026.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **RFI Answers 08 17 2026.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **Scope of Work_BN Improvement Wallpaper Wrap.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*

**VERDICT:** `` 

**Phrasing, if IN-DOC:**

---

## d1f87b927b4f4fe59ffd52d799a0de9c

*19725785-Modernize Foyer, B3001G, Room 127*

**Portal states the deadline is:** `2026-08-29`

- **B3001G-Modernize Foyer Scope Drawings 3.13.26 - Copy.pdf** *(extracted)*
    - …03-13-26 PRICING UPDATES A-110 DEMO PLANS, FLOOR & RCP PLANS B3001G, DOOR #G16 M. LUKSIK M. SHIPLER B. HUNTER MARCH 13, 2026 FOYER MODERNIZA…
- **Submittal_register .pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **RFI Response 8-18.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **PWS_Foyer Modernization.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **Sign In Sheet 8-10.pdf** *(failed)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **Solicitation Amendment - FA813726R00440001.pdf** *(extracted)*
    - …(1) of this clause. (3) The procedures in paragraph (b)(3)(i)(A)(2) of this clause will no longer apply as of January 1, 2030. (B) For domes…
- **Solicitation Amendment FA813726R00440001 SF 30.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **wage determination.txt** *(failed)*
    - *(no `Month D, YYYY` date anywhere in this document)*

**VERDICT:** `` 

**Phrasing, if IN-DOC:**

---

## bb095b04d9f64a5099f398fd5ae46ee3

*FCI Leavenworth FY27 QTR 1 Halal Requirement*

**Portal states the deadline is:** `2026-08-30`

- **QTR 1 Delivery Schedule.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **FY27 QTR 1 Halal Request for Quote.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **QTR 1 Halal Combined Synopsis.pdf** *(extracted)*
    - …Bureau of Prisons Federal Correctional Institution, Leavenworth 1300 Metropolitan Ave. Leavenworth, KS 66048 August 18, 2026 (i) This is a…
    - …point of contact. The completed solicitation package must be returned no later than 7:00 a.m. Central Time on August 31, 2026. Vendors shall…
- **QTR 1 Halal Vendor Cover Sheet.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*

**VERDICT:** `` 

**Phrasing, if IN-DOC:**

---

## 937b3434cd974a758dec0ddcd2c36310

*70Z03026QCLEV0053- USCG STATION ST. IGNACE REPLACEMENT SHOWER STALL*

**Portal states the deadline is:** `2026-08-30`

- **SF 1413-23A - Statement and Acknowledgment (1) (1).pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **Solicitation 70Z03026QCLEV0053 - SF 1442 (7) (2).pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **Wage Determination (5).pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **Request for Information (RFI) (25).pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **Reference Information Sheet (21).pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **70Z03026QCLEV0053 - Station St. Ignace Housing Shower Stall Installation (3).docx** *(extracted)*
    - …ing Trafficking in Persons. (Nov 2021)</p><p>52.222-90 Addressing DEI Discrimination by Federal Contractors. (April 27, 2026)</p><p>52.222-5…
- **SOW_Stall Shower Replacement_St. Ignace (1).pdf** *(extracted)*
    - …reet 278 Keightley Street 280 Keightley Street 284 Keightley Street 286 Keightley Street 288 Keightley Street July 30, 2026 2 Scope of Work…

**VERDICT:** `` 

**Phrasing, if IN-DOC:**

---

## 6848a40dfcfc4ca0bd13882e8e2cb2b0

*SOLICITATION-U.S. Army West Point Harbor Q-Boat Ferry Maintenance*

**Portal states the deadline is:** `2026-08-31`

- **W911SD-26-Q-A118 PAST PERFORMANCE QUESTIONARE Harbor Boat.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **PAN 042597 W911SD-26-Q-A118 SOLICITATION AMEND 0001 DRAFT LRC Ferry Boat.pdf** *(extracted)*
    - …y to ensure their SAM UEI# Profile is CURRENT & ACTIVE As a result of interim FAR rule 2019-009, published on July 14, 2020, and effective o…
    - …le is CURRENT & ACTIVE As a result of interim FAR rule 2019-009, published on July 14, 2020, and effective on August 13, 2020, implementatio…
- **PAN 042597 W911SD-26-Q-A118 SOLICITATION D.Final LRC Ferry Boat.pdf** *(extracted)*
    - …cted work deemed necessary to complete all specifications. All work is required to be completed no later than April 30, 2027. 4. Government…
    - …y to ensure their SAM UEI# Profile is CURRENT & ACTIVE As a result of interim FAR rule 2019-009, published on July 14, 2020, and effective o…
    - …le is CURRENT & ACTIVE As a result of interim FAR rule 2019-009, published on July 14, 2020, and effective on August 13, 2020, implementatio…
- **PAN 042597 W911SD-26-Q-A118 SOLICITATION DRAFT LRC Ferry Boat.pdf** *(failed)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **PAN 042597 W911SD-26-Q-A118 PWS LRC Ferry Boat.pdf** *(extracted)*
    - …cted work deemed necessary to complete all specifications. All work is required to be completed no later than April 30, 2027. 4. Government…

**VERDICT:** `` 

**Phrasing, if IN-DOC:**

---

## e62d1f006fb843ac8bfc48fe6ba1cd04

*FCI Leavenworth FY27 QTR 1 Milk Requirement*

**Portal states the deadline is:** `2026-08-31`

- **QTR 1 Milk Vendor Cover Sheet.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **QTR 1 Milk Combined Synopsis.pdf** *(extracted)*
    - …Bureau of Prisons Federal Correctional Institution, Leavenworth 1300 Metropolitan Ave. Leavenworth, KS 66048 August 18, 2026 (i) This is a…
    - …point of contact. The completed solicitation package must be returned no later than 7:00 a.m. Central Time on August 31, 2026. Vendors shall…
- **FY27 QTR 1 Milk Request for Quote.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **QTR 1 Delivery Schedule.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*

**VERDICT:** `` 

**Phrasing, if IN-DOC:**

---

## 526e442ff9834a70be010769ae408d07

*Two-Seat Jet Ski and Dual Personal Water Craft Trailer*

**Portal states the deadline is:** `2026-08-31`

- **Finalized Solicitation_M6700126Q0135.pdf** *(extracted)*
    - …imeframe. Questions related to this RFQ shall be received by the Contracting Department no later than Monday, August 24, 2026, at 12: 00 P.M…

**VERDICT:** `` 

**Phrasing, if IN-DOC:**

---

## 7a428d137ca7475b93bce26cca6be37b

*Navigational Database (NavDB)*

**Portal states the deadline is:** `2026-08-31`

- **Solicitation - FA850426QB001_Rev2_18Aug26.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **Atch 2 - Estimated CLIN_Aircraft Quantities_Rev2.xlsx** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **RFI Questions and Answers - Round 2.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **Aircraft Quantities.xlsx** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **Revised Solicitation - FA850426QB001.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **RFI Questions and Answers.docx** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **Statement of Work - Navigational Database.pdf** *(extracted)*
    - …of Standard Date of Publication DoD 5220.22-M National Industrial Security Program Operating Manual (NISPOM). February 28, 2006 Change 1 - M…
    - …on DoD 5220.22-M National Industrial Security Program Operating Manual (NISPOM). February 28, 2006 Change 1 - March 28, 2013 Change 2 - May…
    - …Industrial Security Program Operating Manual (NISPOM). February 28, 2006 Change 1 - March 28, 2013 Change 2 - May 18, 2016 DoDD 4715.1E Envi…
- **Solicitation - FA850426QB001.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*

**VERDICT:** `` 

**Phrasing, if IN-DOC:**

---

## d00f620428794aa091fc009290f0f031

*Nikon X-Ray Maintenance & Service*

**Portal states the deadline is:** `2026-08-31`

- **X-Ray Service SOW_Redacted.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **SF1449_SP470626Q0034.PDF** *(extracted)*
    - …Defense Logistics Agency (DLA) Master Solicitation for Automated Simplified Acquisitions, Revision 105 (dated May 20, 2026), and are effecti…

**VERDICT:** `` 

**Phrasing, if IN-DOC:**

---

## 8f807ff7a1364ab1b26f10906898191e

*Transition Assistance Program (TAP) Data Entry / Front Desk Clerk*

**Portal states the deadline is:** `2026-08-31`

- **Solicitation - FA527026QB027.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **Price Exhibit.xlsx** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **PWS.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*

**VERDICT:** `` 

**Phrasing, if IN-DOC:**

---

## 4c833bfca9484203b47a0a2353a05c6c

*J063--CTX Surveillance System Installation Palestine CBOC*

**Portal states the deadline is:** `2026-08-31`

- **RFQ 36C25726Q0692 v2.pdf** *(failed)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **RFQ 36C25726Q0692.docx** *(failed)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **36C25726Q0692_1.docx** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*

**VERDICT:** `` 

**Phrasing, if IN-DOC:**

---

## 87568376ec964bac97550f42c22500d3

*FCI Leavenworth FY27 QTR 1 Bread Requirement*

**Portal states the deadline is:** `2026-08-31`

- **FY27 QTR 1 Bread Request for Quote.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **QTR 1 Delivery Schedule.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **QTR 1 Bread Vendor Cover Sheet.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **QTR 1 Bread Combined Synopsis.pdf** *(extracted)*
    - …Bureau of Prisons Federal Correctional Institution, Leavenworth 1300 Metropolitan Ave. Leavenworth, KS 66048 August 18, 2026 (i) This is a…
    - …point of contact. The completed solicitation package must be returned no later than 7:00 a.m. Central Time on August 31, 2026. Vendors shall…

**VERDICT:** `` 

**Phrasing, if IN-DOC:**

---

## 3f5cc0d00a014752b6aa3c06905dce79

*23--BLM Alaska EIFO Recreation ATVS (X4)*

**Portal states the deadline is:** `2026-08-31`

- **Sol_140L6326Q0028_Amd_0001.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **Sol_140L6326Q0028.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **A06_TRADE_INs.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*
- **A06_Specifications.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*

**VERDICT:** `` 

**Phrasing, if IN-DOC:**

---

## e349d8c99ac6400f875613a4835d9e81

*ARCHITECT-ENGINEER (A-E) CIVIL STRUCTURAL IDIQ FOR NORTHERN  & CENTRAL  STATES OF INTERIOR US*

**Portal states the deadline is:** `2026-09-11`

- **B2_Amd_0001_AE_Civil_Structural_Northern_Central_Statessigned.pdf** *(extracted)*
    - …United States Department of Agriculture Forest Service Procurement Operations August 18, 2026 USDA Forest Se…
- **AE_Special Notice v4 29 July 2026.pdf** *(extracted)*
    - *(no `Month D, YYYY` date anywhere in this document)*

**VERDICT:** `` 

**Phrasing, if IN-DOC:**

---

## When it is filled in

`IN-DOC ÷ 14` is the real recall we are missing. Everything currently reported as 12.5% is
measured against a denominator that assumes all fourteen were ours. If most come back
`NOT-IN-DOC`, the extractor is doing considerably better than the number says and the honest
reporting should change — which is itself a finding, and one the accuracy instrument was built
to make reachable rather than to answer on its own.
