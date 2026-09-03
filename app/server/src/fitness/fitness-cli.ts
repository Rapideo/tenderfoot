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
import { measureFloor, type PredicateResult } from "./floor.js";

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
  console.log("");
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
