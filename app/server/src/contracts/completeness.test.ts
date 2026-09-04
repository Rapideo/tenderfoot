import { expect, test } from "vitest";
import { parseRegister, assertComplete } from "./completeness.js";

test("parseRegister reads the total and the rows from DIFFERENT places", () => {
  /* pagination.totalResults and results.length. That separation IS the
   * truncation check -- collapsing them makes it vacuous. */
  const p = parseRegister(JSON.stringify({
    results: [{ id: "a" }],
    pagination: { totalResults: 9 },
  }));
  expect(p.total).toBe(9);
  expect(p.rows).toHaveLength(1);
});

test("a complete page passes", () => {
  expect(() =>
    assertComplete({ total: 3, rows: [{ id: "a" }, { id: "b" }, { id: "c" }] }),
  ).not.toThrow();
});

/* 🔴 THE ASSERTION THIS MODULE EXISTS FOR.
 *
 * The API's `page` parameter is SILENTLY IGNORED -- pages 1, 2 and 100 return
 * identical records -- so there is no cursor to follow and no second request
 * that would fill a gap. If the single fetch comes back short, the ONLY safe
 * outcome is a loud failure. A partial register that looks complete is the
 * exact failure this whole design exists to prevent. */
test("a short page throws, naming both numbers", () => {
  const p = { total: 204991, rows: [{ id: "a" }] };
  expect(() => assertComplete(p)).toThrow(/204991/);
  expect(() => assertComplete(p)).toThrow(/returned 1/);
});

/* An empty request body returns a ZEROED pagination block rather than
 * everything. Zero-and-zero is internally consistent so it must not throw --
 * the caller checks the count separately. */
test("a zeroed response is consistent and does not throw", () => {
  expect(() => assertComplete({ total: 0, rows: [] })).not.toThrow();
});

/* More rows than claimed is also a contract violation. Never observed, and an
 * assertion checking only one direction would not notice. */
test("more rows than the stated total also throws", () => {
  expect(() =>
    assertComplete({ total: 1, rows: [{ id: "a" }, { id: "b" }] }),
  ).toThrow();
});
