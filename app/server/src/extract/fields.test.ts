import { expect, test } from "vitest";
import { extractFields } from "./fields.js";

test("finds a close date and quotes the passage it came from", () => {
  const f = extractFields("Sealed proposals are due September 17, 2026 at 3:00 PM.");
  const closes = f.find((x) => x.field_name === "closes_at");
  expect(closes?.value_text).toBe("2026-09-17");
  /* The citation IS the quote -- Matt's ruling. A value without its passage
   * cannot be checked by the person who has to trust it. */
  expect(closes?.quote).toMatch(/September 17, 2026/);
});

test("distinguishes the Q&A deadline from the close date", () => {
  /* migration 002: qa_closes_at is "often earlier and more binding". */
  const f = extractFields(
    "Questions must be submitted by August 5, 2026. Proposals are due September 17, 2026.",
  );
  expect(f.find((x) => x.field_name === "qa_closes_at")?.value_text).toBe("2026-08-05");
  expect(f.find((x) => x.field_name === "closes_at")?.value_text).toBe("2026-09-17");
});

test("absence is recorded as looked-for, not omitted", () => {
  /* value_text NULL means we looked and it is not there. No row would mean we
   * never looked -- a different fact, and migration 002 insists on it. */
  const f = extractFields("This document contains no dates whatsoever.");
  const closes = f.find((x) => x.field_name === "closes_at");
  expect(closes).toBeDefined();
  expect(closes?.value_text).toBeNull();
});
