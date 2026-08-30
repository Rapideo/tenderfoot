import { expect, test } from "vitest";
import { readFileSync, globSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import JSZip from "jszip";
import { parseDocx } from "./docx.js";

const CORPUS = fileURLToPath(new URL("../../../../../corpus/", import.meta.url));

/* A .docx is a ZIP, and word/document.xml inside it is DEFLATE-compressed --
 * so the literal string `w:tbl` NEVER appears in the raw file bytes. An
 * earlier version of this helper searched the raw bytes and matched nothing
 * across all 52 corpus documents, which looked exactly like "the corpus has no
 * tables". It has plenty; the search was wrong.
 *
 * Detection decompresses with JSZip DELIBERATELY, not with mammoth. mammoth is
 * the thing under test here; if it also chose its own fixture the test would be
 * circular -- "find a file mammoth renders as a table, then assert mammoth
 * renders it as a table" asserts nothing at all. */
async function firstDocxWithTable(): Promise<Buffer> {
  const files = globSync("**/*.docx", { cwd: CORPUS });
  for (const f of files) {
    const bytes = Buffer.from(readFileSync(join(CORPUS, f)));
    const xml = await (await JSZip.loadAsync(bytes)).file("word/document.xml")?.async("string");
    if (xml?.includes("<w:tbl")) return bytes;
  }
  throw new Error("no .docx with a table in corpus/ -- the corpus is not what the spike measured");
}

test("uses convertToHtml so table structure survives", async () => {
  /* THE REQUIREMENT, from the spike: raw text collapses a table into a wall
   * of words. 244/244 tables and 758/758 rows survive convertToHtml. */
  const r = await parseDocx(await firstDocxWithTable());
  expect(r.kind).toBe("text");
  if (r.kind !== "text") return;
  expect(r.text).toMatch(/<table>/);
  expect(r.text).toMatch(/<tr>/);
});
