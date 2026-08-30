import * as XLSX from "xlsx";
import type { ParseResult } from "../parse.js";

export async function parseXlsx(bytes: Buffer): Promise<ParseResult> {
  const wb = XLSX.read(bytes, { type: "buffer", cellFormula: true });
  const notes: string[] = [];
  const chunks: string[] = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;

    /* TRAP 1: `!ref` is a DECLARED range and is routinely fiction. Recompute
     * it from the cells that actually exist. */
    const addresses = Object.keys(ws).filter((k) => !k.startsWith("!"));
    if (addresses.length === 0) continue;
    const populated = addresses.reduce(
      (acc, a) => {
        const { r, c } = XLSX.utils.decode_cell(a);
        return {
          s: { r: Math.min(acc.s.r, r), c: Math.min(acc.s.c, c) },
          e: { r: Math.max(acc.e.r, r), c: Math.max(acc.e.c, c) },
        };
      },
      { s: { r: Infinity, c: Infinity }, e: { r: -1, c: -1 } },
    );
    const range = XLSX.utils.encode_range(populated);

    /* sheet_to_csv (unlike sheet_to_json) does not honor an options `range` --
     * it unconditionally reads `sheet["!ref"]` (confirmed against the pinned
     * xlsx-0.20.3 source). Overwriting it here is the only way to make the
     * recomputed range the one actually used for output. */
    ws["!ref"] = range;

    /* TRAP 2: a formula cell carries `f` AND a cached `v`. SheetJS replays the
     * cache; it does not evaluate. Record every one, by address. */
    for (const a of addresses) {
      const cell = ws[a] as XLSX.CellObject & { f?: string };
      if (cell?.f !== undefined) {
        notes.push(`xlsx: ${name}!${a} is a CACHED formula value (=${cell.f}), not computed now`);
      }
    }

    chunks.push(`# ${name}`);
    chunks.push(XLSX.utils.sheet_to_csv(ws, { FS: "\t" }));
  }

  return { kind: "text", text: chunks.join("\n"), notes };
}
