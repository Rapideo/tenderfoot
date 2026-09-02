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
  posted_at: "2026-07-14",
  value_cents: 45000000,
  kind: "RFP",
  set_aside: null,
  source_name: "SAM.gov",
  documents: 3,
  sightings: 2,
  deadline_conflict: [],
  closed: false,
  deadline_unreliable: false,
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

/* MARKING SOMETHING INTERESTED IS THREE STEPS NOW, not one. Migration 013
 * made the discovery channel required on Interested (design spec §8.5 --
 * "the whole measure"), so `I` opens a step instead of deciding.
 *
 * Deliberately NOT a helper that swallows the intermediate states: each test
 * below still asserts the thing it is about. This only spares four unrelated
 * tests from re-spelling the same three clicks. `channel` defaults to
 * "Nowhere" because that is the answer the gate actually counts, so a
 * fixture that drifts to some other value fails visibly. */
async function markInterested(channel = "Nowhere") {
  screen.getByRole("button", { name: /^interested$/i }).click();
  await waitFor(() => expect(screen.getByRole("button", { name: channel })).toBeTruthy());
  screen.getByRole("button", { name: channel }).click();
  /* WAIT FOR THE SELECTION TO COMMIT before confirming. Clicking both in one
   * synchronous run reads a `channel` of null out of the confirm handler's
   * closure, decide() refuses, and no POST is sent -- which is the guard
   * working, not a flake. Same shape as the undo race documented below: React
   * commits on a macrotask, and a real operator cannot click twice inside
   * one. */
  await waitFor(() =>
    expect(screen.getByRole("button", { name: channel }).getAttribute("aria-pressed")).toBe(
      "true",
    ),
  );
  screen.getByRole("button", { name: /confirm interested/i }).click();
}

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

/* ⚖️ D13 REVERSED by Matt, 2026-09-01. This test asserted the OPPOSITE until
 * today ("no score strip appears on the card") and is inverted, not deleted,
 * so the reversal is visible in the diff rather than looking like coverage
 * that quietly evaporated.
 *
 * The ruling is not simply "render it". D13's objection was that four bare
 * dashes under "A READING AID" read as a RESULT -- the machine scored this
 * and found nothing. The ruling answers that objection with the note, so the
 * note is the load-bearing half and gets its own assertion below. Rendering
 * the strip WITHOUT it would satisfy a lazier version of this test and would
 * be the thing D13 was right about. */
test("the score strip renders, and says it is not populated yet", async () => {
  stub(page());
  const { container } = renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());
  expect(container.querySelector(".score-strip")).toBeTruthy();
  expect(screen.getByText(/machine scores — a reading aid/i)).toBeTruthy();
  /* The disclosure. Without this the four dashes are a verdict. */
  expect(screen.getByText(/nothing is scored yet/i)).toBeTruthy();
  /* All four rows render, and every one of them is empty. If a value ever
   * appears here it means something started wiring a scorer that does not
   * exist -- see the SCORES constant in Queue.tsx. */
  const bars = container.querySelectorAll(".score-bar");
  expect(bars.length).toBe(4);
  expect(container.querySelectorAll(".score-bar--empty").length).toBe(4);
});

/* D15. None of the panel's four facts are extracted. It says so rather than
 * being quietly dropped -- if the session repeatedly wants a fact this
 * panel cannot give, that is a finding the gate should produce.
 *
 * ⚠️ The title assertion changed 2026-09-01. It matched /pursuit cost/i,
 * which was a PARAPHRASE the SP6 plan introduced; the bundle's own copy is
 * "COST TO PURSUE — FACTS, NOT A SCORE" and copy is specification. The old
 * regex would have passed against the wrong words forever. */
test("the cost-to-pursue panel renders, empty and labelled", async () => {
  stub(page());
  renderQueue();
  await waitFor(() =>
    expect(screen.getByText(/cost to pursue — facts, not a score/i)).toBeTruthy(),
  );
  expect(screen.getByText(/not yet extracted/i)).toBeTruthy();
});

/* IMPORTANT fix. Spec §10: a drawn item whose deadline passes mid-session
 * stays in the sample and reachable, marked closed. The card must show
 * that, and must not show it for an ordinary open item. */
test("a closed drawn item is marked closed on the card", async () => {
  stub(page({ items: [{ ...ITEM, closed: true }] }));
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());
  /* The bundle's buyerNote treatment carries this, not a CLOSED microlabel.
   * The property under test is unchanged: a drawn item whose deadline passed
   * is still reachable AND is visibly marked. */
  expect(screen.getByText(/deadline has passed/i)).toBeTruthy();
  expect(screen.getByText(/still decidable/i)).toBeTruthy();
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
  /* getAllByText, not getByText: "SAM.gov" now renders TWICE -- once in the
   * sample banner and once in the source chip the bundle puts on the card.
   * A single-match query would fail for a reason unrelated to what this test
   * is about. */
  expect(screen.getAllByText(/SAM\.gov/).length).toBeGreaterThanOrEqual(1);
});

test("Pass is blocked until a reason is given", async () => {
  const fetchMock = stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());

  /* THE DECISION BAR IS TWO-STATE, as the bundle has it: Pass opens the reason
   * step, and the decision is only recorded on confirm. So the property is
   * asserted where it can actually be violated -- confirming with an empty
   * reason -- rather than at the first click. */
  screen.getByRole("button", { name: /^pass$/i }).click();
  await waitFor(() => expect(screen.getByLabelText("Reason")).toBeTruthy());

  screen.getByRole("button", { name: /confirm pass/i }).click();
  await waitFor(() => expect(screen.getByText(/reason is required/i)).toBeTruthy());
  /* The bundle's own label, restored 2026-09-02 -- we shipped "Confirm
   * pass". ariaLabel keeps the control targetable either way, so this
   * asserts the VISIBLE copy, which is what §7.10 governs. */
  expect(screen.getByRole("button", { name: /confirm pass/i }).textContent).toBe("Pass & next");

  /* The assertion that matters, unchanged: no decision reached the server. */
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

  await markInterested();
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

  await markInterested();
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
  await markInterested();

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

  await markInterested();
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

/* THE THREE-UP FACT PANEL -- the bundle's spine for this card, and the largest
 * gap the 2026-08-31 fidelity audit found. The SVRC calls these "the four
 * facts that decide most items without anything else being read". */
test("the card shows DEADLINE, EST. VALUE and POSTED as a labelled fact panel", async () => {
  stub(page());
  const { container } = renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());

  expect(screen.getByText("DEADLINE")).toBeTruthy();
  expect(screen.getByText("EST. VALUE")).toBeTruthy();
  expect(screen.getByText("POSTED")).toBeTruthy();

  /* Three cells, each carrying its own value -- not three labels over one
   * blob. A layout regression that collapsed them would fail here. */
  const cells = container.querySelectorAll(".queue__fact");
  expect(cells).toHaveLength(3);
  expect(screen.getByText("2026-09-17")).toBeTruthy();
  expect(screen.getByText("2026-07-14")).toBeTruthy();
  expect(screen.getByText(/450,000/)).toBeTruthy();
});

/* The deadline is coloured by urgency in the bundle, and the interval beneath
 * it is what tells a reader whether "2026-09-17" is soon. */
test("the deadline carries a human interval, not just a date", async () => {
  stub(page());
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());
  expect(screen.getByText(/days out|closes today|closed \d+ days ago/)).toBeTruthy();
});

/* THE DISAGREEMENT PANEL. This display currently carries the FSSA near-miss
 * risk ALONE, because Region 1.1.5's Gated Items Drawer is parked -- so it has
 * to show BOTH values with their sources and resolve nothing. */
test("a deadline disagreement shows both values side by side, unresolved", async () => {
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
  const { container } = renderQueue();
  await waitFor(() => expect(screen.getByText(/NOT RESOLVED/)).toBeTruthy());

  /* TWO cells: the listing's value and the document's. Showing only the loser
   * -- or only the winner -- would fail here, and either would be the exact
   * silent-resolution failure this panel exists to prevent. */
  const cells = container.querySelectorAll(".queue__conflict-cell");
  expect(cells).toHaveLength(2);
  const text = Array.from(cells).map((c) => c.textContent).join(" | ");
  expect(text).toContain("2026-09-17");
  expect(text).toContain("2026-08-26");
  expect(text).toContain("document");
});

/* 🔴 THE IMPOSSIBLE DEADLINE, on the screen. These rows reach the queue at all
 * only because of the 2026-09-01 eligibility fix -- 62 biddable, recently posted
 * opportunities were being filed as closed and dropped. Having admitted them,
 * the card must not then render the bad date as if it were real: "2006-09-24"
 * coloured by urgency under a "closes today" caption is a worse lie than the
 * hiding was. */
test("an impossible deadline shows as unknown, and says what the source claimed", async () => {
  stub(page({ items: [{ ...ITEM, closes_at: "2006-09-24", deadline_unreliable: true }] }));
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());

  /* The source's claim is still reported -- not discarded, not presented as a
   * deadline. */
  expect(screen.getByText(/Source states 2006-09-24, before it was posted/)).toBeTruthy();
  /* And it is NOT rendered as a live deadline with an urgency reading. */
  expect(screen.queryByText(/closes today/i)).toBeNull();
});


/* ===========================================================================
 * THE DISCOVERY CHANNEL — migration 013, client half, 2026-09-02
 * ===========================================================================
 * Design spec §8.5 calls discovery "the whole measure": qualified
 * opportunities surfaced THAT WOULD NOT HAVE BEEN SEEN. The server half
 * shipped on 2026-09-01 requiring the channel; until these tests passed, the
 * client did not send one and the Interested button answered 400 in the live
 * app. That is why the server half was held unmerged.
 */

test("Interested is blocked until a channel is picked, and nothing reaches the server", async () => {
  const fetchMock = stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  sessionStorage.setItem("tenderfoot.decidedBy", "matt");
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());

  /* The mirror of the Pass test above, and the property is asserted where it
   * can actually be violated: confirming with nothing selected. */
  screen.getByRole("button", { name: /^interested$/i }).click();
  await waitFor(() =>
    expect(screen.getByText(/WHERE ELSE WOULD THIS HAVE REACHED YOU/i)).toBeTruthy(),
  );

  screen.getByRole("button", { name: /confirm interested/i }).click();
  await waitFor(() => expect(screen.getByText(/Where else would this have reached you/i)).toBeTruthy());

  const posts = fetchMock.mock.calls.filter((c) => (c[1] as any)?.method === "POST");
  expect(posts).toHaveLength(0);
});

test("the Interested POST carries the discovery channel", async () => {
  const fetchMock = stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  sessionStorage.setItem("tenderfoot.decidedBy", "matt");
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());

  await markInterested("Indiana email");
  await waitFor(() =>
    expect(fetchMock.mock.calls.some((c) => (c[1] as any)?.method === "POST")).toBe(true),
  );

  const body = JSON.parse(
    (fetchMock.mock.calls.find((c) => (c[1] as any)?.method === "POST")![1] as any).body,
  );
  expect(body.state).toBe("Interested");
  /* The WIRE value, not the label. A test asserting "Indiana email" would
   * pass while the server's CHECK constraint rejected the row. */
  expect(body.discovery_channel).toBe("indiana_email");
});

test("all seven channels are offered, in the migration's order", async () => {
  stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());
  screen.getByRole("button", { name: /^interested$/i }).click();

  await waitFor(() => expect(screen.getByRole("button", { name: "Nowhere" })).toBeTruthy());
  const chips = Array.from(document.querySelectorAll(".choice-chip")).map((c) => c.textContent);
  expect(chips).toEqual([
    "Already knew",
    "Indiana email",
    "Portal",
    "Colleague",
    "Nowhere",
    "Not sure",
    "Other",
  ]);
});

test("the channel is single-select: picking a second replaces the first", async () => {
  const fetchMock = stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  sessionStorage.setItem("tenderfoot.decidedBy", "matt");
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());
  screen.getByRole("button", { name: /^interested$/i }).click();
  await waitFor(() => expect(screen.getByRole("button", { name: "Portal" })).toBeTruthy());

  screen.getByRole("button", { name: "Portal" }).click();
  screen.getByRole("button", { name: "Nowhere" }).click();

  /* Exactly one selected -- the column holds one value, and a UI that let two
   * look chosen would be lying about what it is about to store. */
  await waitFor(() =>
    expect(document.querySelectorAll(".choice-chip--on")).toHaveLength(1),
  );
  expect(screen.getByRole("button", { name: "Nowhere" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Portal" }).getAttribute("aria-pressed")).toBe("false");

  screen.getByRole("button", { name: /confirm interested/i }).click();
  await waitFor(() =>
    expect(fetchMock.mock.calls.some((c) => (c[1] as any)?.method === "POST")).toBe(true),
  );
  const body = JSON.parse(
    (fetchMock.mock.calls.find((c) => (c[1] as any)?.method === "POST")![1] as any).body,
  );
  expect(body.discovery_channel).toBe("nowhere");
});

test("a Pass carries no channel", async () => {
  const fetchMock = stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  sessionStorage.setItem("tenderfoot.decidedBy", "matt");
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());

  screen.getByRole("button", { name: /^pass$/i }).click();
  await waitFor(() => expect(screen.getByLabelText("Reason")).toBeTruthy());
  /* No chip row on this branch: SVRC 1.1.4 parked reason chips pending a
   * hand-run, and the discovery chips must not leak across the mode. */
  expect(document.querySelectorAll(".choice-chip")).toHaveLength(0);

  (screen.getByLabelText("Reason") as HTMLInputElement).focus();
  const input = screen.getByLabelText("Reason") as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  setter.call(input, "Out of geography");
  input.dispatchEvent(new Event("input", { bubbles: true }));

  screen.getByRole("button", { name: /confirm pass/i }).click();
  await waitFor(() =>
    expect(fetchMock.mock.calls.some((c) => (c[1] as any)?.method === "POST")).toBe(true),
  );

  const body = JSON.parse(
    (fetchMock.mock.calls.find((c) => (c[1] as any)?.method === "POST")![1] as any).body,
  );
  expect(body.state).toBe("Not Interested");
  /* §8.5 asks about QUALIFIED opportunities. A channel on a rejected item
   * would enter the denominator of a rate it is not part of. */
  expect(body.discovery_channel).toBeNull();
});

test("backing out of Interested clears the channel rather than carrying it over", async () => {
  stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());

  screen.getByRole("button", { name: /^interested$/i }).click();
  await waitFor(() => expect(screen.getByRole("button", { name: "Colleague" })).toBeTruthy());
  screen.getByRole("button", { name: "Colleague" }).click();
  await waitFor(() => expect(document.querySelectorAll(".choice-chip--on")).toHaveLength(1));

  screen.getByRole("button", { name: "Back" }).click();
  await waitFor(() => expect(screen.getByRole("button", { name: /^pass$/i })).toBeTruthy());

  /* Reopening must not present a stale answer as this card's answer. A
   * channel left selected from an abandoned decision is the quiet way a
   * discovery rate stops being defensible. */
  screen.getByRole("button", { name: /^interested$/i }).click();
  await waitFor(() => expect(screen.getByRole("button", { name: "Colleague" })).toBeTruthy());
  expect(document.querySelectorAll(".choice-chip--on")).toHaveLength(0);
});

test("the two confirms do not look alike -- a rejection is not a save", async () => {
  stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());

  screen.getByRole("button", { name: /^pass$/i }).click();
  await waitFor(() => expect(screen.getByLabelText("Reason")).toBeTruthy());
  const passConfirm = screen.getByRole("button", { name: /confirm pass/i }).className;
  screen.getByRole("button", { name: "Back" }).click();

  await waitFor(() => expect(screen.getByRole("button", { name: /^interested$/i })).toBeTruthy());
  screen.getByRole("button", { name: /^interested$/i }).click();
  await waitFor(() => expect(screen.getByRole("button", { name: "Nowhere" })).toBeTruthy());
  const yesConfirm = screen.getByRole("button", { name: /confirm interested/i }).className;

  /* The bundle branches confirmStyle on exactly this: --bad/--baddk on the
   * pass branch, --acc/--accbrd on the other. Built as one variant, both
   * branches would render accent and the distinction would be lost at the
   * moment of committing. */
  expect(passConfirm).not.toBe(yesConfirm);
  expect(passConfirm).toMatch(/btn--danger/);
  expect(yesConfirm).toMatch(/btn--primary/);
});

test("the prompt and help are the bundle's own copy, per branch", async () => {
  stub(page());
  sessionStorage.setItem("tenderfoot.adminSecret", "s3cret");
  renderQueue();
  await waitFor(() => expect(screen.getByText(ITEM.title)).toBeTruthy());

  screen.getByRole("button", { name: /^pass$/i }).click();
  /* Verbatim from the bundle's reasonPrompt/reasonHelp ternary. Ruled by
   * Matt 2026-09-02 after the audit found we had invented both. */
  await waitFor(() => expect(screen.getByText("WHY NOT? — REQUIRED")).toBeTruthy());
  expect(
    screen.getByText("A rejection with no reason is the one event that teaches nothing."),
  ).toBeTruthy();

  /* reasonAccent is a ternary in the bundle and was a constant here: the
   * discovery prompt would have rendered in the rejection colour. */
  expect(screen.getByText("WHY NOT? — REQUIRED").className).toMatch(/--bad/);

  screen.getByRole("button", { name: "Back" }).click();
  await waitFor(() => expect(screen.getByRole("button", { name: /^interested$/i })).toBeTruthy());
  screen.getByRole("button", { name: /^interested$/i }).click();

  await waitFor(() =>
    expect(screen.getByText("WHERE ELSE WOULD THIS HAVE REACHED YOU? — REQUIRED")).toBeTruthy(),
  );
  expect(
    screen.getByText("WHERE ELSE WOULD THIS HAVE REACHED YOU? — REQUIRED").className,
  ).toMatch(/--acc/);
});
