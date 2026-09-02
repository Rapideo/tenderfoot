// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { Shell } from "./Shell";

/* CONTROLLER RULING (pre-flight, 2026-08-30): every Shell render is wrapped.
 * Shell's nav renders <Link to="/">, and <Link> outside a Router THROWS --
 * so four of the five tests below would have failed for a reason that has
 * nothing to do with what they assert. */
const render = (ui: ReactNode) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const SOURCES = [
  { id: 1, name: "SAM.gov", health: "ok", enabled: true, last_run_at: "2026-08-28T04:03:59Z" },
  { id: 2, name: "Illinois", health: "failing", enabled: true, last_run_at: null },
  { id: 3, name: "Michigan", health: "rot", enabled: true, last_run_at: null },
  { id: 4, name: "GovWin IQ", health: "excluded", enabled: false, last_run_at: null },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubSources() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(SOURCES), { status: 200 })),
  );
}

test("the status bar counts only sources that are actually ingested", async () => {
  stubSources();
  render(<Shell queueCount={12}>content</Shell>);
  /* GovWin is `excluded` -- it is not a source that could be failing, so
   * counting it would report a permanent fault that is a legal posture. */
  await waitFor(() => expect(screen.getByText(/3 sources/i)).toBeTruthy());
});

/* CORRECTION (post-review, 2026-08-30): the original version of this test
 * asserted `/1 failing/i`, on the unverified assumption that the word
 * "failing" would appear somewhere in the rendered output. It does not --
 * StatusBar's counts label is the V1.2 bundle's own footer-chrome copy,
 * transcribed byte-for-byte in task 8 and locked by StatusBar.test.tsx
 * ("renders the counts in the bundle's exact separator format"): "N
 * DEGRADED", never "N failing". That bundle uses a DIFFERENT word,
 * "Failing", in a different location (the Source Registry row, via
 * StatusDot) for the identical health value -- SP2 transcribed each
 * location faithfully and did not harmonise the two; that inconsistency is
 * the frozen bundle's, not this test's to invent around. Harmonising the
 * two copies is a product decision belonging to Matt, not this slice (see
 * docs/admin-deviations.md D11). This test now asserts the copy StatusBar
 * actually renders, read from the DOM rather than assumed:
 * ["3 SOURCES · 1 DEGRADED · 1 ROT SUSPECTED", ...], confirmed by running
 * the component and printing document.querySelectorAll(".status-bar__label")
 * before writing these assertions. */
test("failing and rot are reported separately, because they mean different things", async () => {
  stubSources();
  render(<Shell queueCount={0}>content</Shell>);
  await waitFor(() => expect(screen.getByText(/1 DEGRADED/i)).toBeTruthy());
  expect(screen.getByText(/1 ROT SUSPECTED/i)).toBeTruthy();
});

test("the queue counter shows what is left to decide", async () => {
  stubSources();
  render(<Shell queueCount={12}>content</Shell>);
  await waitFor(() => expect(screen.getByLabelText(/queue count/i).textContent).toContain("12"));
});

/* ⚖️ REGION A.1.2, ruled 2026-09-01: all seven nav entries, each to a stub.
 *
 * ⚠️ THIS TEST EXISTS BECAUSE ITS ABSENCE WAS CAUGHT. The nav went from two
 * entries to seven and every test in this file stayed green -- the nav had
 * no coverage at all beyond "it disappears when reduced". A region the SVRC
 * scores as shell-critical was deletable without a single failure.
 *
 * The label assertions are not padding. "Triage" is the bundle's word and
 * ours read "Queue" until today; copy is specification (CLAUDE.md §1), so a
 * silent revert to "Queue" must fail here. */
test("the primary nav renders all seven entries, in the bundle's order", async () => {
  stubSources();
  render(<Shell queueCount={3}>content</Shell>);
  await waitFor(() => expect(screen.getByRole("navigation")).toBeTruthy());
  const labels = Array.from(
    screen.getByRole("navigation").querySelectorAll("a"),
  ).map((a) => a.textContent);
  expect(labels).toEqual([
    "Triage",
    "Opportunities",
    "Radars",
    "Entities",
    "Reports",
    "Admin",
    "Pipeline",
  ]);
});

/* Every entry goes SOMEWHERE. The ruling was for stubs over inert entries
 * precisely so that none of these is a dead end (the D14 failure), so an
 * href that goes missing is the defect this catches. */
test("every nav entry has a destination", async () => {
  stubSources();
  render(<Shell queueCount={3}>content</Shell>);
  await waitFor(() => expect(screen.getByRole("navigation")).toBeTruthy());
  const hrefs = Array.from(
    screen.getByRole("navigation").querySelectorAll("a"),
  ).map((a) => a.getAttribute("href"));
  expect(hrefs).toEqual([
    "/",
    "/opportunities",
    "/radars",
    "/entities",
    "/reports",
    "/admin",
    "/pipeline",
  ]);
});

/* SVRC Screen 1: the queue wants full width and no competing affordances. */
test("the reduced shell collapses primary nav", async () => {
  stubSources();
  const { container } = render(
    <Shell queueCount={1} reduced>
      content
    </Shell>,
  );
  await waitFor(() => expect(container.querySelector(".shell--reduced")).toBeTruthy());
  expect(screen.queryByRole("navigation")).toBeNull();
});

/* A status bar that renders zeros while the fetch is in flight is a status
 * bar that says "all clear" before it knows anything.
 *
 * CORRECTION (post-review, 2026-08-30): originally asserted the absence of
 * `/0 failing/i`, the same unverified word as the test above -- that string
 * never appears in this component regardless of load state (see the
 * correction note above), which made the original assertion vacuously true
 * and unable to catch a premature render. It now checks for the absence of
 * StatusBar's real copy, "0 DEGRADED". */
test("counts are absent, not zero, before the sources load", () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(<Shell queueCount={0}>content</Shell>);
  expect(screen.queryByText(/0 DEGRADED/i)).toBeNull();
});

/* THE REDUCED SHELL'S AFFORDANCE. The SVRC collapses the nav while triaging;
 * we had implemented the EFFECT (hidden nav) and never the affordance, so
 * nothing told the user the menu was gone or offered it back. */
test("the reduced shell says the nav is collapsed and offers it back", async () => {
  stubSources();
  render(
    <Shell queueCount={5} reduced>
      content
    </Shell>,
  );
  await waitFor(() => expect(screen.getByText(/NAV COLLAPSED/)).toBeTruthy());
  expect(screen.queryByRole("navigation")).toBeNull();

  screen.getByRole("button", { name: /show menu/i }).click();

  /* The nav comes back, and the notice goes with it -- an affordance that
   * does not restore anything is decoration. */
  await waitFor(() => expect(screen.getByRole("navigation")).toBeTruthy());
  expect(screen.queryByText(/NAV COLLAPSED/)).toBeNull();
});

/* The bundle's counter is a BUTTON with a stacked IN / QUEUE label, and it is
 * the route back to triage from anywhere -- not a bare number. */
test("the queue counter is a button carrying its own label", async () => {
  stubSources();
  render(<Shell queueCount={8008}>content</Shell>);
  await waitFor(() => expect(screen.getByLabelText(/queue count/i)).toBeTruthy());

  const counter = screen.getByLabelText(/queue count/i);
  expect(counter.tagName).toBe("BUTTON");
  expect(counter.textContent).toContain("8008");
  expect(counter.textContent).toMatch(/IN\s*QUEUE/);
});

/* Clear and not-clear are different states in the bundle -- --ok against
 * --acc -- so a cleared queue reads as an achievement rather than as work. */
test("a cleared queue renders the counter differently", async () => {
  stubSources();
  const { container } = render(<Shell queueCount={0}>content</Shell>);
  await waitFor(() => expect(screen.getByLabelText(/queue count/i)).toBeTruthy());
  expect(container.querySelector(".shell__count--clear")).toBeTruthy();
});
