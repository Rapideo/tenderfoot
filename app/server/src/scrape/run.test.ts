import { expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runScrape } from "./run.js";
import { fakeAdapter } from "./adapters/fake.js";
import { readArtifact } from "./artifact.js";
import { validateRun } from "./contract.js";
import type { WindowedAdapter } from "./adapter.js";

function tmpPath() {
  return join(mkdtempSync(join(tmpdir(), "tf-run-")), "run.db");
}

/* Task 4 (spec §4, §4.1): a stub SnapshotAdapter that walks a fixed list of
 * pages, mirroring fakeAdapter's role for the windowed tests above. */
function stubSnapshot(pages: Array<{ ids: string[]; next: string | null }>) {
  let i = 0;
  return {
    shape: "snapshot" as const,
    name: "stub-snap",
    async fetchSnapshot(_cursor: string | null) {
      const p = pages[i++]!;
      return {
        items: p.ids.map((id) => ({ externalId: id, raw: { id } })),
        nextCursor: p.next,
        requestUrl: "https://example.test/page",
        httpStatus: 200,
        payload: JSON.stringify(p.ids),
      };
    },
  };
}

test("a snapshot run walks its pages and reports no resume marker", async () => {
  const adapter = stubSnapshot([
    { ids: ["a", "b"], next: "p2" },
    { ids: ["c"], next: null },
  ]);
  const res = await runScrape(
    { source: "stub-snap", depth: "listing", budgetMs: 60_000 },
    adapter,
    tmpPath(),
  );
  expect(res.rows).toBe(3);
  expect(res.done).toBe(true);
  /* There is no window to narrow, so there is nothing to resume FROM.
   * A date here would be an invented one. */
  expect(res.nextUntil).toBeNull();
  expect(res.noProgress).toBe(false);
});

test("a partial snapshot run does not offer a resume it cannot honour", async () => {
  const adapter = stubSnapshot([{ ids: ["a"], next: "p2" }]);
  const res = await runScrape(
    { source: "stub-snap", depth: "listing", budgetMs: 0 },
    adapter,
    tmpPath(),
  );
  expect(res.done).toBe(false);
  expect(res.nextUntil).toBeNull();
});

/* Backfills a gap left by Task 4: `runSnapshot`'s row-counting limit
 * enforcement (run.ts) shipped with no test exercising it at all -- Task 3
 * only tested that `limit` survives contract validation (contract.test.ts),
 * never that a run actually stops there. Added here, alongside Task 5's
 * windowed counterpart, so this file's mutation proof has something real to
 * fail on both sides of the shape dispatch. */
test("limit stops a snapshot run at the requested number of rows", async () => {
  const adapter = stubSnapshot([{ ids: ["a", "b", "c"], next: null }]);
  const res = await runScrape(
    { source: "stub-snap", depth: "listing", budgetMs: 60_000, limit: 2 },
    adapter,
    tmpPath(),
  );
  expect(res.rows).toBe(2);
  /* The budget is a platform rail; the limit is operator intent. Hitting
   * the limit is a completed request, not a truncated one. */
  expect(res.done).toBe(true);
});

test("a run that fits reports done and no next_until", async () => {
  const p = tmpPath();
  const req = validateRun({ source: "fake", since: "2026-01-01", depth: "listing" }, "windowed");
  const res = await runScrape(req, fakeAdapter(5, 2), p);
  expect(res.done).toBe(true);
  expect(res.nextUntil).toBeNull();
  expect(res.rows).toBe(5);
  expect(readArtifact(p).run.outcome).toBe("complete");
});

/* The whole point of checkpointing: a scope larger than the budget must
 * resume rather than die mid-write (spec §5).
 *
 * PROOF STEP (2026-08-15 correction): the fake adapter pages descending --
 * newest modifiedAt first, mirroring the real source (see fake.ts). Under
 * that ordering the correct resume marker is the MINIMUM modifiedAt among
 * items actually written -- i.e. the oldest item in the last committed
 * page -- not the maximum. A `not.toBeNull()` check cannot distinguish
 * "tracks max" from "tracks min"; this test asserts the actual value so it
 * would have caught the direction defect. */
test("a run that exhausts its budget commits what it has and reports a resume marker", async () => {
  const p = tmpPath();
  const req = validateRun({ source: "fake", since: "2026-01-01", depth: "listing", budgetMs: 1 }, "windowed");
  let t = 0;
  const clock = () => (t += 10); // every check advances past the 1ms budget
  const res = await runScrape(req, fakeAdapter(100, 2), p, clock);

  expect(res.done).toBe(false);
  expect(res.rows).toBeGreaterThan(0);
  expect(res.rows).toBeLessThan(100);

  const out = readArtifact(p);
  expect(out.run.outcome).toBe("partial");
  expect(out.sightings).toHaveLength(res.rows);

  /* The fixture descends monotonically with index, so the oldest item
   * actually written is the one with the highest index, i.e. the last
   * sighting row (sightings are written in fetch order). */
  const oldestWritten = out.sightings[out.sightings.length - 1].external_id;
  const oldestIndex = Number(oldestWritten.replace("fake-", ""));
  const expectedNextUntil = new Date(
    Date.parse("2026-08-15T00:00:00.000Z") - oldestIndex * 1000,
  ).toISOString();

  expect(res.nextUntil).toBe(expectedNextUntil);
  /* FIX 5 regression guard: this IS real progress (the fixture's index-1
   * spacing means lowWater always lands strictly below `until`), so
   * noProgress must read false here -- a false positive on an ordinary
   * checkpoint-and-resume run would be its own kind of defect. */
  expect(res.noProgress).toBe(false);
});

/* FIX ROUND 1 on Task 7, Finding 3: this same "resume doesn't make forward
 * progress" defect has now been found twice, once in run.ts's resume-marker
 * DIRECTION (fixed 2026-08-15, see the module header above) and once in
 * sam.ts's window, which was bounded only below (fixed in this round). Both
 * are the same class of bug and no per-layer unit test can catch it, because
 * resume is a property of TWO invocations in sequence: whatever an adapter
 * returns for a single call always looks fine in isolation.
 *
 * This test drives two real `runScrape` invocations back to back, exactly
 * as an operator resuming a scrape would: same `since`, second run's
 * `until` set to the first run's `nextUntil`, cursor reset to null (a
 * fresh process invocation never carries a page cursor across runs -- see
 * sam.ts's Finding 1 comment for why persisting one would be WRONG, not
 * just unimplemented).
 *
 * REPRODUCING THE DEFECT WITHOUT A NETWORK: fakeAdapter's own fetch is
 * synchronous and free, so a plain per-page synthetic clock (as used
 * above) can't distinguish "the adapter re-returned an already-covered
 * page" from "it correctly skipped straight past it" -- paging is
 * positional either way, so the same NUMBER of pages get fetched
 * regardless. What actually starves a resumed run is real work: writing
 * every re-matched record back into the artifact costs real time, and that
 * time is what a broken (unbounded-above) filter wastes. `withWriteCost`
 * below simulates that specific, real cost -- proportional to how many
 * items an adapter call actually returns -- and feeds it to `runScrape`'s
 * injected clock, so a resumed run that re-returns an already-covered page
 * genuinely does run its budget down before reaching new ground, exactly
 * as it would with a real artifact writer and real wall-clock time. This
 * makes the defect and its fix observable deterministically, without any
 * dependence on real timing. */
function withWriteCost(
  adapter: WindowedAdapter,
  elapsed: { value: number },
  msPerItem: number,
): WindowedAdapter {
  return {
    shape: "windowed",
    name: adapter.name,
    async fetchListing(since, until, cursor) {
      const page = await adapter.fetchListing(since, until, cursor);
      elapsed.value += page.items.length * msPerItem;
      return page;
    },
  };
}

test("two sequential runs resume correctly: the second reaches new ground and the union has no gap", async () => {
  const since = "2000-01-01T00:00:00.000Z";
  const TOTAL = 25;
  const PAGE_SIZE = 10;
  const MS_PER_ITEM = 10;
  // Between one page's cost bounded-above (1 boundary-duplicate item: 10ms)
  // and one page's cost unbounded (10 items: 100ms). An adapter that
  // correctly excludes already-covered records fits a second page inside
  // this budget; one that doesn't, does not.
  const BUDGET_MS = 50;

  const run1Path = tmpPath();
  const elapsed1 = { value: 0 };
  const req1 = validateRun({
    source: "fake",
    since,
    until: "2026-12-31T00:00:00.000Z",
    depth: "listing",
    budgetMs: BUDGET_MS,
  }, "windowed");
  const res1 = await runScrape(
    req1,
    withWriteCost(fakeAdapter(TOTAL, PAGE_SIZE), elapsed1, MS_PER_ITEM),
    run1Path,
    () => elapsed1.value,
  );
  expect(res1.done).toBe(false);
  expect(res1.nextUntil).not.toBeNull();
  const ids1 = readArtifact(run1Path).sightings.map((s: { external_id: string }) => s.external_id);
  expect(ids1.length).toBeGreaterThan(0);

  // Resume: same `since`, `until` lowered to the first run's resume marker.
  const run2Path = tmpPath();
  const elapsed2 = { value: 0 };
  const req2 = validateRun({
    source: "fake",
    since,
    until: res1.nextUntil as string,
    depth: "listing",
    budgetMs: BUDGET_MS,
  }, "windowed");
  const res2 = await runScrape(
    req2,
    withWriteCost(fakeAdapter(TOTAL, PAGE_SIZE), elapsed2, MS_PER_ITEM),
    run2Path,
    () => elapsed2.value,
  );
  const ids2 = readArtifact(run2Path).sightings.map((s: { external_id: string }) => s.external_id);

  // The second run must reach new ground -- not just re-tread the first
  // run's pages under a fresh, cursor-reset invocation.
  const newIds = ids2.filter((id) => !ids1.includes(id));
  expect(newIds.length).toBeGreaterThan(0);

  // The union must cover the corpus with no gap: every index from the
  // newest (0) down to the oldest one actually written must be present.
  const indices = [...new Set([...ids1, ...ids2])]
    .map((id) => Number(id.replace("fake-", "")))
    .sort((a, b) => a - b);
  expect(indices[0]).toBe(0);
  for (let i = 1; i < indices.length; i++) {
    expect(indices[i]).toBe(indices[i - 1]! + 1);
  }
});

/* FIX 4 (final review, 2026-08-15): adapter.ts promises undated records are
 * "visible rather than silent" (§5.4), but run.ts never read
 * `page.undatedSkipped` -- it reached neither RunResult, the artifact, the
 * CLI output, nor the response headers. This adapter fixture returns two
 * pages, each reporting a nonzero `undatedSkipped`, so the fix under test
 * is specifically the ACCUMULATION across pages, not just a single read. */
function undatedFixtureAdapter(): WindowedAdapter {
  let called = 0;
  return {
    shape: "windowed",
    name: "undated-fixture",
    async fetchListing(): Promise<import("./adapter.js").ListingPage> {
      called++;
      if (called === 1) {
        return {
          items: [{ externalId: "u-1", modifiedAt: "2026-08-10T00:00:00.000Z", raw: {} }],
          nextCursor: "2",
          requestUrl: "fake://undated?page=1",
          httpStatus: 200,
          payload: "{}",
          undatedSkipped: 2,
        };
      }
      return {
        items: [{ externalId: "u-2", modifiedAt: "2026-08-09T00:00:00.000Z", raw: {} }],
        nextCursor: null,
        requestUrl: "fake://undated?page=2",
        httpStatus: 200,
        payload: "{}",
        undatedSkipped: 1,
      };
    },
  };
}

test("undatedSkipped is accumulated across pages, onto RunResult and the artifact", async () => {
  const p = tmpPath();
  const req = validateRun({ source: "fake", since: "2026-01-01", depth: "listing" }, "windowed");
  const res = await runScrape(req, undatedFixtureAdapter(), p);

  expect(res.done).toBe(true);
  expect(res.undatedSkipped).toBe(3); // 2 + 1 across the two pages

  const out = readArtifact(p);
  expect(out.run.undated_skipped).toBe(3);
});

test("a run with no undated records reports undatedSkipped: 0, not undefined", async () => {
  const p = tmpPath();
  const req = validateRun({ source: "fake", since: "2026-01-01", depth: "listing" }, "windowed");
  const res = await runScrape(req, fakeAdapter(3, 3), p);
  expect(res.undatedSkipped).toBe(0);
  expect(readArtifact(p).run.undated_skipped).toBe(0);
});

/* FIX 5 (Critical, final review 2026-08-15): SAM's modifiedDate is
 * second-precision, and a bulk re-index can tie many records to the exact
 * same timestamp -- the captured fixture has 3 of 5 sharing one value.
 * `nextUntil` is the INCLUSIVE minimum, so an invocation whose `until` is
 * set to that tied value re-admits the ENTIRE tie block. If the block is
 * wider than one invocation's budget, `lowWater` computes to the SAME
 * value again -- this run's own `nextUntil` never gets strictly below the
 * `until` it was handed -- and re-invoking with that marker would re-fetch
 * and re-write the identical prefix forever while reporting done: false,
 * looking exactly like ordinary (slow but working) checkpoint-and-resume.
 *
 * This fixture reproduces that shape directly: page 0 returns three items
 * that all share modifiedAt === the `until` this invocation was given (so
 * their inclusion is legitimate -- the window filter is `<= until`), and
 * the budget is set to trip after that one page commits, before page 1
 * (whose items are NOT tied and WOULD make real progress) is ever
 * fetched. */
function tieBlockAdapter(): WindowedAdapter {
  const TIE = "2026-08-10T00:00:00.000Z";
  return {
    shape: "windowed",
    name: "tie-block-fixture",
    async fetchListing(_since, _until, cursor): Promise<import("./adapter.js").ListingPage> {
      const page = cursor ? Number(cursor) : 0;
      if (page === 0) {
        return {
          items: [
            { externalId: "t-1", modifiedAt: TIE, raw: {} },
            { externalId: "t-2", modifiedAt: TIE, raw: {} },
            { externalId: "t-3", modifiedAt: TIE, raw: {} },
          ],
          nextCursor: "1",
          requestUrl: "fake://tie?page=0",
          httpStatus: 200,
          payload: "{}",
        };
      }
      // Real, older ground -- reachable only if the run gets past page 0.
      return {
        items: [
          { externalId: "t-4", modifiedAt: "2026-08-09T00:00:00.000Z", raw: {} },
          { externalId: "t-5", modifiedAt: "2026-08-08T00:00:00.000Z", raw: {} },
        ],
        nextCursor: null,
        requestUrl: "fake://tie?page=1",
        httpStatus: 200,
        payload: "{}",
      };
    },
  };
}

/* Task 5 (spec §5): `limit` applies to the windowed path too, not just
 * `runSnapshot`. `d` and `stubWindowed` mirror `stubSnapshot`'s role above
 * -- a fixed list of pages walked by position -- for a WindowedAdapter. No
 * test here exercises since/until filtering (fakeAdapter and the fixtures
 * above already do), so `stubWindowed` ignores those arguments. */
function d(id: string, modifiedAt: string) {
  return { externalId: id, modifiedAt, raw: {} };
}

function stubWindowed(pages: Array<{ items: ReturnType<typeof d>[]; next: string | null }>): WindowedAdapter {
  let i = 0;
  return {
    shape: "windowed" as const,
    name: "stub-windowed",
    async fetchListing(_since, _until, _cursor) {
      const p = pages[i++]!;
      return {
        items: p.items,
        nextCursor: p.next,
        requestUrl: "https://example.test/listing",
        httpStatus: 200,
        payload: JSON.stringify(p.items),
      };
    },
  };
}

test("limit stops a windowed run at the requested number of rows", async () => {
  const adapter = stubWindowed([
    { items: [d("a", "2026-01-03"), d("b", "2026-01-02"), d("c", "2026-01-01")], next: null },
  ]);
  const res = await runScrape(
    { source: "stub", since: "2026-01-01", until: "2026-01-04", depth: "listing", budgetMs: 60_000, limit: 2 },
    adapter,
    tmpPath(),
  );
  expect(res.rows).toBe(2);
  /* The budget is a platform rail; the limit is operator intent. Hitting the
   * limit is a completed request, not a truncated one. */
  expect(res.done).toBe(true);
});

test("a tie block wider than the budget is reported as noProgress, not a silent resume", async () => {
  const p = tmpPath();
  const TIE = "2026-08-10T00:00:00.000Z";
  const req = validateRun({
    source: "fake",
    since: "2026-01-01",
    until: TIE,
    depth: "listing",
    budgetMs: 1,
  }, "windowed");
  let t = 0;
  const clock = () => (t += 10); // trips the 1ms budget check after page 0 commits

  const res = await runScrape(req, tieBlockAdapter(), p, clock);

  expect(res.done).toBe(false);
  // The entire page was tied to the window ceiling -- lowWater cannot land
  // below `until`, which is exactly the livelock condition.
  expect(res.nextUntil).toBe(TIE);
  expect(res.noProgress).toBe(true);
});
