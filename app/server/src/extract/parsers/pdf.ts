import { extractText, getDocumentProxy } from "unpdf";
import type { ParseResult } from "../parse.js";

const NO_TABLES = "pdf: no table structure available; geometry is present, reconstruction is not";

export async function parsePdf(bytes: Buffer): Promise<ParseResult> {
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(doc, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n") : text;

  /* PAGES BUT NO TEXT IS A SCAN, and saying so is the difference between a
   * category decision and an open question.
   *
   * `Sign In Sheet 8-10.pdf` (first live run, 2026-08-30) is an image-only
   * PDF. It parsed to an empty string, and all the orchestrator could record
   * was "parsed but produced no text" -- true, and indistinguishable from a
   * corrupt file, a mislabelled media type, or a fault in this parser. The
   * page count separates them, and it costs one property read: a document
   * with pages and no text layer has nothing wrong with it, it simply has no
   * text to give without OCR, which is out of scope.
   *
   * The table-structure note is DROPPED here rather than added to. It
   * describes what was lost from text that exists; in front of no text at
   * all it is noise sitting where the only useful fact should be. */
  if (merged.trim() === "") {
    const pages = doc.numPages;
    return {
      kind: "text",
      text: merged,
      notes: [
        `pdf: ${pages} page(s) but no text layer -- almost certainly a scanned image, ` +
          `which OCR would be needed to read and OCR is out of scope`,
      ],
    };
  }

  return { kind: "text", text: merged, notes: [NO_TABLES] };
}
