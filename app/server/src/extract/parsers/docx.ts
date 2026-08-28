import mammoth from "mammoth";
import type { ParseResult } from "../parse.js";

/* convertToHtml, NOT extractRawText. The spike measured 244/244 tables and
 * 758/758 rows preserved this way; raw text loses every cell boundary, and a
 * cost-proposal table is exactly the thing this slice exists to read. The
 * 64-cell shortfall in the spike was vertical-merge continuation -- correct
 * rowspan, not loss. */
export async function parseDocx(bytes: Buffer): Promise<ParseResult> {
  const { value, messages } = await mammoth.convertToHtml({ buffer: bytes });
  return {
    kind: "text",
    text: value,
    notes: messages.map((m) => `docx: ${m.type}: ${m.message}`),
  };
}
