import { expect, test } from "vitest";
import { orgChain } from "./org-chain.js";

/* Pure -- no useTestSchema(), no database. Same posture as closes-at.test.ts
 * and title.test.ts: a rule that reads a payload should be testable without a
 * Postgres connection. */

/* SAM's own shape: an array of {level, name}, unordered on purpose (see
 * org-chain.ts's own comment on why array order is not trusted). */
const SAM = {
  organizationHierarchy: [
    { level: 3, name: "DLA AVIATION" },
    { level: 1, name: "DEPT OF DEFENSE" },
    { level: 2, name: "DEFENSE LOGISTICS AGENCY" },
  ],
};

test("SAM.gov resolves a multi-level chain, top-level first", () => {
  expect(orgChain("SAM.gov", SAM)).toEqual([
    "DEPT OF DEFENSE",
    "DEFENSE LOGISTICS AGENCY",
    "DLA AVIATION",
  ]);
});

test("USASpending resolves a one-level chain from Awarding Agency", () => {
  expect(orgChain("USASpending", { "Awarding Agency": "Department of Veterans Affairs" })).toEqual([
    "Department of Veterans Affairs",
  ]);
});

/* Real values from the live IDOA page (per the task dispatch), not invented
 * ones -- including the ampersand, which must survive untouched. */
test("IDOA resolves a one-element chain from agency, verbatim", () => {
  expect(orgChain("Indiana IDOA solicitations", { agency: "Alcohol & Tobacco Comm" })).toEqual([
    "Alcohol & Tobacco Comm",
  ]);
  expect(orgChain("Indiana IDOA solicitations", { agency: "Education" })).toEqual(["Education"]);
  expect(
    orgChain("Indiana IDOA solicitations", { agency: "Indiana Dept of Transportation" }),
  ).toEqual(["Indiana Dept of Transportation"]);
});

/* THE CASE THIS WHOLE SLICE EXISTS TO FIX: before this case existed, org_id
 * stayed NULL on every IDOA row -- measured live, 0 of 45. */
test("a missing or blank IDOA agency yields an empty chain, not a chain with an empty entry", () => {
  expect(orgChain("Indiana IDOA solicitations", {})).toEqual([]);
  expect(orgChain("Indiana IDOA solicitations", { agency: "" })).toEqual([]);
  expect(orgChain("Indiana IDOA solicitations", { agency: "   " })).toEqual([]);
  expect(orgChain("Indiana IDOA solicitations", { agency: null })).toEqual([]);
  expect(orgChain("Indiana IDOA solicitations", { agency: undefined })).toEqual([]);
});

/* No depth is invented: the agency string is not split into a fabricated
 * hierarchy, and IDOA never gets a synthetic "State of Indiana" parent
 * prepended -- both would fabricate structure the source does not publish. */
test("IDOA's chain is never widened beyond the one name the source states", () => {
  const chain = orgChain("Indiana IDOA solicitations", { agency: "Alcohol & Tobacco Comm" });
  expect(chain).toHaveLength(1);
  expect(chain).not.toContain("State of Indiana");
});

/* Regression: SAM and USASpending are unchanged by IDOA's new case. */
test("SAM.gov and USASpending are unaffected by the IDOA case", () => {
  expect(orgChain("SAM.gov", SAM)).toEqual([
    "DEPT OF DEFENSE",
    "DEFENSE LOGISTICS AGENCY",
    "DLA AVIATION",
  ]);
  expect(orgChain("USASpending", { "Awarding Agency": "Department of Veterans Affairs" })).toEqual([
    "Department of Veterans Affairs",
  ]);
});

/* IDOA's own field means nothing to a different source, matching the
 * discipline closes-at.ts and title.ts already hold to. */
test("IDOA's agency field means nothing to a different source", () => {
  expect(orgChain("SAM.gov", { agency: "Alcohol & Tobacco Comm" })).toEqual([]);
  expect(orgChain("USASpending", { agency: "Alcohol & Tobacco Comm" })).toEqual([]);
});

/* A source with neither a recognised name nor a usable payload still yields
 * nothing, exactly as the default branch always has. */
test("an unknown source yields an empty chain even when the payload looks familiar", () => {
  expect(orgChain("some-future-source", { agency: "Education" })).toEqual([]);
  expect(orgChain("", SAM)).toEqual([]);
});

/* Absence must not throw: merge reads whatever the source stored, and a
 * sighting's raw column is nullable. */
test("null and non-object payloads yield an empty chain, not a throw", () => {
  expect(orgChain("Indiana IDOA solicitations", null)).toEqual([]);
  expect(orgChain("Indiana IDOA solicitations", undefined)).toEqual([]);
  expect(orgChain("SAM.gov", null)).toEqual([]);
});
