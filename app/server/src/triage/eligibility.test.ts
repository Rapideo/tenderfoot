import { expect, test } from "vitest";
import { ELIGIBLE, NOT_BIDDABLE, NOT_BIDDABLE_SQL } from "./eligibility.js";

/* FOUND BY MATT, 2026-09-02, triaging sample 1 and calling it unworkable:
 * 38 of his 100 items could not be bid on -- 31 Award Notices, 6 Special
 * Notices, 1 Justification. ELIGIBLE filtered on deadline and decidedness and
 * never on notice KIND, so a notice already awarded sat in the queue asking
 * for a judgement. */

test("the predicate excludes the kinds nobody can bid on", () => {
  for (const kind of ["Award Notice", "Justification", "Special Notice"]) {
    expect(NOT_BIDDABLE).toContain(kind);
    expect(NOT_BIDDABLE_SQL).toContain(`'${kind}'`);
  }
});

test("early-signal kinds are KEPT, and that is the deliberate line", () => {
  /* Presolicitation and Sources Sought are not biddable TODAY. They are the
   * earliest evidence a requirement exists, and lead time is worth more to a
   * small firm than to a large one. Excluding them would optimise the queue
   * for today at the cost of the pipeline. */
  for (const kind of ["Presolicitation", "Sources Sought", "Solicitation",
                      "Combined Synopsis/Solicitation", "RFP"]) {
    expect(NOT_BIDDABLE).not.toContain(kind);
    expect(NOT_BIDDABLE_SQL).not.toContain(`'${kind}'`);
  }
});

test("a NULL kind is admitted, not excluded", () => {
  /* Corpus rows carry no kind. Excluding NULL would silently drop every row
   * from a source that does not publish one -- the SAM-shaped assumption that
   * cost four defects on 2026-09-02 (D27). Fail open on absence; exclude only
   * what is positively identified. */
  expect(NOT_BIDDABLE_SQL).toContain("s.kind IS NULL OR");
});

test("ELIGIBLE actually applies the filter", () => {
  /* The whole defect was that this predicate existed and did not mention
   * kind. If someone removes the clause, this fails. */
  expect(ELIGIBLE).toContain("s.kind");
  expect(ELIGIBLE).toContain("Award Notice");
});

test("the generated SQL escapes quotes rather than trusting the list", () => {
  /* Belt and braces: the list is edited by hand and SAM publishes
   * vendor-authored strings. An apostrophe must not terminate the literal. */
  const built = NOT_BIDDABLE.map((k) => `'${k.replace(/'/g, "''")}'`).join(", ");
  expect(NOT_BIDDABLE_SQL).toContain(built);
});
