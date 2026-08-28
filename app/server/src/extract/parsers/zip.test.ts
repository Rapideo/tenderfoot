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
  /* Without the `entry.dir` guard, `path.split("/").pop()` on the folder key
   * "Attachments/" returns "" -- an empty string, not undefined, so the
   * `?? path` fallback never fires -- and Task 10 would insert a document
   * row with an empty filename instead of skipping a non-file entry. */
  const r = await parseZip(await bundle());
  if (r.kind !== "members") throw new Error("expected members");
  const filenames = r.members.map((m) => m.filename);
  expect(filenames).toContain("A.pdf");
  expect(filenames).not.toContain("Attachments");
  expect(filenames).not.toContain("");
});
