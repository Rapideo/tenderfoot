// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Record } from "./Record";

const RECORD = {
  id: 7,
  title: "Care-management workflow redesign",
  org_name: "Indiana FSSA",
  source_name: "SAM.gov",
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
    /* A DOCUMENT-ORIGIN FIELD THAT CARRIES ITS OWN QUOTE, added 2026-09-01.
     *
     * Until today the fixture's ONLY quote hung off the conflict on
     * `closes_at`, because a listing-origin winner has no extracted passage.
     * Matt's inline-conflict ruling drops the loser's quote from the screen
     * (D18), which would have taken the suite's only coverage of
     * .record__quote with it and left the quote rendering deletable with
     * every test still green -- the exact failure mode CLAUDE.md §4 asks
     * about ("would this still pass if I deleted the thing it tests?").
     * This row keeps that coverage on a field where a quote genuinely
     * belongs. confidence 0.6 is what fields.ts actually emits. */
    {
      field_name: "qa_closes_at", value: "2026-09-03", origin: "document",
      source_label: "SCOPE OF WORK.docx",
      confidence: 0.6, quote: "questions must be received by September 3, 2026",
      note: null, state: "found", conflicts: [],
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

/* Screen 2 is TABBED, as the bundle has it. Extracted Fields is the default;
 * Documents and Timeline need their tab. */
async function openTab(name: RegExp) {
  screen.getByRole("tab", { name }).click();
  await waitFor(() => expect(screen.getByRole("tab", { name })).toHaveProperty("ariaSelected", "true"));
}

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
  /* getAllByText: "2026-09-17" now renders TWICE -- in the field's VALUE cell
   * and in the card subtitle ("… · closes 2026-09-17"), which the bundle puts
   * there. A single-match query would fail for a reason unrelated to what
   * this test is about. */
  await waitFor(() => expect(screen.getAllByText(/2026-09-17/).length).toBeGreaterThan(0));
  expect(screen.getByText(/100%/)).toBeTruthy();
  /* The citation evidence -- SP4's deferred bullet 2, and the whole reason
   * this screen exists. Carried by qa_closes_at since 2026-09-01: the
   * conflict's quote that used to prove this is no longer rendered (D18). */
  expect(screen.getByText(/60%/)).toBeTruthy();
  expect(screen.getByText(/questions must be received by September 3, 2026/)).toBeTruthy();
});

/* SP4 criterion bullet 3. The FSSA near-miss, visible in the product.
 *
 * ⚖️ REWRITTEN 2026-09-01 for Matt's ruling: the conflict renders INLINE in
 * the value cell, as the bundle draws it, not beneath the winner as SP6 spec
 * §6.1 had specified. The three things that must survive that change are
 * asserted separately below, because they are three different losses if any
 * one of them silently stops rendering. */
test("a conflict renders inline in the value cell, naming both values", async () => {
  const { container } = renderRecord();
  await waitFor(() => expect(screen.getByText(/2026-08-26/)).toBeTruthy());

  /* 1. ONE cell carries both values and the bundle's own connective word. */
  const value = container.querySelector(".record__field-value");
  expect(value!.textContent).toContain("2026-09-17");
  expect(value!.textContent).toContain("CONFLICT with");
  expect(value!.textContent).toContain("2026-08-26");

  /* 2. BOTH origins are named, joined as the bundle's fixture joins them
   *    ("listing + addendum"). This is the losing value's surviving
   *    provenance -- its quote is gone (D18), so if this stops rendering
   *    the disagreement becomes unattributable. */
  const source = screen.getByText(/listing \+ document/);
  expect(source).toBeTruthy();

  /* 2b. ⚠️ AND THE TITLE CARRIES IT IN FULL, which is the only reason the
   *     above is readable. The SOURCE column is a fixed 150px and truncates
   *     with an ellipsis (Matt's ruling 2026-08-31); a conflicted row now
   *     puts TWO source names in that cell, so in a real browser the second
   *     one is off the end. The DOM assertion above passes either way --
   *     that gap between "the text exists" and "a person can read it" is
   *     exactly what CLAUDE.md §4 is about -- so the hover fallback is
   *     pinned here rather than assumed. */
  expect(source.getAttribute("title")).toBe("listing + document");

  /* 3. The row still reads as a disagreement: --badbg2 ground and a --bad
   *    confidence, both of which the bundle uses to mark a conflicted row.
   *    Without these the inline text is the ONLY signal, in a table where
   *    long values already wrap. */
  const row = container.querySelector(".record__fieldgroup [style*='--badbg2']")
    ?? container.querySelector("[style*='--badbg2']");
  expect(row).toBeTruthy();
});

/* ⚠️ D18, asserted rather than merely written down. The losing value's quote
 * is NOT rendered anywhere after the inline ruling. This test exists so that
 * if someone later reinstates it, they are told that it is a reversal of a
 * ruling and not a bug fix -- and so the deviation cannot quietly rot. */
test("the losing value's quote is not rendered — D18", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByText(/2026-08-26/)).toBeTruthy());
  expect(screen.queryByText(/proposals due August 26, 2026/)).toBeNull();
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
  await waitFor(() => expect(screen.getByRole("tab", { name: /documents/i })).toBeTruthy());
  await openTab(/documents/i);
  const link = screen.getByRole("link", { name: /SCOPE OF WORK.docx/i });
  expect(link.getAttribute("href")).toBe("https://sam.gov/a.docx");
  expect(screen.getByText(/The deadline is September 17, 2026/)).toBeTruthy();
});

/* D12, fixed: media_type was declared on Doc and never rendered. */
test("a document shows its media type", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByRole("tab", { name: /documents/i })).toBeTruthy());
  await openTab(/documents/i);
  /* The bundle tags each file with an UPPERCASE extension chip on a colour --
   * PDF red, DOCX accent, XLSX green. The property is unchanged: the media
   * type is shown. Its presentation is now the bundle's. */
  expect(screen.getByText("DOCX")).toBeTruthy();
});

test("the timeline shows what the documents did and what the system decided", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByRole("tab", { name: /timeline/i })).toBeTruthy());
  await openTab(/timeline/i);
  expect(screen.getByText(/Seen in SAM.gov/)).toBeTruthy();
  expect(screen.getByText(/Buyer resolved to Indiana FSSA/)).toBeTruthy();
});

/* SCREEN 2 IS TABBED -- that is the bundle's organising principle for this
 * screen, and stacking every section down one page was the structural gap the
 * 2026-08-31 fidelity audit found. */
test("the record is tabbed, defaulting to Extracted Fields", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByRole("tab", { name: /extracted fields/i })).toBeTruthy());

  const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
  expect(tabs).toEqual([
    "Extracted Fields", "Documents", "Timeline", "Brief", "Scores & Evidence",
  ]);
  expect(screen.getByRole("tab", { name: /extracted fields/i })).toHaveProperty(
    "ariaSelected", "true",
  );

  /* One tab's content at a time -- the timeline must NOT be on screen while
   * Fields is selected, or the tabs are decoration over a stacked page. */
  expect(screen.queryByText(/Seen in SAM.gov/)).toBeNull();
});

/* The two parked tabs disclose the parking rather than inventing content --
 * the Brief's live half is qualification, and View 2.2 is parked with scoring. */
test("the parked tabs say they are parked, and invent nothing", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByRole("tab", { name: /^brief$/i })).toBeTruthy());

  await openTab(/^brief$/i);
  expect(screen.getByText(/parked for V1/i)).toBeTruthy();
  expect(screen.getByText(/qualification is\s+undesigned|undesigned by decision/i)).toBeTruthy();

  await openTab(/scores & evidence/i);
  expect(screen.getByText(/no scores to cite/i)).toBeTruthy();
});

/* The bundle puts a route back to the queue on this screen; ours had none but
 * the browser button. */
test("there is a way back to the queue", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByRole("button", { name: /back to queue/i })).toBeTruthy());
  expect(screen.getByRole("button", { name: /all opportunities/i })).toBeTruthy();
});

/* The bundle's subtitle is "buyer · source · closes date", not the buyer alone. */
test("the subtitle names the buyer, the source and the closing date", async () => {
  renderRecord();
  await waitFor(() => expect(screen.getByText(/Indiana FSSA · SAM.gov · closes 2026-09-17/)).toBeTruthy());
});

/* The full filename must survive truncation -- it is truncated for LAYOUT, and
 * a citation you cannot read in full is not a citation. Matt's ruling was to
 * keep the bundle's 150px column and put the name on hover, so the title
 * attribute IS the guarantee and needs a test of its own. */
test("a truncated SOURCE still carries its full filename", async () => {
  const long = "Solicitation Amendment M6700126Q01350001 SF 30.pdf";
  renderRecord({
    ...RECORD,
    fields: [
      {
        field_name: "closes_at", value: "2026-09-17", origin: "document",
        source_label: long, confidence: 0.6, quote: null, note: null,
        state: "found", conflicts: [],
      },
    ],
  });
  await waitFor(() => expect(screen.getByText(long)).toBeTruthy());
  expect(screen.getByText(long).getAttribute("title")).toBe(long);
});

/* THE DOCUMENTS TAB IS TWO PANES, as the bundle has it: a 300px file list
 * beside a reader. Selecting a file changes what the reader shows -- a flat
 * list of every file's text, which is what shipped first, is a different
 * screen. */
test("documents are a file list beside a reader, and selecting changes the reader", async () => {
  renderRecord({
    ...RECORD,
    documents: [
      { id: 1, filename: "SCOPE OF WORK.docx", media_type: "docx",
        extract_status: "extracted", source_url: "https://sam.gov/a.docx",
        extracted_text: "The deadline is September 17, 2026." },
      { id: 2, filename: "Pricing.xlsx", media_type: "xlsx",
        extract_status: "extracted", source_url: null,
        extracted_text: "Unit price schedule, sheet 1 of 2." },
    ],
  });
  await waitFor(() => expect(screen.getByRole("tab", { name: /documents/i })).toBeTruthy());
  await openTab(/documents/i);

  expect(screen.getByText(/BUNDLE — 2 FILES/)).toBeTruthy();
  expect(screen.getByText("DOCX")).toBeTruthy();
  expect(screen.getByText("XLSX")).toBeTruthy();

  /* The reader shows the FIRST file, not all of them. */
  expect(screen.getByText(/deadline is September 17/)).toBeTruthy();
  expect(screen.queryByText(/Unit price schedule/)).toBeNull();

  /* Selecting the second swaps the reader. */
  screen.getByText("Pricing.xlsx").closest("button")!.click();
  await waitFor(() => expect(screen.getByText(/Unit price schedule/)).toBeTruthy());
  expect(screen.queryByText(/deadline is September 17/)).toBeNull();
});

/* The bundle's timeline is a RAIL -- a dot per event over a connecting line --
 * and the dot colour separates what the DOCUMENTS did from what the SYSTEM
 * decided. Ours was a flat date-and-text row. */
test("the timeline is a rail, and distinguishes a system decision from a sighting", async () => {
  const { container } = renderRecord();
  await waitFor(() => expect(screen.getByRole("tab", { name: /timeline/i })).toBeTruthy());
  await openTab(/timeline/i);

  expect(container.querySelectorAll(".record__dot")).toHaveLength(2);
  expect(container.querySelectorAll(".record__railline")).toHaveLength(2);

  /* Entity resolution is "the least visible thing the system does and the
   * easiest to get silently wrong" -- so it must read differently from a
   * sighting, not just sit in the same list. */
  expect(screen.getByText(/System decision/)).toBeTruthy();
  expect(screen.getByText(/Sighting — carried by SAM.gov/)).toBeTruthy();
});
