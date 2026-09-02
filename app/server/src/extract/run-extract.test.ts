import { afterAll, expect, test, vi } from "vitest";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { useTestSchema, resetSchema } from "../db/testdb.js";

/* Same import shape as discover.test.ts, and for the same reason:
 * run-extract.ts has a STATIC top-level `import ... from "../db/index.js"`,
 * whose module-level pool is built from whatever DATABASE_URL is ambient at
 * import time. A static import of run-extract.js here would be HOISTED ahead
 * of useTestSchema(), so the pool would be pointed at the wrong database --
 * or at none at all under `npm run check`, which strips DATABASE_URL. The
 * dynamic imports below run after it.
 *
 * DEVIATION from the task brief, which spelled these imports statically and
 * named the schema "run_extract": the prefix is "test_" because
 * scripts/clean-test-schemas.mjs only ever reclaims test_%, bench_% and
 * verify_% schemas. A bare prefix is the leak that once left 106 abandoned
 * schemas behind and a suite slow enough to fail its own timeout. */
useTestSchema("test_run_extract");

/* Ruling 6 (SP2 T2 coordinator review): the shared Neon test-branch compute
 * cold-starts at ~1.1s and is contended by parallel test files. */
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

const { migrate } = await import("../db/migrate.js");
const { runExtract } = await import("./run-extract.js");
const { all, one, run, insert, close } = await import("../db/index.js");

afterAll(async () => {
  await close();
});

/* resetSchema() drops every table migrate() created, schema_migrations
 * included, so migrate() must be re-run after every reset -- the same shape
 * discover.test.ts uses, and for the same reason: each test here wants its
 * own independently empty schema. */
async function fresh(): Promise<void> {
  await resetSchema();
  await migrate(false);
}

/* DEVIATION from the brief, which inserted `INSERT INTO solicitation (title,
 * closes_at)`. That statement cannot run any more: migration 010 landed
 * AFTER this brief was written and made `source_id` NOT NULL, so a fixture
 * without one is a row that could not exist and could not have been
 * migrated. Seeded the way discover.test.ts seeds it, sighting included,
 * because 010's own backfill derives source_id FROM the sighting. */
async function solicitation(closesAt: string | null): Promise<number> {
  await run(`INSERT INTO source (name) VALUES ('SAM.gov') ON CONFLICT (name) DO NOTHING`);
  const id = await insert(
    `INSERT INTO solicitation (title, closes_at, source_id)
     SELECT 'fixture', $1, src.id FROM source src WHERE src.name = 'SAM.gov' RETURNING id`,
    [closesAt],
  );
  await insert(
    `INSERT INTO sighting (source_id, solicitation_id)
     SELECT id, $1 FROM source WHERE name = 'SAM.gov' RETURNING id`,
    [id],
  );
  return id;
}

/* ⏰ A LIVE DEADLINE IS COMPUTED, NEVER HARDCODED, and this file is why.
 *
 * `runExtract`'s ORDER BY sorts LIVE solicitations first --
 * `left(s.closes_at,10) >= to_char(now(),'YYYY-MM-DD')` -- then nearest-first
 * within them, then everything already closed most-recent-first. Every
 * ordering fixture below therefore needs two things and only two: that the
 * row is live, and that it sorts before or after its neighbours. The literal
 * date never mattered.
 *
 * FOUR TESTS IN THIS FILE HARDCODED `2026-09-01` AS "SOON" AND WENT RED ON
 * 2026-09-01, at 20:00 EDT -- the moment a GMT database rolled over to
 * 2026-09-02 and that date stopped being live. The rows did not fail; they
 * SORTED DIFFERENTLY, which is worse, because the assertions that broke were
 * about batch contents and document text rather than about ordering. The NUL
 * -byte test served its two response bodies in call order and silently gave
 * the first one to the wrong document.
 *
 * `now()` is evaluated by POSTGRES, so a JS fake clock cannot help here --
 * vi.setSystemTime does not reach into the database. Relative fixtures are
 * the fix. UTC throughout, matching the server, and offsets are days apart so
 * no timezone skew can reorder two neighbours.
 *
 * ⚠️ Use a genuinely past literal for rows that must be CLOSED (2020-01-01
 * below). Those cannot rot the way a future date can. */
function daysOut(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function pending(filename: string, closesAt: string | null = daysOut(30)): Promise<number> {
  const sol = await solicitation(closesAt);
  return insert(
    `INSERT INTO document (solicitation_id, filename, source_url, extract_status)
     VALUES ($1, $2, 'https://example.test/f', 'pending') RETURNING id`,
    [sol, filename],
  );
}

const bytes = (b: Buffer) =>
  vi.fn(async () => new Response(new Uint8Array(b), { status: 200 })) as unknown as typeof fetch;

/* A1 carries the cue and the date; B1 is a formula whose CACHED value is
 * stale. One fixture, two independent things to pin: the field the extractor
 * found, and the note the PARSER left about the document. */
function workbook(due = "September 15, 2026"): Buffer {
  const ws: XLSX.WorkSheet = {
    A1: { t: "s", v: `Proposals are due ${due}` },
    B1: { t: "n", v: 999, f: "SUM(B2:B2)" },
    "!ref": "A1:B1",
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

test("an unsupported type is a recorded failure, never a silent skip", async () => {
  await fresh();
  await pending("deck.pptx");

  const r = await runExtract({ limit: 5, budgetMs: 10_000, fetchImpl: bytes(Buffer.from("x")) });

  expect(r.failed).toBe(1);
  const [doc] = await all<{ extract_status: string; source_note: string }>(
    `SELECT extract_status, source_note FROM document`,
  );
  expect(doc?.extract_status).toBe("failed");
  expect(doc?.source_note).toMatch(/pptx/i);
});

test("one bad document does not kill the batch", async () => {
  await fresh();
  await pending("bad.pptx");
  await pending("also-bad.txt");

  const r = await runExtract({ limit: 5, budgetMs: 10_000, fetchImpl: bytes(Buffer.from("x")) });

  expect(r.processed).toBe(2);
});

test("stops on the budget and reports what remains", async () => {
  await fresh();
  for (let i = 0; i < 3; i++) await pending(`f${i}.pptx`);

  /* A zero budget means the loop stops before the first document. Nothing is
   * half-written, because each document commits on its own. */
  const r = await runExtract({ limit: 5, budgetMs: 0, fetchImpl: bytes(Buffer.from("x")) });

  expect(r.processed).toBe(0);
  expect(r.remaining).toBe(3);
  const still = await all<{ c: string }>(
    `SELECT count(*) AS c FROM document WHERE extract_status = 'pending'`,
  );
  expect(Number(still[0]?.c)).toBe(3);
});

/* SPEC §7, and it was missing entirely: "A 429 stops the batch cleanly and
 * reports `remaining` rather than retrying harder. This project has already
 * burst-probed a host into a defensive posture once" -- Vercel Attack
 * Challenge Mode, 2026-08-19.
 *
 * Two properties, and the second is the one an ordinary reading misses. The
 * batch STOPS, so the remaining documents are not fired at a host that has
 * just asked us to slow down. And the rate-limited document stays PENDING
 * rather than being marked `failed`: a 429 is the most transient failure
 * there is, and `failed` is where permanent things go -- the deleted
 * resource, the unparseable type. Marking it failed would discard a document
 * SAM.gov was perfectly willing to serve a minute later, and no later run
 * would ever pick it up again. */
test("a 429 stops the batch and leaves the document pending, not failed", async () => {
  await fresh();
  const first = await pending("First.pdf", daysOut(10));
  await pending("Second.pdf", daysOut(20));
  const limited = vi.fn(
    async () => new Response("slow down", { status: 429, headers: { "Retry-After": "60" } }),
  );

  const r = await runExtract({
    limit: 5,
    budgetMs: 10_000,
    fetchImpl: limited as unknown as typeof fetch,
  });

  /* Asked once, then stopped -- not once per remaining document. */
  expect(limited).toHaveBeenCalledTimes(1);
  expect(r.processed).toBe(0);
  expect(r.failed).toBe(0);
  expect(r.remaining).toBe(2);

  const row = await one<{ extract_status: string; source_note: string | null }>(
    `SELECT extract_status, source_note FROM document WHERE id = $1`,
    [first],
  );
  expect(row?.extract_status).toBe("pending");
  /* Not a silent stop: the reason is on the row, so an operator asking why a
   * batch did nothing has an answer without reading logs that do not exist. */
  expect(row?.source_note).toMatch(/429|rate/i);
});

/* SPEC §8's resumability row -- "kill a batch mid-way; assert finished
 * documents stay `extracted` and the rest stay `pending`" -- which the
 * budget test above does NOT cover: a zero budget stops before the first
 * document, so it only ever proves the all-pending case. The MIXED state is
 * the one the property is about, and it is the one 2026-08-27 got wrong.
 *
 * Made deterministic by the fetch itself: one download takes longer than the
 * whole budget, so document one starts and document two finds it spent. The
 * budget is WALL CLOCK FOR THE CALL -- `started` is captured before the
 * queue query, so it covers that query too, which is why the budget here is
 * seconds rather than the milliseconds a first draft used. That draft
 * processed nothing at all, because a Neon round trip had already outrun a
 * 50ms budget before the loop began. Correct behaviour; a badly chosen
 * number. */
test("a batch stopped mid-way keeps what it finished and leaves the rest pending", async () => {
  await fresh();
  const firstDoc = await pending("First.xlsx", daysOut(10));
  await pending("Second.xlsx", daysOut(20));
  await pending("Third.xlsx", daysOut(30));
  const slow = vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 4000));
    return new Response(new Uint8Array(workbook()), { status: 200 });
  }) as unknown as typeof fetch;

  const r = await runExtract({ limit: 5, budgetMs: 3000, fetchImpl: slow });

  expect(r.processed).toBe(1);
  expect(r.remaining).toBe(2);

  /* The one that finished is COMMITTED -- text, status and fields -- not
   * rolled back with the batch it was part of. */
  const done = await one<{ extract_status: string; extracted_text: string }>(
    `SELECT extract_status, extracted_text FROM document WHERE id = $1`,
    [firstDoc],
  );
  expect(done?.extract_status).toBe("extracted");
  expect(done?.extracted_text).toContain("September 15, 2026");
  expect(
    await one<{ c: number }>(
      `SELECT count(*) AS c FROM extracted_field WHERE document_id = $1`,
      [firstDoc],
    ),
  ).toEqual({ c: 6 });

  /* And the rest are exactly as they were, ready for the next run. */
  expect(
    await one<{ c: number }>(
      `SELECT count(*) AS c FROM document WHERE extract_status = 'pending'`,
    ),
  ).toEqual({ c: 2 });
});

/* ADDED, not in the brief. Every one of the three tests above feeds the
 * orchestrator a file it cannot parse, so between them they never reach the
 * success path -- extractFields, the extracted_field rows, produced_by and
 * the parser notes were all unpinned by the brief's own suite. That is the
 * shape of the defect Task 9 shipped and had to catch by mutation instead:
 * green tests over a premise nobody exercised. */
test("a parsed document becomes extracted, with its text and its fields", async () => {
  await fresh();
  const doc = await pending("Solicitation.xlsx");

  const r = await runExtract({ limit: 5, budgetMs: 10_000, fetchImpl: bytes(workbook()) });

  expect(r.processed).toBe(1);
  expect(r.failed).toBe(0);
  const row = await one<{
    extract_status: string;
    extracted_text: string;
    produced_by: string;
  }>(`SELECT extract_status, extracted_text, produced_by FROM document WHERE id = $1`, [doc]);
  expect(row?.extract_status).toBe("extracted");
  expect(row?.extracted_text).toContain("September 15, 2026");
  expect(row?.produced_by).toBe("mechanical");

  const fields = await all<{ field_name: string; value_text: string | null }>(
    `SELECT field_name, value_text FROM extracted_field
      WHERE origin = 'document' AND document_id = $1 ORDER BY field_name`,
    [doc],
  );
  expect(fields.map((f) => f.field_name)).toEqual([
    "closes_at",
    "prebid_at",
    "prebid_required",
    "qa_closes_at",
    "set_aside",
    "value_cents",
  ]);
  expect(fields.find((f) => f.field_name === "closes_at")?.value_text).toBe("2026-09-15");
});

/* ADDED, not in the brief, and the reason is the brief's own division of
 * labour. `document.source_note` is the PARSER's account of the document
 * ("B1 is a cached formula value"); `extracted_field.note` is the FIELD's
 * account of itself ("not extracted"). An earlier draft of this task bound
 * the parser's notes into extracted_field.note and never wrote the field's
 * own note at all, discarding every one of them -- and the accuracy
 * instrument depends on those: without the date-seen-but-unplaced note, a
 * recall miss is indistinguishable from a document that genuinely had no
 * date. Two assertions, because one note landing does not prove the other
 * was not overwritten with it. */
test("the parser's note lands on the document, the field's note on the field", async () => {
  await fresh();
  const doc = await pending("Solicitation.xlsx");

  await runExtract({ limit: 5, budgetMs: 10_000, fetchImpl: bytes(workbook()) });

  const row = await one<{ source_note: string | null }>(
    `SELECT source_note FROM document WHERE id = $1`,
    [doc],
  );
  expect(row?.source_note).toMatch(/cached/i);

  const setAside = await one<{ note: string | null }>(
    `SELECT note FROM extracted_field WHERE document_id = $1 AND field_name = 'set_aside'`,
    [doc],
  );
  expect(setAside?.note).toBe("not extracted");
});

/* ADDED, and it is the one that changes the implementation -- see D9. The
 * brief expanded a bundle into child rows marked 'pending', to be picked up
 * by a later batch. A member row CANNOT be picked up by a later batch: its
 * bytes came from inside an archive, so it has no source_url, and ruling 1
 * keeps no bytes anywhere. Left as briefed, every one of the spike's 86
 * members becomes a row that a later pass fetches from `null`, fails, and
 * records as "download failed" -- a wrong reason, made durable, which is
 * exactly what D8 exists to stop happening to nested archives. The bytes are
 * in hand at expansion time, so the member is extracted THERE. */
test("a bundle's members are extracted in the same pass, not left unfetchable", async () => {
  await fresh();
  const z = new JSZip();
  z.file("Pricing.xlsx", workbook());
  const parent = await pending("bundle.zip");

  const r = await runExtract({
    limit: 5,
    budgetMs: 10_000,
    fetchImpl: bytes(await z.generateAsync({ type: "nodebuffer" })),
  });

  expect(r.processed).toBe(1); // the bundle is one unit of work
  const member = await one<{ id: number; extract_status: string; parent_document_id: number }>(
    `SELECT id, extract_status, parent_document_id FROM document WHERE filename = 'Pricing.xlsx'`,
  );
  expect(member?.parent_document_id).toBe(parent);
  expect(member?.extract_status).toBe("extracted");
  expect(
    await one<{ value_text: string }>(
      `SELECT value_text FROM extracted_field WHERE document_id = $1 AND field_name = 'closes_at'`,
      [member?.id],
    ),
  ).toEqual({ value_text: "2026-09-15" });

  /* Spec §5: the parent carries no text of its own. */
  const p = await one<{ extract_status: string; extracted_text: string | null }>(
    `SELECT extract_status, extracted_text FROM document WHERE id = $1`,
    [parent],
  );
  expect(p?.extract_status).toBe("extracted");
  expect(p?.extracted_text).toBeNull();
  /* A number, not the string pg hands back for int8 by default: db/index.ts
   * registers a type parser for oid 20 precisely so a count arrives as one. */
  expect(
    await one<{ c: number }>(`SELECT count(*) AS c FROM document WHERE extract_status = 'pending'`),
  ).toEqual({ c: 0 });
});

/* D8. Depth 1 is the limit; the nested archive becomes a row that says so,
 * because a recorded failure is queryable and the spike's throwaway
 * `skipped: "not a parseable format"` was not. */
test("a nested archive is a failed row with a reason, not a traversal", async () => {
  await fresh();
  const inner = new JSZip();
  inner.file("deep.xlsx", workbook());
  const z = new JSZip();
  z.file("Library.zip", await inner.generateAsync({ type: "nodebuffer" }));
  await pending("bundle.zip");

  await runExtract({
    limit: 5,
    budgetMs: 10_000,
    fetchImpl: bytes(await z.generateAsync({ type: "nodebuffer" })),
  });

  const nested = await one<{ extract_status: string; source_note: string }>(
    `SELECT extract_status, source_note FROM document WHERE filename = 'Library.zip'`,
  );
  expect(nested?.extract_status).toBe("failed");
  expect(nested?.source_note).toMatch(/nested archive/i);
  expect(
    await one<{ c: number }>(`SELECT count(*) AS c FROM document WHERE filename = 'deep.xlsx'`),
  ).toEqual({ c: 0 });
});

/* ADDED. `extracted` is what accuracyByField counts as an OPPORTUNITY, so a
 * document marked extracted with no text scores every field as a miss
 * against a document that was never read -- the extractor blamed for a
 * parser that came back empty. Fail closed instead. Verified by mutation
 * rather than by watching it fail first: deleting the `text.trim() === ""`
 * arm of the guard leaves this test, and only this test, red. */
test("a document that parses to nothing is failed, never marked extracted", async () => {
  await fresh();
  const doc = await pending("Empty.xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, { "!ref": "A1:A1" } as XLSX.WorkSheet, "Sheet1");

  const r = await runExtract({
    limit: 5,
    budgetMs: 10_000,
    fetchImpl: bytes(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })),
  });

  expect(r.failed).toBe(1);
  const row = await one<{ extract_status: string; source_note: string }>(
    `SELECT extract_status, source_note FROM document WHERE id = $1`,
    [doc],
  );
  expect(row?.extract_status).toBe("failed");
  expect(row?.source_note).toMatch(/no text/i);
});

/* ADDED, and the distinction it pins is the one the accuracy instrument
 * rests on: a `failed` document is a missed FETCH, not a missed extraction.
 * `opportunities` counts only solicitations with a document in `extracted`
 * or `absent`, so a document that never arrived must not be counted as one
 * the extractor read and got nothing from. The reason has to say which. */
test("a download that never arrives is recorded as a download failure", async () => {
  await fresh();
  const doc = await pending("RFP.pdf");
  const gone = vi.fn(async () => new Response(null, { status: 404 })) as unknown as typeof fetch;

  const r = await runExtract({ limit: 5, budgetMs: 10_000, fetchImpl: gone });

  expect(r.failed).toBe(1);
  const row = await one<{ extract_status: string; source_note: string }>(
    `SELECT extract_status, source_note FROM document WHERE id = $1`,
    [doc],
  );
  expect(row?.extract_status).toBe("failed");
  expect(row?.source_note).toBe("download failed: HTTP 404");
  /* Nothing was parsed, so nothing may be claimed about the fields. An
   * extracted_field row here would be a statement about a document that was
   * never read. */
  expect(
    await one<{ c: number }>(`SELECT count(*) AS c FROM extracted_field`),
  ).toEqual({ c: 0 });
});

/* A cell, no cached formula, so the only note this document can carry is the
 * one the storage boundary adds. */
function plainSheet(a1: string): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, { A1: { t: "s", v: a1 }, "!ref": "A1:A1" } as XLSX.WorkSheet, "S");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/* FOUND BY THE FIRST LIVE RUN, 2026-08-30, and it killed the batch.
 *
 * A real SAM.gov drawings PDF parsed to text containing a NUL byte, and
 * Postgres `text` cannot hold one: `invalid byte sequence for encoding
 * "UTF8": 0x00`. The throw came from the UPDATE, which sits OUTSIDE the
 * try/catch around parse(), so it escaped runExtract entirely and took every
 * remaining document in the batch with it -- while "one bad document does
 * not kill the batch" above stayed green, because its bad documents all fail
 * at PARSE time and never reach a write.
 *
 * Two properties, one test, deliberately: the NUL is removed rather than
 * fatal, AND a document that still cannot be written fails alone. Mutating
 * away the sanitiser leaves the first document `failed` and the second
 * `extracted` -- the batch survives, and this test says so. Mutating away
 * both puts the pg error back through the caller. */
test("a NUL byte in the text is removed, and does not take the batch with it", async () => {
  await fresh();
  const nul = String.fromCharCode(0);
  const dirty = await pending("Drawings.xlsx", daysOut(10));
  const clean = await pending("Clean.xlsx", daysOut(20));
  const bodies = [
    plainSheet(`Proposals are due September 15, 2026 ${nul} sheet 1 of 2`),
    plainSheet("nothing of interest here"),
  ];
  let call = 0;
  const serve = vi.fn(async () => {
    const b = bodies[call++] ?? bodies[0]!;
    return new Response(new Uint8Array(b), { status: 200 });
  }) as unknown as typeof fetch;

  const r = await runExtract({ limit: 5, budgetMs: 10_000, fetchImpl: serve });

  expect(r).toEqual({ processed: 2, failed: 0, remaining: 0 });

  const bad = await one<{ extract_status: string; extracted_text: string; source_note: string }>(
    `SELECT extract_status, extracted_text, source_note FROM document WHERE id = $1`,
    [dirty],
  );
  expect(bad?.extract_status).toBe("extracted");
  expect(bad?.extracted_text).not.toContain(nul);
  /* Removed, not truncated at the NUL: everything either side survives. */
  expect(bad?.extracted_text).toContain("September 15, 2026");
  expect(bad?.extracted_text).toContain("sheet 1 of 2");
  /* Recorded, because a silently altered document is one nobody can audit. */
  expect(bad?.source_note).toMatch(/NUL/i);

  /* The fields come off the CLEANED text, so the date is still found. */
  expect(
    await one<{ value_text: string }>(
      `SELECT value_text FROM extracted_field WHERE document_id = $1 AND field_name = 'closes_at'`,
      [dirty],
    ),
  ).toEqual({ value_text: "2026-09-15" });

  /* And the document after it in the batch ran at all. */
  expect(
    await one<{ extract_status: string }>(`SELECT extract_status FROM document WHERE id = $1`, [
      clean,
    ]),
  ).toEqual({ extract_status: "extracted" });
});

/* Same builder as pdf.test.ts's, and local for the same reason every other
 * fixture in this suite is: a valid one-page PDF with no content stream, the
 * shape a scan has once the image is removed. */
function emptyPagePdf(): Buffer {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

/* The parser's explanation is worth nothing if it stops at the parser. The
 * fail-closed branch overwrites source_note with its own reason, so unless
 * that reason CARRIES the notes, "1 page, no text layer" -- the fact that
 * distinguishes a scan from a corrupt file -- never reaches the column an
 * operator queries. Found on `Sign In Sheet 8-10.pdf`, 2026-08-30. */
test("a scanned PDF is failed with the parser's own explanation attached", async () => {
  await fresh();
  const doc = await pending("Sign In Sheet.pdf");

  const r = await runExtract({ limit: 5, budgetMs: 10_000, fetchImpl: bytes(emptyPagePdf()) });

  expect(r.failed).toBe(1);
  const row = await one<{ extract_status: string; source_note: string }>(
    `SELECT extract_status, source_note FROM document WHERE id = $1`,
    [doc],
  );
  expect(row?.extract_status).toBe("failed");
  expect(row?.source_note).toMatch(/no text/i);
  expect(row?.source_note).toMatch(/no text layer/i);
});

/* FOUND BY THE FIRST LIVE RUN, 2026-08-30. SAM.gov serves a document called
 * `Current Request for Proposal`, with no extension at all, and the failure
 * recorded for it read `unsupported type: current request for proposal` --
 * because the extension split returns the WHOLE NAME when there is no dot.
 * True in the sense that nothing could parse it, and misleading in the sense
 * that it names a "type" that is not one, which is worse than useless in a
 * column an operator greps to find out what SAM.gov actually serves. */
test("a filename with no extension reports that, not the whole name as a type", async () => {
  await fresh();
  const doc = await pending("Current Request for Proposal");

  const r = await runExtract({ limit: 5, budgetMs: 10_000, fetchImpl: bytes(Buffer.from("x")) });

  expect(r.failed).toBe(1);
  const row = await one<{ source_note: string }>(
    `SELECT source_note FROM document WHERE id = $1`,
    [doc],
  );
  expect(row?.source_note).toMatch(/no file extension/i);
  expect(row?.source_note).not.toMatch(/type: current request/i);
});

/* FOUND BY THE FIRST LIVE RUN, 2026-08-30, on four real documents. SAM.gov
 * answers a download for a withdrawn attachment with HTTP 400 and a JSON
 * body saying "The resource has been deleted." -- and all we recorded was
 * `download failed: HTTP 400`, which an operator cannot tell apart from
 * SAM.gov being down. One is permanent and one is worth retrying, and the
 * difference was sitting unread in the response body. */
test("a download failure records the reason the server gave, not just the code", async () => {
  await fresh();
  const doc = await pending("Withdrawn.pdf");
  const deleted = vi.fn(
    async () =>
      new Response(JSON.stringify({ errors: { message: "The resource has been deleted." } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
  ) as unknown as typeof fetch;

  await runExtract({ limit: 5, budgetMs: 10_000, fetchImpl: deleted });

  const row = await one<{ source_note: string }>(
    `SELECT source_note FROM document WHERE id = $1`,
    [doc],
  );
  expect(row?.source_note).toMatch(/HTTP 400/);
  expect(row?.source_note).toMatch(/resource has been deleted/i);
});

/* REVIEW FINDING 4 (2026-08-30), and it lands squarely on my own reasoning.
 * Dropping §4.3's `closes_at >= now()` filter was right -- it keeps
 * `remaining` honest -- but I then claimed plain `ORDER BY closes_at ASC`
 * still delivered "nearest live deadline first". Over an UNFILTERED set it
 * delivers the exact opposite: the longest-expired solicitations sort to the
 * front, so the first batch is the least useful one. Measured, not
 * theoretical -- every document in the 2026-08-30 live run belonged to an
 * already-closed solicitation and was processed oldest-first.
 *
 * A two-key sort restores the intent without excluding anything: live rows
 * first, nearest deadline within them. */
test("takes the nearest LIVE deadline first, ahead of anything already closed", async () => {
  await fresh();
  await pending("long-closed.pptx", "2020-01-01");
  await pending("closes-soon.pptx", daysOut(10));
  await pending("closes-later.pptx", daysOut(200));

  const r = await runExtract({ limit: 1, budgetMs: 10_000, fetchImpl: bytes(Buffer.from("x")) });

  expect(r.processed).toBe(1);
  const done = await one<{ filename: string }>(
    `SELECT filename FROM document WHERE extract_status = 'failed'`,
  );
  expect(done?.filename).toBe("closes-soon.pptx");
});

/* REVIEW FINDING 7 (2026-08-30). `remaining` counted every pending row while
 * NEXT inner-joins `solicitation` -- and `document.solicitation_id` is
 * nullable, because a document may belong to a `contract` instead. Such a row
 * is invisible to the queue but visible to the counter, so the Extract button
 * would report a `remaining` that never decreases and an operator's "click
 * until zero" loop would never end. Latent today (nothing creates one), which
 * is exactly when it is cheap to close. */
test("remaining counts only what the queue can actually return", async () => {
  await fresh();
  await pending("real.pptx");
  /* A contract-attached document: legal per the schema, invisible to NEXT. */
  await insert(
    `INSERT INTO document (solicitation_id, filename, source_url, extract_status)
     VALUES (NULL, 'orphan.pdf', 'https://example.test/f', 'pending') RETURNING id`,
  );

  const r = await runExtract({ limit: 5, budgetMs: 10_000, fetchImpl: bytes(Buffer.from("x")) });

  expect(r.processed).toBe(1);
  /* Not 1: the orphan is not work this loop can ever do, so counting it as
   * outstanding is a promise the button cannot keep. */
  expect(r.remaining).toBe(0);
});

/* REVIEW FINDING 6 (2026-08-30). D9 marks the parent `extracted` only AFTER
 * its members, so a run killed mid-expansion leaves the parent `pending` and
 * the next run redoes it -- deliberate. The cost is a second copy of every
 * member already inserted, and I had claimed the stranded-member branch
 * covered it. It does not: that branch only catches the WRITE-FAILURE path,
 * not a platform kill, and nothing in the schema stopped the duplicate.
 *
 * This reproduces the killed state directly -- a pending parent with one
 * member already under it -- because a real platform kill cannot be staged. */
test("re-expanding a bundle after a kill does not duplicate its members", async () => {
  await fresh();
  const parent = await pending("bundle.zip");
  const sol = await one<{ solicitation_id: number }>(
    `SELECT solicitation_id FROM document WHERE id = $1`,
    [parent],
  );
  await insert(
    `INSERT INTO document (solicitation_id, filename, parent_document_id, extract_status)
     VALUES ($1, 'Pricing.xlsx', $2, 'pending') RETURNING id`,
    [sol?.solicitation_id, parent],
  );

  const z = new JSZip();
  z.file("Pricing.xlsx", workbook());
  z.file("Second.xlsx", workbook());
  await runExtract({
    limit: 5,
    budgetMs: 10_000,
    fetchImpl: bytes(await z.generateAsync({ type: "nodebuffer" })),
  });

  expect(
    await one<{ c: number }>(
      `SELECT count(*) AS c FROM document WHERE parent_document_id = $1 AND filename = 'Pricing.xlsx'`,
      [parent],
    ),
  ).toEqual({ c: 1 });
  /* AND the pre-existing member is EXTRACTED, not failed. Before members were
   * removed from the fetch queue this row was clobbered: the bundle expanded
   * and extracted it correctly, then the loop reached the same row as a stale
   * snapshot entry, found no source_url, and overwrote the good extraction
   * with "expand its parent bundle again". */
  expect(
    await one<{ extract_status: string }>(
      `SELECT extract_status FROM document WHERE parent_document_id = $1 AND filename = 'Pricing.xlsx'`,
      [parent],
    ),
  ).toEqual({ extract_status: "extracted" });

  /* Both members end up read, and the pre-existing row is the one that was
   * filled in rather than a second copy beside it. */
  expect(
    await one<{ c: number }>(
      `SELECT count(*) AS c FROM document WHERE parent_document_id = $1 AND extract_status = 'extracted'`,
      [parent],
    ),
  ).toEqual({ c: 2 });
});

/* Spec §4.3: nearest live deadline first. Ordering is the whole of what
 * makes the first batch the useful batch, and `limit` is what makes the
 * order observable -- with a limit above the queue size every ordering
 * passes. */
test("takes the nearest deadline first", async () => {
  await fresh();
  await pending("late.pptx", daysOut(400));
  await pending("soon.pptx", daysOut(10));
  await pending("undated.pptx", null);

  const r = await runExtract({ limit: 1, budgetMs: 10_000, fetchImpl: bytes(Buffer.from("x")) });

  expect(r.processed).toBe(1);
  expect(r.remaining).toBe(2);
  const done = await one<{ filename: string }>(
    `SELECT filename FROM document WHERE extract_status = 'failed'`,
  );
  expect(done?.filename).toBe("soon.pptx");
});

/* ---- REVIEW ROUND 2, 2026-08-30 ---------------------------------------- */

/* FINDING 3 (Medium). Excluding members from the queue fixed the clobbering,
 * and opened a hole at the other end: a member stranded by a parent that
 * FAILED mid-expansion is now invisible to the queue AND uncounted in
 * `remaining`, where it used to be picked up and marked failed with an
 * actionable note. Invisible and unrecoverable is strictly worse than
 * wrongly-shaped and visible.
 *
 * Closed with a reconciliation pass rather than a catch-local sweep, because
 * a catch only covers the failure it wraps: a process killed at the platform
 * ceiling leaves exactly the same state and runs no catch at all. A pending
 * member whose parent is not itself pending cannot be reached by anything,
 * whatever put it there. */
test("a member stranded under a failed parent is surfaced, not left invisible", async () => {
  await fresh();
  const parent = await pending("bundle.zip");
  const sol = await one<{ solicitation_id: number }>(
    `SELECT solicitation_id FROM document WHERE id = $1`,
    [parent],
  );
  await run(`UPDATE document SET extract_status = 'failed' WHERE id = $1`, [parent]);
  const orphan = await insert(
    `INSERT INTO document (solicitation_id, filename, parent_document_id, extract_status)
     VALUES ($1, 'Stranded.pdf', $2, 'pending') RETURNING id`,
    [sol?.solicitation_id, parent],
  );

  await runExtract({ limit: 5, budgetMs: 10_000, fetchImpl: bytes(Buffer.from("x")) });

  const row = await one<{ extract_status: string; source_note: string }>(
    `SELECT extract_status, source_note FROM document WHERE id = $1`,
    [orphan],
  );
  expect(row?.extract_status).toBe("failed");
  expect(row?.source_note).toMatch(/parent/i);
});

/* FINDING 5 (Low), and it matters more than "low" suggests in the state
 * actually measured: every document in the 2026-08-30 live run belonged to an
 * already-closed solicitation. With nothing live, the live-first key selects
 * nothing, the sort collapses to plain `closes_at ASC`, and the operator's
 * first batch is the 2020 notices -- the very ordering the fix was supposed
 * to end. Within the expired group, most-recently-closed is the useful end. */
test("among already-closed solicitations, the most recently closed comes first", async () => {
  await fresh();
  await pending("ancient.pptx", "2020-01-01");
  await pending("recent.pptx", "2026-08-01");

  const r = await runExtract({ limit: 1, budgetMs: 10_000, fetchImpl: bytes(Buffer.from("x")) });

  expect(r.processed).toBe(1);
  const done = await one<{ filename: string }>(
    `SELECT filename FROM document WHERE extract_status = 'failed'`,
  );
  expect(done?.filename).toBe("recent.pptx");
});
