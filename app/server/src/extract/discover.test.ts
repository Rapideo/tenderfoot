import { afterAll, expect, test, vi } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

/* Point at a scratch SCHEMA before importing anything that opens a pool.
 * discover.ts has a STATIC top-level `import ... from "../db/index.js"`
 * (correct there -- every export of discover.ts is db-backed, unlike
 * precedence.ts, which keeps a pure half free of any database import). That
 * means importing discover.js itself, not only db/index.js directly, must
 * happen AFTER useTestSchema() runs: a static `import` at the top of THIS
 * file is hoisted ahead of any top-level statement regardless of where it
 * sits in the source, so db/index.ts's module-level `pool` would otherwise
 * get built from whatever DATABASE_URL happened to be ambient (unset under
 * `npm run check`, or the real one under a plain `vitest run` with .env
 * loaded) with no TENDERFOOT_SCHEMA search_path at all -- not this test's
 * isolated schema. Every other db-backed test file in this codebase
 * (db/schema.test.ts, db/migrate.test.ts, db/health-schema.test.ts,
 * extract/accuracy.test.ts) avoids exactly this by importing such modules
 * dynamically, after useTestSchema(); this file follows the same shape.
 *
 * Fix round 1, item 6: named "test_discover", not "discover". testdb.ts
 * suffixes this to "<logical>_<runSuffix>", and
 * scripts/clean-test-schemas.mjs only ever reclaims schemas matching
 * test_%, bench_%, or verify_% -- every one of the twelve sibling
 * db-backed test files already uses a "test_" prefix. A bare "discover"
 * prefix is exactly the leak that script's own header comment documents
 * having already cost the project once (106 abandoned schemas, a suite
 * slow enough to fail its own timeout). */
useTestSchema("test_discover");

/* Ruling 6 (SP2 T2 coordinator review), same as every other db-backed test
 * file (db/schema.test.ts, db/migrate.test.ts, extract/accuracy.test.ts):
 * the shared Neon test-branch compute cold-starts at ~1.1s and is contended
 * by parallel test files, so the 5000ms/10000ms defaults are too tight. */
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

const { migrate } = await import("../db/migrate.js");
const { discoverAttachments } = await import("./discover.js");
const { all, run, insert, close } = await import("../db/index.js");

afterAll(async () => {
  await close();
});

/* A solicitation cannot exist without a source: migration 010 put
 * `source_id` ON the row, NOT NULL, so "where did this come from" is no
 * longer a fact you have to join `sighting` to recover. discoverAttachments
 * reads that column directly -- it hands each candidate's external_id to
 * SAM.gov's attachment API, so it must select SAM.gov's rows and nothing
 * else.
 *
 * The sighting is written too, even though nothing under test reads it any
 * more. In production every solicitation has one (measured: 0 of 1,925 lack
 * one) and the migration's backfill derives `source_id` FROM it, so a
 * fixture without one is a row that could not exist and could not have been
 * migrated. 003_seed_source_registry.sql seeds 'SAM.gov'; the corpus-import
 * sources are created at IMPORT time rather than seeded, so a fixture naming
 * one has to create it -- `name` is the only NOT NULL column on `source`
 * without a default. */
interface Fixture {
  externalId: string;
  title?: string;
  closesAt?: string | null;
  setAside?: string | null;
  kind?: string | null;
  source?: string;
}

async function seed(f: Fixture): Promise<number> {
  const name = f.source ?? "SAM.gov";
  await run(`INSERT INTO source (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [name]);
  const id = await insert(
    `INSERT INTO solicitation (title, external_id, closes_at, set_aside, kind, source_id)
     SELECT $1, $2, $3, $4, $5, src.id FROM source src WHERE src.name = $6 RETURNING id`,
    [f.title ?? "fixture", f.externalId, f.closesAt ?? null, f.setAside ?? null, f.kind ?? null, name],
  );
  await insert(
    `INSERT INTO sighting (source_id, solicitation_id)
     SELECT id, $2 FROM source WHERE name = $1 RETURNING id`,
    [name, id],
  );
  return id;
}

const SAM_RESPONSE = {
  _embedded: {
    opportunityAttachmentList: [
      {
        attachments: [
          { name: "RFP.pdf", resourceId: "r1", type: "file", fileExists: "1" },
          { name: "Pricing.xlsx", resourceId: "r2", type: "file", fileExists: "1" },
          { name: "Gone.pdf", resourceId: "r3", type: "file", fileExists: "0" },
        ],
      },
    ],
  },
};

test("inserts one pending document per existing attachment", async () => {
  await resetSchema();
  /* resetSchema() drops every table migrate() created, including
   * schema_migrations itself -- each test in this file wants its own
   * independently empty schema (unlike the other db-backed test files,
   * which reset once for the whole file), so migrate() must be re-run
   * after every reset or the INSERT below fails with "relation
   * \"solicitation\" does not exist". */
  await migrate(false);
  await seed({
    title: "live one",
    externalId: "abc123",
    closesAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  const stub = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(SAM_RESPONSE), { status: 200 }),
  );

  const r = await discoverAttachments(10, stub as unknown as typeof fetch);

  expect(r.documents).toBe(2); // fileExists "0" is not a document
  const docs = await all<{ filename: string; extract_status: string; source_url: string }>(
    `SELECT filename, extract_status, source_url FROM document ORDER BY filename`,
  );
  expect(docs.map((d) => d.filename)).toEqual(["Pricing.xlsx", "RFP.pdf"]);
  expect(docs.every((d) => d.extract_status === "pending")).toBe(true);

  /* Fix round 1, CRITICAL 1: `source_url.length > 0` was the only thing
   * pinning the endpoint, and it passes just as happily against the wrong
   * host this task originally shipped -- a URL written from memory that
   * 404s on every id. Both URLs are spelled out here as LITERALS rather
   * than built from the imported SAM_HOST on purpose: a test that composes
   * the same constant the implementation composes moves with it, and would
   * have stayed green through the exact defect it is here to catch. These
   * two strings were verified live against SAM.gov. */
  expect(stub.mock.calls[0]?.[0]).toBe(
    "https://sam.gov/api/prod/opps/v3/opportunities/abc123/resources",
  );
  expect(docs.map((d) => d.source_url)).toEqual([
    "https://sam.gov/api/prod/opps/v3/opportunities/resources/files/r2/download",
    "https://sam.gov/api/prod/opps/v3/opportunities/resources/files/r1/download",
  ]);
  /* sam.ts's adapter and probe both treat the User-Agent as mandatory --
   * the default Node agent is rejected outright. */
  expect(
    (stub.mock.calls[0]?.[1] as RequestInit | undefined)?.headers,
  ).toMatchObject({ "User-Agent": expect.stringContaining("Mozilla") });
});

test("writes the portal's own values as listing rows", async () => {
  /* WITHOUT THIS, NOTHING EVER WRITES origin='listing'. The accuracy query in
   * Task 8 self-joins on it, so it would return zero rows forever, and the
   * spec's whole ground-truth argument -- "the portal listing doubles as
   * ground truth ... Accuracy is a query" -- would be unbuildable. */
  await resetSchema();
  await migrate(false);
  await seed({
    title: "live one",
    externalId: "abc123",
    closesAt: new Date(Date.now() + 86_400_000).toISOString(),
    setAside: "SBA",
    kind: "RFP",
  });
  const stub = vi.fn(async () => new Response(JSON.stringify(SAM_RESPONSE), { status: 200 }));

  await discoverAttachments(10, stub as unknown as typeof fetch);

  const listing = await all<{ field_name: string; value_text: string | null }>(
    `SELECT field_name, value_text FROM extracted_field
      WHERE origin = 'listing' ORDER BY field_name`,
  );
  const byName = Object.fromEntries(listing.map((r) => [r.field_name, r.value_text]));

  /* Fix round 1, item 5: pins the WHOLE six-field set by name. Before this,
   * reverting LISTING_FIELDS back to the brief's wrong 'kind' entry left
   * all four tests in this file green -- none of them named the field that
   * silently went missing (prebid_required). Object.keys, not
   * toHaveProperty per-field, is what actually catches an extra or missing
   * name. */
  expect(Object.keys(byName).sort()).toEqual([
    "closes_at", "prebid_at", "prebid_required", "qa_closes_at", "set_aside", "value_cents",
  ]);
  expect(byName["set_aside"]).toBe("SBA");
  expect(byName["closes_at"]).not.toBeNull();
  /* A field the portal does not carry is ABSENT, not omitted -- the same
   * three-state discipline the document side uses. toHaveProperty, not a
   * bare index read, is what actually proves the row EXISTS: `byName
   * ["qa_closes_at"]` alone reads as `undefined` identically whether the
   * row is present with value_text NULL or simply missing -- the
   * Object.keys assertion above closes that gap too, but this pins the
   * NULL value specifically. */
  expect(byName).toHaveProperty("qa_closes_at", null);
});

test("does not duplicate listing rows when run twice", async () => {
  /* Discover skips solicitations that already have documents, but a
   * solicitation with NO attachments would be revisited. */
  await resetSchema();
  await migrate(false);
  await seed({
    title: "s",
    externalId: "abc123",
    closesAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  const stub = vi.fn(async () => new Response(JSON.stringify(SAM_RESPONSE), { status: 200 }));
  await discoverAttachments(10, stub as unknown as typeof fetch);
  await discoverAttachments(10, stub as unknown as typeof fetch);
  const rows = await all<{ c: string }>(
    `SELECT count(*) AS c FROM extracted_field WHERE origin = 'listing' AND field_name = 'closes_at'`,
  );
  expect(Number(rows[0]?.c)).toBe(1);
});

test("skips solicitations whose deadline has passed", async () => {
  await resetSchema();
  await migrate(false);
  await seed({ title: "closed", externalId: "old", closesAt: "2020-01-01" });
  const stub = vi.fn(async () => new Response("{}", { status: 200 }));
  const r = await discoverAttachments(10, stub as unknown as typeof fetch);
  expect(r.solicitations).toBe(0);
  expect(stub).not.toHaveBeenCalled();
});

test("a solicitation with only SOME listing fields already written gains the rest on a later run", async () => {
  /* Fix round 1, item 8: the OLD read-then-write guard returned early the
   * moment ANY listing row existed for a solicitation -- so a run that died
   * partway through (three of six fields written, say) left that
   * solicitation looking "already done" PERMANENTLY, with no path to ever
   * fill the other three. This pins the replacement's self-repair property:
   * a pre-existing partial set gets topped up, not skipped. */
  await resetSchema();
  await migrate(false);
  const sol = await seed({
    title: "partial",
    externalId: "abc123",
    closesAt: new Date(Date.now() + 86_400_000).toISOString(),
    setAside: "SBA",
  });
  /* Simulates exactly one field surviving an earlier, interrupted run. */
  await insert(
    `INSERT INTO extracted_field
       (solicitation_id, field_name, value_text, origin, confidence, produced_by)
     VALUES ($1, 'closes_at', '2026-09-01', 'listing', 1.0, 'mechanical') RETURNING id`,
    [sol],
  );
  const stub = vi.fn(async () => new Response(JSON.stringify(SAM_RESPONSE), { status: 200 }));

  await discoverAttachments(10, stub as unknown as typeof fetch);

  const listing = await all<{ field_name: string; value_text: string | null }>(
    `SELECT field_name, value_text FROM extracted_field
      WHERE solicitation_id = $1 AND origin = 'listing' ORDER BY field_name`,
    [sol],
  );
  expect(listing.map((r) => r.field_name)).toEqual([
    "closes_at", "prebid_at", "prebid_required", "qa_closes_at", "set_aside", "value_cents",
  ]);
  /* REVERSED on 2026-08-29. This used to assert DO NOTHING -- that the row
   * surviving from the earlier run was left exactly as it was. That rested
   * on the recomputed value being merely "different-looking", and it is not:
   * ground truth here is a COPY of a solicitation column, and that column
   * gets corrected. The fixture's pre-existing '2026-09-01' is precisely a
   * stale copy, and the run must overwrite it with what the portal says now. */
  expect(listing.find((r) => r.field_name === "closes_at")?.value_text).toBe(
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  );
  expect(listing.find((r) => r.field_name === "set_aside")?.value_text).toBe("SBA");
});

test("admits solicitations with NO close date, dated ones first", async () => {
  /* Fix round 1, CRITICAL 2: `left(closes_at, 10) >= ...` evaluates to NULL
   * for a NULL closes_at and WHERE treats that as false, so the original
   * predicate silently excluded EVERY SAM.gov solicitation -- measured on
   * production, 9,682 of them, none carrying a close date. The task
   * inserted zero documents not because the fetch failed but because the
   * candidate list was empty. Nothing in this file caught it: every
   * fixture happened to set closes_at.
   *
   * This pins both halves of the fix -- undated rows are ADMITTED, and
   * NULLS LAST keeps a real deadline ahead of them when one exists. */
  await resetSchema();
  await migrate(false);
  await seed({ title: "undated", externalId: "no-date", closesAt: null });
  await seed({
    title: "dated",
    externalId: "has-date",
    closesAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  const stub = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(SAM_RESPONSE), { status: 200 }),
  );

  const r = await discoverAttachments(10, stub as unknown as typeof fetch);

  expect(r.solicitations).toBe(2);
  const requested = stub.mock.calls.map((c) => String(c[0]));
  expect(requested[0]).toContain("has-date");
  expect(requested[1]).toContain("no-date");
});

test("skips a malformed attachment without losing the rest of the batch", async () => {
  /* Fix round 1, item 3: document.filename is NOT NULL, so an attachment
   * SAM.gov returns without a name threw 23502 from inside a loop with no
   * try/catch -- taking out this solicitation's remaining attachments AND
   * every candidate after it. resourceId is unconstrained and fails more
   * quietly: it yields the well-formed URL `.../files/undefined/download`,
   * and a document row Task 10 fetches, fails, and marks failed forever.
   *
   * Two solicitations, not one, because the claim being pinned is about
   * the BATCH surviving, not just the attachment being skipped. */
  await resetSchema();
  await migrate(false);
  await seed({ title: "a", externalId: "aaa", closesAt: "2099-01-01" });
  await seed({ title: "b", externalId: "bbb", closesAt: "2099-01-02" });
  const malformed = {
    _embedded: {
      opportunityAttachmentList: [
        {
          attachments: [
            { resourceId: "r1", type: "file", fileExists: "1" }, // no name
            { name: "NoId.pdf", type: "file", fileExists: "1" }, // no resourceId
            { name: "Good.pdf", resourceId: "r3", type: "file", fileExists: "1" },
          ],
        },
      ],
    },
  };
  const stub = vi.fn(async () => new Response(JSON.stringify(malformed), { status: 200 }));

  const r = await discoverAttachments(10, stub as unknown as typeof fetch);

  expect(r.solicitations).toBe(2);
  expect(r.documents).toBe(2); // one good attachment from EACH solicitation
  const docs = await all<{ filename: string }>(`SELECT filename FROM document`);
  expect(docs.map((d) => d.filename)).toEqual(["Good.pdf", "Good.pdf"]);
});

test("counts a failed fetch as skipped and keeps going", async () => {
  /* Fix round 1, item 4: a THROWN fetch (DNS failure, connection reset)
   * used to kill the whole batch while a non-OK response merely skipped one
   * solicitation -- an inconsistency, not a deliberate distinction. Both
   * now skip one solicitation and are counted, which is what lets an
   * operator tell "nothing to fetch" (skipped 0) from "every request
   * failed" (skipped === solicitations).
   *
   * Also pins the ordering inside the loop: listing rows are written
   * BEFORE the fetch, so ground truth still lands for a solicitation whose
   * attachment request never succeeds. */
  await resetSchema();
  await migrate(false);
  await seed({ title: "a", externalId: "aaa", closesAt: "2099-01-01" });
  await seed({ title: "b", externalId: "bbb", closesAt: "2099-01-02" });
  await seed({ title: "c", externalId: "ccc", closesAt: "2099-01-03" });
  const stub = vi
    .fn(async (_url: string, _init?: RequestInit) => new Response("{}", { status: 200 }))
    .mockRejectedValueOnce(new TypeError("fetch failed"))
    .mockResolvedValueOnce(new Response("not json", { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(SAM_RESPONSE), { status: 200 }));

  const r = await discoverAttachments(10, stub as unknown as typeof fetch);

  expect(r.solicitations).toBe(3);
  expect(r.skipped).toBe(2); // the throw AND the unparseable body
  expect(r.documents).toBe(2); // only the third solicitation's attachments
  const listing = await all<{ c: string }>(
    `SELECT count(*) AS c FROM extracted_field WHERE origin = 'listing'`,
  );
  expect(Number(listing[0]?.c)).toBe(18); // six fields x three solicitations
});

test("never hands a non-SAM solicitation's external_id to the SAM.gov API", async () => {
  /* `solicitation` has no source column, so before the sighting predicate
   * this function selected EVERY portal's rows and posted their ids to a
   * federal API that has never heard of them. Measured on the live
   * database: 201 of 1,925 solicitations are corpus imports and ALL of
   * them carry a close date, while all 1,724 SAM.gov rows carry none -- so
   * `ORDER BY closes_at NULLS LAST` sorted every wrong-source row to the
   * FRONT. The first twenty batches of ten would have fetched nothing but
   * 404s, counted as `skipped`, looking like a network fault.
   *
   * The corpus-import row here is dated and the SAM row is not, which is
   * the real distribution -- so if the predicate is dropped, the wrong row
   * is not merely included, it is fetched FIRST. */
  await resetSchema();
  await migrate(false);
  await seed({
    title: "indiana one",
    externalId: "in-999",
    closesAt: "2099-01-01",
    source: "Corpus import — Indiana open (2026-08-04)",
  });
  await seed({ title: "sam one", externalId: "sam-111", closesAt: null });
  const stub = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(SAM_RESPONSE), { status: 200 }),
  );

  const r = await discoverAttachments(10, stub as unknown as typeof fetch);

  expect(r.solicitations).toBe(1);
  expect(stub).toHaveBeenCalledOnce();
  expect(String(stub.mock.calls[0]?.[0])).toContain("sam-111");
  /* And the wrong-source solicitation gets no ground-truth rows either --
   * listing values written from a candidate this function should never
   * have selected would be just as wrong as the fetch. */
  const listing = await all<{ c: string }>(
    `SELECT count(*) AS c FROM extracted_field ef
       JOIN solicitation s ON s.id = ef.solicitation_id
      WHERE ef.origin = 'listing' AND s.external_id = 'in-999'`,
  );
  expect(Number(listing[0]?.c)).toBe(0);
});

/* THE ORDERING CONSTRAINT, REMOVED RATHER THAN ENFORCED.
 *
 * merge.ts populates solicitation.closes_at; discover.ts copies it into a
 * listing row as ground truth. Nothing sequences them, and nothing can --
 * they are separate operations over a corpus that keeps arriving. Run in
 * the wrong order, discover records "the portal states no deadline" about a
 * notice whose deadline the portal has published all along, and CANDIDATES
 * never revisits a solicitation once it has documents, so that lie was
 * permanent.
 *
 * This is the exact shape of what happened on 2026-08-29: closes_at was null
 * on all 9,682 SAM.gov rows until closes-at.ts taught merge to read the
 * payload it was already holding. */
test("ground truth written before merge knew the deadline is corrected later", async () => {
  await resetSchema();
  await migrate(false);
  const sol = await seed({ title: "deadline not yet merged", externalId: "abc123", closesAt: null });
  const stub = vi.fn(async () => new Response(JSON.stringify(SAM_RESPONSE), { status: 200 }));

  const first = await discoverAttachments(10, stub as unknown as typeof fetch);
  expect(first.documents).toBe(2);
  const before = await all<{ value_text: string | null }>(
    `SELECT value_text FROM extracted_field
      WHERE solicitation_id = $1 AND origin = 'listing' AND field_name = 'closes_at'`,
    [sol],
  );
  expect(before[0]?.value_text).toBeNull();

  /* merge catches up, exactly as it did for 1,337 rows. */
  await run(`UPDATE solicitation SET closes_at = '2026-09-30' WHERE id = $1`, [sol]);

  const second = await discoverAttachments(10, stub as unknown as typeof fetch);

  /* CANDIDATES skips it -- it has documents now -- so the repair cannot come
   * from the main loop, and this asserts that rather than assuming it. */
  expect(second.solicitations).toBe(0);
  expect(second.refreshed).toBe(1);

  const after = await all<{ value_text: string | null }>(
    `SELECT value_text FROM extracted_field
      WHERE solicitation_id = $1 AND origin = 'listing' AND field_name = 'closes_at'`,
    [sol],
  );
  expect(after[0]?.value_text).toBe("2026-09-30");
});

/* A refresh that finds nothing wrong must write nothing, or every run would
 * churn rows it did not change and `refreshed` would count visits instead of
 * corrections. The DO UPDATE carries `WHERE ... IS DISTINCT FROM` for this. */
test("a refresh with nothing to correct writes nothing and reports nothing", async () => {
  await resetSchema();
  await migrate(false);
  await seed({ title: "settled", externalId: "abc123", closesAt: "2026-09-30" });
  const stub = vi.fn(async () => new Response(JSON.stringify(SAM_RESPONSE), { status: 200 }));

  await discoverAttachments(10, stub as unknown as typeof fetch);
  const second = await discoverAttachments(10, stub as unknown as typeof fetch);

  expect(second.refreshed).toBe(0);
});


/* ---- REVIEW ROUND, 2026-08-30 ----------------------------------------- */

/* REVIEW FINDING 2 (Major). `NOT EXISTS (document)` was the ONLY thing that
 * retired a candidate, and a notice that legitimately carries no attachments
 * never gets a document row -- so it qualified again on every run, forever,
 * and discovery could not advance past it. With the screen's `?limit=10`,
 * ten attachment-less notices at the head of the queue stall the phase
 * completely.
 *
 * The 2026-08-30 click-through reported exactly this -- "0 document(s) from
 * 10 solicitation(s), 0 skipped" -- and it was read as the benign case (no
 * files on those notices) when it was also the STUCK case. `skipped: 0`
 * proved the requests succeeded; nothing proved discovery could move on. */
test("a notice with no attachments is asked once, not on every run", async () => {
  await resetSchema();
  await migrate(false);
  await seed({
    title: "no files",
    externalId: "empty1",
    closesAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  const empty = vi.fn(async () => new Response(JSON.stringify({ _embedded: {} }), { status: 200 }));

  const first = await discoverAttachments(10, empty as unknown as typeof fetch);
  const second = await discoverAttachments(10, empty as unknown as typeof fetch);

  expect(first.solicitations).toBe(1);
  expect(first.documents).toBe(0);
  /* The whole point: the second run does not re-ask. */
  expect(second.solicitations).toBe(0);
  expect(empty).toHaveBeenCalledTimes(1);
});

/* THE OTHER HALF, and the reason the stamp is a column rather than a
 * predicate over the listing rows discover already writes. `writeListingRows`
 * runs BEFORE the fetch, so retiring on "listing rows exist" would retire a
 * notice whose attachment request merely FAILED -- a timeout, a 502, the
 * network -- permanently hiding its attachments on the strength of one bad
 * minute. Only a successful answer counts. */
test("a notice whose attachment request failed is asked again", async () => {
  await resetSchema();
  await migrate(false);
  await seed({
    title: "flaky",
    externalId: "flaky1",
    closesAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  const down = vi.fn(async () => new Response("nope", { status: 502 }));

  const first = await discoverAttachments(10, down as unknown as typeof fetch);
  const second = await discoverAttachments(10, down as unknown as typeof fetch);

  expect(first.skipped).toBe(1);
  expect(second.skipped).toBe(1);
  expect(down).toHaveBeenCalledTimes(2);
});

/* REVIEW FINDING 1 (Major). REFRESH carried CANDIDATES' `ORDER BY closes_at
 * ASC NULLS LAST` but NOT its live-deadline filter, so ascending order over
 * an unfiltered set puts the LONGEST-EXPIRED solicitations first -- the exact
 * inverse of the rule its own comment claims ("the ground truth that gets
 * refreshed first is the ground truth about to be used"). With a limit of
 * ten, run one repairs the ten oldest closed notices, the IS DISTINCT FROM
 * guard suppresses every later write, and the listing rows for LIVE
 * solicitations -- the only ones the accuracy measurement uses -- are never
 * repaired at all.
 *
 * Both fixtures already carry a document, so neither is a candidate: this
 * isolates REFRESH, which would otherwise be masked by the main loop
 * rewriting the live row anyway. */
test("refresh repairs a live solicitation before a long-closed one", async () => {
  await resetSchema();
  await migrate(false);
  const live = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const closedId = await seed({ title: "closed", externalId: "c1", closesAt: "2020-01-01" });
  const liveId = await seed({ title: "live", externalId: "l1", closesAt: live });

  for (const id of [closedId, liveId]) {
    await insert(
      `INSERT INTO document (solicitation_id, filename, source_url, extract_status)
       VALUES ($1, 'x.pdf', 'https://example.test/f', 'extracted') RETURNING id`,
      [id],
    );
    /* Ground truth written back when the portal carried no deadline -- the
     * real shape of the stale rows, since closes-at.ts only began reading
     * SAM deadlines on 2026-08-29. */
    await insert(
      `INSERT INTO extracted_field (solicitation_id, field_name, value_text, origin, confidence, produced_by)
       VALUES ($1, 'closes_at', NULL, 'listing', 1.0, 'mechanical') RETURNING id`,
      [id],
    );
  }

  const stub = vi.fn(async () => new Response("{}", { status: 200 }));
  await discoverAttachments(1, stub as unknown as typeof fetch);

  const value = async (id: number) =>
    (
      await all<{ value_text: string | null }>(
        `SELECT value_text FROM extracted_field
          WHERE solicitation_id = $1 AND origin = 'listing' AND field_name = 'closes_at'`,
        [id],
      )
    )[0]?.value_text ?? null;

  expect(await value(liveId)).toBe(live);
  expect(await value(closedId)).toBeNull();
});

/* REVIEW FINDING 5 (Medium). `/discover` had no time budget at all, while
 * the handler comment about budgets sat directly above it. Up to MAX_BATCH
 * (50) sequential fetches with no clock check runs past Vercel's 300s
 * ceiling on a slow day, and a killed request reports NOTHING -- the exact
 * failure RUN_HANDLER_BUDGET_MS exists to prevent, and the one the extract
 * phase was given a budget for. */
test("discover stops on its budget and reports only what it walked", async () => {
  await resetSchema();
  await migrate(false);
  for (let i = 0; i < 3; i++) {
    await seed({
      title: `s${i}`,
      externalId: `b${i}`,
      closesAt: new Date(Date.now() + (i + 1) * 86_400_000).toISOString(),
    });
  }
  const slow = vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 4000));
    return new Response(JSON.stringify({ _embedded: {} }), { status: 200 });
  });

  const r = await discoverAttachments(10, slow as unknown as typeof fetch, 3000);

  expect(slow).toHaveBeenCalledTimes(1);
  /* `solicitations` counts what was WALKED, not what the query selected --
   * otherwise a budget stop reports work it did not do. */
  expect(r.solicitations).toBe(1);
});

/* REVIEW ROUND 2, FINDING 4 (Medium). Stamping `attachments_checked_at` once
 * and never looking again retires a notice FOREVER -- including one amended
 * tomorrow with an SOW or a wage determination, which is ordinary on SAM.gov.
 * It also fails the `NOT EXISTS (document)` half the moment it has any
 * document, so nothing else would bring it back either. That is the same
 * "the portal changed its mind" case REFRESH exists for on the listing side,
 * with nothing analogous here.
 *
 * A bounded re-check window keeps the stall closed (a notice is not re-asked
 * on every click) without freezing it (it is re-asked tomorrow). */
test("a notice checked long enough ago is asked again; one checked just now is not", async () => {
  await resetSchema();
  await migrate(false);
  const stale = await seed({
    title: "amended since",
    externalId: "stale1",
    closesAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  const fresh = await seed({
    title: "just asked",
    externalId: "fresh1",
    closesAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  await run(`UPDATE solicitation SET attachments_checked_at = now() - interval '2 days' WHERE id = $1`, [stale]);
  await run(`UPDATE solicitation SET attachments_checked_at = now() WHERE id = $1`, [fresh]);

  /* The url parameter is declared so `mock.calls[0][0]` is a typed element
   * rather than an index into an empty tuple -- tsc rejects the latter, which
   * is the check catching a test that could not have asserted what it says. */
  const stub = vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify({ _embedded: {} }), { status: 200 }),
  );
  const r = await discoverAttachments(10, stub as unknown as typeof fetch);

  expect(r.solicitations).toBe(1);
  expect(stub).toHaveBeenCalledTimes(1);
  expect(String(stub.mock.calls[0]?.[0])).toContain("stale1");
});
