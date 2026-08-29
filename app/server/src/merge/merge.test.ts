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

