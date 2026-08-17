import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_merge");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { one, run, close, pool } = await import("../db/index.js");
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

beforeAll(async () => {
  await migrate(false);
  await run(`INSERT INTO source (name, enabled) VALUES ('src-a', true), ('src-b', true)`);
  sourceA = (await one(`SELECT id FROM source WHERE name = 'src-a'`)).id;
  sourceB = (await one(`SELECT id FROM source WHERE name = 'src-b'`)).id;
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
