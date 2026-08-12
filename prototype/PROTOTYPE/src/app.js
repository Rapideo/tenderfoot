/* Tenderfoot — prototype mock layer
 *
 * Extracted 2026-08-10 from the Claude Design bundle in this directory.
 *
 * WHAT THIS FILE IS FOR. Per Proto2PRD §4.1.1 the production data model is this
 * dataset normalized — the schema gets read off these shapes rather than designed
 * separately. So a field here is a schema decision, and the comments are the
 * specification. That is the whole reason this was lifted out of the bundle:
 * the DATA survived the generator intact and well-shaped; the RULES did not,
 * because the generated script carried zero comments.
 *
 * Everything below the rule comments is verbatim from the bundle. The comments
 * are new, and are the point.
 *
 * Sources cited as §x.y are `docs/superpowers/specs/2026-08-03-tenderfoot-design.md`.
 *
 * ===========================================================================
 * SCOPE CHANGE 2026-08-11 — V1 HAS NO SCORES. READ BEFORE TRUSTING THIS FILE.
 * ===========================================================================
 * Matching is parked in full (spec §1.1, §6). The application returns everything
 * every active source returns: no ranking, no scoring, no filtering. Qualification
 * will be re-imagined after ingestion is running, and §6 does not describe it.
 *
 * WHAT THAT MEANS HERE -- AND WHAT IT DOES NOT MEAN. The `scores` array on every
 * opportunity below, and the chip vocabularies at the foot of this file, model a
 * layer V1 does not have.
 *
 * They STAY. Matt, 2026-08-11: the prototype represents the final released product
 * and doubles as demo material, so it is measured against the destination rather
 * than against the first shippable slice. Nothing here is trimmed to match V1, and
 * a later Design iteration adding more intelligence surface is on-plan.
 *
 * So this is a PHASING note, not a defect report. The distinction that matters is
 * schema: Proto2PRD §4.1.1 makes the production data model this dataset normalized,
 * and V1's migrations should not carry fields that nothing populates for a year.
 *
 * LATER-PHASE, not V1 schema: `scores[]`, `PASS_CHIPS`, `YES_CHIPS`.
 * V1 SCHEMA: everything else -- and `conflict` plus the pursuit-cost fact fields
 * get MORE important, not less, because with no scores the extracted facts are the
 * only thing V1 can be right or wrong about (§8.4).
 *
 * ONE RISK THIS CREATES. The deadline-conflict model below was justified partly by
 * the gated-items drawer (SVRC 1.1.5) making a bad extraction recoverable. That
 * drawer is parked with the gates. The conflict display is now the ONLY thing
 * standing between a wrongly-extracted deadline and a silently missed bid.
 * ===========================================================================
 */
(function (window) {
  'use strict';

  const TENDERFOOT = {};

  /* ---- OPPORTUNITIES ---------------------------------------------------
   *
   * RULE: an opportunity carries its four machine scores WITH the text that
   * produced them. `scores[].cite` and `scores[].doc` are not decoration —
   * §6.3 makes citation mandatory, because an uncited score is an assertion
   * and the user is being asked to trust it in ten seconds.
   *
   * RULE: `conflict` models a real failure, not an edge case. The FSSA bundle
   * in `corpus/` ships three boilerplate PDFs carrying TWO different deadlines,
   * and the correct one lives in the least-specifically-named file. Where
   * sources disagree the record keeps BOTH values with their provenance
   * (`conflictA`/`conflictASrc`, `conflictB`/`conflictBSrc`) and shows the
   * disagreement rather than silently resolving it. A field that quietly picks
   * one is how the near-miss in `corpus/FINDINGS.md` reaches production —
   * a stale date would have killed the best-fit opportunity three weeks early.
   *
   * RULE: listing metadata outranks document text for dates (`corpus/FINDINGS.md`).
   * The portal's structured field was right; all three documents were not.
   *
   * SCHEMA NOTE: `deadlineColor` is presentation leaking into data. It should
   * be derived from the deadline at render time, not stored. Left as-is so the
   * extraction stays faithful; flag it before this shape becomes a migration.
   */
  TENDERFOOT.OPPS = [
    {
      id: "in-fssa-ltss",
      title: "Long-Term Services & Supports Care Management Redesign",
      buyer: "Indiana Family & Social Services Administration — Office of Medicaid Policy",
      sourceLabel: "IN · SUPPLIER PORTAL",
      tags: ["MEDICAID", "RFP", "STATE"],
      deadline: "2026-09-18",
      deadlineIn: "39 days out · 5:00 PM EDT",
      deadlineColor: "#14181c",
      value: "$4.1M",
      valueNote: "2-yr base + 2 one-yr options",
      posted: "2026-07-29",
      postedNote: "Addendum 2 on 08-06",
      conflict: true,
      conflictA: "2026-09-18",
      conflictASrc: "Listing metadata · portal record",
      conflictB: "2026-09-25",
      conflictBSrc: "Addendum 2, §1.4 (least-specifically-named file)",
      scores: [
        { label: "Fit", v: 84, cite: "Scope §2.1 asks for care-management workflow redesign and stakeholder facilitation across county offices — both named service lines in the Firm Profile.", doc: "RFP-24-0918_SOW.docx · p.7" },
        { label: "Winnability", v: 61, cite: "Incumbent Maximus has held the adjacent contract since 2019 but this scope is newly severed from it, so there is no incumbent on this work specifically.", doc: "EDS award record 0043118 · 2019-04-02" },
        { label: "Value", v: 72, cite: "Stated not-to-exceed of $4.1M across the full option period; annualised it sits in the upper half of the profile's target band.", doc: "RFP-24-0918_Main.pdf · §5.2" },
        { label: "Timing", v: 48, cite: "39 days to a mandatory-conference solicitation with three reference letters required. Tight but not disqualifying.", doc: "derived · pursuit-cost panel" }
      ],
      cost: [
        { v: "7", label: "Required forms" },
        { v: "Mandatory", label: "Pre-proposal conference", warn: true },
        { v: "3", label: "References demanded" },
        { v: "Yes", label: "Notarization required", warn: true },
        { v: "40 pp", label: "Page limit" },
        { v: "2", label: "Sealed copies + USB" }
      ]
    },
    {
      id: "naspo-ogs",
      title: "Public Health Data Modernization Services (NASPO ValuePoint)",
      buyer: "New York State Office of General Services",
      buyerNote: "Listed on Indiana's portal — the buyer is NY OGS, not Indiana. Cooperative award, participating states TBD.",
      sourceLabel: "IN · SUPPLIER PORTAL",
      tags: ["COOPERATIVE", "RFP"],
      deadline: "2026-08-27",
      deadlineIn: "17 days out · 3:00 PM EDT",
      deadlineColor: "#b5761a",
      value: "$12M+",
      valueNote: "Multi-state, no ceiling stated",
      posted: "2026-07-14",
      postedNote: "No addenda",
      conflict: false,
      scores: [
        { label: "Fit", v: 43, cite: "Scope is weighted to platform engineering and hosting; the advisory component is one of six lots and not separately awardable.", doc: "OGS-2026-11_Scope.pdf · §3" },
        { label: "Winnability", v: 21, cite: "Cooperative awards favour vendors with existing multi-state contract vehicles. No such vehicle in the Firm Profile.", doc: "profile · certifications" },
        { label: "Value", v: 91, cite: "No stated ceiling; comparable NASPO health-data vehicles have run past $12M over five years.", doc: "EDS comparable 0038822" },
        { label: "Timing", v: 34, cite: "17 days, and a cooperative response typically needs a teaming agreement executed first.", doc: "derived" }
      ],
      cost: [
        { v: "14", label: "Required forms", warn: true },
        { v: "Optional", label: "Pre-proposal conference" },
        { v: "5", label: "References demanded", warn: true },
        { v: "Yes", label: "Notarization required", warn: true },
        { v: "None", label: "Page limit" },
        { v: "6", label: "Sealed copies + USB", warn: true }
      ]
    },
    {
      id: "in-doh-cboa",
      title: "Community-Based Organization Readiness Assessment",
      buyer: "Indiana Department of Health — Division of Chronic Disease",
      sourceLabel: "IN · SUPPLIER PORTAL",
      tags: ["PUBLIC HEALTH", "RFI"],
      deadline: "2026-10-02",
      deadlineIn: "53 days out · 4:00 PM EDT",
      deadlineColor: "#14181c",
      value: "$285K",
      valueNote: "12-month term, no options",
      posted: "2026-08-04",
      postedNote: "No addenda",
      conflict: false,
      scores: [
        { label: "Fit", v: 92, cite: "Readiness assessment, capacity-building curriculum, and county-level facilitation — a near-verbatim match to three Firm Profile service lines.", doc: "IDOH-RFI-26-08_SOW.pdf · §2.2" },
        { label: "Winnability", v: 74, cite: "RFI stage with no incumbent named. Small dollar value tends to thin the field of national primes.", doc: "no prior award found" },
        { label: "Value", v: 31, cite: "$285K single-year sits below the profile's stated target band but above its floor.", doc: "IDOH-RFI-26-08_Main.pdf · §4" },
        { label: "Timing", v: 88, cite: "53 days, four forms, no conference. The cheapest pursuit in the queue.", doc: "derived" }
      ],
      cost: [
        { v: "4", label: "Required forms" },
        { v: "None", label: "Pre-proposal conference" },
        { v: "2", label: "References demanded" },
        { v: "No", label: "Notarization required" },
        { v: "25 pp", label: "Page limit" },
        { v: "1", label: "Sealed copies + USB" }
      ]
    },
    {
      id: "in-doe-transport",
      title: "Statewide Student Transportation Routing Software",
      buyer: "Indiana Department of Education",
      sourceLabel: "IN · SUPPLIER PORTAL",
      tags: ["EDUCATION", "RFP", "SOFTWARE"],
      deadline: "2026-09-04",
      deadlineIn: "25 days out · 12:00 PM EDT",
      deadlineColor: "#b5761a",
      value: "$1.9M",
      valueNote: "3-yr term",
      posted: "2026-07-22",
      postedNote: "Addendum 1 on 08-01",
      conflict: false,
      scores: [
        { label: "Fit", v: 12, cite: "Deliverable is a licensed routing product with implementation services attached. No software product in the Firm Profile.", doc: "DOE-26-044_SOW.pdf · §1.1" },
        { label: "Winnability", v: 9, cite: "Four named products meet the mandatory feature matrix; all four vendors bid this vehicle in 2023.", doc: "EDS award history 0041027" },
        { label: "Value", v: 58, cite: "$1.9M over three years, mid-band.", doc: "DOE-26-044_Main.pdf · §6" },
        { label: "Timing", v: 40, cite: "25 days with a mandatory demo window.", doc: "derived" }
      ],
      cost: [
        { v: "9", label: "Required forms" },
        { v: "Mandatory", label: "Pre-proposal conference", warn: true },
        { v: "4", label: "References demanded" },
        { v: "Yes", label: "Notarization required", warn: true },
        { v: "60 pp", label: "Page limit" },
        { v: "3", label: "Sealed copies + USB" }
      ]
    },
    {
      id: "in-fssa-mco",
      title: "Managed Care Organization Quality Oversight Support",
      buyer: "Indiana Family & Social Services Administration — Medicaid Managed Care",
      sourceLabel: "IN · SUPPLIER PORTAL",
      tags: ["MEDICAID", "RFP", "RE-COMPETE"],
      deadline: "2026-11-14",
      deadlineIn: "96 days out · 5:00 PM EST",
      deadlineColor: "#14181c",
      value: "$2.6M",
      valueNote: "Successor to a 2026-12-31 expiry",
      posted: "2026-08-08",
      postedNote: "Surfaced by expiration radar 5mo early",
      conflict: false,
      scores: [
        { label: "Fit", v: 77, cite: "Quality oversight, EQRO coordination, and stakeholder reporting. Two of three are profile service lines; EQRO coordination is not.", doc: "FSSA-26-112_SOW.docx · §2" },
        { label: "Winnability", v: 55, cite: "The expiring capitation book is held by three MCOs, but oversight support has been a separate small award each cycle.", doc: "EDS contract 0044901 · expires 2026-12-31" },
        { label: "Value", v: 64, cite: "$2.6M over the base period.", doc: "FSSA-26-112_Main.pdf · §5.1" },
        { label: "Timing", v: 95, cite: "96 days. Radar surfaced this five months before the RFP posted.", doc: "expiration radar · 2026-03-11" }
      ],
      cost: [
        { v: "6", label: "Required forms" },
        { v: "Optional", label: "Pre-proposal conference" },
        { v: "3", label: "References demanded" },
        { v: "No", label: "Notarization required" },
        { v: "35 pp", label: "Page limit" },
        { v: "2", label: "Sealed copies + USB" }
      ]
    }
  ];;

  /* ---- OPPORTUNITY DETAIL ----------------------------------------------
   *
   * RULE: the brief answers what it is, why it fits, key dates, key risks, and
   * a recommended posture. It does NOT say which past projects to cite —
   * that capability was cut 2026-08-10 because the past-performance records are
   * not accessible to this project (§7.3). The Firm Profile field stays in the
   * model and stays empty so the capability can return without a migration.
   *
   * RULE: extracted fields carry confidence AND a source pointer, always.
   * §8.4 makes deadlines the highest-consequence extracted field; a value with
   * no provenance cannot be checked, and unverifiable extraction is worse than
   * absent extraction because it looks the same as the real thing.
   */
  TENDERFOOT.DETAILS = {
    "in-fssa-ltss": {
        brief: {
          what: "FSSA is severing care-management workflow design from its incumbent LTSS operations contract and competing it separately. The work is process redesign and county-office facilitation across 92 counties, delivered against a fixed 24-month schedule with two one-year options.",
          fit: "Two of the three named deliverables map directly onto Firm Profile service lines — workflow redesign and multi-stakeholder facilitation. The third, CMS 1915(c) waiver reporting, does not appear in the profile at all and is where the pursuit gets expensive.",
          gaps: [
            "CMS 1915(c) waiver reporting — no capability in the Firm Profile. Sub or partner.",
            "Three references on Medicaid work of comparable size; the profile records one.",
            "Mandatory pre-proposal conference in Indianapolis, 2026-08-21, in person."
          ],
          posture: "Pursue as sub to a Medicaid-experienced prime",
          postureWhy: "Held back where the ingredients are thin — this is the machine claiming authority it may not have earned. Open question 2.1.",
          dates: [
            { label: "Questions due", v: "2026-08-19", color: "#b5761a" },
            { label: "Pre-proposal conf.", v: "2026-08-21", color: "#a33a2e" },
            { label: "Addenda close", v: "2026-09-04", color: "#3d474e" },
            { label: "Proposals due", v: "2026-09-18 ⚑", color: "#a33a2e" }
          ],
          risks: [
            "Two deadlines in the bundle disagree by seven days. Unresolved — verify with the buyer before planning.",
            "Incumbent holds the adjacent operations contract and will know the counties better.",
            "Notarized cost proposal means the schedule needs three extra days at the end."
          ]
        },

        fields: [
          { label: "Submission deadline", v: "2026-09-18 · CONFLICT with Addendum 2 (2026-09-25)", conf: "48%", src: "listing + addendum", bg: "#fdf7f6", confColor: "#a33a2e" },
          { label: "Estimated value", v: "$4,100,000 not-to-exceed", conf: "91%", src: "Main.pdf §5.2", bg: "#fff", confColor: "#2e7d5b" },
          { label: "Set-aside", v: "None. M/WBE participation goal 8%", conf: "88%", src: "Main.pdf §3.4", bg: "#fff", confColor: "#2e7d5b" },
          { label: "NAICS", v: "541611 · 621999", conf: "76%", src: "listing metadata", bg: "#fff", confColor: "#1b6a8c" },
          { label: "Contract term", v: "24 months + 2 × 12-month options", conf: "84%", src: "SOW.docx §1.3", bg: "#fff", confColor: "#2e7d5b" },
          { label: "Contact", v: "procurement@fssa.in.gov", conf: "97%", src: "listing metadata", bg: "#fff", confColor: "#2e7d5b" },
          { label: "Bond requirement", v: "Not found", conf: "—", src: "absent from bundle", bg: "#fbfcfd", confColor: "#93a0a8" }
        ],
        docs: [
          { ext: "PDF", name: "RFP-24-0918_Main.pdf", tagColor: "#a33a2e", bg: "#fff" },
          { ext: "DOCX", name: "RFP-24-0918_SOW.docx", tagColor: "#1b6a8c", bg: "#f2f8fb" },
          { ext: "PDF", name: "Addendum_2_signed.pdf", tagColor: "#a33a2e", bg: "#fff" },
          { ext: "XLSX", name: "Cost_Proposal_Template.xlsx", tagColor: "#2e7d5b", bg: "#fff" },
          { ext: "DOCX", name: "Attachment_C_References.docx", tagColor: "#1b6a8c", bg: "#fff" },
          { ext: "ZIP", name: "County_Data_2024-2025.zip", tagColor: "#5a666e", bg: "#fff" },
          { ext: "PPTX", name: "Pre-proposal_Deck.pptx", tagColor: "#b5761a", bg: "#fff" },
          { ext: "PDF", name: "Standard_Terms_v9.pdf", tagColor: "#a33a2e", bg: "#fff" },
          { ext: "PDF", name: "W-9_and_EDS.pdf", tagColor: "#a33a2e", bg: "#fff" }
        ],
        timeline: [
          { date: "2026-08-06", dot: "#a33a2e", title: "Addendum 2 posted", body: "Enumerates four changes to §4 evaluation criteria. Does not mention the deadline.", diff: "DIFF · submission_deadline  2026-09-18 → 2026-09-25\nDIFF · title  “…Redesign” → “…Redesign and Support”" },
          { date: "2026-08-01", dot: "#1b6a8c", title: "Sighting — IN Supplier Portal", body: "Bundle re-fetched. 9 files, 2 new since first sighting." },
          { date: "2026-07-31", dot: "#b5761a", title: "Addendum 1 posted", body: "Pre-proposal conference moved from virtual to in-person, Indianapolis." },
          { date: "2026-07-29", dot: "#1b6a8c", title: "First sighting", body: "Ingested at 06:04. Cleared Stage 0 gates on geography, NAICS, and set-aside." },
          { date: "2026-03-11", dot: "#2e7d5b", title: "Predicted by expiration radar", body: "Adjacent LTSS operations contract flagged 5 months before this RFP posted." }
        ],
    },
    "naspo-ogs": {
      brief: {
        what: "NASPO ValuePoint cooperative solicitation led by New York State OGS for public-health data modernization, awarded as six lots. Participating states are named after award, so the addressable value is not knowable at bid time.",
        fit: "Lot 4 (stakeholder engagement and change management) is the only lot that touches a Firm Profile service line. Lots are not separately awardable, so bidding means bidding platform engineering and hosting alongside it.",
        gaps: [
          "Platform engineering and hosting — absent from the profile. Prime relationship required, not a sub scope.",
          "Multi-state contract vehicle. None on file; cooperative evaluations weight it heavily.",
          "Five references at cooperative scale; the profile records one."
        ],
        posture: "No-bid as prime · watch for teaming inbound",
        postureWhy: "The ingredients are thin enough that the recommendation is cheap to make. Where they are close, the machine should show them and stay quiet.",
        dates: [
          { label: "Questions due", v: "2026-08-14", color: "#a33a2e" },
          { label: "Intent to bid", v: "2026-08-18", color: "#b5761a" },
          { label: "Proposals due", v: "2026-08-27", color: "#a33a2e" },
          { label: "Award target", v: "2026-12-01", color: "#3d474e" }
        ],
        risks: [
          "No stated ceiling means no way to size the pursuit against the profile's target band.",
          "Participating-state list is published post-award; the work could land nowhere near Indiana.",
          "Fourteen required forms against a 17-day window."
        ]
      },
      fields: [
        { label: "Submission deadline", v: "2026-08-27 · 3:00 PM EDT", conf: "94%", src: "listing metadata", bg: "#fff", confColor: "#2e7d5b" },
        { label: "Estimated value", v: "No ceiling stated", conf: "—", src: "absent from bundle", bg: "#fbfcfd", confColor: "#93a0a8" },
        { label: "Buyer", v: "New York State OGS — listed on Indiana's portal", conf: "88%", src: "Scope.pdf cover", bg: "#fdf7f6", confColor: "#2e7d5b" },
        { label: "Set-aside", v: "None. No participation goal stated", conf: "81%", src: "Scope.pdf §3", bg: "#fff", confColor: "#2e7d5b" },
        { label: "NAICS", v: "541512 · 541611", conf: "72%", src: "listing metadata", bg: "#fff", confColor: "#1b6a8c" },
        { label: "Contract term", v: "5 years, no options", conf: "90%", src: "Terms.pdf §2", bg: "#fff", confColor: "#2e7d5b" },
        { label: "Contact", v: "valuepoint.rfp@ogs.ny.gov", conf: "96%", src: "listing metadata", bg: "#fff", confColor: "#2e7d5b" }
      ],
      docs: [
        { ext: "PDF", name: "OGS-2026-11_Main.pdf", tagColor: "#a33a2e", bg: "#fff" },
        { ext: "PDF", name: "OGS-2026-11_Scope.pdf", tagColor: "#a33a2e", bg: "#f2f8fb" },
        { ext: "XLSX", name: "Lot_Pricing_Workbook.xlsx", tagColor: "#2e7d5b", bg: "#fff" },
        { ext: "PDF", name: "NASPO_Master_Terms.pdf", tagColor: "#a33a2e", bg: "#fff" },
        { ext: "DOCX", name: "Participating_Addendum_Template.docx", tagColor: "#1b6a8c", bg: "#fff" }
      ],
      timeline: [
        { date: "2026-07-16", dot: "#1b6a8c", title: "Sighting — IN Supplier Portal", body: "Bundle complete at 5 files. No addenda since." },
        { date: "2026-07-14", dot: "#1b6a8c", title: "First sighting", body: "Cleared Stage 0 gates. Buyer resolved to NY OGS, not the hosting jurisdiction — Organization link corrected on ingest." }
      ]
    },
    "in-doh-cboa": {
      brief: {
        what: "An RFI, not yet an RFP: IDOH is scoping a readiness assessment of community-based organizations delivering chronic-disease programming, with a county-level facilitation component and a capacity-building curriculum.",
        fit: "The closest match in the queue. Three named deliverables, three Firm Profile service lines. Nothing in the scope falls outside what the profile already claims.",
        gaps: [
          "Nothing structural. The scope is inside the profile.",
          "Two references at this size — the profile records one, and the second is recoverable from the 2025 county pilot.",
          "$285K single-year sits below the target band; the fit is the argument, not the money."
        ],
        posture: "Pursue as prime",
        postureWhy: "Cheapest pursuit in the queue and the highest fit score. Four forms, no conference, no notarization.",
        dates: [
          { label: "RFI responses due", v: "2026-10-02", color: "#3d474e" },
          { label: "Expected RFP", v: "Q1 2027 (stated)", color: "#3d474e" },
          { label: "Questions due", v: "2026-09-18", color: "#b5761a" },
          { label: "Award target", v: "not stated", color: "#93a0a8" }
        ],
        risks: [
          "An RFI can produce no RFP at all. Effort here buys position, not revenue.",
          "Responding shapes the eventual scope — and also tells competitors it exists.",
          "Below the profile's target value band."
        ]
      },
      fields: [
        { label: "Submission deadline", v: "2026-10-02 · 4:00 PM EDT", conf: "96%", src: "listing metadata", bg: "#fff", confColor: "#2e7d5b" },
        { label: "Estimated value", v: "$285,000", conf: "79%", src: "Main.pdf §4", bg: "#fff", confColor: "#1b6a8c" },
        { label: "Instrument type", v: "RFI — not a solicitation", conf: "98%", src: "cover page", bg: "#fff", confColor: "#2e7d5b" },
        { label: "Set-aside", v: "None. M/WBE goal 10%", conf: "85%", src: "Main.pdf §3.1", bg: "#fff", confColor: "#2e7d5b" },
        { label: "NAICS", v: "541611 · 923120", conf: "74%", src: "listing metadata", bg: "#fff", confColor: "#1b6a8c" },
        { label: "Contract term", v: "12 months, no options", conf: "88%", src: "SOW.pdf §1.2", bg: "#fff", confColor: "#2e7d5b" },
        { label: "Contact", v: "chronicdisease.rfi@health.in.gov", conf: "97%", src: "listing metadata", bg: "#fff", confColor: "#2e7d5b" }
      ],
      docs: [
        { ext: "PDF", name: "IDOH-RFI-26-08_Main.pdf", tagColor: "#a33a2e", bg: "#f2f8fb" },
        { ext: "PDF", name: "IDOH-RFI-26-08_SOW.pdf", tagColor: "#a33a2e", bg: "#fff" },
        { ext: "DOCX", name: "Response_Template.docx", tagColor: "#1b6a8c", bg: "#fff" },
        { ext: "PDF", name: "County_Program_Inventory.pdf", tagColor: "#a33a2e", bg: "#fff" }
      ],
      timeline: [
        { date: "2026-08-04", dot: "#1b6a8c", title: "First sighting", body: "Ingested at 06:04. Cleared all Stage 0 gates. Highest Fit score recorded to date." }
      ]
    },
    "in-doe-transport": {
      brief: {
        what: "A licensed student-transportation routing product with implementation, training, and three years of support, bought as one award for all participating school corporations.",
        fit: "Low. The deliverable is software the firm does not make. The implementation and training services attached to it are real work, but they are not separately awardable.",
        gaps: [
          "A routing product. This is not a partner gap, it is the whole deliverable.",
          "Mandatory demo against a 41-item feature matrix.",
          "K-12 references; the profile records none."
        ],
        posture: "No-bid",
        postureWhy: "Fit 12 and Winnability 9. The four vendors meeting the mandatory feature matrix all bid the 2023 vehicle.",
        dates: [
          { label: "Questions due", v: "2026-08-20", color: "#b5761a" },
          { label: "Mandatory demo window", v: "2026-08-25 → 08-28", color: "#a33a2e" },
          { label: "Proposals due", v: "2026-09-04", color: "#a33a2e" },
          { label: "Award target", v: "2026-10-15", color: "#3d474e" }
        ],
        risks: [
          "Feature-matrix scoring is pass/fail before price is opened.",
          "Incumbent product is already deployed in 38 corporations.",
          "Demo window falls inside the LTSS pre-proposal week."
        ]
      },
      fields: [
        { label: "Submission deadline", v: "2026-09-04 · 12:00 PM EDT", conf: "93%", src: "listing metadata", bg: "#fff", confColor: "#2e7d5b" },
        { label: "Estimated value", v: "$1,900,000 over 3 years", conf: "86%", src: "Main.pdf §6", bg: "#fff", confColor: "#2e7d5b" },
        { label: "Set-aside", v: "None", conf: "92%", src: "Main.pdf §3", bg: "#fff", confColor: "#2e7d5b" },
        { label: "NAICS", v: "511210 · 541512", conf: "89%", src: "listing metadata", bg: "#fff", confColor: "#2e7d5b" },
        { label: "Mandatory features", v: "41 items, pass/fail", conf: "77%", src: "Feature_Matrix.xlsx", bg: "#fff", confColor: "#1b6a8c" },
        { label: "Contract term", v: "36 months + 2 × 12-month options", conf: "84%", src: "SOW.pdf §1.4", bg: "#fff", confColor: "#2e7d5b" },
        { label: "Contact", v: "procurement@doe.in.gov", conf: "95%", src: "listing metadata", bg: "#fff", confColor: "#2e7d5b" }
      ],
      docs: [
        { ext: "PDF", name: "DOE-26-044_Main.pdf", tagColor: "#a33a2e", bg: "#fff" },
        { ext: "PDF", name: "DOE-26-044_SOW.pdf", tagColor: "#a33a2e", bg: "#fff" },
        { ext: "XLSX", name: "Feature_Matrix.xlsx", tagColor: "#2e7d5b", bg: "#f2f8fb" },
        { ext: "PDF", name: "Addendum_1.pdf", tagColor: "#a33a2e", bg: "#fff" },
        { ext: "ZIP", name: "Corporation_Route_Data.zip", tagColor: "#5a666e", bg: "#fff" }
      ],
      timeline: [
        { date: "2026-08-01", dot: "#b5761a", title: "Addendum 1 posted", body: "Demo window moved forward four days; feature matrix reissued with two items added." },
        { date: "2026-07-22", dot: "#1b6a8c", title: "First sighting", body: "Cleared Stage 0 gates on geography and set-aside. Flagged low Fit at ingest." }
      ]
    },
    "in-fssa-mco": {
      brief: {
        what: "Independent quality-oversight support for Indiana's Medicaid managed-care program: EQRO coordination, MCO performance reporting, and stakeholder briefings across the capitation book that expires 2026-12-31.",
        fit: "Two of three deliverables are profile service lines. EQRO coordination is not, and it is the regulated part — the piece that decides whether this is a prime bid or a sub bid.",
        gaps: [
          "EQRO coordination — CMS-recognised review capability. Sub to an EQRO or partner with one.",
          "Three Medicaid references of comparable size; the profile records one.",
          "Actuarial review support is named in passing and not scoped."
        ],
        posture: "Pursue as sub to an EQRO-credentialed prime",
        postureWhy: "96 days out and surfaced five months early by the radar — the pursuit has time to build the teaming relationship it needs.",
        dates: [
          { label: "Questions due", v: "2026-09-30", color: "#3d474e" },
          { label: "Optional conference", v: "2026-10-08", color: "#3d474e" },
          { label: "Proposals due", v: "2026-11-14", color: "#b5761a" },
          { label: "Incumbent expiry", v: "2026-12-31", color: "#a33a2e" }
        ],
        risks: [
          "The successor award has to be in place before 2026-12-31 — a schedule slip favours an incumbent extension.",
          "Burns & Associates holds the adjacent oversight contract with two options remaining.",
          "EQRO teaming partner is a single point of failure for the whole bid."
        ]
      },
      fields: [
        { label: "Submission deadline", v: "2026-11-14 · 5:00 PM EST", conf: "95%", src: "listing metadata", bg: "#fff", confColor: "#2e7d5b" },
        { label: "Estimated value", v: "$2,600,000 base period", conf: "87%", src: "Main.pdf §5.1", bg: "#fff", confColor: "#2e7d5b" },
        { label: "Predecessor contract", v: "EDS 0044901 · expires 2026-12-31", conf: "91%", src: "expiration radar", bg: "#f6fafc", confColor: "#2e7d5b" },
        { label: "Set-aside", v: "None. M/WBE goal 12%", conf: "83%", src: "Main.pdf §3.2", bg: "#fff", confColor: "#2e7d5b" },
        { label: "NAICS", v: "541611 · 524292", conf: "78%", src: "listing metadata", bg: "#fff", confColor: "#1b6a8c" },
        { label: "Contract term", v: "24 months + 3 × 12-month options", conf: "86%", src: "SOW.docx §1.3", bg: "#fff", confColor: "#2e7d5b" },
        { label: "Contact", v: "managedcare.procurement@fssa.in.gov", conf: "97%", src: "listing metadata", bg: "#fff", confColor: "#2e7d5b" }
      ],
      docs: [
        { ext: "PDF", name: "FSSA-26-112_Main.pdf", tagColor: "#a33a2e", bg: "#fff" },
        { ext: "DOCX", name: "FSSA-26-112_SOW.docx", tagColor: "#1b6a8c", bg: "#f2f8fb" },
        { ext: "XLSX", name: "Quality_Measure_Set.xlsx", tagColor: "#2e7d5b", bg: "#fff" },
        { ext: "PDF", name: "EQRO_Protocol_Reference.pdf", tagColor: "#a33a2e", bg: "#fff" },
        { ext: "DOCX", name: "Cost_Proposal_Template.docx", tagColor: "#1b6a8c", bg: "#fff" },
        { ext: "PDF", name: "Standard_Terms_v9.pdf", tagColor: "#a33a2e", bg: "#fff" }
      ],
      timeline: [
        { date: "2026-08-08", dot: "#1b6a8c", title: "First sighting — RFP posted", body: "Matched to the predicted re-compete raised by the expiration radar in March." },
        { date: "2026-03-11", dot: "#2e7d5b", title: "Predicted by expiration radar", body: "EDS 0044901 flagged on expiry inside a Firm-Profile sector, 150 days before the RFP existed." }
      ]
    }
  };;

  /* ---- GATED ITEMS ------------------------------------------------------
   *
   * RULE: gated items are FILED, NOT DELETED (§6.2). Every entry keeps the
   * gate that eliminated it, and the drawer is reachable from the queue.
   *
   * This is not tidiness. Stage 0 gates are deterministic and will sometimes be
   * fed a wrong extracted value, and a rejection nobody can inspect is a bug
   * nobody can find. The whole system exists to prevent silent recall failures;
   * a gate that deletes is one.
   */
  TENDERFOOT.GATED = [
    { title: "Roadway Bridge Inspection Services — INDOT District 4", gate: "GEOGRAPHY — OUT OF STATE" },
    { title: "Correctional Food Service Management, Statewide", gate: "NAICS — NO MATCH" },
    { title: "Emergency Generator Maintenance — 14 Sites", gate: "DEADLINE PASSED" },
    { title: "Cloud Migration & FedRAMP Advisory (Federal)", gate: "SET-ASIDE — 8(a) ONLY" }
  ];;

  /* ---- REASON VOCABULARY ------------------------------------------------
   *
   * RULE: the reason matters more than the decision (§4.5, component 3K). With
   * no bid history to seed the scorer, every no-bid reason is a few-shot example
   * and is load-bearing from decision one. Email can only ever record the binary,
   * which is the argument for the app existing at all.
   *
   * RULE: a Pass requires a reason; an Interested does not. Rejections teach.
   *
   * PROVISIONAL: this vocabulary was invented by the generator, not derived.
   * It must be replaced by the categories that actually emerge from the hand-run
   * in `corpus/manifest.md`, in the scorer's own words. Chips fixed before the
   * hand-run flatten exactly the signal the hand-run exists to capture, and a
   * free-text escape hatch stays regardless.
   *
   * NOTE: "Capacity — too large" contradicts §1. The system is capacity-agnostic:
   * eligibility facts stay, capacity judgments go. A solicitation demanding 50
   * employees is a hard gate; "we are too busy" is not modelled anywhere.
   * Either this chip goes, or §1 changes — but not both quietly.
   *
   * UPDATE 2026-08-11 — PARKED, AND THE CONTRADICTION WENT DORMANT RATHER THAN
   * GETTING RESOLVED. Qualification is parked (spec §1.1); no recorded reason
   * feeds any model, so there is no vocabulary to get right and nothing learns
   * from a capacity judgment. V1 records free text against the decision instead.
   *
   * The §1 conflict is therefore ASLEEP, NOT FIXED. It wakes the moment recorded
   * reasons become model input again, and whoever designs qualification has to
   * re-check it then. Writing it down here because a dormant contradiction that
   * nobody wrote down is indistinguishable from one that was resolved.
   *
   * The wider version of the problem, worth carrying forward: three of these
   * chips are facts about KP at a moment rather than facts about the opportunity
   * -- "Too small", "Capacity — too large", "Cost to pursue too high". Those do
   * not generalize, because the same solicitation next quarter is a different
   * answer. Any future design that learns from reasons needs that split.
   */
  TENDERFOOT.PASS_CHIPS = ["Out of geography", "No capability match", "Incumbent locked", "Too small", "Capacity — too large", "Deadline too close", "Set-aside ineligible", "Cost to pursue too high"];;
  TENDERFOOT.YES_CHIPS = ["Strong fit", "Sub / teaming play", "Known buyer", "Watch only"];;

  window.TENDERFOOT = TENDERFOOT;
})(window);
