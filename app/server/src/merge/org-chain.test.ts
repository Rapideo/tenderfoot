import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { orgChain } from "./org-chain.js";

/* The nested-agency fallback warns (see org-chain.ts). Muted for the whole
 * suite so the tests that merely EXERCISE that branch do not print a real
 * warning into the gate's output; the two tests at the bottom of this file
 * install their own spies and assert on it deliberately. */
beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

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

/* Adapted from the brief's sketch: this module's exported entry point is
 * `orgChain`, not `orgChainFrom` -- there is no `orgChainFrom` in this file.
 * One level, not a chain: HigherGov publishes a flat agency name, and the
 * sub-state buyers this source is bought for have no parent to walk. */
test("HigherGov's agency_name lands as the organisation", () => {
  expect(orgChain("HigherGov", { agency_name: "Natural Resources" })).toEqual(["Natural Resources"]);
});

test("a missing or blank HigherGov agency_name yields an empty chain", () => {
  expect(orgChain("HigherGov", {})).toEqual([]);
  expect(orgChain("HigherGov", { agency_name: "" })).toEqual([]);
  expect(orgChain("HigherGov", { agency_name: null })).toEqual([]);
});

/* docs/2026-09-03-highergov-field-mapping.md:55 records this field as nested
 * (`agency.agency_name`), not flat -- unlike the flat shape above, no live
 * response backs it either, so this fallback exists precisely because which
 * shape a real HigherGov response actually uses is unverified. */
test("HigherGov's nested agency.agency_name lands when the flat field is absent", () => {
  expect(orgChain("HigherGov", { agency: { agency_name: "Allen County" } })).toEqual(["Allen County"]);
});

test("HigherGov's nested agency.agency_name is used when the flat field is blank", () => {
  expect(orgChain("HigherGov", { agency_name: "", agency: { agency_name: "Allen County" } })).toEqual([
    "Allen County",
  ]);
  expect(orgChain("HigherGov", { agency_name: "   ", agency: { agency_name: "Allen County" } })).toEqual([
    "Allen County",
  ]);
});

/* Both shapes present: the flat field wins, so behaviour under today's
 * assumed shape stays exactly what it was before the nested fallback
 * existed. */
test("HigherGov prefers the flat agency_name over the nested one when both are present", () => {
  expect(
    orgChain("HigherGov", { agency_name: "Natural Resources", agency: { agency_name: "Allen County" } }),
  ).toEqual(["Natural Resources"]);
});

test("HigherGov yields an empty chain when neither the flat nor the nested field is usable", () => {
  expect(orgChain("HigherGov", { agency: {} })).toEqual([]);
  expect(orgChain("HigherGov", { agency: { agency_name: "" } })).toEqual([]);
  expect(orgChain("HigherGov", { agency: null })).toEqual([]);
  expect(orgChain("HigherGov", { agency: undefined })).toEqual([]);
});

/* `agency` is exactly the field whose shape is in question -- a non-object
 * value (the flat shape's own sibling, a stray string, a number) must not be
 * treated as a container to read `.agency_name` off, and must not throw. */
test("a non-object HigherGov agency does not throw and is treated as absent", () => {
  expect(orgChain("HigherGov", { agency: "Allen County" })).toEqual([]);
  expect(orgChain("HigherGov", { agency: 12345 })).toEqual([]);
  expect(orgChain("HigherGov", { agency: "Allen County", agency_name: "Natural Resources" })).toEqual([
    "Natural Resources",
  ]);
});

/* ── the nested fallback reports itself, added 2026-09-07 ─────────────── */

/* Accepting both shapes settled a disagreement between this module and
 * docs/2026-09-03-highergov-field-mapping.md:55 without spending metered
 * records. What it did NOT do is answer it: whichever shape is real, the
 * merge succeeds silently and the guess survives the very run that could
 * have resolved it. The warning is that answer, collected for free on the
 * first live run.
 *
 * Each test takes a FRESH module instance, because the warning is
 * once-per-process by design and a shared instance would make these
 * order-dependent on the nested-fallback tests above. */
async function freshOrgChain() {
  vi.resetModules();
  const mod = await import("./org-chain.js");
  return mod.orgChain;
}

test("the nested agency fallback warns, and says which shape it saw", async () => {
  const chain = await freshOrgChain();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  expect(chain("HigherGov", { agency: { agency_name: "Allen County" } })).toEqual(["Allen County"]);

  expect(warn).toHaveBeenCalledTimes(1);
  const message = String(warn.mock.calls[0]?.[0]);
  expect(message).toContain("NESTED");
  /* The observed name is in the message: a reader confirming the shape wants
   * to see a real buyer, not just an assertion that one existed. */
  expect(message).toContain("Allen County");
  /* And the message must say what to DO with the answer, or it is a fact
   * nobody acts on -- the flat branch is what gets deleted. */
  expect(message).toContain("agency_name");

  /* ONCE PER PROCESS. A merge walks every group; if the nested shape is the
   * real one, per-row warnings would print thousands of identical lines and
   * bury the rest of the run's output. */
  chain("HigherGov", { agency: { agency_name: "Natural Resources" } });
  chain("HigherGov", { agency: { agency_name: "Wayne Township" } });
  expect(warn).toHaveBeenCalledTimes(1);
});

/* 🔴 THE HALF THAT CARRIES THE INFORMATION. Only the nested branch DECIDING
 * the name means anything -- it means the document is right and this module's
 * original flat read was an assumption. A warning that also fired on the flat
 * path, or on a row with no agency at all, would report nothing and would be
 * indistinguishable from noise on the first live run. */
test("neither the flat shape nor an absent agency warns", async () => {
  const chain = await freshOrgChain();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  chain("HigherGov", { agency_name: "Natural Resources" });
  /* Both present: the flat one wins, so nothing was learned and nothing is
   * said. */
  chain("HigherGov", { agency_name: "Natural Resources", agency: { agency_name: "Allen County" } });
  chain("HigherGov", { agency: {} });
  chain("HigherGov", { agency: null });
  chain("HigherGov", { agency: "Allen County" });
  chain("HigherGov", {});
  chain("SAM.gov", SAM);
  chain("Indiana IDOA solicitations", { agency: "Education" });

  expect(warn).not.toHaveBeenCalled();
});

/* Non-fatal, and not a control-flow decision: the warning fires only after
 * `names` is already assigned (org-chain.ts's HigherGov case), and the call
 * is wrapped in its own try/catch there -- so neither a caller that has
 * silenced console.warn nor one whose console.warn actively throws can cost
 * a row its organisation. This test covers the silenced case; the one below
 * covers the throwing case, which is the half that actually needs pinning. */
test("the warning never changes what the chain resolves to", async () => {
  const chain = await freshOrgChain();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(chain("HigherGov", { agency: { agency_name: "Allen County" } })).toEqual(["Allen County"]);
  /* Second call, warning already spent -- the answer is identical. */
  expect(chain("HigherGov", { agency: { agency_name: "Allen County" } })).toEqual(["Allen County"]);
});

/* 🔴 THE HALF THAT ACTUALLY NEEDED PINNING (final review, fix 1). As first
 * written, warnNestedAgency was called ONE LINE BEFORE `names = [flat ||
 * nested]`, unwrapped -- a throwing console.warn (a broken stream, a
 * hijacked global) would have propagated straight out of orgChain, past the
 * chain-building loop, and out of the function entirely, taking the row's
 * organisation down with it. Neither test above would have caught that: both
 * mock console.warn to succeed quietly. This one makes it throw. Fresh
 * module instance, because the warning is once-per-process and this must be
 * the row that FIRES it, not one where it already fired and the call site
 * is never reached. */
test("a console.warn that throws does not prevent the row from getting its organisation", async () => {
  const chain = await freshOrgChain();
  vi.spyOn(console, "warn").mockImplementation(() => {
    throw new Error("console.warn exploded");
  });
  expect(chain("HigherGov", { agency: { agency_name: "Allen County" } })).toEqual(["Allen County"]);
});
