import { expect, test } from "vitest";
import { parserFor } from "./parse.js";

test("dispatches the four types the corpus actually contains", () => {
  expect(parserFor("application/pdf", "a.pdf")).toBe("pdf");
  expect(parserFor("", "a.docx")).toBe("docx");
  expect(parserFor("", "a.xlsx")).toBe("xlsx");
  expect(parserFor("", "bundle.zip")).toBe("zip");
});

test("an unknown type returns null rather than a guess", () => {
  /* .pptx has no maintained Node library (spike, 2026-08-18). Returning null
   * makes it a recorded `failed` row; guessing would make it a silent one. */
  expect(parserFor("", "deck.pptx")).toBeNull();
  expect(parserFor("", "notes.txt")).toBeNull();
});

test("the extension WINS when the two signals disagree", () => {
  /* This is the case that actually proves precedence. octet-stream alone does
   * not: it matches neither branch, so extension-first and media-type-first
   * both fall through to the extension and the test cannot tell them apart. */
  expect(parserFor("application/pdf", "a.docx")).toBe("docx");
  expect(parserFor("application/octet-stream", "RFP.pdf")).toBe("pdf");
});

test("xlsm is treated as a spreadsheet", () => {
  expect(parserFor("", "macro-enabled.xlsm")).toBe("xlsx");
});
