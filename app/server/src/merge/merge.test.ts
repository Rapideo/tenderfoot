import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_merge");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { all, one, run, close, pool } = await import("../db/index.js");
const { mergeSightings } = await import("./merge.js");

/* Counts every statement that reaches Postgres, by wrapping each client the
 * pool opens. A spy, not a stub: the real query still runs. Attached at
 * module level because `pool.on("connect")` fires at client CREATION and
 * beforeAll's migrate() creates the first one -- a listener registered
 * inside a test would observe nothing and count zero, which is
 * indistinguishable from a passing fix. */
const statements: string[] = [];
pool.on("connect", (client) => {
  const c = client as unknown as { query: (...a: any[]) => any };
  const orig = c.query.bind(c);
  c.query = (...a: any[]) => {
    statements.push(typeof a[0] === "string" ? a[0] : (a[0]?.text ?? ""));
    return orig(...a);
  };
});

let sourceA: number;
let sourceB: number;
/* The real registry name, seeded by migration 003 -- org-chain.ts is keyed
 * by it, so a test using a made-up source name would exercise the fallback
 * (empty chain) and prove nothing about the mapping. */
let sourceSam: number;

beforeAll(async () => {
  await migrate(false);
  await run(`INSERT INTO source (name, enabled) VALUES ('src-a', true), ('src-b', true)`);
  sourceA = (await one(`SELECT id FROM source WHERE name = 'src-a'`)).id;
  sourceB = (await one(`SELECT id FROM source WHERE name = 'src-b'`)).id;
  sourceSam = (await one(`SELECT id FROM source WHERE name = 'SAM.gov'`)).id;
}, 120000);
afterAll(async () => {
  await close();
});

async function sight(sourceId: number, externalId: string, title: string, seenAt: string) {
  await run(
    `INSERT INTO sighting (source_id, external_id, seen_at, raw, mode)
     VALUES ($1,$2,$3,$4,'mechanical')`,
    [sourceId, externalId, seenAt, JSON.stringify({ title })],
  );
}

/* THE SLICE'S DEMO CRITERION: the same solicitation, seen by two sources,
 * resolves to ONE canonical row. A triage queue that shows one opportunity
 * three times because three sources carry it is not a triage queue. */
test("the same external id from two sources resolves to one canonical row", async () => {
  await sight(sourceA, "SOL-1", "Nursing services", "2026-08-10T00:00:00Z");
  await sight(sourceB, "SOL-1", "Nursing services", "2026-08-11T00:00:00Z");

  const res = await mergeSightings();
  expect(res.created).toBe(1);

  expect((await one(`SELECT count(*) n FROM solicitation WHERE external_id = 'SOL-1'`)).n).toBe(1);
  expect(
    (await one(`SELECT count(*) n FROM sighting WHERE external_id = 'SOL-1' AND solicitation_id IS NOT NULL`)).n,
  ).toBe(2);
});

test("merging twice creates nothing new", async () => {
  const before = (await one(`SELECT count(*) n FROM solicitation`)).n;
  const res = await mergeSightings();
  expect(res.created).toBe(0);
  // A true no-op reports ALL THREE counters at zero, not merely `created`.
  // `updated` and `linked` were unchecked here originally, and that gap is
  // exactly how Fix round 1 Finding 1 -- a scoped call silently linking a
  // stale sighting without ever crediting an `updated` -- went unnoticed.
  expect(res.updated).toBe(0);
  expect(res.linked).toBe(0);
  expect((await one(`SELECT count(*) n FROM solicitation`)).n).toBe(before);
});

/* An amendment must read as a CHANGE, not a duplicate. The latest sighting
 * wins on the canonical row; the earlier one is retained. */
test("a later sighting updates the canonical row and both sightings survive", async () => {
  await sight(sourceA, "SOL-1", "Nursing services (amended)", "2026-08-14T00:00:00Z");
  const res = await mergeSightings();

  expect(res.updated).toBe(1);
  expect((await one(`SELECT title FROM solicitation WHERE external_id = 'SOL-1'`)).title).toBe(
    "Nursing services (amended)",
  );
  expect((await one(`SELECT count(*) n FROM sighting WHERE external_id = 'SOL-1'`)).n).toBe(3);
});

/* REGRESSION TEST, Fix round 1 Finding 1 (CRITICAL).
 *
 * Before this fix, a scoped call's `unlinked` count was computed from the
 * SAME source-filtered rowset used to pick which external_ids to process --
 * so once the calling source's own sightings were fully linked, a scoped
 * call believed there was nothing left to do for that external_id, even
 * when ANOTHER source had since produced a newer, still-unlinked sighting
 * for it. The title-update branch was skipped -- but the final link UPDATE
 * has no source filter and linked that stray sighting anyway. Once linked,
 * no future call, scoped or unscoped, would ever see it as unlinked again:
 * the canonical title never caught up, permanently.
 *
 * Sequence: source A is seen and merged (unscoped) to full linkage. Source B
 * then sees a LATER, differently-titled sighting for the same external_id.
 * A call scoped to source A -- which has nothing new -- must still pick up
 * source B's amendment, because within a group every source participates. */
test("a scoped merge still catches a later cross-source amendment (Finding 1 regression)", async () => {
  await sight(sourceA, "SOL-2", "Highway resurfacing", "2026-08-10T00:00:00Z");
  await mergeSightings(); // unscoped: creates the canonical row, fully linked

  await sight(sourceB, "SOL-2", "Highway resurfacing (amended)", "2026-08-12T00:00:00Z");
  const res = await mergeSightings(sourceA); // scoped to source A, which has nothing new

  expect(res.updated).toBe(1);
  expect((await one(`SELECT title FROM solicitation WHERE external_id = 'SOL-2'`)).title).toBe(
    "Highway resurfacing (amended)",
  );
  expect(
    (
      await one(
        `SELECT count(*) n FROM sighting WHERE external_id = 'SOL-2' AND source_id = $1 AND solicitation_id IS NOT NULL`,
        [sourceB],
      )
    ).n,
  ).toBe(1);
});

/* MERGE COST MUST NOT SCALE WITH THE NUMBER OF GROUPS.
 *
 * Measured on the first live run, 2026-08-16: 530 solicitations took 3m36s,
 * about 2.4/sec. The old shape opened a TRANSACTION PER GROUP -- BEGIN, one
 * or two writes, COMMIT -- and did so for every group the grouping query
 * returned, including groups already fully merged that needed no work at
 * all. So the cost tracked the size of the whole corpus on every run, not
 * the size of the new batch.
 *
 * The assertion is CONSTANCY, not smallness. A bound like `<= 10` passes for
 * any implementation whose constant happens to fit, and would keep passing
 * if cost quietly became proportional again with a small multiplier.
 * Merging 5 groups and then 25 must issue the SAME number of statements;
 * only a set-based implementation can do that. */
test("merge cost is CONSTANT in the number of groups, not proportional", async () => {
  for (let i = 0; i < 5; i++) {
    await sight(sourceA, `BULK1-${i}`, `Bulk one ${i}`, "2026-08-15T00:00:00Z");
  }
  statements.length = 0;
  const small = await mergeSightings();
  const smallStatements = statements.length;

  for (let i = 0; i < 25; i++) {
    await sight(sourceA, `BULK2-${i}`, `Bulk two ${i}`, "2026-08-15T00:00:00Z");
  }
  statements.length = 0;
  const large = await mergeSightings();
  const largeStatements = statements.length;

  /* The merge must actually have DONE the work -- five times as many groups
   * in the second batch. A no-op merge would issue a constant number of
   * statements too, and would be worthless. */
  expect(small.created).toBe(5);
  expect(large.created).toBe(25);

  expect(largeStatements).toBe(smallStatements);
  /* Generous timeout on purpose: the per-group version needs well over
   * vitest's 5s default for 30 groups, and a timeout is a weaker, vaguer
   * failure than the statement-count assertion this test exists to make. */
}, 120000);

async function sightRaw(sourceId: number, externalId: string, raw: unknown, seenAt: string) {
  await run(
    `INSERT INTO sighting (source_id, external_id, seen_at, raw, mode)
     VALUES ($1,$2,$3,$4,'mechanical')`,
    [sourceId, externalId, seenAt, JSON.stringify(raw)],
  );
}

/* WHO IS BUYING THIS. Every merged solicitation carried org_id NULL until
 * 2026-08-16 -- 530 of 788 production rows orphaned from the organisation
 * graph SP1 T10-T11 built, while the agency sat unread in the payload.
 *
 * The anchor is the DEEPEST node, not the department. Level 1 is
 * "DEPT OF DEFENSE", which 96% of a day's federal notices share and which
 * therefore tells a triage queue nothing; the chain is preserved through
 * parent_id, so a screen can always roll up. Losing the office is
 * irreversible, rolling up is not. */
test("a merged solicitation is attached to the organisation that issued it", async () => {
  await sightRaw(
    sourceSam,
    "ORG-1",
    {
      title: "Dredging services",
      organizationHierarchy: [
        { level: 1, name: "DEPT OF DEFENSE" },
        { level: 2, name: "DEPT OF THE NAVY" },
        { level: 3, name: "NAVSEA" },
      ],
    },
    "2026-08-16T00:00:00Z",
  );
  await mergeSightings();

  const row = await one<{ name: string }>(
    `SELECT o.name FROM solicitation s JOIN organization o ON o.id = s.org_id
      WHERE s.external_id = 'ORG-1'`,
  );
  expect(row?.name).toBe("NAVSEA");
});

/* The hierarchy is the reason organization.parent_id exists -- its own
 * schema comment reads "State -> FSSA -> Division". SAM hands us that shape
 * ready-made and it was being thrown away. */
test("the organisation hierarchy is preserved as a parent chain", async () => {
  const chain = await all<{ name: string; parent: string | null }>(
    `WITH RECURSIVE up AS (
       SELECT o.id, o.name, o.parent_id FROM solicitation s
         JOIN organization o ON o.id = s.org_id WHERE s.external_id = 'ORG-1'
       UNION ALL
       SELECT p.id, p.name, p.parent_id FROM organization p JOIN up ON p.id = up.parent_id
     )
     SELECT up.name, (SELECT name FROM organization WHERE id = up.parent_id) AS parent FROM up`,
  );
  expect(chain.map((c) => c.name)).toEqual(["NAVSEA", "DEPT OF THE NAVY", "DEPT OF DEFENSE"]);
  expect(chain[chain.length - 1]?.parent).toBeNull();
});

/* A REAL QUIRK IN REAL DATA, found in production on the first live run:
 * one DLA record repeats a name at two levels --
 * [DEPT OF DEFENSE, DEFENSE LOGISTICS AGENCY, DLA AVIATION, DLA AV RICHMOND,
 * DLA AVIATION]. Identity is name-only, matching upsertOrg, so a naive walk
 * makes that row its own grandparent: a cycle, and the recursive query above
 * would never terminate. */
test("a repeated name in the hierarchy does not become its own ancestor", async () => {
  await sightRaw(
    sourceSam,
    "ORG-2",
    {
      title: "Aviation parts",
      organizationHierarchy: [
        { level: 1, name: "DEPT OF DEFENSE" },
        { level: 2, name: "DEFENSE LOGISTICS AGENCY" },
        { level: 3, name: "DLA AVIATION" },
        { level: 4, name: "DLA AV RICHMOND" },
        { level: 5, name: "DLA AVIATION" },
      ],
    },
    "2026-08-16T00:00:00Z",
  );
  await mergeSightings();

  const self = await one<{ n: number }>(
    `SELECT count(*) n FROM organization WHERE parent_id = id`,
  );
  expect(self?.n).toBe(0);

  const row = await one<{ name: string }>(
    `SELECT o.name FROM solicitation s JOIN organization o ON o.id = s.org_id
      WHERE s.external_id = 'ORG-2'`,
  );
  /* The repeat is dropped, so the deepest DISTINCT node anchors it. */
  expect(row?.name).toBe("DLA AV RICHMOND");
});

/* The 530 production rows already merged with org_id NULL must be repaired
 * by a re-run, not left behind. Their sightings are fully linked, so the
 * "is there unlinked work" test that drives the rest of the merge says no --
 * a solicitation missing its organisation is its own reason to do work. */
test("an already-merged solicitation with no organisation gets one on the next merge", async () => {
  await sightRaw(
    sourceSam,
    "ORG-3",
    { title: "Legacy row", organizationHierarchy: [{ level: 1, name: "DEPT OF STATE" }] },
    "2026-08-16T00:00:00Z",
  );
  await mergeSightings();
  await run(`UPDATE solicitation SET org_id = NULL WHERE external_id = 'ORG-3'`);

  const res = await mergeSightings();
  expect(res.orgsAttached).toBe(1);

  const row = await one<{ name: string }>(
    `SELECT o.name FROM solicitation s JOIN organization o ON o.id = s.org_id
      WHERE s.external_id = 'ORG-3'`,
  );
  expect(row?.name).toBe("DEPT OF STATE");
});

/* THE DEADLINE, on the same argument as the organisation above and with a
 * worse starting position: 9,682 of 9,682 production SAM.gov solicitations
 * carried closes_at NULL while every stored payload held the date. Nothing
 * read it, because merge only ever read the title. SP4's accuracy query
 * treats the listing as ground truth ONLY where it states a value, so with
 * closes_at null everywhere the measurement had nothing to measure at all.
 *
 * These rows are fully linked and have an organisation, so every other
 * branch of the merge loop skips them -- which is exactly why this is
 * tested against an ALREADY-MERGED row rather than a fresh insert. */
test("an already-merged solicitation with no deadline gets one on the next merge", async () => {
  await sightRaw(
    sourceSam,
    "DUE-1",
    {
      title: "Deadline in the payload all along",
      responseDate: "2026-09-02T03:59:00+00:00",
      responseDateActual: "2026-09-01T23:59:00-04:00",
      responseTimeZone: "America/New_York",
      organizationHierarchy: [{ level: 1, name: "DEPT OF STATE" }],
    },
    "2026-08-20T00:00:00Z",
  );
  await mergeSightings();
  await run(`UPDATE solicitation SET closes_at = NULL WHERE external_id = 'DUE-1'`);

  const res = await mergeSightings();
  expect(res.deadlinesSet).toBe(1);

  /* The LOCAL day, not the UTC one. This payload is the real evening-deadline
   * shape: 23:59 Eastern on the 1st is 03:59 UTC on the 2nd, and reading the
   * UTC field would record the deadline a day late. */
  const row = await one<{ closes_at: string }>(
    `SELECT closes_at FROM solicitation WHERE external_id = 'DUE-1'`,
  );
  expect(row?.closes_at).toBe("2026-09-01");
});

/* A steady-state run must not rewrite rows that already agree, or every
 * merge would report work it did not do and dirty rows it did not change.
 * The guard is IS DISTINCT FROM rather than <>, because <> against a NULL
 * closes_at yields NULL and updates nothing at all. */
test("a merge that changes no deadline reports none and writes none", async () => {
  const res = await mergeSightings();
  expect(res.deadlinesSet).toBe(0);
});

/* Corpus imports set closes_at at ingest and closesAt() returns null for
 * them, so they must be left exactly as they are -- not blanked by a source
 * whose payload this reader cannot parse. */
test("a source with no readable deadline never clears one that exists", async () => {
  await sight(sourceA, "KEEP-1", "Has a deadline from ingest", "2026-08-21T00:00:00Z");
  await mergeSightings();
  await run(`UPDATE solicitation SET closes_at = '2027-01-15' WHERE external_id = 'KEEP-1'`);

  await mergeSightings();

  const row = await one<{ closes_at: string }>(
    `SELECT closes_at FROM solicitation WHERE external_id = 'KEEP-1'`,
  );
  expect(row?.closes_at).toBe("2027-01-15");
});


/* THE POSTING DATE. Second instance of the exact defect closes-at.ts was built
 * for: merge wrote four columns and posted_at was not one of them, so no
 * live-ingested row on any branch ever had one -- and volume per source per
 * week, half of what Plan of Action §6 requires this gate to produce, could
 * not be computed at all. */
test("merge reads the posting date out of the payload, on insert and on backfill", async () => {
  const raw = {
    noticeId: "POSTED-1",
    title: "Posting date fixture",
    publishDate: "2026-08-18T21:07:27+00:00",
    responseDateActual: "2026-09-01T23:59:00-04:00",
  };
  await sightRaw(sourceSam, "POSTED-1", raw, "2026-08-19T00:00:00Z");
  await mergeSightings();

  const row = await one<{ posted_at: string; posted_at_origin: string; closes_at: string }>(
    `SELECT posted_at, posted_at_origin, closes_at FROM solicitation WHERE external_id = 'POSTED-1'`,
  );
  /* A bare YYYY-MM-DD, matching the column's existing shape. */
  expect(row?.posted_at).toBe("2026-08-18");
  expect(row?.closes_at).toBe("2026-09-01");
  /* SAM.gov PUBLISHES this date -- it is migration 016's 'published' case,
   * not a date derived from when we merely saw the row. */
  expect(row?.posted_at_origin).toBe("published");

  /* BACKFILL. The rows that need this most were merged before it existed --
   * they have an organisation and nothing unlinked, so every other branch
   * skips them. Null BOTH columns and re-merge: they must come back together
   * -- migration 016's CHECK constraint refuses posted_at_origin alone to
   * survive a null posted_at, so a fix that forgot to null it here would fail
   * this setup step outright, not the assertion. */
  await run(
    `UPDATE solicitation SET posted_at = NULL, posted_at_origin = NULL WHERE external_id = 'POSTED-1'`,
  );
  const again = await mergeSightings();
  expect(again.postedSet).toBeGreaterThanOrEqual(1);

  const back = await one<{ posted_at: string; posted_at_origin: string }>(
    `SELECT posted_at, posted_at_origin FROM solicitation WHERE external_id = 'POSTED-1'`,
  );
  expect(back?.posted_at).toBe("2026-08-18");
  expect(back?.posted_at_origin).toBe("published");
});

/* A source with no posting date to read must be left alone, not given a
 * plausible-looking one. USASpending reports AWARDS: action_date is when an
 * award was made, and dressing that as a posting date would make a volume
 * series measure two different things under one label. */
test("a source with no posting date is left null rather than guessed at", async () => {
  await sightRaw(
    sourceA,
    "NO-POSTED-1",
    { title: "No posting date here", action_date: "2026-08-01" },
    "2026-08-19T00:00:00Z",
  );
  await mergeSightings();
  const row = await one<{ posted_at: string | null; posted_at_origin: string | null }>(
    `SELECT posted_at, posted_at_origin FROM solicitation WHERE external_id = 'NO-POSTED-1'`,
  );
  expect(row?.posted_at).toBeNull();
  /* A provenance for a date that does not exist would be inventing the thing
   * this column exists to prevent -- see migration 016's own comment. */
  expect(row?.posted_at_origin).toBeNull();
});

/* THE CHECK CONSTRAINT ITSELF (migration 016). Half of what this migration
 * delivers is the column; the other half is that a date can never exist
 * without saying where it came from. A test that only exercises the happy
 * path above would still pass if this constraint were dropped -- this one
 * would not. */
test("the CHECK constraint rejects a posted_at with no origin", async () => {
  await expect(
    run(
      `INSERT INTO solicitation (external_id, title, source_id, posted_at, posted_at_origin)
       VALUES ('CHECK-NO-ORIGIN', 'CHECK constraint fixture', $1, '2026-01-01', NULL)`,
      [sourceSam],
    ),
  ).rejects.toThrow(/solicitation_posted_at_origin_valid/);
});

/* The mirror image: an origin recorded for a date that was never set is the
 * same defect from the other side, and the same constraint refuses it. */
test("the CHECK constraint rejects an origin with no posted_at", async () => {
  await expect(
    run(
      `INSERT INTO solicitation (external_id, title, source_id, posted_at, posted_at_origin)
       VALUES ('CHECK-NO-DATE', 'CHECK constraint fixture', $1, NULL, 'published')`,
      [sourceSam],
    ),
  ).rejects.toThrow(/solicitation_posted_at_origin_valid/);
});

/* And an origin outside the two allowed values is rejected too -- the CHECK
 * is a closed set, not merely "non-null". */
test("the CHECK constraint rejects an origin value that isn't published or observed", async () => {
  await expect(
    run(
      `INSERT INTO solicitation (external_id, title, source_id, posted_at, posted_at_origin)
       VALUES ('CHECK-BAD-ORIGIN', 'CHECK constraint fixture', $1, '2026-01-01', 'guessed')`,
      [sourceSam],
    ),
  ).rejects.toThrow(/solicitation_posted_at_origin_valid/);
});

/* THE THIRD INSTANCE, and the largest: five columns null on 1,724 of 1,724
 * SAM.gov rows while the payload filling three of them sat unread in
 * `sighting.raw`. STATUS predicted this one -- "assume a third instance exists
 * until someone looks" -- and it was found on 2026-09-01 by looking.
 *
 * Insert AND backfill, exactly as the posting-date test above, because the
 * rows that need it most have an organisation and nothing unlinked, so every
 * other branch of the merge skips them. */
test("merge reads kind, codes and set-aside out of the payload, on insert and on backfill", async () => {
  const raw = {
    noticeId: "FACTS-1",
    title: "Listing facts fixture",
    type: { code: "o", value: "Combined Synopsis/Solicitation" },
    naics: [{ code: "541611" }],
    psc: [{ code: "R410" }, { code: null }],
    solicitation: { setAside: { code: "SBA" }, originalSetAside: { code: "NONE" } },
  };
  await sightRaw(sourceSam, "FACTS-1", raw, "2026-08-19T00:00:00Z");
  await mergeSightings();

  const row = await one<{ kind: string; codes: unknown; set_aside: string }>(
    `SELECT kind, codes, set_aside FROM solicitation WHERE external_id = 'FACTS-1'`,
  );
  /* ⚖️ SAM's own word, per Matt's ruling 2026-09-01 -- NOT mapped to RFP. */
  expect(row?.kind).toBe("Combined Synopsis/Solicitation");
  /* The null psc code is dropped rather than carried as an entry. */
  /* WIDENED 2026-09-02: `codes` now carries the human-readable labels
   * alongside the codes, because the triage card showed nothing about what a
   * notice IS and "541611" only helps a reader who knows it by heart. The
   * fixture's naics entry has no `value`, so its label list is empty here --
   * which is the point of keeping the two lists independent rather than
   * zipping them into pairs. See listing-facts.ts. */
  expect(row?.codes).toEqual({
    naics: ["541611"],
    psc: ["R410"],
    naics_labels: [],
    psc_labels: [],
  });
  /* The current set-aside, not the superseded originalSetAside. */
  expect(row?.set_aside).toBe("SBA");

  await run(
    `UPDATE solicitation SET kind = NULL, codes = NULL, set_aside = NULL
      WHERE external_id = 'FACTS-1'`,
  );
  const again = await mergeSightings();
  expect(again.kindsSet).toBeGreaterThanOrEqual(1);
  expect(again.codesSet).toBeGreaterThanOrEqual(1);
  expect(again.setAsidesSet).toBeGreaterThanOrEqual(1);

  const back = await one<{ kind: string; codes: unknown; set_aside: string }>(
    `SELECT kind, codes, set_aside FROM solicitation WHERE external_id = 'FACTS-1'`,
  );
  expect(back?.kind).toBe("Combined Synopsis/Solicitation");
  /* Same widening as the insert assertion above -- this is the BACKFILL half
   * of the same test, and it has to agree with it. */
  expect(back?.codes).toEqual({
    naics: ["541611"],
    psc: ["R410"],
    naics_labels: [],
    psc_labels: [],
  });
  expect(back?.set_aside).toBe("SBA");
});

/* ⚠️ THE TWO COLUMNS THAT STAY NULL, asserted so they cannot be quietly
 * filled later without someone meeting the reasoning.
 *
 * `status` carries no information from this source: the adapter requests
 * is_active=true, and isCanceled measured false on 1,724 of 1,724. A column
 * holding one value forever is noise dressed as data.
 *
 * `value_cents` is NOT in the listing. SAM publishes `award.amount`, present
 * on 361 rows -- tracking the 359 whose type is "Award Notice" almost exactly.
 * It is what somebody ALREADY WON. Reading it into value_cents would put award
 * amounts on solicitations and make every value-weighted number wrong
 * invisibly. This test pins that it is not read. */
test("status and value_cents are left null, even when the payload could tempt you", async () => {
  const raw = {
    noticeId: "FACTS-2",
    title: "Award notice fixture",
    type: { value: "Award Notice" },
    isActive: true,
    isCanceled: false,
    award: { amount: "4100000", date: "2026-08-01", number: "W519-26-C-0001" },
  };
  await sightRaw(sourceSam, "FACTS-2", raw, "2026-08-19T00:00:00Z");
  await mergeSightings();

  const row = await one<{ status: string | null; value_cents: string | null; kind: string }>(
    `SELECT status, value_cents, kind FROM solicitation WHERE external_id = 'FACTS-2'`,
  );
  expect(row?.status).toBeNull();
  expect(row?.value_cents).toBeNull();
  /* But the notice type IS read -- which is what makes an award notice
   * identifiable in the queue at all. Ruled 2026-09-01: they are NOT
   * filtered out (spec §1.1), so being able to see them is the whole point. */
  expect(row?.kind).toBe("Award Notice");
});
