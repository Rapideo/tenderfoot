# Possible immediate opportunities

**Compiled:** 2026-08-10 · **Sources:** `corpus/` (fetched 2026-08-04) and `corpus/indiana-contracts/` (fetched 2026-08-10)

> **What this is.** Everything currently open that a person should at least look at, plus one pre-RFP cluster worth knowing about early. **It surfaces; it does not recommend.** Nothing here has been judged for fit — that is the hand-run, and it has not been done. Band A/B is my guess at plausibility from Aug 4, deliberately kept visible so disagreement shows up.
>
> **One caution that applies throughout.** Dates come from portal listing metadata, which outranks document text — a real bundle in this corpus ships three PDFs carrying two different deadlines. Confirm against the portal before relying on any date here.

---

## 1. Closing this week

| Due | Left | Solicitation | Buyer | Band |
|---|---|---|---|---|
| **08/11** 2:00 PM ET | **1 day** | [State Charter School Facilities Incentive Grant — Technical Assistance](https://www.in.gov/idoa/proc/solicitations/files/007000000087845.zip) | IN Dept of Education | A |
| **08/11** 5:00 PM EST | **1 day** | [Community Health Workers/Representatives Training](https://sam.gov/opp/IHS_SS_26_0804/view) — *Sources Sought, not a solicitation* | Indian Health Service | A |
| **08/13** | 3 days | [Quality Counts II Cohort 4 Peer Reviewers](https://www.in.gov/idoa/proc/solicitations/files/007000000087880.zip) | IN Dept of Education | A |
| **08/17** | 7 days | [Drug Evaluation & Classification (DEC) Program](https://www.in.gov/idoa/proc/solicitations/files/000320000084775.zip) | IN Criminal Justice Institute | A |

**Charter School TA** — technical assistance to 10–20 charter subgrantees under a $10M five-year federal grant. Monthly training and office hours; facilities planning, financing strategy, SFIG compliance. *The independent evaluation of the same programme is a separate contract.*

**IHS CHW/CHR** — market research only, setting the eventual set-aside. Capability assessed in priority order: Indian Small Business Economic Enterprises first, then small business, then others. Generic capability statements explicitly not considered.

**Quality Counts II** — external peer review of charter grant applications; two independent reviews each. Named expertise: charter operations, facilities financing, school improvement, federal grant evaluation.

**DEC Program** — administering Indiana's impaired-driving enforcement training to NHTSA/IACP standards. Delivery, coordination, documentation only.

---

## 2. Open, with room to respond

| Due | Left | Solicitation | Buyer | Band |
|---|---|---|---|---|
| 08/24 | 14d | [FHWA Policy & Governmental Affairs Support](https://sam.gov/opp/HPLRFI2026/view) — *RFI* | FHWA | A |
| 08/26 | 16d | [Growth Analysis of ILEARN and ACCESS ELP Data](https://www.in.gov/idoa/proc/solicitations/files/007000000087901.zip) | IN Dept of Education | A |
| 08/26 | 16d | [Business Consulting Services — NASPO ValuePoint](https://www.in.gov/idoa/procurement/current-business-opportunities/) | NY OGS *(co-op)* | A |
| 08/27 | 17d | [IGC Daycare Services](https://www.in.gov/idoa/proc/solicitations/files/000610000087934.zip) — *RFI* | IN Dept of Administration | A |
| 09/02 | 23d | [General Supervision — State Complaint Corrective Action](https://www.in.gov/idoa/proc/solicitations/files/007000000088051.zip) | IN Dept of Education | A |
| 09/10 | 31d | [Community Supports IT Systems](https://www.in.gov/idoa/proc/solicitations/files/004050000086378.zip) | FSSA | A |
| **09/17** | **38d** | **[External Quality Reviews for MCO Programs](https://www.in.gov/idoa/proc/solicitations/files/005030000087847.zip)** | **FSSA Medicaid Policy & Planning** | **A** |

**FSSA External Quality Reviews is the closest match in the entire corpus** — Medicaid managed care quality review across HHW, HIP, Hoosier Care Connect and PathWays. Mandatory CMS activities under 42 CFR §438.358/.360.

**It carries a hard eligibility requirement worth checking first.** The contractor must **be, or subcontract with, an NCQA-certified HEDIS/CAHPS survey vendor**, and must have **NCQA-certified HEDIS Compliance Auditors**. The Medical Records Review Coordinator must be an RN or equivalently licensed. That is a teaming question, not a capability question, and it is answerable today.

**Two on this list are RFIs, not solicitations** — FHWA and IGC Daycare. No bid, no award. IGC Daycare notes the State *may limit future competition to RFI respondents*, which makes responding cheap insurance; it also requires full childcare licensure and full operational liability.

**Band B — 12 more open**, edge cases on scope or scale, listed in [`corpus/manifest.md`](../corpus/manifest.md). Documents not pulled for these.

**One has closed** since collection: *Staff Augmentation*, U.S. Army Central, 08/09.

---

## 3. Pre-RFP: the Medicaid contract cliff, 2026-12-31

Not a solicitation. This is what the Expiration Radar is designed to surface, found by hand before the radar exists.

**231 Indiana contracts across 149 vendors all end 2026-12-31 — 143 days out.** Forty-two belong to FSSA Medicaid Policy & Planning, and they include the entire managed care book:

| Vendor | Role |
|---|---|
| Anthem Insurance Companies | MCO capitation |
| MDwise | MCO capitation |
| Coordinated Care Corporation | MCO capitation |
| CareSource Indiana | MCO capitation |
| [OptumRx Administrative Services](https://contracts.idoa.in.gov/idoacontractsweb/PUBLIC/0000000000000000000059301-001.pdf) | Pharmacy benefit administration |
| [First Data Government Solutions](https://contracts.idoa.in.gov/idoacontractsweb/PUBLIC/0000000000000000000071837-000.pdf) | Payment processing |
| **[Milliman, Inc.](https://contracts.idoa.in.gov/idoacontractsweb/PUBLIC/0000000000000000000096081-000.pdf)** | **Actuarial / service delivery modelling** |

**The Milliman contract is the one to read.** Verified from the document: a **Professional Services Contract** with FSSA, two-year term, hourly rate, scope covering *"the design and modeling of a Service Delivery Model related to the transition from fee-for-service Medicaid to managed care."*

That is a consulting engagement, not an insurance contract, and it sits on the same expiry as the plans it supports. Whatever replaces it is professional services work in Medicaid managed care operations.

**Why the timing matters.** The same programme is re-procuring its plans *and* competing its quality-review contract (§2 above, due 09/17) in the same window. Positioning for the December work is possible now; by the time an RFP publishes, the incumbent will have been positioning for months — which is problem #2 in the design spec, stated in the abstract and now available in the concrete.

**Search the register yourself:** [secure.in.gov/apps/idoa/contractsearch](https://secure.in.gov/apps/idoa/contractsearch/) · 204,439 contracts back to 2005, free, no account.

> **Do not read the dollar figures in the raw data as contract values.** The `amount` field is EDS form field 6, *"total amount this action"* — a per-amendment delta that is routinely negative. The running total is field 7 and exists only inside the PDF. Any sizing has to come from reading the document.

---

## 4. What would make this list shorter and better

**The hand-run.** Twenty-three open band A/B rows, none scored. Until they are, this list is *everything plausible* rather than *what to pursue*, and the difference is roughly a day of reading.

**The EQR teaming question.** One phone call establishes whether an NCQA-certified HEDIS auditor relationship is reachable, and that single answer decides whether the best-matching opportunity in the corpus is bidable at all.

**Read the Milliman scope of work.** Exhibit 1 is attached to the linked PDF. It is the clearest available description of what Indiana buys, from a consultancy, in Medicaid managed care.
