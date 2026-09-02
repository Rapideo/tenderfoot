import { all, one, insert } from "../db/index.js";

/* SIBLING of discover.ts's discoverAttachments, not a generalisation of it
 * (Ruling 12, 2026-09-02 progress.md). The two sources need genuinely
 * different mechanisms:
 *
 *   SAM.gov  must CALL AN API PER NOTICE to find out what is attached.
 *            discoverAttachments is dense with hard-won guards earned
 *            across two review rounds -- missing `a.name`, missing
 *            `a.resourceId` (which would otherwise produce the well-formed
 *            but wrong `.../files/undefined/download`), and the
 *            `attachments_checked_at` retirement rule that stops a
 *            no-attachment notice re-qualifying forever.
 *
 *   IDOA     already carries its one ZIP's URL in the payload the parser
 *            put there (`sighting.raw.documentsUrl`, adapters/idoa.ts). No
 *            network call is needed to discover it -- "discovery" here is
 *            just reading a column and writing a `document` row. None of
 *            SAM's guards apply, because there is no per-notice list to
 *            walk and no resource id to be missing.
 *
 * Making one function conditional on source would route IDOA's trivial path
 * through SAM's delicate one for no benefit. Two small functions, dispatched
 * by source (see scrape/cli.ts and routes/admin.ts), mirrors the adapter
 * split (scrape/adapters/idoa.ts vs sam.ts) and keeps discoverAttachments's
 * SAM logic untouched.
 */
/* Exported so this file's own test can seed fixtures against the SAME string
 * this module queries with, rather than a second hand-typed copy of a name
 * that only migrations/003_seed_source_registry.sql truly owns. The dispatch
 * sites (scrape/cli.ts, routes/admin.ts) do NOT import this constant --
 * cli.ts's dispatch runs before this module is even loaded (see its own
 * comment on why the discover-idoa import there stays dynamic), and
 * admin.ts's dispatch calls both discovery functions unconditionally rather
 * than branching on a name at all. Both already hardcode this identical
 * string where they need it (registry.ts's `idoa` entry does too), and all
 * three must agree with the seed migration. */
export const IDOA_SOURCE_NAME = "Indiana IDOA solicitations";

/* Same shape as discover.ts's CANDIDATES: not yet checked for documents.
 * `s.external_id IS NOT NULL` mirrors SAM's guard even though every IDOA row
 * carries one (adapters/idoa.ts's Event-ID-or-slug rule) -- cheap insurance
 * against a future row that somehow lacks it, and it costs nothing here.
 *
 * No REFRESH counterpart: SAM's exists because SAM's ground-truth listing
 * fields (closes_at, set_aside, ...) are written by discoverAttachments
 * itself and need re-syncing when merge learns a value later. This function
 * writes no listing fields at all -- that is merge's job for every source,
 * IDOA included -- so there is nothing here to refresh. */
const CANDIDATES = `
  SELECT s.id, s.external_id
    FROM solicitation s
    JOIN source src ON src.id = s.source_id
   WHERE src.name = $2
     AND s.external_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM document d WHERE d.solicitation_id = s.id)
   ORDER BY s.id
   LIMIT $1`;

interface Candidate {
  id: number;
  external_id: string;
}

/** The URL's last path segment -- "…/files/002300000087895.zip" ->
 * "002300000087895.zip". `document.filename` is NOT NULL and must be a
 * TRUE fact about the file, not a placeholder: this is the one name IDOA
 * itself gave the bundle, taken from the URL its own page published (the
 * same scraped `href`, never reconstructed -- adapters/idoa.ts's own rule).
 * A pathological URL with no path segments falls back to the whole URL
 * rather than throwing, so one malformed value cannot abort the batch. */
function basename(url: string): string {
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? url;
}

/** IDOA's payload shape (adapters/idoa.ts's `IdoaRawItem`) is not imported
 * here on purpose -- reading `raw` out of `sighting` is the same
 * loosely-typed, defensive read merge/description.ts and merge/posted-at.ts
 * already use for the identical column, and jsonb can in principle arrive
 * as either a parsed object or (defensively, matching merge.ts's own guard
 * on `latest_raw`) a JSON string. */
function documentsUrlFrom(raw: unknown): string | null {
  const parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  const url = (parsed as Record<string, unknown> | null | undefined)?.documentsUrl;
  return typeof url === "string" ? url : null;
}

/* Budget and limit honoured exactly as discoverAttachments honours them:
 * LIMIT bounds the candidate query, and the clock is checked BEFORE each
 * candidate so a killed run reports only what it actually walked. */
export async function discoverIdoaAttachments(
  limit: number,
  budgetMs: number = Number.POSITIVE_INFINITY,
): Promise<{ solicitations: number; skipped: number; documents: number }> {
  const started = Date.now();
  const rows = await all<Candidate>(CANDIDATES, [limit, IDOA_SOURCE_NAME]);

  let documents = 0;
  let skipped = 0;
  let walked = 0;

  for (const s of rows) {
    if (Date.now() - started >= budgetMs) break;
    walked++;

    /* The most recent sighting for THIS solicitation, same "latest wins"
     * rule merge.ts's `latest_raw` subquery uses (there, keyed by
     * external_id before linking; here, keyed by solicitation_id since a
     * candidate from CANDIDATES above is linked by definition). IDOA is
     * re-scraped as a whole snapshot, not amended in place, so in practice
     * this is almost always the row's only sighting. */
    const sighting = await one<{ raw: unknown }>(
      `SELECT raw FROM sighting
        WHERE solicitation_id = $1
        ORDER BY seen_at DESC, id DESC
        LIMIT 1`,
      [s.id],
    );

    /* Nullable by design (adapters/idoa.ts: 66 of 71 rows have one; five do
     * not). A missing sighting or a missing/absent documentsUrl are the same
     * fact from this function's point of view -- "nothing to discover" --
     * and both must be skipped cleanly, never thrown. */
    const url = sighting ? documentsUrlFrom(sighting.raw) : null;
    if (!url) {
      skipped++;
      continue;
    }

    await insert(
      `INSERT INTO document (solicitation_id, filename, source_url, extract_status)
       VALUES ($1, $2, $3, 'pending') RETURNING id`,
      [s.id, basename(url), url],
    );
    documents++;
  }

  /* WALKED, not `rows.length` -- a budget stop must not claim work it did
   * not do, the same reasoning discoverAttachments's own return states. */
  return { solicitations: walked, skipped, documents };
}
