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

test("the filename decides when the media type is missing or wrong", () => {
  /* SAM.gov's attachment list frequently omits a usable type. */
  expect(parserFor("application/octet-stream", "RFP.pdf")).toBe("pdf");
});
