import JSZip from "jszip";
import type { ParseResult } from "../parse.js";

/* DEPTH 1 ONLY -- D8. A nested archive is returned as a member so that the
 * caller records it as `failed` with a reason. The spike traversed one level
 * and skipped the rest in silence; the limit is the same, the silence is not. */
export async function parseZip(bytes: Buffer): Promise<ParseResult> {
  const zip = await JSZip.loadAsync(bytes);
  const members: { filename: string; bytes: Buffer }[] = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    members.push({
      filename: path.split("/").pop() ?? path,
      bytes: Buffer.from(await entry.async("nodebuffer")),
    });
  }
  return { kind: "members", members };
}
