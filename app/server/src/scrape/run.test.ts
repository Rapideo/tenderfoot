import { expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runScrape } from "./run.js";
import { fakeAdapter } from "./adapters/fake.js";
import { readArtifact } from "./artifact.js";
import { validateRun } from "./contract.js";

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
