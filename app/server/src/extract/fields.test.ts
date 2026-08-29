import { expect, test } from "vitest";
import { extractFields } from "./fields.js";

test("finds a close date and quotes the passage it came from", () => {
  const f = extractFields("Sealed proposals are due September 17, 2026 at 3:00 PM.");
  const closes = f.find((x) => x.field_name === "closes_at");
  expect(closes?.value_text).toBe("2026-09-17");
  /* The citation IS the quote -- Matt's ruling. A value without its passage
   * cannot be checked by the person who has to trust it. */
  expect(closes?.quote).toMatch(/September 17, 2026/);
});

test("distinguishes the Q&A deadline from the close date", () => {
  /* migration 002: qa_closes_at is "often earlier and more binding". */
  const f = extractFields(
    "Questions must be submitted by August 5, 2026. Proposals are due September 17, 2026.",
  );
  expect(f.find((x) => x.field_name === "qa_closes_at")?.value_text).toBe("2026-08-05");
  expect(f.find((x) => x.field_name === "closes_at")?.value_text).toBe("2026-09-17");
});

test("absence is recorded as looked-for, not omitted", () => {
  /* value_text NULL means we looked and it is not there. No row would mean we
   * never looked -- a different fact, and migration 002 insists on it. */
  const f = extractFields("This document contains no dates whatsoever.");
  const closes = f.find((x) => x.field_name === "closes_at");
  expect(closes).toBeDefined();
  expect(closes?.value_text).toBeNull();
});

test("clamps the cue lookback at the line break -- a schedule-of-events table", () => {
  /* Round 2, fix 1 (CRITICAL). A padded table puts three or four rows inside
   * the old raw 120-character window, so every date could see its
   * neighbours' cue words. Pre-fix this produced closes_at = 2026-08-12 (the
   * Answers-Posted row, 36 days early) with a quote ending "...Proposals
   * Due" that reads like corroboration. Each row must be judged only by its
   * own line. */
  const text = [
    "Deadline for Questions         August 5, 2026",
    "Answers Posted                 August 12, 2026",
    "Proposals Due                  September 17, 2026",
  ].join("\n");
  const f = extractFields(text);
  expect(f.find((x) => x.field_name === "qa_closes_at")?.value_text).toBe("2026-08-05");
  expect(f.find((x) => x.field_name === "closes_at")?.value_text).toBe("2026-09-17");
});

test("clamps the cue lookback at the line break -- a heading does not bleed into the next section", () => {
  /* Round 2, fix 1. "Questions and Clarifications" is a heading, not a cue
   * for the date two lines down; the date's own line says "due", which is
   * the correct, closer cue and must not lose to the heading's word. */
  const text = "Questions and Clarifications\n\nProposals are due September 17, 2026.";
  const f = extractFields(text);
  expect(f.find((x) => x.field_name === "closes_at")?.value_text).toBe("2026-09-17");
  expect(f.find((x) => x.field_name === "qa_closes_at")?.value_text).toBeNull();
});

test("the quote always contains the cue that justified the classification", () => {
  /* Round 2, fix 2 (CRITICAL). Classification looks back up to 120
   * characters; the old quote only looked back 80. A cue between 81 and 120
   * characters away could classify a date without the citation ever showing
   * why -- precisely when the call is shakiest. */
  const filler = "x".repeat(80);
  const text = `Deadline ${filler} the proposal closes on September 17, 2026.`;
  const f = extractFields(text);
  const closes = f.find((x) => x.field_name === "closes_at");
  expect(closes?.value_text).toBe("2026-09-17");
  expect(closes?.quote).toMatch(/Deadline/);
});

test("cue words do not match inside unrelated words that merely contain them", () => {
  /* Round 2, fix 4 (IMPORTANT). Plain substring matching let "due", "closing"
   * and "site visit" fire from the middle of unrelated words. None of these
   * five sentences contains a real cue, so none should classify a field. */
  const cases = [
    "Handle any hazardous residue by August 5, 2026.",
    "Payment is overdue as of August 5, 2026.",
    "The vendor is disclosing pricing details on August 5, 2026.",
    "The lender is foreclosing on the property before August 5, 2026.",
    "Check the website visitor count by August 5, 2026.",
  ];
  for (const text of cases) {
    const f = extractFields(text);
    expect(f.every((x) => x.value_text === null), text).toBe(true);
  }
});

test("stem-safe cues still match genuine plurals and phrases", () => {
  /* Round 2, fix 4 -- the boundary fix must not cost real recall. */
  const inquiries = extractFields("Submit all inquiries by August 5, 2026.");
  expect(inquiries.find((x) => x.field_name === "qa_closes_at")?.value_text).toBe("2026-08-05");

  const siteVisit = extractFields("Attend the site visit on August 5, 2026.");
  expect(siteVisit.find((x) => x.field_name === "prebid_at")?.value_text).toBe("2026-08-05");
});

test("an invalid calendar date is rejected rather than fabricated", () => {
  /* Round 2, fix 5 (IMPORTANT). "February 31" and "September 0" match the
   * DATE pattern syntactically but do not exist. A measurable miss (null +
   * a note) beats an invented value that nothing downstream would catch. */
  const f1 = extractFields("Proposals are due February 31, 2026.");
  const closes1 = f1.find((x) => x.field_name === "closes_at");
  expect(closes1?.value_text).toBeNull();
  expect(closes1?.note).toMatch(/valid|parse|calendar/i);

  const f2 = extractFields("Proposals are due September 0, 2026.");
  expect(f2.find((x) => x.field_name === "closes_at")?.value_text).toBeNull();
});

test("fields with no extraction logic say so, instead of looking like a checked absence", () => {
  /* Round 2, fix 6 (IMPORTANT). migration 008: a NULL value_text means
   * "looked and it is not there." These three fields were never looked for
   * at all -- that is a different fact and must say so via `note`. */
  const f = extractFields("This document contains no dates whatsoever.");
  for (const name of ["prebid_required", "set_aside", "value_cents"] as const) {
    const row = f.find((x) => x.field_name === name);
    expect(row?.value_text).toBeNull();
    expect(row?.note).toBe("not extracted");
  }
});

test("a date that could not be classified is distinguished from a document with no dates", () => {
  /* Round 2, fix 6. Without this, "we found a date but no cue was close
   * enough" and "there is no date in this document" produce identical
   * output -- collapsing a recall miss into a true negative and making the
   * extractor's measured accuracy look better than it is. */
  const noDate = extractFields("This document contains no dates whatsoever.");
  expect(noDate.find((x) => x.field_name === "closes_at")?.note).toBeUndefined();

  const unclassified = extractFields("A meeting took place on August 5, 2026 to discuss logistics.");
  const closes = unclassified.find((x) => x.field_name === "closes_at");
  expect(closes?.value_text).toBeNull();
  expect(closes?.note).toBeDefined();
});

test("clamps the cue lookback at HTML block boundaries -- mammoth emits zero newlines", () => {
  /* Round 3, fix 1 (CRITICAL). mammoth.convertToHtml emits NO newlines at
   * all (52/52 corpus DOCX measured zero \n), so the round-2 "\n" clamp was
   * a no-op on the DOCX path and this exact bug -- closes_at landing on the
   * Answers-Posted row -- was still live there. A schedule table survives
   * convertToHtml as <tr><td> rows (see parsers/docx.test.ts), so those
   * closing tags (plus </p> and <br> variants) are the real row boundaries
   * on this path. */
  const text =
    "<table><tr><td>Deadline for Questions         August 5, 2026</td></tr>" +
    "<tr><td>Answers Posted                 August 12, 2026</td></tr>" +
    "<tr><td>Proposals Due                  September 17, 2026</td></tr></table>";
  const f = extractFields(text);
  expect(f.find((x) => x.field_name === "qa_closes_at")?.value_text).toBe("2026-08-05");
  expect(f.find((x) => x.field_name === "closes_at")?.value_text).toBe("2026-09-17");
});

test("fixed-priority order is pinned behaviourally, not just described in a comment", () => {
  /* Round 3, fix 2. The fix-3 comment claims cues are tried in fixed
   * priority order, not by proximity. These two cases pin that claim to
   * actual output: in each, the LOWER-priority cue sits closer to the date
   * and the HIGHER-priority cue sits farther away, and the farther,
   * higher-priority cue must still win. */
  const qa = extractFields("Questions regarding this solicitation are due by August 1, 2026.");
  expect(qa.find((x) => x.field_name === "qa_closes_at")?.value_text).toBe("2026-08-01");
  expect(qa.find((x) => x.field_name === "closes_at")?.value_text).toBeNull();

  const prebid = extractFields(
    "The site visit is described above; the applicable deadline is August 1, 2026.",
  );
  expect(prebid.find((x) => x.field_name === "prebid_at")?.value_text).toBe("2026-08-01");
  expect(prebid.find((x) => x.field_name === "closes_at")?.value_text).toBeNull();
});

test("the quote's trailing edge stops at the next block boundary, not inside a different date", () => {
  /* Round 3, fix 3. The leading edge was clamped in round 2; the trailing
   * edge was not, so a quote could run past the classified date straight
   * into the text of a SECOND, unrelated date -- the same reading hazard
   * that made Critical 1 hard to catch by eye. Uses <br>, not </p>: round
   * 4 dropped </p> (and </td>) from the boundary set entirely, since
   * mammoth wraps every table cell in its own <p> and clamping there walls
   * a date off from its own row's cue. */
  const text = "Submission Due Date/Time is September 17, 2026<br>August 12, 2026";
  const f = extractFields(text);
  const closes = f.find((x) => x.field_name === "closes_at");
  expect(closes?.value_text).toBe("2026-09-17");
  expect(closes?.quote).not.toMatch(/August 12/);
});

test("the widened inquir stem also matches inquire and inquiring, not just inquiry/inquiries", () => {
  /* Round 3, fix 4. \binquir(y|ies)\b was too narrow -- it dropped
   * "inquire" and "inquiring", which the old bare substring match caught.
   * No common English word carries "inquir" as a non-initial stem, so
   * widening adds no new collision. */
  const inquire = extractFields("Please inquire by August 5, 2026.");
  expect(inquire.find((x) => x.field_name === "qa_closes_at")?.value_text).toBe("2026-08-05");

  const inquiring = extractFields("We are inquiring by August 5, 2026.");
  expect(inquiring.find((x) => x.field_name === "qa_closes_at")?.value_text).toBe("2026-08-05");
});
