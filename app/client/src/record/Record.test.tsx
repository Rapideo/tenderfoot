// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Record } from "./Record";

const RECORD = {
  id: 7,
  title: "Care-management workflow redesign",
  org_name: "Indiana FSSA",
  closes_at: "2026-09-17",
  fields: [
    {
      field_name: "closes_at", value: "2026-09-17", origin: "listing",
      confidence: 1, quote: null, note: null, state: "found",
      conflicts: [
        {
          value_text: "2026-08-26", origin: "document",
          quote: "proposals due August 26, 2026", confidence: 0.72,
        },
      ],
    },
    {
      field_name: "value_cents", value: null, origin: "document",
      confidence: null, quote: null, note: null, state: "absent", conflicts: [],
    },
    {
      field_name: "set_aside", value: null, origin: null,
      confidence: null, quote: null, note: null, state: "not_looked_for", conflicts: [],
    },
  ],
  documents: [
    {
      id: 1, filename: "SCOPE OF WORK.docx", media_type: "docx",
      extract_status: "extracted", source_url: "https://sam.gov/a.docx",
      extracted_text: "The deadline is September 17, 2026.",
    },
  ],
  timeline: [
    { kind: "sighting", at: "2026-08-10T00:00:00Z", source_name: "SAM.gov", detail: "Seen in SAM.gov" },
    { kind: "resolution", at: "2026-08-11T00:00:00Z", source_name: null, detail: "Buyer resolved to Indiana FSSA" },
  ],
  decision: null,
};

/* Record renders inside Shell, and Shell fires its OWN fetch("/api/sources")
 * on mount (Shell.tsx:49) -- unrelated to the record body this file is
 * actually testing. A stub that ignores the URL hands the record fixture to
 * Shell, whose summarise() then calls `.filter` on it and throws "sources.
 * filter is not a function" as an uncaught exception, failing every test in
 * this file for a reason none of them are actually about. This cost a fix
 * round on Task 11 (Queue.test.tsx); routed by URL here from the start, same
 * pattern as Shell.test.tsx, Admin.test.tsx and Queue.test.tsx. */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderRecord(body: unknown = RECORD) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      new Response(
        JSON.stringify(String(url).includes("/api/sources") ? [] : body),
        { status: 200 },
      ),
    ),
  );
  return render(
    <MemoryRouter initialEntries={["/solicitation/7"]}>
      <Routes>
        <Route path="/solicitation/:id" element={<Record />} />
      </Routes>
    </MemoryRouter>,
  );
}

/* SP4 criterion bullet 2, deferred here by ruling. Until this renders, SP4
 * proves a citation is STORED, never that it is READABLE.
 *
 * DEFECT FOUND HERE (mutation testing, task 13): the brief's original
 * version of this test asserted only /72%/, which is the CONFLICT's
 * confidence (0.72), not the winning field's own (confidence: 1 -> "100%").
 * Deleting the winner's own `{pct(f.confidence)}` span left every one of
 * the five tests in this file green -- the winning field's own confidence
 * had zero coverage, even though the test's name claims "a field shows...
 * its confidence". Added the /100%/ assertion below to close that gap;
 * confirmed by re-running the same mutation, which now fails this test. */
test("a field shows its value, its confidence, and its quoted passage", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByText(/2026-09-17/)).toBeTruthy());
  expect(screen.getByText(/100%/)).toBeTruthy();
  /* The near-miss conflict's own confidence and quote -- both are absent
   * from the winning field itself (a listing-origin value has no extracted
   * passage), so this is the citation evidence that makes the deadline
   * disagreement inspectable rather than merely stored. */
  expect(screen.getByText(/72%/)).toBeTruthy();
  expect(screen.getByText(/proposals due August 26, 2026/)).toBeTruthy();
});

/* SP4 criterion bullet 3. The FSSA near-miss, visible in the product for
 * the first time. */
test("a conflict renders beneath the winner, with its origin", async () => {
  const { container } = renderRecord();
  await waitFor(() => expect(screen.getByText(/2026-08-26/)).toBeTruthy());
  const conflict = container.querySelector(".record__conflict");
  expect(conflict).toBeTruthy();
  expect(conflict!.textContent).toContain("document");
});

test("absent and never-looked-for read differently", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByText(/absent from bundle/i)).toBeTruthy());
  expect(screen.getByText(/not yet looked for/i)).toBeTruthy();
});

/* D12. The bytes were discarded by SP4's ruling, so the link out is the
 * only route back to the original. */
test("a document links out and shows its extracted text", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByText(/SCOPE OF WORK.docx/)).toBeTruthy());
  const link = screen.getByRole("link", { name: /SCOPE OF WORK.docx/i });
  expect(link.getAttribute("href")).toBe("https://sam.gov/a.docx");
  expect(screen.getByText(/The deadline is September 17, 2026/)).toBeTruthy();
});

/* D12, fixed: media_type was declared on Doc and never rendered. */
test("a document shows its media type", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByText(/SCOPE OF WORK.docx/)).toBeTruthy());
  expect(screen.getByText("docx")).toBeTruthy();
});

test("the timeline shows what the documents did and what the system decided", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByText(/Seen in SAM.gov/)).toBeTruthy());
  expect(screen.getByText(/Buyer resolved to Indiana FSSA/)).toBeTruthy();
});
