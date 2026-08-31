import { all, one } from "../db/index.js";
import { LATEST_PURSUIT } from "./latest.js";

export interface WeeklyVolume {
  source_id: number;
  source_name: string;
  /** ISO date of the Monday that starts the week. */
  week: string;
  solicitations: number;
}

export interface VolumeReport {
  weeks: WeeklyVolume[];
  /** Never silently dropped: a series with an unstated exclusion is the same
   *  class of error as a rate with the wrong denominator.
   *
   *  MINOR fix, SP6 final review: renamed from excluded_no_posted_at. The
   *  old name was a misnomer -- this also counts rows that DO have a
   *  posted_at, just a malformed one (POSTED_AT_LOOKS_LIKE_A_DATE below
   *  excludes NULL *or* unparseable, not merely absent). At a gate where
   *  this exclusion is deliberately reported, the label has to match the
   *  behaviour. */
  excluded_unparseable_posted_at: number;
  total_rows: number;
}

/* posted_at is `text`, and nothing upstream constrains its shape (§8.4:
 * listing metadata is displayed, not normalised). A regex that only checks
 * DIGIT SHAPE -- ^\d{4}-\d{2}-\d{2} -- is not the same guarantee as "this
 * will parse": "9999-99-99" matches that shape and then fails the ::date
 * cast below with a Postgres error ("date/time field value out of range"),
 * which does not exclude the one bad row -- it throws and takes the WHOLE
 * report down, for every source, on account of one row. That is a strictly
 * worse failure than the silent-drop this predicate exists to prevent.
 *
 * Fixed here by constraining month to 01-12 and day to 01-31, which rules
 * out the realistic corruption this project actually produces (all-9s or
 * all-0s placeholder dates, an out-of-range month from a parsing bug)
 * without a second query or a PL/pgSQL helper.
 *
 * DELIBERATELY UN-ANCHORED at the end. This is a prefix check, not a full
 * validation, and that is load-bearing: posted_at legitimately holds full
 * ISO timestamps ("2026-03-04T12:00:00Z"), and a `$`-anchored regex would
 * exclude every one of those real, castable rows from the gate's own
 * volume series -- wrongly discarding good data is a worse error than the
 * one this predicate exists to catch. The un-anchored end is why the CAST
 * below reads only substring(posted_at, 1, 10), never posted_at::date
 * directly: a trailing-garbage value like "2026-01-01 (TBD)" matches this
 * regex on its first ten characters (a valid date) and would otherwise
 * still reach an unconstrained ::date cast on the FULL string and crash it
 * -- the exact "9999-99-99" failure shape, recurring through the gap this
 * regex's own permissiveness leaves open. Constraining the cast's input to
 * the ten characters the regex actually validated closes that class, not
 * just the instance: the cast can now never see anything the regex did not
 * already range-check.
 *
 * Residual gap, still open and still accepted rather than closed with a
 * stored function ("smallest thing, numbered"): a calendar-invalid but
 * range-valid first-ten-characters date, e.g. "2026-02-30...", still
 * matches this regex (month 02, day 30 both pass the 01-12/01-31 range
 * check) and still crashes substring(posted_at,1,10)::date. If that ever
 * fires in practice, the fix is a real DATE-parsing guard, not a wider
 * regex. */
const POSTED_AT_LOOKS_LIKE_A_DATE = String.raw`^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])`;

/* VOLUME PER SOURCE PER WEEK, computed on posted_at and never on seen_at.
 *
 * sighting.seen_at is when WE saw a row. Nothing ingests unless a human
 * asks it to, so sightings cluster on the days somebody ran a scrape. A
 * weekly series built on seen_at measures OPERATOR BEHAVIOUR, and would
 * show a source surging or dying when all that changed was who was at the
 * laptop. */
export async function volumePerSourcePerWeek(): Promise<VolumeReport> {
  const weeks = await all<WeeklyVolume>(
    `SELECT s.source_id,
            src.name AS source_name,
            to_char(date_trunc('week', substring(s.posted_at, 1, 10)::date), 'YYYY-MM-DD') AS week,
            count(*)::int AS solicitations
       FROM solicitation s
       JOIN source src ON src.id = s.source_id
      WHERE s.posted_at ~ $1
      GROUP BY s.source_id, src.name, date_trunc('week', substring(s.posted_at, 1, 10)::date)
      ORDER BY src.name, week`,
    [POSTED_AT_LOOKS_LIKE_A_DATE],
  );

  const counts = await one<{ total: number; excluded: number }>(
    `SELECT count(*) AS total,
            count(*) FILTER (
              WHERE posted_at IS NULL OR posted_at !~ $1
            ) AS excluded
       FROM solicitation`,
    [POSTED_AT_LOOKS_LIKE_A_DATE],
  );

  return {
    weeks,
    excluded_unparseable_posted_at: Number(counts?.excluded ?? 0),
    total_rows: Number(counts?.total ?? 0),
  };
}

export interface InterestedRate {
  sample_id: number;
  source_id: number;
  source_name: string;
  population_size: number;
  drawn: number;
  decided: number;
  interested: number;
  /** NULL when nothing has been decided. A rate over zero is UNKNOWN, not zero. */
  interested_per_hundred: number | null;
}

/* INTERESTED-PER-HUNDRED, per source, against the materialised sample.
 *
 * Counts SOLICITATIONS at their LATEST state, not pursuit rows -- an
 * Interested later reversed to Pass counts once, as Pass, and the reversal
 * is still on the record.
 *
 * Three numbers ship together because any one alone misleads:
 * population_size says what the sample represents, `drawn` how big it is,
 * and `decided` how much of it has actually been read. A half-triaged
 * sample then reads as a half-triaged sample rather than as a rate.
 *
 * ONE ROW PER SAMPLE, deliberately, not aggregated per source (MINOR fix,
 * SP6 final review -- protecting a correct decision that had no comment).
 * Two draws against the same source carry two different `population_size`
 * values -- the eligible count moves between draws -- so summing their
 * `interested`/`decided` into one per-source row would recreate exactly the
 * denominator error migration 012's materialised sample exists to prevent.
 * Do not "fix" this into a GROUP BY source_id. A reader who wants one number
 * per source should read the LATEST sample_id for that source, never a sum
 * across sample_ids. */
export async function interestedPerHundred(): Promise<InterestedRate[]> {
  return all<InterestedRate>(
    `WITH latest AS (${LATEST_PURSUIT}),
     decided AS (
       SELECT i.sample_id,
              count(*)::int AS decided,
              count(*) FILTER (WHERE l.state = 'Interested')::int AS interested
         FROM triage_sample_item i
         JOIN latest l ON l.solicitation_id = i.solicitation_id
        WHERE l.state <> 'New'
        GROUP BY i.sample_id
     )
     SELECT ts.id AS sample_id, ts.source_id, src.name AS source_name,
            ts.population_size,
            (SELECT count(*)::int FROM triage_sample_item i WHERE i.sample_id = ts.id) AS drawn,
            COALESCE(d.decided, 0) AS decided,
            COALESCE(d.interested, 0) AS interested,
            CASE WHEN COALESCE(d.decided, 0) = 0 THEN NULL
                 ELSE round(100.0 * d.interested / d.decided, 2)::float8
            END AS interested_per_hundred
       FROM triage_sample ts
       JOIN source src ON src.id = ts.source_id
       LEFT JOIN decided d ON d.sample_id = ts.id
      ORDER BY ts.drawn_at DESC`,
  );
}
