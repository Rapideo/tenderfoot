/* Thin CLI over ingest.ts. Mirrors merge/merge-cli.ts exactly: same
 * pathToFileURL entry guard, same catch/close handling, same pool closing on
 * both paths. No ingest logic lives here.
 *
 * RUNS LOCALLY, per Matt's standing ruling of 2026-09-03 -- "we should always
 * do scraping locally unless otherwise specified" -- which supersedes the
 * 2026-08-15 ruling that long ingestion runs on Vercel. No function ceiling,
 * so a multi-minute run is unremarkable.
 *
 * NO ARGUMENTS. Ruling 3 (.superpowers/sdd/2026-09-03-indiana-contract-
 * register/progress.md) abandoned date-window chunking after measurement:
 * startDate/endDate filters fully-contained-within, so year windows recovered
 * 24,933 of 204,991 -- an 88% shortfall from contracts spanning a year
 * boundary. The only correct fetch is "everything at once", which
 * fetchRegister() already performs and asserts complete. There is nothing
 * left for this CLI to parse.
 *
 *   npm run contracts:ingest
 */
import { pathToFileURL } from "node:url";
import { ingestContracts } from "./ingest.js";
import { fetchRegister } from "./eds-client.js";

const SOURCE = "Indiana EDS contract register";

export async function main(): Promise<void> {
  console.log(`\n${SOURCE}\n`);
  const t0 = Date.now();
  const r = await ingestContracts({
    sourceName: SOURCE,
    fetchAll: () => fetchRegister(),
  });

  console.log(`  rows fetched       ${r.fetched}`);
  console.log(`  rows written       ${r.written}`);
  console.log(`  rows already held  ${r.skipped}`);
  /* The real fetch takes about 47s (measured 2026-09-03, 204,991 rows at
   * 78 MB) -- a silent minute at the terminal reads as a hang, so this line
   * stays even though there is no window/request breakdown left to print. */
  console.log(`  elapsed            ${Math.round((Date.now() - t0) / 1000)}s\n`);
}

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
