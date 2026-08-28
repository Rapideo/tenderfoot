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
  /* D8. The spike skipped `Att L - Bidders Library.zip` inside `docs.zip` and
   * said nothing. Depth 1 is still the limit -- but the member becomes a row
   * that Task 10 marks `failed` with a reason, so the limit is visible. */
  const r = await parseZip(await bundle());
  if (r.kind !== "members") throw new Error("expected members");
  expect(r.members.map((m) => m.filename)).toContain("Bidders Library.zip");
});
