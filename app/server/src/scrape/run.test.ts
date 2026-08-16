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

test("a run that fits reports done and no next_since", async () => {
  const p = tmpPath();
  const req = validateRun({ source: "fake", since: "2026-01-01", depth: "listing" });
  const res = await runScrape(req, fakeAdapter(5, 2), p);
  expect(res.done).toBe(true);
  expect(res.nextSince).toBeNull();
  expect(res.rows).toBe(5);
  expect(readArtifact(p).run.outcome).toBe("complete");
});

/* The whole point of checkpointing: a scope larger than the budget must
 * resume rather than die mid-write (spec §5). */
test("a run that exhausts its budget commits what it has and reports a resume marker", async () => {
  const p = tmpPath();
  const req = validateRun({ source: "fake", since: "2026-01-01", depth: "listing", budgetMs: 1 });
  let t = 0;
  const clock = () => (t += 10); // every check advances past the 1ms budget
  const res = await runScrape(req, fakeAdapter(100, 2), p, clock);

  expect(res.done).toBe(false);
  expect(res.nextSince).not.toBeNull();
  expect(res.rows).toBeGreaterThan(0);
  expect(res.rows).toBeLessThan(100);

  const out = readArtifact(p);
  expect(out.run.outcome).toBe("partial");
  expect(out.sightings).toHaveLength(res.rows);
});
