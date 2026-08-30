import { expect, test } from "vitest";
import JSZip from "jszip";
import { parseZip } from "./zip.js";

async function bundle(): Promise<Buffer> {
  const z = new JSZip();
  z.file("RFP.pdf", "%PDF-1.4 fake");
  z.file("Pricing.xlsx", "fake");
  const inner = new JSZip();
  inner.file("deep.pdf", "%PDF-1.4 deeper");
  z.file("Bidders Library.zip", await inner.generateAsync({ type: "nodebuffer" }));
  /* Real corpus bundles nest files in folders; JSZip lists the folder itself
   * as its own entry ("Attachments/"), which is what the entry.dir guard
   * below exists to skip. */
  z.folder("Attachments")?.file("A.pdf", "x");
  return z.generateAsync({ type: "nodebuffer" });
}

test("expands a bundle into its members", async () => {
  const r = await parseZip(await bundle());
  expect(r.kind).toBe("members");
  if (r.kind !== "members") return;
  expect(r.members.map((m) => m.filename)).toContain("RFP.pdf");
  expect(r.members.map((m) => m.filename)).toContain("Pricing.xlsx");
});

test("a nested archive is surfaced as a member, not silently dropped", async () => {
  /* D8. The spike logged `Att L - Bidders Library.zip` inside `docs.zip` as
   * `skipped: "not a parseable format"` -- a wrong reason with no durable
   * record. Depth 1 is still the limit; the member becomes a row Task 10
   * marks `failed` with a reason that can be queried instead. A recursing
   * "improvement" is the most likely future violation of that limit, so pin
   * the archive's presence AND its contents' absence, not just the former. */
  const r = await parseZip(await bundle());
  if (r.kind !== "members") throw new Error("expected members");
  const filenames = r.members.map((m) => m.filename);
  expect(filenames).toContain("Bidders Library.zip");
  expect(r.members).toHaveLength(4);
  expect(filenames).not.toContain("deep.pdf");
});

test("a folder entry is not itself returned as a member", async () => {
  /* Without the `entry.dir` guard, JSZip's folder key "Attachments/" would
   * become a member of its own and Task 10 would insert a `document` row for
   * a thing that is not a file.
   *
   * The expected name here changed on 2026-08-30 (review round 2, finding 2)
   * and the CLAIM did not: a member now carries its full archive path, so the
   * file inside the folder is "Attachments/A.pdf". What this test is for --
   * the folder itself is not a member, and no member has an empty name -- is
   * unchanged, and reads more directly against a path than it did against a
   * basename that had thrown the folder away. */
  const r = await parseZip(await bundle());
  if (r.kind !== "members") throw new Error("expected members");
  const filenames = r.members.map((m) => m.filename);
  expect(filenames).toContain("Attachments/A.pdf");
  expect(filenames).not.toContain("Attachments/");
  expect(filenames).not.toContain("");
});

/* REVIEW ROUND 2, FINDING 2 (Major, 2026-08-30). Flattening every entry to
 * its basename was harmless while nothing depended on the name being unique.
 * Migration 011's partial unique index on (parent_document_id, filename) made
 * it lossy: a bundle shipping `Volume 1/SOW.pdf` and `Volume 2/SOW.pdf` --
 * ordinary in federal solicitations, which ship per-volume folders -- yielded
 * two members with the SAME filename, so the second collided with the first
 * and its bytes, text and fields were discarded with no record anywhere.
 *
 * The archive path is already unique within an archive, so keeping it is both
 * the fix and the more informative record: an operator reading
 * `document.filename` now sees which volume a file came from. */
test("members keep their path, so same-named files in different folders survive", async () => {
  const z = new JSZip();
  z.folder("Volume 1")?.file("SOW.pdf", "%PDF-1.4 one");
  z.folder("Volume 2")?.file("SOW.pdf", "%PDF-1.4 two");
  const r = await parseZip(await z.generateAsync({ type: "nodebuffer" }));

  if (r.kind !== "members") throw new Error("expected members");
  const names = r.members.map((m) => m.filename).sort();
  expect(names).toEqual(["Volume 1/SOW.pdf", "Volume 2/SOW.pdf"]);
  /* The property that actually matters downstream: no two members collide. */
  expect(new Set(names).size).toBe(names.length);
});
