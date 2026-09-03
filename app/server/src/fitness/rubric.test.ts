import { expect, test } from "vitest";
import { scoreSource, type RubricSubject } from "./rubric.js";

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

/* ------------------------------------------------------------------- R8 -- */

test("cost `unknown` is not graded as free", () => {
  expect(scoreSource(subject({ cost_posture: "free" })).dimensions.R8!.grade).toBe("strong");
  expect(scoreSource(subject({ cost_posture: "unknown" })).dimensions.R8!.grade).toBe("unknown");
  const paid = scoreSource(subject({ cost_posture: "paid", annual_cost_usd: 500 }));
  expect(paid.dimensions.R8!.grade).toBe("adequate");
  expect(paid.dimensions.R8!.note).toContain("500");
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
    field_completeness: null, watermark_field: null, ...GEO,
  });
  const eds = scoreSource({
    name: "Indiana EDS contract register", jurisdiction: "IN", platform: "IDOA contract search",
    adapter_tier: "1 api", legal_posture: "in",
    archive_depth: "FULL -- 204,439 contracts back to 2005.",
    verified_facets: { works: ["endDate"], silently_ignored: [] },
    cost_posture: "free", annual_cost_usd: null, field_completeness: null,
    watermark_field: "modifiedDate", ...GEO,
  });

  for (const d of ["R2", "R3", "R4", "R9"]) {
    expect(
      order[eds.dimensions[d]!.grade],
      `${d}: EDS ${eds.dimensions[d]!.grade} vs IDOA ${idoa.dimensions[d]!.grade}`,
    ).toBeGreaterThan(order[idoa.dimensions[d]!.grade]);
  }
});
