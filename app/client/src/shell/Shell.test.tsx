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

test("failing and rot are reported separately, because they mean different things", async () => {
  stubSources();
  render(<Shell queueCount={0}>content</Shell>);
  await waitFor(() => expect(screen.getByText(/1 failing/i)).toBeTruthy());
  expect(screen.getByText(/1 rot/i)).toBeTruthy();
});

test("the queue counter shows what is left to decide", async () => {
  stubSources();
  render(<Shell queueCount={12}>content</Shell>);
  await waitFor(() => expect(screen.getByLabelText(/queue count/i).textContent).toContain("12"));
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
 * bar that says "all clear" before it knows anything. */
test("counts are absent, not zero, before the sources load", () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(<Shell queueCount={0}>content</Shell>);
  expect(screen.queryByText(/0 failing/i)).toBeNull();
});
