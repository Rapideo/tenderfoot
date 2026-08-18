// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Admin } from "./Admin";

/* Health values here are the REAL database enum (ok/failing/rot/excluded/
 * unknown), not the bundle's display strings ("Rot suspected", "Not
 * ingested") the fixtures used to carry. Migration 006's CHECK constraint
 * means the database cannot contain the old strings any more -- fixtures
 * that still used them were asserting a mapping over data production can
 * never produce, which is exactly how the HEALTH_TO_DOT defect (see the
 * StatusDot test below) survived a green gate. SAM.gov's health_note mirrors
 * a real `rot` verdict (health/probes/sam.ts); GovWin IQ's mirrors migration
 * 006's own excluded-row backfill (`'legal_posture=' || legal_posture`). */
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
    health: "rot",
    health_checked_at: "2026-08-18T09:00:00.000Z",
    health_method: "sam",
    health_note: "answered 200 but returned 0 rows",
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
    health: "excluded",
    health_checked_at: null,
    health_method: null,
    health_note: "legal_posture=out",
    enabled: false,
    source_note: null,
  },
];

/* One full row for the health-cell tests below, so each test only states
 * the field it is actually varying rather than all fifteen columns. */
const baseSource = {
  id: 50,
  name: "Test Source",
  jurisdiction: "US",
  platform: "SAM",
  adapter_tier: "T1 API",
  legal_posture: "in",
  legal_note: "Public API, documented terms.",
  archive_depth: "archive: 12mo",
  verified_facets: {},
  since_default: "P7D",
  last_run_at: null,
  health: "unknown",
  health_checked_at: null,
  health_method: null,
  health_note: null,
  enabled: true,
  source_note: null,
};

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
 * "found multiple elements", not as a wrong assertion. Also clears
 * sessionStorage, since the Check-control tests below seed
 * "tenderfoot.adminSecret" directly and must not leak it into later tests. */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

function stubOk() {
  vi.stubGlobal(
    "fetch",
    mockFetch((url) => (String(url).includes("/api/sources") ? SOURCES : PROFILE)),
  );
}

function renderAdminWith(sources: unknown[]) {
  vi.stubGlobal(
    "fetch",
    mockFetch((url) => (String(url).includes("/api/sources") ? sources : PROFILE)),
  );
  render(<Admin />);
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

/* THE DEFECT THIS TASK FIXES. HEALTH_TO_DOT's keys used to be the bundle's
 * display strings ("Rot suspected", "Not ingested") while `s.health` is
 * always the real database enum -- so the lookup was `undefined` for every
 * row, always, and every source silently fell back to the decorative grey
 * dot regardless of its actual health. It read as correct only because
 * production health was uniformly 'unknown', which legitimately gets the
 * decorative dot too. SOURCES above now carries the real enum ('rot' for
 * SAM.gov) specifically so a regression back to bundle-string keys fails
 * this test rather than passing vacuously the way the original did. */
test("a real 'rot' enum value renders StatusDot's rot state; 'excluded' renders none", async () => {
  stubOk();
  render(<Admin />);

  await waitFor(() => expect(screen.getByText("SAM.gov")).toBeTruthy());
  /* Exactly one dot: SAM.gov ('rot') gets one, GovWin IQ ('excluded') must
   * not -- routing 'excluded' through StatusDot would put "Not ingested"
   * into the accessibility tree the same way 'unknown' would (see the
   * excluded/unknown test further down). */
  const dots = screen.getAllByRole("img");
  expect(dots.map((d) => d.getAttribute("data-state"))).toEqual(["rot"]);
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
        ? [{ ...SOURCES[0], health: "unknown", health_checked_at: null, health_method: null }]
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

/* ---- TASK 11: HEALTH cell timestamp, and the Check control -------------- */

test("a checked source shows when it was checked, not just its state", async () => {
  renderAdminWith([
    {
      ...baseSource,
      name: "SAM.gov",
      health: "ok",
      health_checked_at: "2026-08-18T10:00:00.000Z",
      health_method: "sam",
    },
  ]);
  expect(await screen.findByText(/ok/)).toBeTruthy();
  /* A verdict with no timestamp is the stale-green trap. */
  expect(screen.getByText(/checked/i)).toBeTruthy();
});

test("an unmeasured source shows no timestamp at all", async () => {
  renderAdminWith([{ ...baseSource, health: "unknown", health_checked_at: null }]);
  expect(await screen.findByText("unknown")).toBeTruthy();
  expect(screen.queryByText(/checked/i)).toBeNull();
});

/* ea798e9's rule, extended to `excluded`: routing either through StatusDot
 * would put "Not ingested" into the accessibility tree. */
test("excluded and unknown never render a StatusDot", async () => {
  renderAdminWith([
    { ...baseSource, id: 51, name: "GovWin IQ", health: "excluded" },
    { ...baseSource, id: 52, name: "Illinois BidBuy", health: "unknown" },
  ]);
  await screen.findByText("excluded");
  expect(document.querySelectorAll("[data-state]")).toHaveLength(0);
});

test("an excluded row offers no Check control", async () => {
  renderAdminWith([
    { ...baseSource, name: "GovWin IQ", health: "excluded", legal_posture: "out" },
  ]);
  await screen.findByText("excluded");
  expect(screen.queryByRole("button", { name: /check govwin/i })).toBeNull();
});

/* Review finding 1 (Task 11): the test above only varies legal_posture, so
 * isProbeable's `platform !== "Manual import"` clause had no regression
 * protection -- deleting it left the whole suite green. corpus.ts:216-218
 * seeds real Manual import rows with legal_posture: 'in', which is exactly
 * this shape: the posture clause alone would wrongly allow a Check button. */
test("a Manual import row offers no Check control, even with legal_posture 'in'", async () => {
  renderAdminWith([
    {
      ...baseSource,
      name: "Corpus import",
      health: "excluded",
      legal_posture: "in",
      platform: "Manual import",
    },
  ]);
  await screen.findByText("excluded");
  expect(screen.queryByRole("button", { name: /check corpus/i })).toBeNull();
});

/* Review finding 2 (Task 11): eligibility.ts also refuses a null platform
 * ("an unknown platform is not evidence that contact is permitted"), and
 * `platform !== "Manual import"` alone lets `null` through (`null !==
 * "Manual import"` is true). Without the explicit null check, a null-
 * platform 'in' row would show a Check button that silently no-ops --
 * checkSources filters it out and the route answers 200 with
 * `{ checked: [] }`, the exact broken-looking button isProbeable exists to
 * prevent. */
test("a null-platform row offers no Check control, even with legal_posture 'in'", async () => {
  renderAdminWith([{ ...baseSource, name: "Mystery Source", legal_posture: "in", platform: null }]);
  await screen.findByText("Mystery Source");
  expect(screen.queryByRole("button", { name: /check mystery/i })).toBeNull();
});

/* A probeable row DOES offer the control -- the mirror image of the test
 * above, and load-bearing: without it, "no Check control" could pass by
 * accident if the button were never rendered for anyone. */
test("a probeable row offers a Check control", async () => {
  renderAdminWith([{ ...baseSource, name: "SAM.gov", legal_posture: "in", platform: "SAM" }]);
  expect(await screen.findByRole("button", { name: /check sam\.gov/i })).toBeTruthy();
});

/* The control's actual job: POST the right URL with the admin secret, and
 * refresh the row when the probe completes. A test that only checked the
 * button existed would pass even if the click did nothing. */
test("Check POSTs to /api/admin/health with the admin secret, and reloads when it completes", async () => {
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  const posts: { url: string; headers: Record<string, string> }[] = [];
  let sourcesLoaded = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push({ url: String(url), headers: (init.headers ?? {}) as Record<string, string> });
        return { ok: true, status: 200, json: async () => ({ checked: [] }) };
      }
      if (String(url).includes("/api/sources")) sourcesLoaded++;
      return {
        ok: true,
        status: 200,
        json: async () =>
          String(url).includes("/api/sources") ? [{ ...baseSource, name: "SAM.gov" }] : PROFILE,
      };
    }) as unknown as typeof fetch,
  );

  render(<Admin />);
  const btn = await screen.findByRole("button", { name: /check sam\.gov/i });
  btn.click();

  await waitFor(() => expect(posts.length).toBe(1));
  expect(posts[0]!.url).toBe("/api/admin/health?source=SAM.gov");
  expect(posts[0]!.headers["X-Admin-Secret"]).toBe("s3cret");
  /* The mount's own load, plus the reload checkHealth triggers on completion. */
  await waitFor(() => expect(sourcesLoaded).toBe(2));
});

/* clearAdminSecret() on 401 -- adminSecret.ts's own rule: a wrong secret
 * must not silently break every later click. */
test("a 401 from Check clears the stored admin secret", async () => {
  sessionStorage.setItem("tenderfoot.adminSecret", "wrong-secret");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return { ok: false, status: 401, json: async () => ({ error: "bad secret" }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () =>
          String(url).includes("/api/sources") ? [{ ...baseSource, name: "SAM.gov" }] : PROFILE,
      };
    }) as unknown as typeof fetch,
  );

  render(<Admin />);
  const btn = await screen.findByRole("button", { name: /check sam\.gov/i });
  btn.click();

  await waitFor(() => expect(sessionStorage.getItem("tenderfoot.adminSecret")).toBeNull());
});

/* ---- TASK 12: the Run control -------------------------------------------
 *
 * D5, finally housed on the screen: POST /api/admin/run (Task 9) already
 * does scrape+import+merge in one request. This is the client-side lever.
 */

test("a source with an adapter offers a Run control", async () => {
  renderAdminWith([{ ...baseSource, name: "SAM.gov", platform: "SAM", enabled: true }]);
  expect(await screen.findByRole("button", { name: /run sam\.gov/i })).toBeTruthy();
});

/* Disabled with a stated reason, never hidden -- an absent control is a
 * mystery, a disabled one is an explanation. Only SAM and USASpending have
 * adapters today (scrape/adapters/registry.ts). */
test("a source with no adapter shows Run disabled with a reason", async () => {
  renderAdminWith([{ ...baseSource, name: "Illinois BidBuy", platform: "Periscope S2G" }]);
  const btn = await screen.findByRole("button", { name: /run illinois bidbuy/i });
  expect(btn).toHaveProperty("disabled", true);
  expect(btn.getAttribute("title")).toMatch(/no adapter/i);
});

test("an excluded source offers no Run control at all", async () => {
  renderAdminWith([{ ...baseSource, name: "GovWin IQ", legal_posture: "out" }]);
  await screen.findByText(/GovWin/);
  expect(screen.queryByRole("button", { name: /run govwin/i })).toBeNull();
});

/* The control's actual job: POST the right URL (source name, not a key --
 * the route resolves that server-side per the task-12 ruling) with the
 * ingestion window and the admin secret, and refresh the row when the run
 * completes so last_run_at and the counts move. A test that only checked
 * the button existed would pass even if the click did nothing. */
test("Run POSTs to /api/admin/run with the source name, window and secret, and reloads when it completes", async () => {
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  const posts: { url: string; headers: Record<string, string> }[] = [];
  let sourcesLoaded = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push({ url: String(url), headers: (init.headers ?? {}) as Record<string, string> });
        return { ok: true, status: 200, json: async () => ({ last_run_at: "2026-08-18T12:00:00.000Z" }) };
      }
      if (String(url).includes("/api/sources")) sourcesLoaded++;
      return {
        ok: true,
        status: 200,
        json: async () =>
          String(url).includes("/api/sources")
            ? [{ ...baseSource, name: "SAM.gov", platform: "SAM", since_default: "P7D" }]
            : PROFILE,
      };
    }) as unknown as typeof fetch,
  );

  render(<Admin />);
  const btn = await screen.findByRole("button", { name: /run sam\.gov/i });
  btn.click();

  await waitFor(() => expect(posts.length).toBe(1));
  expect(posts[0]!.url).toBe("/api/admin/run?source=SAM.gov&since=P7D");
  expect(posts[0]!.headers["X-Admin-Secret"]).toBe("s3cret");
  /* The mount's own load, plus the reload Run triggers on completion. */
  await waitFor(() => expect(sourcesLoaded).toBe(2));
});

/* clearAdminSecret() on 401 -- same rule as Check, adminSecret.ts's own:
 * a wrong secret must not silently break every later click. */
test("a 401 from Run clears the stored admin secret", async () => {
  sessionStorage.setItem("tenderfoot.adminSecret", "wrong-secret");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return { ok: false, status: 401, json: async () => ({ error: "bad secret" }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () =>
          String(url).includes("/api/sources")
            ? [{ ...baseSource, name: "SAM.gov", platform: "SAM" }]
            : PROFILE,
      };
    }) as unknown as typeof fetch,
  );

  render(<Admin />);
  const btn = await screen.findByRole("button", { name: /run sam\.gov/i });
  btn.click();

  await waitFor(() => expect(sessionStorage.getItem("tenderfoot.adminSecret")).toBeNull());
});
