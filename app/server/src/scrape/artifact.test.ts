// app/server/src/scrape/artifact.test.ts
import { expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openArtifact, readArtifact } from "./artifact.js";

function tmpPath() {
  return join(mkdtempSync(join(tmpdir(), "tf-artifact-")), "run.db");
}

test("an artifact describes itself and round-trips its rows", () => {
  const p = tmpPath();
  const a = openArtifact(p, {
    sourceName: "fake",
    since: "2026-08-01",
    until: "2026-08-15",
    depth: "listing",
    scraperVer: "test",
  });
  const capId = a.writeCapture({
    hop: "listing",
    url: "fake://1",
    httpStatus: 200,
    payload: "{}",
  });
  a.writeSighting({
    externalId: "fake-0",
    seenAt: "2026-08-15T00:00:00.000Z",
    raw: { title: "x" },
    captureId: capId,
    extractorVer: "test",
    mode: "mechanical",
  });
  a.finish("partial", "2026-08-09T00:00:00.000Z");
  a.close();

  const out = readArtifact(p);
  expect(out.run.source_name).toBe("fake");
  expect(out.run.outcome).toBe("partial");
  expect(out.run.next_since).toBe("2026-08-09T00:00:00.000Z");
  expect(out.sightings).toHaveLength(1);
  expect(out.sightings[0].external_id).toBe("fake-0");
  expect(out.captures).toHaveLength(1);
});

/* Documents are referenced, never embedded, and a hash is never invented
 * for a document that was not downloaded (spec §3.3). */
test("a document reference at listing depth carries a null sha256", () => {
  const p = tmpPath();
  const a = openArtifact(p, {
    sourceName: "fake",
    since: "2026-08-01",
    until: "2026-08-15",
    depth: "listing",
    scraperVer: "test",
  });
  const capId = a.writeCapture({ hop: "listing", url: "fake://1", httpStatus: 200, payload: "{}" });
  a.writeDocumentRef({
    captureId: capId,
    url: "https://example.gov/bundle.zip",
    filename: "bundle.zip",
    contentType: "application/zip",
    statedBytes: 21_000_000,
  });
  a.finish("complete", null);
  a.close();

  const out = readArtifact(p);
  expect(out.documentRefs[0].sha256).toBeNull();
  expect(out.documentRefs[0].blob_ref).toBeNull();
});
