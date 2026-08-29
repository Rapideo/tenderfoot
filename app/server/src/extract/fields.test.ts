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
   * that made Critical 1 hard to catch by eye.
   *
   * The primary fixture is </p>, not <br>, because that is the separator
   * this clamp actually meets: across the 52 corpus DOCX, mammoth emits
   * </p> 2,304 times and <br> 27 times. The earlier <br> fixture exercised
   * the rarest separator on the very path the clamp exists for. <br> is
   * still asserted below so its coverage is not lost. */
  const paragraphs = extractFields(
    "<p>Submission Due Date/Time is September 17, 2026</p><p>August 12, 2026</p>",
  );
  const byParagraph = paragraphs.find((x) => x.field_name === "closes_at");
  expect(byParagraph?.value_text).toBe("2026-09-17");
  expect(byParagraph?.quote).not.toMatch(/August 12/);

  const breaks = extractFields("Submission Due Date/Time is September 17, 2026<br>August 12, 2026");
  const byBreak = breaks.find((x) => x.field_name === "closes_at");
  expect(byBreak?.value_text).toBe("2026-09-17");
  expect(byBreak?.quote).not.toMatch(/August 12/);
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

test("a form's own due date does not become the solicitation's close date", () => {
  /* Round 4 (CRITICAL), case 3. Verbatim mammoth.convertToHtml output from
   * corpus/indiana/005030000087847/Att H - Reference Check Form.docx. With
   * no </p> clamp on the DOCX path, "Reference Check Form Due Date:" -- a
   * heading in its OWN paragraph -- reached across into the next
   * paragraph's date and produced closes_at = 2026-08-26 at full
   * confidence, against a manifest truth of 09/17 and against every other
   * document in the folder. A wrong deadline is a missed bid; the heading
   * must not cross the paragraph break. */
  const text =
    "<p><strong>Attachment H</strong></p><p><strong>Reference Check Form </strong></p>" +
    "<p><strong>RFP 26-87847</strong></p><p><br />Reference Check Form Due Date: </p>" +
    "<p><strong>August 26, 2026 @ 03:00PM Eastern Time</strong></p>";
  const f = extractFields(text);
  expect(f.find((x) => x.field_name === "closes_at")?.value_text).toBeNull();
  expect(f.find((x) => x.field_name === "qa_closes_at")?.value_text).toBeNull();
  expect(f.find((x) => x.field_name === "prebid_at")?.value_text).toBeNull();
});

test("the DOCX and plain-text paths agree: a heading paragraph is not a cue for the next one", () => {
  /* Round 4 (CRITICAL), case 4. The plain-text fixture above ("a heading
   * does not bleed into the next section") already pins this for \n. With
   * </p> missing from the boundary set, the IDENTICAL words on the DOCX
   * path classified the close date as the Q&A deadline and quoted
   * "Questions and Clarifications" alongside it, so the wrong answer read
   * like corroboration -- the two paths disagreed, and the DOCX one failed
   * unsafely. </p> is mammoth's only paragraph marker (it emits no \n), so
   * it is what makes the two paths agree. */
  const f = extractFields(
    "<p>Questions and Clarifications</p><p>Proposals are due September 17, 2026.</p>",
  );
  expect(f.find((x) => x.field_name === "closes_at")?.value_text).toBe("2026-09-17");
  expect(f.find((x) => x.field_name === "qa_closes_at")?.value_text).toBeNull();
});

test("inside a table, a cell's second paragraph still sees its own row's label", () => {
  /* Round 4, case 5 -- the reason </p> is a boundary only OUTSIDE a
   * <table>. mammoth genuinely splits a cell across paragraphs (the real
   * addendum's "Submission Due Date/Time" row has its time in a second <p>
   * inside the same <td>), and it wraps every cell in a <p> regardless. If
   * </p> were an unconditional boundary, the label and the date -- one
   * logical row -- would be walled apart and the schedule table would
   * extract nothing. </tr> is the row boundary inside a table; the sibling
   * rows below confirm it still separates them. */
  const text =
    "<table>" +
    "<tr><td><p>Deadline to Submit Written Questions</p></td>" +
    "<td><p>3:00 PM Eastern Time on</p><p>August 5, 2026</p></td></tr>" +
    "<tr><td><p>Response to Written Questions/Amendments</p></td><td><p>August 12, 2026</p></td></tr>" +
    "<tr><td><p>Submission Due Date/Time </p></td>" +
    "<td><p>September 17, 2026</p><p>by 3:00 PM Eastern Time</p></td></tr>" +
    "</table>";
  const f = extractFields(text);
  expect(f.find((x) => x.field_name === "qa_closes_at")?.value_text).toBe("2026-08-05");
  expect(f.find((x) => x.field_name === "closes_at")?.value_text).toBe("2026-09-17");
});

test("an unmatched <table> does not suppress the paragraph clamp for the rest of the document", () => {
  /* Round 5 (CRITICAL). The <table> guard was a counter, so one open with no
   * close disabled the </p> clamp for everything after it -- re-opening the
   * exact round-4 failure: the close date filed as qa_closes_at at 0.6
   * confidence, quoted with "Questions and Clarifications" so the wrong
   * answer reads like corroboration. Opens are now PAIRED with closes and an
   * unmatched open is ignored.
   *
   * Not reachable through mammoth today -- it escapes < in text content, and
   * across all 72 corpus texts final depth is 0 with 0 stray closes. It
   * becomes reachable at the wiring step, from a caller that truncates
   * stored text mid-table or concatenates a PDF's plain text (which CAN
   * contain a literal "<table") with a DOCX's HTML. Nothing in the signature
   * states that precondition, so the function must not depend on it. */
  const prose = "<p>Questions and Clarifications</p><p>Proposals are due September 17, 2026.</p>";

  const unclosed = extractFields("<table><tr><td><p>Schedule of Events</p></td></tr>" + prose);
  expect(unclosed.find((x) => x.field_name === "closes_at")?.value_text).toBe("2026-09-17");
  expect(unclosed.find((x) => x.field_name === "qa_closes_at")?.value_text).toBeNull();

  /* A literal, unescaped "<table>" sitting in prose -- the same shape, from a
   * source that does not escape the way mammoth does. */
  const literal = extractFields("<p>See the <table> below.</p>" + prose);
  expect(literal.find((x) => x.field_name === "closes_at")?.value_text).toBe("2026-09-17");
  expect(literal.find((x) => x.field_name === "qa_closes_at")?.value_text).toBeNull();

  /* A stray </table> with no open must not throw or shift anything either. */
  const stray = extractFields("</table>" + prose);
  expect(stray.find((x) => x.field_name === "closes_at")?.value_text).toBe("2026-09-17");
  expect(stray.find((x) => x.field_name === "qa_closes_at")?.value_text).toBeNull();
});
