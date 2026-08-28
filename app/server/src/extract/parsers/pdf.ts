import { extractText, getDocumentProxy } from "unpdf";
import type { ParseResult } from "../parse.js";

export async function parsePdf(bytes: Buffer): Promise<ParseResult> {
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(doc, { mergePages: true });
  return {
    kind: "text",
    text: Array.isArray(text) ? text.join("\n") : text,
    notes: ["pdf: no table structure available; geometry is present, reconstruction is not"],
  };
}
