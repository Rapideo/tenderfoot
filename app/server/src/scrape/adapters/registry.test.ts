import { expect, test } from "vitest";
import { ADAPTERS } from "./registry.js";

/* The sourceName must match migration 019's seeded row exactly.
 * resolve-source.ts looks it up by this string, and a mismatch is not an
 * error anywhere -- it surfaces as "No source row named ..." at IMPORT
 * time, after the whole scrape has already run and been billed. */
test("highergov resolves to the seeded source name", () => {
  expect(ADAPTERS.highergov?.sourceName).toBe("HigherGov");
});

test("highergov builds a windowed adapter", () => {
  const a = ADAPTERS.highergov!.make();
  expect(a.shape).toBe("windowed");
  expect(a.name).toBe("HigherGov");
});
