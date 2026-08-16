import { expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runScrape } from "./run.js";
import { fakeAdapter } from "./adapters/fake.js";
import { readArtifact } from "./artifact.js";
import { validateRun } from "./contract.js";
import type { Adapter } from "./adapter.js";

function tmpPath() {
  return join(mkdtempSync(join(tmpdir(), "tf-run-")), "run.db");
}

test("a run that fits reports done and no next_until", async () => {
  const p = tmpPath();
  const req = validateRun({ source: "fake", since: "2026-01-01", depth: "listing" });
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
  const req = validateRun({ source: "fake", since: "2026-01-01", depth: "listing", budgetMs: 1 });
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
function withWriteCost(adapter: Adapter, elapsed: { value: number }, msPerItem: number): Adapter {
  return {
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
  });
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
  });
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
