/* Thin CLI over floor.ts. Mirrors merge/merge-cli.ts's shape exactly: same
 * pathToFileURL entry guard, same catch/close handling, same pool closing on
 * both paths. No measurement logic lives here.
 *
 * WHY A CLI AND NOT A ROUTE: ruling 3A forbids new UI slices, and the Status
 * Dashboard is parked (docs/Pinned-Status-Dashboard.md). A report a person runs
 * is the whole delivery -- and merge-cli.ts's own header records why that
 * matters: a criterion nobody can perform is not demonstrated by green tests.
 *
 * READ-ONLY. floor.ts contains no INSERT, UPDATE or DELETE, which is what makes
 * it safe to point at production:
 *
 *   DATABASE_URL="$DATABASE_URL_PRODUCTION" npm run fitness
 */
import { pathToFileURL } from "node:url";
import { all, one } from "../db/index.js";
import { measureFloor, type PredicateResult } from "./floor.js";
import { scoreSource, type RubricSubject, type SourceProfile } from "./rubric.js";

const MARK: Record<string, string> = {
  pass: "PASS",
  fail: "FAIL",
  marginal: "MARGINAL",
  unknown: "UNKNOWN",
};

function render(p: PredicateResult): string {
  const head =
    `  ${p.id}  ${MARK[p.verdict]!.padEnd(9)} ${p.statement}\n` +
    `        ${p.property} · threshold ${p.threshold} · measured ${p.measured}`;
  return p.detail ? `${head}\n        ${p.detail}` : head;
}

/* Read the Profile's geography ONCE and attach it to every subject. Having each
 * dimension re-read it would make scoreSource impure and its acceptance test
 * un-runnable without a database -- and that test has to stay cheap. */
export async function loadSubjects(): Promise<RubricSubject[]> {
  const profile = await one<{ geography: { primary?: string[]; secondary?: string[] } | null }>(
    `SELECT geography FROM firm_profile
       JOIN vendor ON vendor.id = firm_profile.vendor_id
      WHERE vendor.is_self LIMIT 1`,
  );
  const primaryGeography = profile?.geography?.primary ?? [];
  const secondaryGeography = profile?.geography?.secondary ?? [];

  const rows = await all<Omit<RubricSubject, "primaryGeography" | "secondaryGeography">>(
    `SELECT name, jurisdiction, platform, adapter_tier, legal_posture, archive_depth,
            verified_facets, cost_posture, annual_cost_usd, field_completeness, watermark_field
       FROM source
      ORDER BY name`,
  );
  return rows.map((r) => ({ ...r, primaryGeography, secondaryGeography }));
}

function renderProfile(p: SourceProfile): string {
  const head = `  ${p.name}`;
  if (p.disqualified) {
    return [
      head,
      `      DISQUALIFIED — ${p.disqualifiedReason}`,
      `      R1  ${p.dimensions.R1!.note}`,
    ].join("\n");
  }
  const lines = Object.entries(p.dimensions).map(
    ([id, d]) => `      ${id}  ${d.grade.toUpperCase().padEnd(9)} ${d.note}`,
  );
  return [head, ...lines].join("\n");
}

export async function main(): Promise<void> {
  const floor = await measureFloor();

  console.log("\nTHE FLOOR — does what we hold support a decision we can trust?\n");
  for (const p of floor.predicates) console.log(render(p) + "\n");

  console.log("  " + "-".repeat(72));
  console.log(`  ${floor.summary}`);
  if (floor.blocksAdjudication) {
    console.log(
      "\n  ⚠️  No GO / NO-GO adjudication may be taken while a predicate is\n" +
        "      unsatisfied. `unknown` blocks exactly as `fail` does: \"we have not\n" +
        "      measured it\" is not permission to proceed.",
    );
  }
  const subjects = await loadSubjects();
  console.log("\n\nTHE SOURCE PROFILES — how much of the property list can each supply?\n");
  for (const s of subjects) {
    console.log(renderProfile(scoreSource(s)));
    console.log("");
  }
}

/* Only run when invoked directly, so importing this file in a test does not
 * open a database pool. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { close } = await import("../db/index.js");
  main()
    .then(() => close())
    .catch(async (e) => {
      console.error(e.message);
      await close();
      process.exit(1);
    });
}
