import { all, one } from "../db/index.js";
import { LATEST_PURSUIT } from "./latest.js";
import { ELIGIBLE } from "./eligibility.js";

export interface DeadlineConflict {
  value_text: string;
  origin: "listing" | "document";
  quote: string | null;
}

export interface QueueItem {
  id: number;
  title: string;
  org_name: string | null;
  jurisdiction: string | null;
  closes_at: string | null;
  /* bigint column, but db/index.ts:20 parses OID 20 (bigint) to Number
   * centrally via pg.types.setTypeParser -- so this arrives as a number,
   * not the string a bare pg client would hand back. */
  value_cents: number | null;
  kind: string | null;
  set_aside: string | null;
  source_name: string | null;
  documents: number;
  sightings: number;
  /* Region 1.1.1: show the disagreement rather than silently picking a
   * winner. Empty for the overwhelming majority of rows. */
  deadline_conflict: DeadlineConflict[];
}

export interface QueuePage {
  mode: "all" | "sample";
  sample: null;
  total: number;
  remaining: number;
  items: QueueItem[];
}

const NOW_ISO = () => new Date().toISOString().slice(0, 10);

export async function queuePage(
  opts: { limit?: number; offset?: number } = {},
): Promise<QueuePage> {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 200));
  const offset = Math.max(0, opts.offset ?? 0);
  const today = NOW_ISO();

  const counted = await one<{ total: number }>(
    `SELECT count(*) AS total
       FROM solicitation s
       LEFT JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = s.id
      WHERE ${ELIGIBLE}`,
    [today],
  );
  // Number(...) stays even though setTypeParser already coerces OID 20 --
  // harmless belt-and-braces, not a claim that the driver still hands back a string.
  const total = Number(counted?.total ?? 0);

  /* ONE statement for the page, whatever its size -- including the
   * per-item document counts, sighting counts and deadline conflicts,
   * which are lateral aggregates rather than a query per row. This is
   * what the constancy test in queue.test.ts pins. */
  const items = await all<QueueItem>(
    `SELECT s.id, s.title, o.name AS org_name, o.jurisdiction,
            s.closes_at, s.value_cents, s.kind, s.set_aside,
            src.name AS source_name,
            (SELECT count(*)::int FROM document d WHERE d.solicitation_id = s.id) AS documents,
            (SELECT count(*)::int FROM sighting g WHERE g.solicitation_id = s.id) AS sightings,
            COALESCE(
              (SELECT json_agg(json_build_object(
                        'value_text', ef.value_text,
                        'origin', ef.origin,
                        'quote', ef.quote))
                 FROM extracted_field ef
                WHERE ef.solicitation_id = s.id
                  AND ef.field_name = 'closes_at'
                  AND ef.value_text IS NOT NULL
                  AND s.closes_at IS NOT NULL
                  AND ef.value_text <> s.closes_at),
              '[]'::json) AS deadline_conflict
       FROM solicitation s
       LEFT JOIN (${LATEST_PURSUIT}) lp ON lp.solicitation_id = s.id
       LEFT JOIN organization o ON o.id = s.org_id
       LEFT JOIN source src ON src.id = s.source_id
      WHERE ${ELIGIBLE}
      ORDER BY s.closes_at ASC NULLS LAST, s.id ASC
      LIMIT $2 OFFSET $3`,
    [today, limit, offset],
  );

  return { mode: "all", sample: null, total, remaining: Math.max(0, total - offset), items };
}
