// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
  closed: false,
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

/* IMPORTANT fix. Spec §10: a drawn item whose deadline passes mid-session
 * stays in the sample and reachable, marked closed. The card must show
 * that, and must not show it for an ordinary open item. */
test("a closed drawn item is marked closed on the card", async () => {
  stub(page({ items: [{ ...ITEM, closed: true }] }));
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());
  expect(screen.getByText(/^CLOSED$/)).toBeTruthy();
});

test("an open item is not marked closed on the card", async () => {
  stub(page());
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());
  expect(screen.queryByText(/^CLOSED$/)).toBeNull();
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

/* CRITICAL fix. The server accepts and stores decided_by (routes/triage.ts,
 * triage/decide.ts) and it is tested there -- but nothing on the client sent
 * it, so every row the gate counts would have been written with
 * decided_by = NULL, and that cannot be backfilled. Spec §5.3: "decided_by
 * is set once per session and stored on every row." */
test("the decision POST carries decided_by", async () => {
  const fetchMock = stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  sessionStorage.setItem("tenderfoot.decidedBy", "matt");
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());

  screen.getByRole("button", { name: /interested/i }).click();
  await waitFor(() =>
    expect(fetchMock.mock.calls.some((c) => (c[1] as any)?.method === "POST")).toBe(true),
  );

  const body = JSON.parse(
    (fetchMock.mock.calls.find((c) => (c[1] as any)?.method === "POST")![1] as any).body,
  );
  expect(body.decided_by).toBe("matt");
});

test("a seeded decided_by is used without prompting", async () => {
  const fetchMock = stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  sessionStorage.setItem("tenderfoot.decidedBy", "matt");
  const promptSpy = vi.spyOn(window, "prompt");
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());

  screen.getByRole("button", { name: /interested/i }).click();
  await waitFor(() =>
    expect(fetchMock.mock.calls.some((c) => (c[1] as any)?.method === "POST")).toBe(true),
  );
  expect(promptSpy).not.toHaveBeenCalled();
});

/* IMPORTANT fix. adminSecret.ts's own comment: "Call on a 401 -- a wrong
 * secret must not silently break every later click." Admin.tsx honours this
 * in five places; Queue.tsx's decide() did not, which would brick the whole
 * triage session on one mistyped secret with no in-app recovery. */
test("a 401 on decide clears the stored admin secret", async () => {
  sessionStorage.setItem("tenderfoot.adminSecret", "wrong-secret");
  sessionStorage.setItem("tenderfoot.decidedBy", "matt");
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      return new Response(JSON.stringify({ error: "bad secret" }), { status: 401 });
    }
    return new Response(
      JSON.stringify(String(url).includes("/api/sources") ? [] : page()),
      { status: 200 },
    );
  });
  vi.stubGlobal("fetch", fetchMock);

  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());
  screen.getByRole("button", { name: /interested/i }).click();

  await waitFor(() => expect(sessionStorage.getItem("tenderfoot.adminSecret")).toBeNull());
});

test("an empty queue offers somewhere to go, and states how a new sample is drawn", async () => {
  stub(page({ total: 0, remaining: 0, items: [] }));
  renderQueue();
  await waitFor(() => expect(screen.getByText(/queue cleared/i)).toBeTruthy());
  /* D14, corrected: "Draw another sample" is gone -- there is no
   * draw-a-sample UI anywhere in the product. The screen states the fact
   * plainly instead of promising a button that does not exist. */
  expect(screen.queryByText(/draw another sample/i)).toBeNull();
  expect(screen.getByText(/drawn via/i)).toBeTruthy();
  expect(screen.getByText(/POST \/api\/triage\/samples/)).toBeTruthy();
});

/* D14, corrected: both remaining cards must actually navigate -- the
 * original defect was that neither had an onClick at all. There is no
 * separate metrics view in the product, so both land on /admin. */
test("Metrics and Admin both navigate away from the dead end", async () => {
  stub(page({ total: 0, remaining: 0, items: [] }));
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Queue />} />
        <Route path="/admin" element={<div>ADMIN SCREEN MARKER</div>} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByText(/queue cleared/i)).toBeTruthy());

  screen.getByText("Metrics").closest("button")!.click();
  await waitFor(() => expect(screen.getByText(/ADMIN SCREEN MARKER/)).toBeTruthy());
});

test("the Admin card navigates to /admin", async () => {
  stub(page({ total: 0, remaining: 0, items: [] }));
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Queue />} />
        <Route path="/admin" element={<div>ADMIN SCREEN MARKER</div>} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByText(/queue cleared/i)).toBeTruthy());

  screen.getByText("Admin").closest("button")!.click();
  await waitFor(() => expect(screen.getByText(/ADMIN SCREEN MARKER/)).toBeTruthy());
});

/* Decisions are APPEND-ONLY (spec §5.1): undo does not edit or delete the
 * first decision -- it decides the row back to "New", appending a third
 * row, and both earlier rows survive. This asserts the actual POST body
 * undo sends, not just that a second POST happened. */
test("undo appends a return to New rather than deleting", async () => {
  const fetchMock = stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  sessionStorage.setItem("tenderfoot.decidedBy", "matt");
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
