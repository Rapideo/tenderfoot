/* THE RUBRIC SCORES SOURCES. IT NEVER SCORES OPPORTUNITIES.
 *
 * Data-fitness spec §5.1, and it is the constraint most likely to erode. Every
 * dimension below takes a SOURCE as its subject. A dimension whose sentence
 * reads naturally with a solicitation as its subject belongs to the
 * qualification design, which ruling 1A keeps parked and design spec §7.10
 * clause 2 guards.
 *
 * ⚠️ THERE IS DELIBERATELY NO AGGREGATE SCORE. A single number would let a
 * strong archive silently compensate for a failing legal posture, and would
 * make this file look like the scorer it must not become. R1 is a GATE; the
 * rest is a PROFILE a person reads. rubric.test.ts asserts the absence, so
 * adding a total breaks the suite on purpose.
 *
 * PURE OVER A ROW, no database. That keeps the §5.4 acceptance test a fast unit
 * test with hand-written rows -- and that test has to stay trivially
 * re-runnable, because it is the only thing proving the rubric reproduces
 * judgements already made by hand. */

import { R7 as R7_THRESHOLDS, R7_RATIFIED } from "./thresholds.js";

/* ⚖️ D5 OPTION C, AND IT IS THE WHOLE POINT OF THAT RULING. Matt left R7's
 * boundaries provisional on 2026-09-04 while ratifying the floor's (D4), and
 * option C's stated consequence was that "grades keep shipping with the 'not
 * approved' caveat."
 *
 * 🔴 THAT CAVEAT HAD TO BE BUILT, because it did not exist here. Before
 * 2026-09-05 the only "unratified" text in the system was in the floor's
 * summary, driven by the single flag that governed both blocks — so ratifying
 * D4 would have removed the last trace of it and R7's grades would have
 * shipped looking settled. Answering D4 and D5 differently is exactly what
 * exposed it. */
const R7_CAVEAT = R7_RATIFIED
  ? ""
  : " ⚠️ R7 boundaries are UNRATIFIED proposals (D5), so this grade is provisional.";

export type Grade = "strong" | "adequate" | "weak" | "unknown";

export interface RubricSubject {
  name: string;
  jurisdiction: string | null;
  platform: string | null;
  adapter_tier: string | null;
  legal_posture: string;
  archive_depth: string | null;
  verified_facets: Record<string, unknown> | null;
  cost_posture: string;
  annual_cost_usd: number | null;
  field_completeness: Record<string, unknown> | null;
  watermark_field: string | null;
  /** When a watermark was DELIBERATELY LOOKED FOR. Null means nobody has
   * looked; set with `watermark_field` still null means one was looked for and
   * none exists. See R9 below.
   *
   * ⚠️ `Date` IS NOT DEFENSIVE TYPING, IT IS THE SHAPE THE DRIVER RETURNS.
   * node-postgres parses `timestamptz` into a Date; a hand-written fixture
   * naturally supplies a string. Both reach this function, and typing only the
   * fixture's shape is what crashed `npm run fitness` on 2026-09-05 with a
   * green 785-test gate behind it. */
  watermark_probed_at: Date | string | null;
  /** From firm_profile.geography — never constant-folded (§1A). */
  primaryGeography: string[];
  secondaryGeography: string[];
}

export interface Dimension {
  grade: Grade;
  note: string;
}

export interface SourceProfile {
  name: string;
  disqualified: boolean;
  disqualifiedReason?: string;
  dimensions: Record<string, Dimension>;
}

/* archive_depth is prose written by a researcher, not an enum. These markers
 * are matched against what the seed ACTUALLY contains -- "NONE.", "NONE AT
 * IDOA.", "FULL --", "DEEP", "Assume none", "Unknown --". Anything unmatched
 * grades `unknown`, which is the safe direction: a depth nobody can parse has
 * not been established. */
/* R7 — FIELD COMPLETENESS, AND IT GRADES THE MEASUREMENT RATHER THAN ITS
 * PRESENCE.
 *
 * 🔴 WHAT THIS REPLACED, because the next person will be tempted to simplify it
 * back. Until 2026-09-04 R7 was `field_completeness === null ? unknown :
 * adequate` -- a null check. Recording SAM.gov's real numbers under that rule
 * would have graded it `adequate` on a p10 description of 57 characters, 0 of
 * 9,883 rows carrying a value, and 3 of 979 document-deferring rows readable,
 * putting it level with HigherGov on the dimension where they differ most.
 * §5.3 forbids collapsing `unknown` into `weak`; this is the same error
 * inverted, and it flatters every source it touches.
 *
 * THE COMBINING RULE IS WEAKEST-WINS, AND IT IS NOT A SUM. §5.3 rejects a
 * weighted total across dimensions because it lets a strength compensate for a
 * failure. The same reasoning applies inside a dimension: a source with superb
 * descriptions and no value at all is not `adequate` on field completeness --
 * it is missing a field, and the note has to say which one. A minimum, unlike
 * an average, cannot be talked up by adding strengths.
 *
 * `unknown` PROPERTIES ARE SKIPPED, NOT COUNTED. A property nobody measured is
 * not a property the source lacks. But skipping them means a row with one
 * known property would be graded on that alone, so below
 * `minKnownProperties` the dimension reports `unknown` instead. */
const R7_PROPERTIES = ["P6", "P7", "P8", "P11", "P14"] as const;

const GRADE_ORDER: Record<Grade, number> = { unknown: 0, weak: 1, adequate: 2, strong: 3 };

function isGrade(v: unknown): v is Grade {
  return v === "strong" || v === "adequate" || v === "weak" || v === "unknown";
}

export function gradeCompleteness(fc: Record<string, unknown> | null): Dimension {
  if (fc === null) {
    return { grade: "unknown", note: "Field completeness has never been measured." };
  }
  const known = R7_PROPERTIES.flatMap((id) => {
    const g = fc[id];
    return isGrade(g) && g !== "unknown" ? [{ id, grade: g }] : [];
  });

  if (known.length < R7_THRESHOLDS.minKnownProperties) {
    /* Name the population when the row carries one -- it is almost always the
     * reason, and "measured, and still unknown" is otherwise baffling. */
    const n = typeof fc.population_n === "number" ? fc.population_n : null;
    const why =
      n !== null && n < R7_THRESHOLDS.minPopulation
        ? `Population ${n} is below ${R7_THRESHOLDS.minPopulation}; too few rows to grade.`
        : `${known.length} of ${R7_PROPERTIES.length} properties measured; ` +
          `${R7_THRESHOLDS.minKnownProperties} needed before a profile is asserted.`;
    return { grade: "unknown", note: `Not enough measured to grade. ${why}` };
  }

  const weakest = known.reduce((a, b) => (GRADE_ORDER[b.grade] < GRADE_ORDER[a.grade] ? b : a));
  const measured = known.map((k) => `${k.id} ${k.grade}`).join(", ");
  return {
    grade: weakest.grade,
    /* The caveat rides on an ASSERTED GRADE only. The `unknown` returns above
     * are a refusal to grade, and marking a refusal "provisional" says nothing
     * a reader can act on. */
    note: `Weakest of ${known.length} measured properties sets the grade: ${weakest.id}. (${measured}.)${R7_CAVEAT}`,
  };
}

function gradeArchive(depth: string | null): Dimension {
  if (depth === null) {
    return { grade: "unknown", note: "archive_depth is null — never established." };
  }
  const d = depth.trim().toLowerCase();
  if (d.startsWith("none") || d.startsWith("assume none")) {
    return {
      grade: "weak",
      note: "Documented as retaining nothing. That is evidence, not an absence of it.",
    };
  }
  if (d.startsWith("unknown")) return { grade: "unknown", note: "Recorded as untestable." };
  if (d.startsWith("full") || d.startsWith("deep")) {
    return { grade: "strong", note: depth.slice(0, 120) };
  }
  return { grade: "adequate", note: depth.slice(0, 120) };
}

function gradeTier(tier: string | null): Dimension {
  if (tier === null) return { grade: "unknown", note: "No adapter tier recorded." };
  if (tier.startsWith("1")) {
    return { grade: "strong", note: "API — cheapest to build and cheapest to keep working." };
  }
  if (tier.startsWith("2")) return { grade: "adequate", note: "Email or RSS subscription." };
  if (tier.startsWith("3")) return { grade: "weak", note: "HTML scraping — breaks on redesign." };
  return { grade: "weak", note: "Manual only — cannot be scheduled." };
}

/* §5.4. A source that WITHHOLDS totals cannot be checked at all, and recording
 * that as a failure would be wrong -- Michigan is not dishonest, it is
 * unmeasurable. `unknown` is the honest grade, and the registry note says why. */
function gradeFacets(f: Record<string, unknown> | null): Dimension {
  if (f === null) return { grade: "unknown", note: "vary-a-parameter has never been run." };
  const blob = JSON.stringify(f).toLowerCase();
  if (blob.includes("cannot run") || blob.includes("withheld")) {
    return { grade: "unknown", note: "Totals withheld — the check cannot run here." };
  }
  const ignored = (f as { silently_ignored?: unknown }).silently_ignored;
  if (Array.isArray(ignored) && ignored.length > 0) {
    return {
      grade: "adequate",
      note:
        `${ignored.length} parameter(s) accepted and silently ignored — known and ` +
        `worked around: ${ignored.join(", ")}.`,
    };
  }
  if (typeof (f as { verified?: unknown }).verified === "string") {
    return { grade: "strong", note: "Filters verified to move a count." };
  }
  if (Array.isArray(ignored)) {
    return { grade: "strong", note: "Checked, and no silently-ignored parameters found." };
  }
  return { grade: "adequate", note: "Facets recorded, but no verification statement." };
}

function gradeGeography(j: string | null, primary: string[], secondary: string[]): Dimension {
  if (j === null) return { grade: "unknown", note: "No jurisdiction recorded." };
  if (primary.includes(j)) return { grade: "strong", note: `${j} is the Profile's primary geography.` };
  if (j === "US") {
    return { grade: "adequate", note: "Federal — in profile, but not the primary ground." };
  }
  if (secondary.includes(j)) return { grade: "adequate", note: `${j} is secondary geography.` };
  return { grade: "weak", note: `${j} is outside the Profile's geography.` };
}

/* A source nobody has priced is NOT a free source. Migration 018 splits these
 * into two columns for exactly this reason, and collapsing them here would undo
 * that in the one place it matters. */
function gradeCost(posture: string, usd: number | null): Dimension {
  if (posture === "free") return { grade: "strong", note: "No recurring cost." };
  if (posture === "unknown") {
    return { grade: "unknown", note: "Never priced. An unpriced source is not a free one." };
  }
  return {
    grade: "adequate",
    note: usd === null ? "Paid, amount not recorded." : `$${usd}/yr.`,
  };
}

/* R9 — INCREMENTAL RESUME, AND IT HAS THREE STATES RATHER THAN TWO.
 *
 * Until 2026-09-05 this was `watermark_field === null ? unknown : strong`, so
 * a source we had PROBED and found to have no watermark read identically to
 * one nobody had ever opened. Illinois BidBuy (probed 2026-09-04, migration
 * 027: no modification time on the filter surface or the sort surface, in
 * 263,822 bytes) graded the same as Kentucky eMARS VSS, which is inferred from
 * its platform and has never been tested. A day of probing left no trace.
 *
 * gradeArchive forty lines up has always drawn this distinction — "Documented
 * as retaining nothing. That is evidence, not an absence of it." This brings
 * R9 into line with R2; it is not a new idea, it is the one already here.
 *
 * ⚠️ §5.3 IS NOT BREACHED, IT IS APPLIED. The clause forbids recording an
 * absence of evidence as `weak`. `unknown` is still what an unprobed source
 * gets, and that is the branch §5.3 protects. A measured absence is evidence,
 * and grading it `weak` is the same move R2 makes. */
function gradeWatermark(field: string | null, probedAt: Date | string | null): Dimension {
  if (field !== null) {
    return { grade: "strong", note: `Incremental on \`${field}\`.` };
  }
  if (probedAt === null || probedAt === undefined) {
    return {
      grade: "unknown",
      note: "No watermark recorded, and one has not been probed for — whether any exists is not established.",
    };
  }
  /* The day, not the instant. A probe is a thing someone did on a date, and the
   * matrix is read by a person. */
  const day = (probedAt instanceof Date ? probedAt.toISOString() : String(probedAt)).slice(0, 10);
  return {
    grade: "weak",
    note: `Probed ${day} and no watermark exists — every run must re-read its whole window. That is evidence, not an absence of it.`,
  };
}

export function scoreSource(s: RubricSubject): SourceProfile {
  /* R1 IS A GATE. It runs first and returns first. A disqualified source must
   * not present a full profile -- a profile invites comparison, and there is
   * nothing to compare when the source may not be contacted at all. */
  const r1: Dimension =
    s.legal_posture === "in"
      ? { grade: "strong", note: "Posture `in` — adapters may run on a schedule." }
      : {
          grade: "weak",
          note:
            `Posture \`${s.legal_posture}\` — no automated access. §5.5.1: documented ` +
            `permission moves it, and the evidence goes on the row.`,
        };

  if (s.legal_posture !== "in") {
    return {
      name: s.name,
      disqualified: true,
      disqualifiedReason: `legal_posture=${s.legal_posture}`,
      dimensions: { R1: r1 },
    };
  }

  return {
    name: s.name,
    disqualified: false,
    dimensions: {
      R1: r1,
      R2: gradeArchive(s.archive_depth),
      R3: gradeTier(s.adapter_tier),
      R4: gradeFacets(s.verified_facets),
      R5:
        s.platform === null
          ? { grade: "unknown", note: "No platform recorded — leverage unassessable." }
          : {
              grade: "adequate",
              note: `Platform ${s.platform}. §5.7: one adapter may reach other jurisdictions.`,
            },
      R6: gradeGeography(s.jurisdiction, s.primaryGeography, s.secondaryGeography),
      R7: gradeCompleteness(s.field_completeness),
      R8: gradeCost(s.cost_posture, s.annual_cost_usd),
      R9: gradeWatermark(s.watermark_field, s.watermark_probed_at),
    },
  };
}
