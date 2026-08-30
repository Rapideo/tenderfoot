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
    /* THE FULL ARCHIVE PATH, not the basename. Flattening was harmless while
     * nothing depended on the name being unique; migration 011's partial
     * unique index on (parent_document_id, filename) made it LOSSY. A bundle
     * shipping `Volume 1/SOW.pdf` and `Volume 2/SOW.pdf` -- ordinary in
     * federal solicitations, which ship per-volume folders -- produced two
     * members with one name, so the second collided with the first and its
     * bytes, text and fields were discarded with nothing recorded anywhere.
     *
     * A path is unique within an archive by construction, so keeping it is
     * both the fix and the better record: `document.filename` now says which
     * volume a file came from. Downstream is unaffected -- parserFor takes
     * the extension after the last dot, and D8's nested-archive check is a
     * `.zip` suffix test; a path satisfies both. */
    members.push({
      filename: path,
      bytes: Buffer.from(await entry.async("nodebuffer")),
    });
  }
  return { kind: "members", members };
}
