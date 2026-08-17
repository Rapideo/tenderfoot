/* Thin CLI over merge/merge.ts and merge/yield.ts. Mirrors
 * ingest/import-cli.ts's shape EXACTLY (FIX 6, final review 2026-08-15):
 * same pathToFileURL entry-point guard, same catch/close error handling,
 * same pool closing on both the success and the failure path. No merge or
 * yield logic lives here, only argument-free process wiring.
 *
 * WHY THIS FILE HAS TO EXIST: SP3.5's own demo criterion is "dedup works;
 * per-source yield visible" (merge.ts's header, Plan of Action §6.5), but
 * before this fix mergeSightings() and perSourceYield() were called only by
 * their own test suites -- library functions nothing outside a test runner
 * ever invoked, exactly the defect import-cli.ts's header comment already
 * names for importArtifact() (task-6 review, finding 3, quoted there
 * verbatim). A criterion a human cannot perform is not demonstrated by
 * green tests alone.
 *
 * Takes NO positional argument, unlike import-cli.ts's artifact path --
 * there is nothing to specify. A merge run always processes every
 * still-unlinked sighting across every source (mergeSightings() called with
 * no sourceId scopes it to nothing, i.e. everything), and the yield report
 * that follows always covers every source row. */
import { pathToFileURL } from "node:url";
import { mergeSightings } from "./merge.js";
import { perSourceYield } from "./yield.js";

export async function main(): Promise<void> {
  const mergeResult = await mergeSightings();
  console.log("merge:");
  console.log(JSON.stringify(mergeResult, null, 2));

  const yieldResult = await perSourceYield();
  console.log("\nper-source yield:");
  console.log(JSON.stringify(yieldResult, null, 2));
}

/* Only run when invoked directly, so importing this file in a test does not
 * start a merge or open a database pool. */
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
