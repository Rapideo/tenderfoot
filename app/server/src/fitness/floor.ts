/* THE FLOOR. Does what we HOLD support a decision we can trust?
 *
 * Data-fitness spec §3, ruled by Matt 2026-09-03. Seven predicates, each
 * measured against the live database, each carrying its threshold, its measured
 * value and a verdict. Read-only: nothing in this file writes.
 *
 * The floor scores OUR HOLDINGS. The rubric (rubric.ts) scores A SOURCE. They
 * are two readings of one property list and must not be conflated -- a source
 * can be excellent while our holdings from it are inadequate, and that is
 * exactly the state this project has been in. */
import { all, one } from "../db/index.js";
import { THRESHOLDS, THRESHOLDS_RATIFIED } from "./thresholds.js";
import { EFFECTIVE_CLOSES_AT, NOT_BIDDABLE_SQL } from "../triage/eligibility.js";

export type Verdict = "pass" | "fail" | "marginal" | "unknown";

export interface PredicateResult {
  /** "F1".."F7" */
  id: string;
  /** The property from spec §2 this predicate reads. */
  property: string;
  statement: string;
  threshold: number | string;
  measured: number | string;
  verdict: Verdict;
  /** Whatever a reader needs in order to act. Never omitted on a fail. */
  detail?: string;
}

/* A source counts as INGESTED when it has an ingest_run row -- not when it is
 * `enabled`, and not when `last_run_at` is stamped. Those say a run was
 * intended or attempted; an ingest_run row says one COMPLETED and wrote an
 * artifact hash. D27's whole finding is that intent and outcome diverge. */
const INGESTED_SOURCES = `
  SELECT DISTINCT s.id, s.name, s.jurisdiction
    FROM source s
    JOIN ingest_run ir ON ir.source_id = s.id`;

export async function measureF1(): Promise<PredicateResult> {
  const rows = await all<{ name: string }>(INGESTED_SOURCES);
  const n = rows.length;
  return {
    id: "F1",
    property: "P1",
    statement: "At least N sources have completed a real ingest",
    threshold: THRESHOLDS.minIngestedSources,
    measured: n,
    verdict: n >= THRESHOLDS.minIngestedSources ? "pass" : "fail",
    detail:
      n >= THRESHOLDS.minIngestedSources
        ? undefined
        : `Ingested: ${rows.map((r) => r.name).join(", ") || "none"}. ` +
          `A layer is only proven source-agnostic by a second source (D27, Proto2PRD 2.26).`,
  };
}

/* Read the geography from the Profile rather than constant-folding "IN".
 * §1A: scope is a Profile setting, not code. A second customer is a second row,
 * and a hard-coded jurisdiction would make this predicate lie for them. */
export async function measureF2(): Promise<PredicateResult> {
  const statement = "The Profile's primary geography is represented among ingested sources";
  const profile = await one<{ geography: { primary?: string[] } | null }>(
    `SELECT geography FROM firm_profile
       JOIN vendor ON vendor.id = firm_profile.vendor_id
      WHERE vendor.is_self LIMIT 1`,
  );
  const primary = profile?.geography?.primary ?? [];
  if (primary.length === 0) {
    return {
      id: "F2",
      property: "P2",
      statement,
      threshold: THRESHOLDS.minPrimaryGeographySources,
      measured: "unknown",
      verdict: "unknown",
      detail: "firm_profile.geography carries no `primary` array — nothing to measure against.",
    };
  }

  const rows = await all<{ name: string; jurisdiction: string | null }>(INGESTED_SOURCES);
  const n = rows.filter((r) => r.jurisdiction !== null && primary.includes(r.jurisdiction)).length;
  return {
    id: "F2",
    property: "P2",
    statement,
    threshold: THRESHOLDS.minPrimaryGeographySources,
    measured: n,
    verdict: n >= THRESHOLDS.minPrimaryGeographySources ? "pass" : "fail",
    detail:
      n >= THRESHOLDS.minPrimaryGeographySources
        ? undefined
        : `Primary geography is ${primary.join(", ")}; ingested jurisdictions are ` +
          `${[...new Set(rows.map((r) => r.jurisdiction ?? "null"))].join(", ") || "none"}.`,
  };
}

/* F3. THE 62, AND WHY THIS IS MEASURED RATHER THAN ASSUMED.
 *
 * 106 production rows close BEFORE they were posted -- the worst by 7,275 days,
 * a year typo in SAM's own payload. Until 7964047 the queue predicate compared
 * closes_at directly, so those rows filed as CLOSED and 62 live biddable ones
 * were dropped in silence: ~1.4% of a week's discovery.
 *
 * EFFECTIVE_CLOSES_AT now resolves an impossible date to NULL, which makes the
 * count below zero BY CONSTRUCTION today. It is measured anyway because that
 * construction is one refactor from being wrong and the failure mode is
 * silence. A row excluded for a DIFFERENT and legitimate reason -- an award
 * notice is not biddable -- must not be counted, or the predicate cries wolf. */
export async function measureF3(): Promise<PredicateResult> {
  const row = await one<{ n: string }>(
    `SELECT count(*) AS n
       FROM solicitation s
      WHERE s.closes_at IS NOT NULL
        AND s.posted_at IS NOT NULL
        AND s.closes_at < s.posted_at
        AND ${NOT_BIDDABLE_SQL}
        AND ${EFFECTIVE_CLOSES_AT} IS NOT NULL`,
  );
  const n = Number(row?.n ?? 0);
  return {
    id: "F3",
    property: "P5",
    statement: "No biddable row is hidden by a deadline earlier than its own posting date",
    threshold: 0,
    measured: n,
    verdict: n === 0 ? "pass" : "fail",
    detail:
      n === 0
        ? undefined
        : `${n} biddable rows carry an impossible deadline that still resolves to a non-null ` +
          `effective deadline. EFFECTIVE_CLOSES_AT has stopped covering them.`,
  };
}

/* F4. "Was anybody watching?"
 *
 * Plan of Action §6.4: a GO/NO-GO measured during a window in which a source was
 * silently dead is a measurement of an outage, not of the market.
 *
 * The longest run of consecutive ISO weeks, between the first and last ingest,
 * in which NO ingest_run completed. Weeks are counted across all sources
 * together: one source running weekly while another is dead is a per-source
 * problem, and the per-source view is the rubric's job, not the floor's.
 *
 * ⚠️ THE ADJUDICATION WINDOW IS STILL UNDEFINED (spec §8.2). This measures the
 * span we HAVE, not the span we SHOULD have. When the window is ruled, this
 * predicate gains a second clause rather than a different shape. */
export async function measureF4(): Promise<PredicateResult> {
  const statement = "Ingestion has no unwatched gap between its first and last run";
  const weeks = await all<{ week: string }>(
    `SELECT DISTINCT to_char(date_trunc('week', imported_at), 'YYYY-MM-DD') AS week
       FROM ingest_run
      ORDER BY week`,
  );

  if (weeks.length === 0) {
    return {
      id: "F4",
      property: "P4",
      statement,
      threshold: THRESHOLDS.maxIngestGapWeeks,
      measured: "unknown",
      verdict: "unknown",
      detail: "No ingest_run rows exist. Nothing has ever been ingested, so there is no span.",
    };
  }

  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  let worst = 0;
  for (let i = 1; i < weeks.length; i++) {
    const gap = (Date.parse(weeks[i]!.week) - Date.parse(weeks[i - 1]!.week)) / MS_PER_WEEK - 1;
    if (gap > worst) worst = gap;
  }
  const rounded = Math.round(worst);
  return {
    id: "F4",
    property: "P4",
    statement,
    threshold: THRESHOLDS.maxIngestGapWeeks,
    measured: rounded,
    verdict: rounded <= THRESHOLDS.maxIngestGapWeeks ? "pass" : "fail",
    detail:
      rounded <= THRESHOLDS.maxIngestGapWeeks
        ? `Span ${weeks[0]!.week} → ${weeks[weeks.length - 1]!.week}, ${weeks.length} week(s) with an ingest.`
        : `${rounded} consecutive weeks with no ingest, between ${weeks[0]!.week} and ` +
          `${weeks[weeks.length - 1]!.week}. A verdict taken over that span measures an outage.`,
  };
}

/* F5. The one number no amount of engineering can produce.
 *
 * 'New' is migration 002's DEFAULT and means untouched -- counting it would
 * report the queue's size as its decision count. Only a state a person chose is
 * a decision. */
export async function measureF5(): Promise<PredicateResult> {
  const row = await one<{ n: string }>(
    `SELECT count(DISTINCT solicitation_id) AS n FROM pursuit WHERE state <> 'New'`,
  );
  const n = Number(row?.n ?? 0);
  return {
    id: "F5",
    property: "P9",
    statement: "Enough real triage decisions exist to compute Interested-per-hundred",
    threshold: THRESHOLDS.minDecisions,
    measured: n,
    verdict: n >= THRESHOLDS.minDecisions ? "pass" : "fail",
    detail:
      n >= THRESHOLDS.minDecisions
        ? undefined
        : `${n} decisions recorded. This number requires a person triaging a real sample; ` +
          `nothing else can produce it.`,
  };
}

/* F6. p10 rather than the median, deliberately.
 *
 * Sample 2's MEDIAN description is a comfortable 515 characters and 6 of 25 are
 * still under 200. A median hides the tail, and the tail is where a triage
 * decision becomes impossible. Restricted to biddable kinds because an award
 * notice's empty description is not a defect -- there is nothing to decide. */
export async function measureF6(): Promise<PredicateResult> {
  const statement = "The 10th-percentile description on a biddable row is readable";
  const row = await one<{ p10: number | null; n: string }>(
    `SELECT percentile_cont(0.1) WITHIN GROUP (
              ORDER BY length(coalesce(s.description, ''))
            ) AS p10,
            count(*) AS n
       FROM solicitation s
      WHERE ${NOT_BIDDABLE_SQL}`,
  );
  const n = Number(row?.n ?? 0);
  if (n === 0 || row?.p10 === null || row?.p10 === undefined) {
    return {
      id: "F6",
      property: "P6",
      statement,
      threshold: THRESHOLDS.minDescriptionP10Chars,
      measured: "unknown",
      verdict: "unknown",
      detail: "No biddable rows to measure.",
    };
  }
  const p10 = Math.round(row.p10);
  return {
    id: "F6",
    property: "P6",
    statement,
    threshold: THRESHOLDS.minDescriptionP10Chars,
    measured: p10,
    verdict: p10 >= THRESHOLDS.minDescriptionP10Chars ? "pass" : "fail",
    detail: `p10 = ${p10} characters over ${n} biddable rows.`,
  };
}

/* F7. WHAT COUNTS AS "DEFERS TO A DOCUMENT".
 *
 * A heuristic over phrases actually observed in SAM descriptions -- "Dental
 * prosthetics - BPA - Base + four years - see SOW and additional items list" is
 * the real 80-character example that made sample 1 unworkable.
 *
 * ⚠️ IT UNDER-COUNTS, AND THAT IS THE SAFE DIRECTION. A description that is
 * merely thin without saying so is not caught here -- F6 covers that. A marker
 * list that guessed generously would inflate the denominator and make the ratio
 * look worse than the evidence supports. */
export const DOCUMENT_DEFERRAL_MARKERS = [
  "see sow",
  "see attach",
  "see the attach",
  "additional items list",
  "attached solicitation",
  "refer to the attach",
  "see solicitation document",
  "as described in the attach",
] as const;

export async function measureF7(): Promise<PredicateResult> {
  const statement = "Where a description defers to a document, we hold the document";
  /* Safe to inline: OUR OWN compile-time constants, never user input. */
  const marker = DOCUMENT_DEFERRAL_MARKERS.map(
    (m) => `lower(s.description) LIKE '%${m}%'`,
  ).join(" OR ");

  const row = await one<{ defers: string; held: string }>(
    `SELECT count(*) AS defers,
            count(*) FILTER (WHERE d.id IS NOT NULL) AS held
       FROM solicitation s
       LEFT JOIN LATERAL (
              SELECT 1 AS id FROM document dd WHERE dd.solicitation_id = s.id LIMIT 1
            ) d ON true
      WHERE s.description IS NOT NULL
        AND ${NOT_BIDDABLE_SQL}
        AND (${marker})`,
  );

  const defers = Number(row?.defers ?? 0);
  const held = Number(row?.held ?? 0);
  if (defers === 0) {
    return {
      id: "F7",
      property: "P7",
      statement,
      threshold: THRESHOLDS.minDocumentReachability,
      measured: "unknown",
      verdict: "unknown",
      detail: "No description matched a deferral marker, so there is nothing to reach.",
    };
  }
  const ratio = held / defers;
  return {
    id: "F7",
    property: "P7",
    statement,
    threshold: THRESHOLDS.minDocumentReachability,
    measured: Number(ratio.toFixed(3)),
    verdict: ratio >= THRESHOLDS.minDocumentReachability ? "pass" : "fail",
    detail:
      `${held} of ${defers} document-deferring rows have a document. ` +
      `The marker list under-counts by design.`,
  };
}

export interface FloorReport {
  predicates: PredicateResult[];
  /** True while any predicate is `fail` OR `unknown`. */
  blocksAdjudication: boolean;
  thresholdsRatified: boolean;
  summary: string;
}

/* THE BINDING RULE, ruled by Matt 2026-09-03 (spec §3.1):
 *
 *   No GO / NO-GO adjudication may be taken while a floor predicate fails.
 *
 * AND `unknown` BLOCKS EXACTLY AS `fail` DOES. That is the point of keeping the
 * two apart everywhere else: they mean different things to a reader and the
 * same thing to the gate. "We have not measured it" is not permission to
 * proceed -- it is §5.4's silent-failure argument applied to our own paperwork.
 *
 * THE RELEASE VALVE IS DELIBERATELY NOT IMPLEMENTED HERE. A predicate that
 * proves structurally unachievable is promoted into the Target by EDITING THE
 * SPEC and deleting the predicate -- a visible act with a diff -- not by a
 * runtime flag that lets a failing floor quietly stop blocking. P8 (value on
 * open notices) was promoted that way before this code existed. */
export async function measureFloor(): Promise<FloorReport> {
  const predicates = [
    await measureF1(),
    await measureF2(),
    await measureF3(),
    await measureF4(),
    await measureF5(),
    await measureF6(),
    await measureF7(),
  ];

  const blocking = predicates.filter((p) => p.verdict === "fail" || p.verdict === "unknown");
  const note = THRESHOLDS_RATIFIED
    ? ""
    : " Thresholds are UNRATIFIED proposals (spec §8.1), so this verdict is provisional.";

  return {
    predicates,
    blocksAdjudication: blocking.length > 0,
    thresholdsRatified: THRESHOLDS_RATIFIED,
    summary:
      blocking.length === 0
        ? `Floor holds on all ${predicates.length} predicates.${note}`
        : `Floor BLOCKS adjudication. Not satisfied: ` +
          `${blocking.map((p) => `${p.id} (${p.verdict})`).join(", ")}.${note}`,
  };
}
