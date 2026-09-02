// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Stub } from "./Stub";

/* Stub renders inside Shell, which fires its own fetch("/api/sources") on
 * mount. Routed by URL rather than blanket-stubbed, same pattern as
 * Shell/Record/Queue/Admin -- a stub that ignores the URL hands the wrong
 * shape to summarise() and fails these tests for a reason they are not
 * about. */
function stubSources() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderStub() {
  stubSources();
  return render(
    <MemoryRouter>
      <Stub
        title="Radars"
        when="NOT BUILT · POST-GATE, SLICE SP8"
        body="Pre-RFP intelligence: expiring contracts and re-competes."
      />
    </MemoryRouter>,
  );
}

/* ⚖️ THE RULING'S WHOLE POINT (2026-09-01): all seven nav entries, each to a
 * stub rather than to a disabled control or to nothing. A stub that does not
 * render is the D14 dead end reached from a different direction -- and until
 * this file existed, Stub.tsx could have been deleted with every test in the
 * suite still green, because Shell.test.tsx only checks the nav's hrefs and
 * never that the destination draws anything. */
test("a stub names the screen, when it arrives, and what it will do", async () => {
  renderStub();
  await waitFor(() => expect(screen.getByRole("heading", { name: "Radars" })).toBeTruthy());
  expect(screen.getByText(/NOT BUILT · POST-GATE, SLICE SP8/)).toBeTruthy();
  expect(screen.getByText(/Pre-RFP intelligence/)).toBeTruthy();
});

/* The honest bottom line. A reader who lands here by clicking the nav needs
 * to know the screen is not broken and not permission-gated -- it does not
 * exist yet. If this sentence goes, the screen becomes a mystery rather than
 * a disclosure, which is the failure the ruling chose stubs to avoid. */
test("a stub says plainly that it is not built", async () => {
  renderStub();
  await waitFor(() => expect(screen.getByText(/This screen is not built/)).toBeTruthy());
  expect(screen.getByText(/rather than leading nowhere/)).toBeTruthy();
});

/* THE FRAME IS SCREEN 2's, and the first cut of this component got it wrong
 * in a way no test could see: it used <Section>, whose padding belongs to the
 * triage card's two-up band, and skipped the card entirely -- so the title
 * sat 30px out from its own paragraph on a bare canvas. The screenshot caught
 * it. This pins the card so a future refactor cannot quietly drop it again.
 *
 * ⚠️ This asserts STRUCTURE, not appearance. It would still pass against an
 * ugly screen; only a screenshot proves legibility (CLAUDE.md §4). */
test("a stub uses Screen 2's card frame", async () => {
  const { container } = renderStub();
  await waitFor(() => expect(container.querySelector(".stub__card")).toBeTruthy());
  const card = container.querySelector(".stub__card")!;
  expect(card.querySelector(".stub__title")).toBeTruthy();
  expect(card.querySelector(".stub__body")).toBeTruthy();
});
