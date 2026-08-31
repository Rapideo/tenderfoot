// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Queue } from "./Queue";

const ITEM = {
  id: 7,
  title: "Care-management workflow redesign",
  org_name: "Indiana FSSA",
  jurisdiction: "IN",
  closes_at: "2026-09-17",
  value_cents: 45000000,
  kind: "RFP",
  set_aside: null,
  source_name: "SAM.gov",
  documents: 3,
  sightings: 2,
  deadline_conflict: [],
};

function page(over: Record<string, unknown> = {}) {
  return { mode: "all", sample: null, total: 1, remaining: 1, items: [ITEM], ...over };
}

/* DEFECT FOUND HERE (Task 11): the brief's stub() returned the same `body`
 * for every fetch call regardless of URL. Queue renders Shell, and Shell
 * fires its OWN fetch("/api/sources") on mount (Shell.tsx:49) -- with the
 * original stub that request resolved to the QueuePage object instead of a
 * SourceRow[], and Shell's summarise() called `.filter` on it, throwing
 * "sources.filter is not a function" as an uncaught exception that failed
 * every single test here, none of which exercise anything this file is
 * actually testing. Routed by URL, same pattern Shell.test.tsx and
 * Admin.test.tsx already use, so Shell's own fetch gets a real (empty)
 * sources array and the queue fetches (GET /api/queue, POST the decision)
 * get the fixture body. */
function stub(body: unknown) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
    new Response(JSON.stringify(String(url).includes("/api/sources") ? [] : body), {
      status: 200,
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const renderQueue = () =>
  render(
    <MemoryRouter>
      <Queue />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

test("the card shows the four facts that decide most items", async () => {
  stub(page());
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());
  expect(screen.getByText(/Indiana FSSA/)).toBeTruthy();
  expect(screen.getByText(/2026-09-17/)).toBeTruthy();
  expect(screen.getByText(/450,000/)).toBeTruthy();
});

/* Region 1.1.1. This display currently carries the FSSA near-miss risk
 * ALONE, because the Gated Items Drawer is parked. */
test("a deadline disagreement is shown, not resolved away", async () => {
  stub(
    page({
      items: [
        {
          ...ITEM,
          deadline_conflict: [
            { value_text: "2026-08-26", origin: "document", quote: "proposals due August 26" },
          ],
        },
      ],
    }),
  );
  renderQueue();
  await waitFor(() => expect(screen.getByText(/2026-08-26/)).toBeTruthy());
  expect(screen.getByText(/proposals due August 26/)).toBeTruthy();
});

/* D13. The strip is built and lives on /dev/gallery; it does not render
 * here. A panel captioned "MACHINE SCORES" showing four dashes reads as
 * "the machine scored this and found nothing". */
test("no score strip appears on the card", async () => {
  stub(page());
  const { container } = renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());
  expect(container.querySelector(".score-strip")).toBeNull();
  expect(screen.queryByText(/machine scores/i)).toBeNull();
});

/* D15. None of the panel's four facts are extracted. It says so rather than
 * being quietly dropped -- if the session repeatedly wants a fact this
 * panel cannot give, that is a finding the gate should produce. */
test("the pursuit-cost panel renders, empty and labelled", async () => {
  stub(page());
  renderQueue();
  await waitFor(() => expect(screen.getByText(/pursuit cost/i)).toBeTruthy());
  expect(screen.getByText(/not yet extracted/i)).toBeTruthy();
});

test("sample mode announces itself and its denominator", async () => {
  stub(
    page({
      mode: "sample",
      sample: {
        id: 3,
        source_name: "SAM.gov",
        seed: "alpha",
        population_size: 4812,
        drawn: 100,
        decided: 12,
        n_requested: 100,
      },
    }),
  );
  renderQueue();
  await waitFor(() => expect(screen.getByText(/sample/i)).toBeTruthy());
  expect(screen.getByText(/4,812/)).toBeTruthy();
  expect(screen.getByText(/SAM\.gov/)).toBeTruthy();
});

test("Pass is blocked until a reason is given", async () => {
  const fetchMock = stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());

  screen.getByRole("button", { name: /^pass$/i }).click();
  await waitFor(() => expect(screen.getByText(/reason is required/i)).toBeTruthy());

  const posts = fetchMock.mock.calls.filter((c) => (c[1] as any)?.method === "POST");
  expect(posts).toHaveLength(0);
});

test("an empty queue offers somewhere to go", async () => {
  stub(page({ total: 0, remaining: 0, items: [] }));
  renderQueue();
  await waitFor(() => expect(screen.getByText(/queue cleared/i)).toBeTruthy());
  expect(screen.getByText(/draw another sample/i)).toBeTruthy();
});

/* Decisions are APPEND-ONLY (spec §5.1): undo does not edit or delete the
 * first decision -- it decides the row back to "New", appending a third
 * row, and both earlier rows survive. This asserts the actual POST body
 * undo sends, not just that a second POST happened. */
test("undo appends a return to New rather than deleting", async () => {
  const fetchMock = stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());

  screen.getByRole("button", { name: /interested/i }).click();
  await waitFor(() =>
    expect(fetchMock.mock.calls.some((c) => (c[1] as any)?.method === "POST")).toBe(true),
  );

  /* DEFECT FOUND HERE (Task 12): dispatching "u" right after that waitFor
   * resolves is a real race, not a hypothetical one -- both the POST and the
   * reload GET (fired by decide()'s `await load()`) settle via microtasks
   * that finish before the outer waitFor's very first synchronous check
   * even runs, since that check is already true the instant it is called
   * (the POST call was already recorded by the synchronous portion of the
   * click handler). React's own commit -- which reruns useQueueKeys's
   * effect and rebinds `undo` with the fresh `lastDecided` -- is scheduled
   * on a macrotask, so it has NOT happened yet at that point. Verified with
   * temporary logging: "decide load done" printed before "undo called,
   * lastDecided= null". A real user could never press "u" fast enough to
   * hit this -- network latency alone gives React ample time to commit --
   * so this is a test-timing gap, not a production bug. Forcing one real
   * macrotask tick lets the pending commit (and effect rerun) happen before
   * "u" is dispatched. */
  await new Promise((resolve) => setTimeout(resolve, 0));

  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "u", bubbles: true }));

  await waitFor(() => {
    const bodies = fetchMock.mock.calls
      .filter((c) => (c[1] as any)?.method === "POST")
      .map((c) => JSON.parse((c[1] as any).body));
    expect(bodies.some((b) => b.state === "New")).toBe(true);
  });
});
