import { expect, test } from "vitest";
import { scoreSource, type RubricSubject } from "./rubric.js";
import { THRESHOLDS_RATIFIED, R7_RATIFIED } from "./thresholds.js";

const GEO = { primaryGeography: ["IN"], secondaryGeography: ["IL", "OH", "KY"] };

function subject(over: Partial<RubricSubject> = {}): RubricSubject {
  return {
    name: "fixture",
    jurisdiction: "US",
    platform: "SAM",
    adapter_tier: "1 api",
    legal_posture: "in",
    archive_depth: null,
    verified_facets: null,
    cost_posture: "free",
    annual_cost_usd: null,
    field_completeness: null,
    watermark_field: null,
    watermark_probed_at: null,
    ...GEO,
    ...over,
  };
}

/* ------------------------------------------------------------ R1, the gate -- */

test("legal posture `out` disqualifies before any other dimension is computed", () => {
  const p = scoreSource(subject({ name: "GovWin IQ", legal_posture: "out" }));
  expect(p.disqualified).toBe(true);
  expect(p.disqualifiedReason).toContain("legal_posture");
  /* R1 is a GATE. Nothing else is scored -- a disqualified source must not
   * present a profile that invites comparison. */
  expect(Object.keys(p.dimensions)).toEqual(["R1"]);
});

test("`manual-only` disqualifies from automated ingestion too", () => {
  const p = scoreSource(subject({ name: "Ohio OhioBuys", legal_posture: "manual-only" }));
  expect(p.disqualified).toBe(true);
  expect(Object.keys(p.dimensions)).toEqual(["R1"]);
});

/* ------------------------------------------------------------------- R2 -- */

test("an untested archive depth is `unknown`, never `weak`", () => {
  expect(scoreSource(subject({ archive_depth: null })).dimensions.R2!.grade).toBe("unknown");
});

test("an archive documented as absent is `weak` — that IS evidence", () => {
  const p = scoreSource(
    subject({ archive_depth: "NONE. Closed solicitations are not published." }),
  );
  expect(p.dimensions.R2!.grade).toBe("weak");
});

test("migration 020's rewritten IDOA depth still grades weak", () => {
  /* 020 rewrote the row to "NONE AT IDOA. ..." -- the marker must survive a
   * correction that changed the sentence but not the fact. */
  const p = scoreSource(
    subject({ archive_depth: "NONE AT IDOA. Closed solicitations are not published, and that is unchanged." }),
  );
  expect(p.dimensions.R2!.grade).toBe("weak");
});

test("a full or deep archive is `strong`", () => {
  expect(
    scoreSource(subject({ archive_depth: "FULL -- 204,439 contracts back to 2005." })).dimensions
      .R2!.grade,
  ).toBe("strong");
  expect(
    scoreSource(subject({ archive_depth: "DEEP -- 2,155 closed solicitations." })).dimensions.R2!
      .grade,
  ).toBe("strong");
});

test("an explicitly untestable archive is `unknown`", () => {
  expect(
    scoreSource(subject({ archive_depth: "Unknown -- not reachable to test." })).dimensions.R2!
      .grade,
  ).toBe("unknown");
});

/* ------------------------------------------------------------------- R3 -- */

test("a tier-1 API scores above hand-written HTML", () => {
  expect(scoreSource(subject({ adapter_tier: "1 api" })).dimensions.R3!.grade).toBe("strong");
  expect(scoreSource(subject({ adapter_tier: "2 email" })).dimensions.R3!.grade).toBe("adequate");
  expect(scoreSource(subject({ adapter_tier: "3 html" })).dimensions.R3!.grade).toBe("weak");
  expect(scoreSource(subject({ adapter_tier: "4 manual" })).dimensions.R3!.grade).toBe("weak");
});

/* ------------------------------------------------------------------- R4 -- */

test("filter honesty is `unknown` until vary-a-parameter has actually run", () => {
  expect(scoreSource(subject({ verified_facets: null })).dimensions.R4!.grade).toBe("unknown");
});

test("a source that withholds totals cannot be checked and stays `unknown`", () => {
  const p = scoreSource(
    subject({
      verified_facets: { note: "TOTALS ARE WITHHELD, so the check CANNOT RUN here." },
    }),
  );
  expect(p.dimensions.R4!.grade).toBe("unknown");
});

test("known silently-ignored parameters grade `adequate` and are named in the note", () => {
  const p = scoreSource(
    subject({
      verified_facets: {
        works: ["source_type"],
        silently_ignored: ["pop_state", "state", "place_of_performance_state"],
      },
    }),
  );
  expect(p.dimensions.R4!.grade).toBe("adequate");
  expect(p.dimensions.R4!.note).toContain("pop_state");
});

test("a clean vary-a-parameter result grades `strong`", () => {
  expect(
    scoreSource(subject({ verified_facets: { works: ["status"], silently_ignored: [] } }))
      .dimensions.R4!.grade,
  ).toBe("strong");
});

/* ------------------------------------------------------------------- R6 -- */

test("primary geography outranks federal, which outranks secondary's neighbours", () => {
  expect(scoreSource(subject({ jurisdiction: "IN" })).dimensions.R6!.grade).toBe("strong");
  expect(scoreSource(subject({ jurisdiction: "US" })).dimensions.R6!.grade).toBe("adequate");
  expect(scoreSource(subject({ jurisdiction: "IL" })).dimensions.R6!.grade).toBe("adequate");
  expect(scoreSource(subject({ jurisdiction: "MI" })).dimensions.R6!.grade).toBe("weak");
});

/* ------------------------------------------------------------------- R7 -- */

/* 🔴 THE DEFECT THESE TESTS EXIST TO PREVENT.
 *
 * Until 2026-09-04 R7 was `field_completeness === null ? unknown : adequate` --
 * a NULL CHECK, not a grade. Recording SAM.gov's real numbers (p10 description
 * of 57 characters, 0 of 9,883 rows carrying a value, 0.3% of document-
 * deferring rows reachable) would therefore have graded it `adequate` and put
 * it level with HigherGov on the one dimension where they differ most.
 *
 * §5.3 forbids collapsing `unknown` into `weak` because that turns absence of
 * evidence into evidence of absence. This is the same error running the other
 * way: collapsing MEASURED into `adequate` turns evidence of absence into
 * evidence of adequacy. */

test("a bad measurement grades `weak` — recording a number is not worth `adequate`", () => {
  /* SAM.gov's real production shape. */
  const p = scoreSource(
    subject({
      field_completeness: {
        P6: "weak",
        P7: "weak",
        P8: "weak",
        measured_on: "2026-09-04",
        population_n: 9883,
      },
    }),
  );
  expect(p.dimensions.R7!.grade).toBe("weak");
});

test("R7 takes the WEAKEST property — a rich description cannot compensate for an absent value", () => {
  const p = scoreSource(
    subject({
      field_completeness: { P6: "strong", P7: "strong", P8: "weak", population_n: 9883 },
    }),
  );
  expect(p.dimensions.R7!.grade).toBe("weak");
  /* The note must name the property that set the grade, or a reader cannot act
   * on it -- "weak" alone does not say which field is missing. */
  expect(p.dimensions.R7!.note).toContain("P8");
});

test("an `unknown` property is SKIPPED, never counted as weak (§5.3)", () => {
  const p = scoreSource(
    subject({
      field_completeness: { P6: "strong", P8: "strong", P14: "unknown", population_n: 500 },
    }),
  );
  expect(p.dimensions.R7!.grade).toBe("strong");
});

test("one measured property is not a measurement — R7 stays `unknown`", () => {
  const p = scoreSource(
    subject({
      field_completeness: { P6: "strong", P7: "unknown", P8: "unknown", population_n: 9883 },
    }),
  );
  expect(p.dimensions.R7!.grade).toBe("unknown");
});

test("a measurement carrying no property grades at all is `unknown`, not `adequate`", () => {
  /* HigherGov's row held exactly this shape from migration 019 until 026: rich
   * prose, real numbers, and not one property grade a rubric could read. */
  const p = scoreSource(
    subject({ field_completeness: { measured_on: "2026-09-03", quirks: "titles carry an artifact" } }),
  );
  expect(p.dimensions.R7!.grade).toBe("unknown");
});

test("field_completeness null is `unknown` — never measured is not the same as measured badly", () => {
  const p = scoreSource(subject({ field_completeness: null }));
  expect(p.dimensions.R7!.grade).toBe("unknown");
  expect(p.dimensions.R7!.note).toContain("never been measured");
});

/* ⚖️ D4 AND D5 WENT DIFFERENT WAYS, AND THE CODE HAD ONE FLAG FOR BOTH.
 *
 * Matt ratified the FLOOR's pass marks on 2026-09-04 (D4, option A) and left
 * R7's grading boundaries PROVISIONAL (D5, option C). thresholds.ts carried a
 * single `THRESHOLDS_RATIFIED` covering both blocks, so his split answer was
 * literally inexpressible -- ratifying the floor would have silently ratified
 * R7 too. The file's own warning anticipated the divergence: "ratifying one
 * should not silently move the other. If they drift apart that is a decision,
 * and it will be visible here." This is that decision, and these two tests are
 * where it is now visible.
 *
 * D5 option C's whole point is that "grades keep shipping with the 'not
 * approved' caveat". Before this, that caveat existed ONLY in the floor's
 * summary -- so ratifying the floor would have removed the last trace of it
 * and R7's grades would have shipped looking settled. */
test("an R7 grade ships with its boundaries marked unratified (D5 option C)", () => {
  const p = scoreSource(
    subject({
      field_completeness: { P6: "strong", P7: "strong", P8: "weak", population_n: 9883 },
    }),
  );
  expect(p.dimensions.R7!.grade).toBe("weak");
  expect(p.dimensions.R7!.note).toContain("UNRATIFIED");
});

test("ratifying the floor did NOT ratify R7 — the two flags are independent", () => {
  /* Read from the module rather than restated, so this fails if someone
   * collapses the two back into one constant. */
  expect(THRESHOLDS_RATIFIED).toBe(true);
  expect(R7_RATIFIED).toBe(false);
});

/* ------------------------------------------------------------------- R8 -- */

test("cost `unknown` is not graded as free", () => {
  expect(scoreSource(subject({ cost_posture: "free" })).dimensions.R8!.grade).toBe("strong");
  expect(scoreSource(subject({ cost_posture: "unknown" })).dimensions.R8!.grade).toBe("unknown");
  const paid = scoreSource(subject({ cost_posture: "paid", annual_cost_usd: 500 }));
  expect(paid.dimensions.R8!.grade).toBe("adequate");
  expect(paid.dimensions.R8!.note).toContain("500");
});

/* ------------------------------------------------------------------- R9 -- */

/* 🔴 THE DEFECT D3 EXISTS TO FIX, AND IT IS R7's DEFECT ONE DIMENSION OVER.
 * Until 2026-09-05 R9 was `watermark_field === null ? unknown : strong` -- a
 * null check, exactly the shape R7 carried until migration 026. Illinois
 * BidBuy was PROBED on 2026-09-04 across both its filter and sort surfaces and
 * no modification time exists on either (migration 027); Kentucky eMARS VSS
 * has never been looked at. Both produced `unknown` carrying the same note, so
 * a day's probing was invisible to every reader of the matrix.
 *
 * R2 has drawn this distinction correctly since it was written -- "an archive
 * documented as absent is `weak` — that IS evidence" sits forty lines above.
 * R9 is brought into line with it, not given a new idea.
 *
 * ⚠️ AND THIS DOES NOT BREACH §5.3. That clause forbids converting an ABSENCE
 * OF EVIDENCE into evidence of absence -- Kentucky, inferred from platform and
 * never tested, must stay `unknown`. BidBuy is the inverse: evidence of
 * absence, gathered deliberately. Grading it `weak` is the clause's own logic,
 * not an exception to it. */
test("R9 does not show a probed absence and an unexamined source alike", () => {
  const probed = scoreSource(
    subject({ name: "Illinois BidBuy", watermark_probed_at: "2026-09-04T00:00:00.000Z" }),
  );
  const unexamined = scoreSource(subject({ name: "Kentucky eMARS VSS" }));

  expect(probed.dimensions.R9!.grade).not.toBe(unexamined.dimensions.R9!.grade);
  expect(probed.dimensions.R9!.note).not.toBe(unexamined.dimensions.R9!.note);
});

test("a watermark probed for and not found is `weak` — that IS evidence", () => {
  const p = scoreSource(subject({ watermark_probed_at: "2026-09-04T00:00:00.000Z" }));
  expect(p.dimensions.R9!.grade).toBe("weak");
  /* The consequence, not the fact: an adapter here re-reads its window every
   * run, which on a metered source is a bill. */
  expect(p.dimensions.R9!.note).toContain("re-read");
});

test("a source nobody has probed stays `unknown`, never `weak` (§5.3)", () => {
  const p = scoreSource(subject({ watermark_probed_at: null }));
  expect(p.dimensions.R9!.grade).toBe("unknown");
  expect(p.dimensions.R9!.note).toContain("not been probed");
});

/* 🔴 THE SHAPE THE UNIT TESTS ABOVE CANNOT CATCH, AND IT CRASHED THE CLI.
 *
 * Every test in this file hands `watermark_probed_at` a string, because a
 * hand-written fixture naturally does. `timestamptz` does not arrive as one --
 * node-postgres parses it into a Date, so the first real `npm run fitness`
 * after 028 died with "probedAt.slice is not a function" AFTER the gate had
 * gone green at 785 tests. The rubric is pure over a row, but the row is
 * whatever the driver produced, and that is the shape it must survive. */
test("R9 survives the Date that Postgres actually returns, not just an ISO string", () => {
  const asDate = scoreSource(subject({ watermark_probed_at: new Date("2026-09-04T00:00:00Z") }));
  const asText = scoreSource(subject({ watermark_probed_at: "2026-09-04T00:00:00.000Z" }));

  expect(asDate.dimensions.R9!.grade).toBe("weak");
  expect(asDate.dimensions.R9!.note).toContain("2026-09-04");
  /* The two spellings of the same instant must read identically, or the matrix
   * says something different depending on where the row came from. */
  expect(asDate.dimensions.R9!.note).toBe(asText.dimensions.R9!.note);
});

/* Migration 021 wrote watermarks for SAM.gov and the EDS register without any
 * probe stamp, because the stamp did not exist yet. Those rows must keep
 * grading `strong` -- a found watermark is its own evidence, and requiring a
 * stamp beside it would silently downgrade two working sources. */
test("a known watermark grades `strong` whether or not a probe was stamped", () => {
  for (const stamp of [null, "2026-09-04T00:00:00.000Z"]) {
    const p = scoreSource(
      subject({ watermark_field: "modifiedDate", watermark_probed_at: stamp }),
    );
    expect(p.dimensions.R9!.grade, `stamp=${stamp}`).toBe("strong");
  }
});

/* --------------------------------------------------------- the scope guard -- */

test("no aggregate score is produced, and adding one must break this test", () => {
  const p = scoreSource(subject());
  expect(p).not.toHaveProperty("score");
  expect(p).not.toHaveProperty("total");
  expect(p).not.toHaveProperty("rank");
  expect(p).not.toHaveProperty("points");
});

/* ============================================================================
 * THE ACCEPTANCE TEST — spec §5.4.
 *
 * "The rubric is calibrated only if, run cold, it reproduces judgements already
 * made." These rows are copied from 003_seed_source_registry.sql and
 * 019_seed_highergov.sql, abbreviated only where the prose is long. The IDOA
 * judgement cost a whole adapter slice to learn -- 673 tests, built against a
 * source whose entire public output is 71 rows.
 * ========================================================================== */

test("ACCEPTANCE: it rejects Indiana IDOA solicitations, as Matt did on 2026-09-02", () => {
  const p = scoreSource({
    name: "Indiana IDOA solicitations",
    jurisdiction: "IN",
    platform: "IDOA static list",
    adapter_tier: "3 html",
    legal_posture: "in",
    archive_depth: "NONE AT IDOA. Closed solicitations are not published, and that is unchanged.",
    verified_facets: { note: "Plain HTML table. No RSS, API or bulk download." },
    cost_posture: "free",
    annual_cost_usd: null,
    field_completeness: null,
    watermark_field: null,
    watermark_probed_at: null,
    ...GEO,
  });

  expect(p.disqualified).toBe(false);
  /* Strong on geography and cost -- and THAT IS THE TRAP a weighted total would
   * fall into. The two dimensions that decide are the archive and the adapter
   * cost, and both must read weak. */
  expect(p.dimensions.R6!.grade).toBe("strong");
  expect(p.dimensions.R8!.grade).toBe("strong");
  expect(p.dimensions.R2!.grade).toBe("weak");
  expect(p.dimensions.R3!.grade).toBe("weak");
  expect(p.dimensions.R9!.grade).toBe("unknown");
});

test("ACCEPTANCE: it ranks the Indiana EDS contract register highly", () => {
  const p = scoreSource({
    name: "Indiana EDS contract register",
    jurisdiction: "IN",
    platform: "IDOA contract search",
    adapter_tier: "1 api",
    legal_posture: "in",
    archive_depth: "FULL -- 204,439 contracts back to 2005.",
    verified_facets: {
      works: ["businessUnit", "endDate", "pageSize"],
      silently_ignored: ["sort=-publishDate"],
    },
    cost_posture: "free",
    annual_cost_usd: null,
    field_completeness: null,
    watermark_field: "modifiedDate",
    watermark_probed_at: null,
    ...GEO,
  });

  expect(p.disqualified).toBe(false);
  for (const d of ["R2", "R3", "R6", "R8", "R9"]) {
    expect(p.dimensions[d]!.grade, d).toBe("strong");
  }
});

test("ACCEPTANCE: HigherGov scores well, and its known weaknesses still show", () => {
  const p = scoreSource({
    name: "HigherGov",
    jurisdiction: "US",
    platform: "HigherGov API",
    adapter_tier: "1 api",
    legal_posture: "in",
    archive_depth: "DEEP, and it overturns a documented assumption. 9,286 Indiana records back to 2013.",
    verified_facets: {
      works: ["source_type", "search_id", "captured_date"],
      silently_ignored: ["pop_state", "state", "place_of_performance_state"],
    },
    cost_posture: "paid",
    annual_cost_usd: 500,
    field_completeness: { measured_on: "2026-09-03" },
    watermark_field: "captured_date",
    watermark_probed_at: null,
    ...GEO,
  });

  expect(p.disqualified).toBe(false);
  expect(p.dimensions.R2!.grade).toBe("strong");
  expect(p.dimensions.R3!.grade).toBe("strong");
  expect(p.dimensions.R9!.grade).toBe("strong");
  /* The weaknesses must survive: it costs money, three state parameters are
   * silently ignored, and it is a federal-jurisdiction row serving a firm whose
   * primary ground is Indiana. A rubric that hid these would be flattering it. */
  expect(p.dimensions.R8!.grade).toBe("adequate");
  expect(p.dimensions.R4!.grade).toBe("adequate");
  expect(p.dimensions.R4!.note).toContain("pop_state");
  expect(p.dimensions.R6!.grade).toBe("adequate");
});

test("ACCEPTANCE: the three paid aggregators fail on R1 alone, reaching no other dimension", () => {
  for (const name of ["GovWin IQ", "BidNet Direct", "BidPrime"]) {
    const p = scoreSource({
      name,
      jurisdiction: "US",
      platform: "Aggregator",
      adapter_tier: "4 manual",
      legal_posture: "out",
      archive_depth: null,
      verified_facets: null,
      cost_posture: "unknown",
      annual_cost_usd: null,
      field_completeness: null,
      watermark_field: null,
      watermark_probed_at: null,
      ...GEO,
    });
    expect(p.disqualified, name).toBe(true);
    expect(Object.keys(p.dimensions), name).toEqual(["R1"]);
  }
});

/* Stated as a dimension-by-dimension comparison because that is what a rubric
 * is FOR, and because there is no total to compare. */
test("ACCEPTANCE: the EDS register out-profiles IDOA on every deciding dimension", () => {
  const order: Record<Grade2, number> = { strong: 3, adequate: 2, weak: 1, unknown: 0 };
  type Grade2 = "strong" | "adequate" | "weak" | "unknown";

  const idoa = scoreSource({
    name: "Indiana IDOA solicitations", jurisdiction: "IN", platform: "IDOA static list",
    adapter_tier: "3 html", legal_posture: "in",
    archive_depth: "NONE AT IDOA. Closed solicitations are not published.",
    verified_facets: null, cost_posture: "free", annual_cost_usd: null,
    field_completeness: null, watermark_field: null, watermark_probed_at: null, ...GEO,
  });
  const eds = scoreSource({
    name: "Indiana EDS contract register", jurisdiction: "IN", platform: "IDOA contract search",
    adapter_tier: "1 api", legal_posture: "in",
    archive_depth: "FULL -- 204,439 contracts back to 2005.",
    verified_facets: { works: ["endDate"], silently_ignored: [] },
    cost_posture: "free", annual_cost_usd: null, field_completeness: null,
    watermark_field: "modifiedDate", watermark_probed_at: null, ...GEO,
  });

  for (const d of ["R2", "R3", "R4", "R9"]) {
    expect(
      order[eds.dimensions[d]!.grade],
      `${d}: EDS ${eds.dimensions[d]!.grade} vs IDOA ${idoa.dimensions[d]!.grade}`,
    ).toBeGreaterThan(order[idoa.dimensions[d]!.grade]);
  }
});
