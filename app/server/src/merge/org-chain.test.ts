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

/* ── HigherGov: NESTED, and the flat branch is gone ───────────────────── */

/* One level, not a chain: the sub-state buyers this source is bought for
 * ("Allen County", "Natural Resources") have no parent to walk.
 *
 * ✅ THE SHAPE IS SETTLED BY CAPTURED DATA, and these tests are the record of
 * it. 1,856 real HigherGov rows across five states and 552 buyers: nested
 * `agency.agency_name` present on 1,856, flat `agency_name` present on 0.
 * This module used to accept both, flat first, and warn once per process when
 * nested was the branch that produced the name -- a deliberate tolerance,
 * because settling it live costs metered records (CLAUDE.md §5.1). The
 * warning fired on the first row and again on a different four-state buyer
 * set, which is the answer it existed to collect, so the flat branch and the
 * warning were deleted together. */
test("HigherGov's nested agency.agency_name lands as the organisation", () => {
  expect(orgChain("HigherGov", { agency: { agency_name: "Allen County" } })).toEqual(["Allen County"]);
  expect(orgChain("HigherGov", { agency: { agency_name: "Natural Resources" } })).toEqual([
    "Natural Resources",
  ]);
});

/* 🔴 THE DELETION ITSELF, pinned. A flat `agency_name` is not read, and a
 * test suite that merely stopped ASSERTING on it would go on passing if the
 * branch were quietly restored. This one would not. */
test("a flat agency_name is NOT read -- the branch that accepted it is gone", () => {
  expect(orgChain("HigherGov", { agency_name: "Natural Resources" })).toEqual([]);
  /* And it does not win, or even participate, when the nested field is the
   * one carrying the real buyer. Before the deletion this returned
   * ["Natural Resources"]; the measured shape says the nested one is the
   * only one a live response ever sends. */
  expect(
    orgChain("HigherGov", { agency_name: "Natural Resources", agency: { agency_name: "Allen County" } }),
  ).toEqual(["Allen County"]);
});

/* THE DEFENSIVE HANDLING SURVIVES THE DELETION, and it is not leftover
 * caution: `agency` is the field whose whole shape was in question, so
 * absent, null, undefined, an empty object, a blank name, a bare string and a
 * number must each yield NO ATTRIBUTION rather than a throw. A merge reads
 * whatever a source stored, and `sighting.raw` is nullable. */
test("a missing, blank or empty HigherGov agency yields an empty chain, not a throw", () => {
  expect(orgChain("HigherGov", {})).toEqual([]);
  expect(orgChain("HigherGov", { agency: {} })).toEqual([]);
  expect(orgChain("HigherGov", { agency: { agency_name: "" } })).toEqual([]);
  expect(orgChain("HigherGov", { agency: { agency_name: "   " } })).toEqual([]);
  expect(orgChain("HigherGov", { agency: { agency_name: null } })).toEqual([]);
  expect(orgChain("HigherGov", { agency: null })).toEqual([]);
  expect(orgChain("HigherGov", { agency: undefined })).toEqual([]);
});

/* A non-object `agency` must not be treated as a container to read
 * `.agency_name` off, and must not throw. */
test("a non-object HigherGov agency does not throw and is treated as absent", () => {
  expect(orgChain("HigherGov", { agency: "Allen County" })).toEqual([]);
  expect(orgChain("HigherGov", { agency: 12345 })).toEqual([]);
  expect(orgChain("HigherGov", { agency: true })).toEqual([]);
  /* Including alongside a flat name, which is no longer a rescue. */
  expect(orgChain("HigherGov", { agency: "Allen County", agency_name: "Natural Resources" })).toEqual([]);
});

/* And a null payload, as every other source's case above already requires. */
test("a null HigherGov payload yields an empty chain, not a throw", () => {
  expect(orgChain("HigherGov", null)).toEqual([]);
  expect(orgChain("HigherGov", undefined)).toEqual([]);
});
