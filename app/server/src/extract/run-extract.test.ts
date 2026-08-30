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

async function pending(filename: string, closesAt: string | null = "2026-09-15"): Promise<number> {
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
  const dirty = await pending("Drawings.xlsx", "2026-09-01");
  const clean = await pending("Clean.xlsx", "2026-09-02");
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

/* Spec §4.3: nearest live deadline first. Ordering is the whole of what
 * makes the first batch the useful batch, and `limit` is what makes the
 * order observable -- with a limit above the queue size every ordering
 * passes. */
test("takes the nearest deadline first", async () => {
  await fresh();
  await pending("late.pptx", "2027-01-01");
  await pending("soon.pptx", "2026-09-01");
  await pending("undated.pptx", null);

  const r = await runExtract({ limit: 1, budgetMs: 10_000, fetchImpl: bytes(Buffer.from("x")) });

  expect(r.processed).toBe(1);
  expect(r.remaining).toBe(2);
  const done = await one<{ filename: string }>(
    `SELECT filename FROM document WHERE extract_status = 'failed'`,
  );
  expect(done?.filename).toBe("soon.pptx");
});
