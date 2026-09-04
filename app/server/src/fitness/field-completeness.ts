/* R7 — FIELD COMPLETENESS, MEASURED PER SOURCE.
 *
 * The rubric asks how much of the property list a source can SUPPLY. Until
 * 2026-09-04 nothing measured it: `field_completeness` was null on every row
 * but HigherGov's, and HigherGov's held prose no grader could read.
 *
 * 🔴 WHY THIS IS NOT JUST F6 AND F7 WITH A `GROUP BY`. floor.ts's F6 and F7
 * aggregate the WHOLE solicitation table with no source_id at all, because the
 * floor scores OUR HOLDINGS. The rubric scores A SOURCE. floor.ts's header
 * insists those must not be conflated, and the reason is concrete: a source can
 * be excellent while our holdings from it are inadequate. The queries below are
 * therefore per-source -- but they reuse `NOT_BIDDABLE_SQL` and
 * `DOCUMENT_DEFERRAL_MARKERS` from the same modules the floor reads, so the two
 * readings can never drift on what counts as biddable or as a deferral.
 *
 * READ-ONLY, AND THAT IS LOAD-BEARING. Nothing in fitness/ contains an INSERT,
 * UPDATE or DELETE, which is what makes `npm run fitness` safe to point at
 * production -- and production is the only database holding the population this
 * measurement is about (9,883 SAM rows against `test`'s 1,724). The measured
 * values reach the registry through a MIGRATION, reviewed as a diff, exactly as
 * migration 021 recorded the watermarks it verified.
 *
 * `measured_against` IS NOT SET HERE, deliberately. The code cannot name the
 * database it is talking to without reading the connection string, and CLAUDE.md
 * §5.3 is emphatic about what happens when credentials get near a printed
 * value. The operator who runs the read knows which DATABASE_URL they exported,
 * and the migration states it in prose. `population_n` is the honest check: it
 * differs between branches by a factor of five.
 *
 * TWO SHAPES, ONE COLUMN. A solicitation source supplies P6, P7, P8 and P11; a
 * contract register supplies P8 and P14. Every source records all five keys,
 * with `unknown` where the property does not apply -- so one grader reads every
 * row, and `unknown` keeps meaning "not established" rather than "not relevant
 * here". */
import { one } from "../db/index.js";
import { DOCUMENT_DEFERRAL_MARKERS } from "./floor.js";
import { EFFECTIVE_CLOSES_AT, NOT_BIDDABLE_SQL } from "../triage/eligibility.js";
import { R7 } from "./thresholds.js";
import type { Grade } from "./rubric.js";

/** The property→grade map migration 018 specified: `{"P6":"strong", ...}`. */
export interface CompletenessMeasurement {
  /** Description sufficiency — p10 characters on biddable rows. */
  P6: Grade;
  /** Document reachability — of rows deferring to a document, how many we hold. */
  P7: Grade;
  /** Value presence — on open biddable rows, or on contracts for a register. */
  P8: Grade;
  /** Capture latency. Never graded; see `insert_lag_median_days` below. */
  P11: Grade;
  /** Contract history — vendor, value and end date on the same row. */
  P14: Grade;
  measured_on: string;
  /** The population the grades were taken over: biddable rows, else contracts. */
  population_n: number;
  evidence: Record<string, number | null>;
}

function gradeBy(value: number, strong: number, adequate: number): Grade {
  if (value >= strong) return "strong";
  if (value >= adequate) return "adequate";
  return "weak";
}

/** Postgres returns numeric and bigint as strings; `null` must survive as null. */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* The marker list is reused rather than restated so R7 and F7 can never
 * disagree about what "defers to a document" means. Safe to inline for the same
 * reason floor.ts gives: OUR OWN compile-time constants, never user input. */
const DEFERS_TO_DOCUMENT = DOCUMENT_DEFERRAL_MARKERS.map(
  (m) => `lower(s.description) LIKE '%${m}%'`,
).join(" OR ");

/* ⚠️ `posted_at` AND `closes_at` ARE text, NOT timestamps. Every other caller
 * binds today as an ISO DATE STRING and compares lexically -- queue.ts's
 * NOW_ISO() does exactly this -- and ISO-8601 sorts correctly as text, which is
 * why it works. Comparing them to now() raises `operator does not exist:
 * text >= timestamp with time zone`, which is how this was found. */
const OPEN = `(${EFFECTIVE_CLOSES_AT} IS NULL OR ${EFFECTIVE_CLOSES_AT} >= $2)`;

/* The same fact makes the capture lag fragile: posted_at is vendor-authored
 * text, so a row can hold anything. The CASE guards the cast -- one unparseable
 * date must not take the whole measurement down with it. */
const INSERT_LAG_DAYS = `
  CASE WHEN s.posted_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
       THEN extract(epoch FROM (s.created_at - substring(s.posted_at from 1 for 10)::date)) / 86400
  END`;

export async function measureCompleteness(sourceId: number): Promise<CompletenessMeasurement> {
  const sol = await one<{
    n: string;
    p10: string | null;
    median: string | null;
    lag_days: string | null;
    open_n: string;
    open_valued: string;
    defers: string;
    defers_held: string;
  }>(
    `SELECT count(*) AS n,
            percentile_cont(0.1) WITHIN GROUP (
              ORDER BY length(coalesce(s.description, ''))) AS p10,
            percentile_cont(0.5) WITHIN GROUP (
              ORDER BY length(coalesce(s.description, ''))) AS median,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY ${INSERT_LAG_DAYS}) AS lag_days,
            count(*) FILTER (WHERE ${OPEN}) AS open_n,
            count(*) FILTER (WHERE ${OPEN} AND s.value_cents IS NOT NULL) AS open_valued,
            count(*) FILTER (WHERE s.description IS NOT NULL
                               AND (${DEFERS_TO_DOCUMENT})) AS defers,
            count(*) FILTER (WHERE s.description IS NOT NULL
                               AND (${DEFERS_TO_DOCUMENT})
                               AND EXISTS (SELECT 1 FROM document d
                                            WHERE d.solicitation_id = s.id)) AS defers_held
       FROM solicitation s
      WHERE s.source_id = $1
        AND ${NOT_BIDDABLE_SQL}`,
    [sourceId, new Date().toISOString().slice(0, 10)],
  );

  /* 🔴 A VENDOR IS PRESENT WHEN WE KNOW WHO IT IS, NOT WHEN WE HAVE RESOLVED
   * THEM TO A ROW. The EDS ingest lands the raw name in `source_note` as
   * "vendorName: ..." and leaves `vendor_id` NULL on all 204,920 rows, by a
   * documented v1 ruling in contracts/import.ts: normalising TIMOTHY WARRICK
   * against Timothy Warrick, Inc. is its own slice, and an un-normalised corpus
   * beats one that does not exist.
   *
   * Reading presence as `vendor_id IS NOT NULL` graded the register P14 `weak`
   * on rows that all carry a vendor -- a measurement punishing a deliberate
   * decision, about to be recorded into the registry as a fact. The
   * unresolved count is kept as evidence because the limitation is real:
   * incumbency means grouping a vendor's contracts, and nobody can group by a
   * name no one has normalised. */
  const VENDOR_PRESENT = `(c.vendor_id IS NOT NULL OR c.source_note LIKE 'vendorName: %')`;
  const con = await one<{ n: string; valued: string; complete: string; unresolved: string }>(
    `SELECT count(*) AS n,
            count(*) FILTER (WHERE coalesce(c.value_cents, c.amount_cents) IS NOT NULL) AS valued,
            count(*) FILTER (WHERE ${VENDOR_PRESENT}
                               AND coalesce(c.value_cents, c.amount_cents) IS NOT NULL
                               AND c.ends_at IS NOT NULL) AS complete,
            count(*) FILTER (WHERE c.vendor_id IS NULL
                               AND c.source_note LIKE 'vendorName: %') AS unresolved
       FROM contract c
      WHERE c.source_id = $1`,
    [sourceId],
  );

  const solN = Number(sol?.n ?? 0);
  const conN = Number(con?.n ?? 0);
  /* Solicitations first: a source holding both is a solicitation source that
   * also records awards, and its descriptions are what triage reads. */
  const population_n = solN > 0 ? solN : conN;

  const solGradeable = solN >= R7.minPopulation;
  const conGradeable = conN >= R7.minPopulation;

  const p10 = num(sol?.p10);
  const openN = Number(sol?.open_n ?? 0);
  const openValued = Number(sol?.open_valued ?? 0);
  const defers = Number(sol?.defers ?? 0);
  const defersHeld = Number(sol?.defers_held ?? 0);

  /* Zero of zero is not zero percent. A source nothing defers from has not
   * failed to reach its documents -- there is nothing to reach. F7 takes the
   * same position for the same reason. */
  const reachability = defers === 0 ? null : defersHeld / defers;
  const valuePresence = solGradeable
    ? openN === 0
      ? null
      : openValued / openN
    : conGradeable
      ? Number(con!.valued) / conN
      : null;
  const contractCompleteness = conN === 0 ? null : Number(con!.complete) / conN;

  return {
    P6: solGradeable && p10 !== null
      ? gradeBy(p10, R7.p6DescriptionP10Strong, R7.p6DescriptionP10Adequate)
      : "unknown",
    P7: solGradeable && reachability !== null
      ? gradeBy(reachability, R7.p7ReachabilityStrong, R7.p7ReachabilityAdequate)
      : "unknown",
    P8: valuePresence !== null
      ? gradeBy(valuePresence, R7.p8ValuePresenceStrong, R7.p8ValuePresenceAdequate)
      : "unknown",
    /* ⚠️ NEVER GRADED, and this is not an oversight. P11 is capture latency --
     * how far behind the source's posting we are. `solicitation` has no capture
     * column; `created_at` is when WE inserted the row, which for a corpus
     * import is the day of the backfill and says nothing about latency.
     * Grading a proxy this weak would put a number on the dimension and stop
     * anyone asking for the real one. The lag is recorded as evidence so a
     * genuine capture column has a baseline to be compared against. */
    P11: "unknown",
    P14: conGradeable && contractCompleteness !== null
      ? gradeBy(contractCompleteness, R7.p14CompletenessStrong, R7.p14CompletenessAdequate)
      : "unknown",
    measured_on: new Date().toISOString().slice(0, 10),
    population_n,
    evidence: {
      solicitations_biddable: solN,
      contracts: conN,
      description_p10_chars: p10 === null ? null : Math.round(p10),
      description_median_chars: num(sol?.median) === null ? null : Math.round(num(sol!.median)!),
      open_biddable: openN,
      value_presence: valuePresence === null ? null : Number(valuePresence.toFixed(3)),
      defers_to_document: defers,
      document_reachability: reachability === null ? null : Number(reachability.toFixed(3)),
      contract_completeness:
        contractCompleteness === null ? null : Number(contractCompleteness.toFixed(3)),
      /* Vendors we can name but cannot group. See VENDOR_PRESENT above. */
      contracts_vendor_unresolved: conN === 0 ? null : Number(con!.unresolved),
      insert_lag_median_days: num(sol?.lag_days) === null ? null : Number(num(sol!.lag_days)!.toFixed(1)),
    },
  };
}

export interface SourceMeasurement {
  id: number;
  name: string;
  measurement: CompletenessMeasurement;
}

/* Every source, including the ones holding nothing. A registry row with no
 * rows behind it is not a bad source, it is an unmeasured one, and the report
 * has to be able to say so -- nine of ten were exactly that on 2026-09-03. */
export async function measureAllSources(): Promise<SourceMeasurement[]> {
  const { all } = await import("../db/index.js");
  const sources = await all<{ id: number; name: string }>(
    `SELECT id, name FROM source ORDER BY name`,
  );
  const out: SourceMeasurement[] = [];
  for (const s of sources) {
    out.push({ id: s.id, name: s.name, measurement: await measureCompleteness(s.id) });
  }
  return out;
}
