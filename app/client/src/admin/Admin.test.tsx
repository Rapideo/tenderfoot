// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Admin } from "./Admin";

const SOURCES = [
  {
    id: 1,
    name: "SAM.gov",
    jurisdiction: "US",
    platform: "SAM",
    adapter_tier: "T1 API",
    legal_posture: "in",
    legal_note: "Public API, documented terms.",
    archive_depth: "archive: 12mo",
    verified_facets: {},
    since_default: "P7D",
    last_run_at: null,
    health: "Rot suspected",
    enabled: true,
    source_note: null,
  },
  {
    id: 9,
    name: "GovWin IQ",
    jurisdiction: "US",
    platform: "Aggregator",
    adapter_tier: null,
    legal_posture: "out",
    legal_note: "Paywalled aggregator; terms forbid it.",
    archive_depth: null,
    verified_facets: {},
    since_default: null,
    last_run_at: null,
    health: "Not ingested",
    enabled: false,
    source_note: null,
  },
];

const PROFILE = {
  id: 1,
  vendor_id: 1,
  vendor_name: "Koehler Partners",
  capabilities: "Care-management workflow redesign",
  codes: {},
  certifications: { wbe: "Indiana, expires 2027-04" },
  geography: { primary: "Indiana" },
  remote_ok: true,
  hard_limits: { headcount: 14 },
  past_performance: null,
  negative_profile: null,
  updated_at: "2026-08-16T00:00:00Z",
};

function mockFetch(handler: (url: string, init?: RequestInit) => unknown, ok = true) {
  return vi.fn(async (url: string, init?: RequestInit) => ({
    ok,
    status: ok ? 200 : 400,
    json: async () => handler(url, init),
  })) as unknown as typeof fetch;
}

/* Explicit cleanup: this project does not enable vitest globals, so
 * testing-library's auto-cleanup afterEach never registers and renders
 * would otherwise accumulate across tests in one file -- which shows up as
 * "found multiple elements", not as a wrong assertion. */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function stubOk() {
  vi.stubGlobal(
    "fetch",
    mockFetch((url) => (String(url).includes("/api/sources") ? SOURCES : PROFILE)),
  );
}

test("renders the bundle's five registry columns, one row per source", async () => {
  stubOk();
  render(<Admin />);

  await waitFor(() => expect(screen.getByText("SAM.gov")).toBeTruthy());
  for (const col of ["SOURCE", "PLATFORM", "TIER", "LEGAL", "HEALTH"]) {
    expect(screen.getByText(col)).toBeTruthy();
  }
  expect(screen.getByText("GovWin IQ")).toBeTruthy();
  /* The registry's own reason for existing: an excluded aggregator is
   * VISIBLE and marked, not omitted and remembered (View 6.2 known gaps). */
  expect(screen.getByLabelText("Legal posture for GovWin IQ")).toHaveProperty("value", "out");
});

/* Health drives StatusDot's four-state vocabulary, which was corrected at
 * the SP2 gate specifically so this screen's words and the primitive's
 * states are the same four. A mismatch here would silently fall back to
 * "Not ingested" and read as a dead source. */
test("source health maps onto StatusDot's four states", async () => {
  stubOk();
  render(<Admin />);

  await waitFor(() => expect(screen.getByText("SAM.gov")).toBeTruthy());
  const dots = screen.getAllByRole("img");
  expect(dots.map((d) => d.getAttribute("data-state"))).toEqual(["rot", "off"]);
});

/* D1 -- the lever the SVRC calls the only one there is. It does not exist in
 * the V1.2 bundle, so this test is the only specification of it. */
test("the enabled toggle PATCHes the source", async () => {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    mockFetch((url, init) => {
      if (init?.method === "PATCH") {
        calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
        return { ok: true };
      }
      return String(url).includes("/api/sources") ? SOURCES : PROFILE;
    }),
  );

  render(<Admin />);
  await waitFor(() => expect(screen.getByText("GovWin IQ")).toBeTruthy());
  (screen.getByLabelText("Enable GovWin IQ") as HTMLInputElement).click();

  await waitFor(() => expect(calls.length).toBe(1));
  expect(calls[0]!.url).toContain("/api/sources/9");
  expect(calls[0]!.body).toEqual({ enabled: true });
});

/* THE FAIL-CLOSED GUARDS MUST BE VISIBLE.
 *
 * The server refuses to enable a source with no ingestion window, and
 * refuses a posture change with no evidence note. Both are deliberate 400s.
 * A screen that swallows them turns a refusal into a control that appears to
 * do nothing -- which is worse than an error, because the operator concludes
 * the button is broken rather than that the system said no. */
test("a fail-closed 400 is shown to the operator, not swallowed", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const isPatch = init?.method === "PATCH";
      return {
        ok: !isPatch,
        status: isPatch ? 400 : 200,
        json: async () =>
          isPatch
            ? { error: "Enabling a source requires an ingestion window (since_default)." }
            : String(url).includes("/api/sources")
              ? SOURCES
              : PROFILE,
      };
    }) as unknown as typeof fetch,
  );

  render(<Admin />);
  await waitFor(() => expect(screen.getByText("GovWin IQ")).toBeTruthy());
  (screen.getByLabelText("Enable GovWin IQ") as HTMLInputElement).click();

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("ingestion window");
});

/* D3 -- the bundle renders the profile read-only; T14 requires it editable.
 * The empty-field treatment is data-driven rather than hard-coded to PAST
 * PERFORMANCE, so it has to be asserted on the empty one. */
test("the profile renders the bundle's five fields, empty ones marked", async () => {
  stubOk();
  render(<Admin />);

  await waitFor(() => expect(screen.getByText("SERVICE LINES")).toBeTruthy());
  for (const label of [
    "SERVICE LINES",
    "CERTIFICATIONS",
    "GEOGRAPHY",
    "ELIGIBILITY FACTS — GATE INPUTS ONLY",
    "PAST PERFORMANCE LIBRARY",
  ]) {
    expect(screen.getByText(label)).toBeTruthy();
  }

  const past = screen.getByText("PAST PERFORMANCE LIBRARY").parentElement!
    .querySelector("textarea")!;
  expect(past.value).toBe("");
  expect(past.className).toContain("admin-field__input--empty");
});

/* FOUND BY RUNNING THE SCREEN, NOT BY A TEST.
 *
 * Every one of the 13 production rows carries health 'unknown' -- the schema
 * default, on a column with no CHECK constraint and nothing that writes it.
 * The fixtures above used the bundle's four words, so the suite asserted a
 * mapping over values production does not contain.
 *
 * `unknown` must keep its own word AND must not borrow StatusDot's `off`
 * state, whose accessible name is "Not ingested". SAM.gov has been ingested
 * twice and still reads `unknown`; calling it "Not ingested" in either the
 * visible label or the accessibility tree is false. */
test("an unmeasured source keeps the word 'unknown' and claims no StatusDot state", async () => {
  vi.stubGlobal(
    "fetch",
    mockFetch((url) =>
      String(url).includes("/api/sources")
        ? [{ ...SOURCES[0], health: "unknown" }]
        : PROFILE,
    ),
  );

  render(<Admin />);
  await waitFor(() => expect(screen.getByText("SAM.gov")).toBeTruthy());

  expect(screen.getByText("unknown")).toBeTruthy();
  /* No StatusDot rendered at all: role="img" is how it announces itself, and
   * every one of its four names would be a claim nobody has measured. */
  expect(screen.queryAllByRole("img")).toHaveLength(0);
  expect(screen.queryByText("Not ingested")).toBeNull();
});
