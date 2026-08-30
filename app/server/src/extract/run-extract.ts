import { all, one, run as dbRun, insert } from "../db/index.js";
import { parserFor, type ParseResult } from "./parse.js";
import { parsePdf } from "./parsers/pdf.js";
import { parseDocx } from "./parsers/docx.js";
import { parseXlsx } from "./parsers/xlsx.js";
import { parseZip } from "./parsers/zip.js";
import { extractFields } from "./fields.js";

/* Nearest live deadline first (design §4.3): this makes the FIRST batch the
 * useful batch and lets an operator stop the moment it stops paying. It costs
 * one ORDER BY.
 *
 * NO `closes_at >= now()` FILTER, though §4.3 words it that way, and the
 * omission is deliberate. Two reasons. A comparison against a NULL closes_at
 * yields NULL and WHERE reads NULL as false -- that is Task 9's Critical (b)
 * verbatim, which silently excluded every SAM.gov row from discover's
 * candidate query, and no SAM row carried a deadline at all until
 * closes-at.ts started reading one on 2026-08-29. And a permanent filter
 * makes `remaining` a lie: documents attached to a since-closed solicitation
 * would sit `pending` forever while the operator watches a counter that never
 * reaches zero. Ordering alone delivers what §4.3 is actually for. Postgres
 * sorts NULLs last under ASC, so an undated solicitation goes to the back
 * rather than the front.
 *
 * The JOIN is what makes the ordering possible, and it is an inner join on a
 * nullable column: `document.solicitation_id` has no NOT NULL constraint (a
 * document may belong to a `contract` instead). Such a row is invisible here.
 * That is correct for this slice -- SP4 extracts solicitation documents, and
 * every row discover writes carries one -- but it is the silent-exclusion
 * shape migration 010's comment warns about, so it is stated rather than
 * left to be rediscovered. */
const NEXT = `
  SELECT d.id, d.filename, d.source_url, d.solicitation_id
    FROM document d
    JOIN solicitation s ON s.id = d.solicitation_id
   WHERE d.extract_status = 'pending'
   ORDER BY s.closes_at ASC
   LIMIT $1`;

interface Doc {
  id: number;
  filename: string;
  source_url: string | null;
  solicitation_id: number;
}

const unsupported = (filename: string): string =>
  `unsupported type: ${filename.toLowerCase().split(".").pop() ?? "unknown"}`;

async function fail(id: number, why: string): Promise<void> {
  await dbRun(`UPDATE document SET extract_status = 'failed', source_note = $2 WHERE id = $1`, [
    id,
    why,
  ]);
}

async function parse(kind: "pdf" | "docx" | "xlsx" | "zip", bytes: Buffer): Promise<ParseResult> {
  return kind === "pdf"
    ? parsePdf(bytes)
    : kind === "docx"
      ? parseDocx(bytes)
      : kind === "xlsx"
        ? parseXlsx(bytes)
        : parseZip(bytes);
}

/* Everything that happens to one document once its bytes are in hand. Called
 * for a fetched document and, one level down, for each member of a bundle --
 * the same code either way, so a member cannot quietly get weaker treatment
 * than a top-level file.
 *
 * `expand` is the depth limit, and it is a parameter rather than a counter
 * because depth 1 is the whole of D8: a bundle expands, a bundle INSIDE a
 * bundle becomes a row that says it was not traversed. A recursing
 * "improvement" is the most likely future violation, and it would have to
 * delete this argument to happen.
 *
 * Returns whether the document failed, so the caller can count. */
async function absorb(doc: Doc, bytes: Buffer, expand: boolean): Promise<boolean> {
  const kind = parserFor("", doc.filename);
  if (kind === null) {
    await fail(doc.id, unsupported(doc.filename));
    return true;
  }
  if (kind === "zip" && !expand) {
    /* D8, and the wording is the deviation record's own. The 2026-08-18 spike
     * logged this case as `skipped: "not a parseable format"` -- a wrong
     * reason, in a throwaway artifact, where nothing could query it. */
    await fail(doc.id, "nested archive not traversed");
    return true;
  }

  let parsed: ParseResult;
  try {
    parsed = await parse(kind, bytes);
  } catch (err) {
    await fail(doc.id, `parse failed: ${(err as Error).message}`);
    return true;
  }

  if (parsed.kind === "members") {
    for (const m of parsed.members) {
      const childId = await insert(
        `INSERT INTO document (solicitation_id, filename, parent_document_id, extract_status)
         VALUES ($1, $2, $3, 'pending') RETURNING id`,
        [doc.solicitation_id, m.filename, doc.id],
      );
      /* D9 -- THE MEMBER IS EXTRACTED HERE, NOT LEFT FOR A LATER BATCH.
       * A member has no `source_url`: its bytes came from inside an archive,
       * and ruling 1 keeps no bytes anywhere. A child row marked `pending`
       * is therefore a row no later pass can ever extract -- it would be
       * fetched from nothing, fail, and record "download failed", blaming
       * the network for a design gap and making a wrong reason durable,
       * which is precisely what D8 exists to prevent for the nested case.
       * The bytes are in hand at exactly this moment; this is the only
       * moment they exist. */
      await absorb(
        { id: childId, filename: m.filename, source_url: null, solicitation_id: doc.solicitation_id },
        m.bytes,
        false,
      );
    }
    /* Design §5: the parent is marked `extracted` and carries no text of its
     * own. Marked AFTER its members, so a run killed mid-expansion leaves the
     * bundle `pending` and the next run redoes it -- the opposite order would
     * mark the bundle done and strand the members it had not written yet. */
    await dbRun(`UPDATE document SET extract_status = 'extracted' WHERE id = $1`, [doc.id]);
    return false;
  }

  if (parsed.kind === "unsupported" || parsed.text.trim() === "") {
    /* FAIL CLOSED: never mark `extracted` without text. `extracted` is what
     * accuracyByField counts as an opportunity, so an empty one scores every
     * field as a miss against a document that was never read. */
    await fail(doc.id, "parsed but produced no text");
    return true;
  }

  /* Parser notes describe the DOCUMENT, not any one field -- "cell B3 is a
   * cached formula", "this PDF has no table structure". They belong on the
   * document row. Putting them on extracted_field.note would collide with the
   * FIELD note, which says something different and per-field: whether we
   * looked, whether a date was seen but unplaced, whether the text was not a
   * real calendar date. An earlier draft of this task bound the parser notes
   * into extracted_field.note and never wrote f.note at all, silently
   * discarding every one of those. */
  await dbRun(
    `UPDATE document
        SET extracted_text = $2, extract_status = 'extracted',
            produced_by = 'mechanical', source_note = $3
      WHERE id = $1`,
    [doc.id, parsed.text, parsed.notes.join(" | ") || null],
  );

  for (const f of extractFields(parsed.text)) {
    await insert(
      `INSERT INTO extracted_field
         (solicitation_id, field_name, value_text, origin, document_id, quote, confidence, produced_by, note)
       VALUES ($1, $2, $3, 'document', $4, $5, $6, 'mechanical', $7) RETURNING id`,
      [
        doc.solicitation_id,
        f.field_name,
        f.value_text,
        doc.id,
        f.quote,
        f.confidence,
        /* f.note, NOT parsed.notes. This is the field's own account of itself
         * -- "not extracted", "a date was present but no cue placed it in
         * this field", "date text does not correspond to a real calendar
         * date". Task 7 spent three fix rounds producing these, and the
         * accuracy measurement depends on them: without the
         * date-seen-but-unplaced note, a recall miss is indistinguishable
         * from a document that genuinely had no date, and the instrument
         * scores it as a clean true negative. */
        f.note ?? null,
      ],
    );
  }
  return false;
}

/* NO TRANSACTION AROUND THE BATCH, deliberately. 2026-08-27: one large
 * transaction killed at the function ceiling rolled back ~9,000 rows and
 * recorded nothing -- recoverable only by sequence forensics. extract_status
 * is already a checkpoint; wrapping the batch is the only way to waste it.
 *
 * `processed` and `failed` both count QUEUE ENTRIES -- one unit, so they can
 * be compared. A bundle is one entry however many members it holds; those
 * members carry their own extract_status and are counted by querying, not
 * here. Task 9's `agreed`/`missed` pair is the cautionary tale: two counts in
 * one result set that measure different things and do not sum. */
export async function runExtract(opts: {
  limit: number;
  budgetMs: number;
  fetchImpl?: typeof fetch;
}): Promise<{ processed: number; failed: number; remaining: number }> {
  const doFetch = opts.fetchImpl ?? fetch;
  const started = Date.now();
  const queue = await all<Doc>(NEXT, [opts.limit]);

  let processed = 0;
  let failed = 0;

  for (const doc of queue) {
    /* Time-boxed, not row-counted (design §4.4): download cost does not track
     * row count -- bundles reach 21 MB. Checked before each document, never
     * inside one, so no document is left half-written. */
    if (Date.now() - started >= opts.budgetMs) break;

    const record = async (why: string) => {
      await fail(doc.id, why);
      failed++;
      processed++;
    };

    /* Before the download, not after: there is no reason to spend a 21 MB
     * fetch on a file no parser can read. */
    if (parserFor("", doc.filename) === null) {
      await record(unsupported(doc.filename));
      continue;
    }

    /* A pending row with no source_url is a bundle member stranded by a run
     * that died mid-expansion (see absorb's D9 note). Its bytes are gone and
     * cannot be recovered from here -- the honest record is that, not
     * "download failed", which would blame the network for it. */
    if (!doc.source_url) {
      await record("no source_url: expand its parent bundle again to recover this member");
      continue;
    }

    let bytes: Buffer;
    try {
      const res = await doFetch(doc.source_url);
      if (!res.ok) {
        await record(`download failed: HTTP ${res.status}`);
        continue;
      }
      bytes = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      await record(`download failed: ${(err as Error).message}`);
      continue;
    }

    if (await absorb(doc, bytes, true)) failed++;
    processed++;
  }

  const left = await one<{ c: string }>(
    `SELECT count(*) AS c FROM document WHERE extract_status = 'pending'`,
  );
  return { processed, failed, remaining: Number(left?.c ?? 0) };
}
