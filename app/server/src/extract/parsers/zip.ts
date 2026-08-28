import JSZip from "jszip";
import type { ParseResult } from "../parse.js";

/* DEPTH 1 ONLY -- D8. A nested archive is returned as a member so that the
 * caller records it as `failed` with a reason. The spike gave this exact case
 * a misleading reason that lived nowhere durable; here it lands on the
 * `document` row and can be queried. */
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
