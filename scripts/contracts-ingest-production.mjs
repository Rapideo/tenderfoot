/* Load the Indiana EDS contract register into PRODUCTION, deliberately.
 *
 * ⚖️ D6, ruled by Matt 2026-09-04: "Yes — load it now." The register is
 * 204,920 contracts, free, and about 86 seconds. It has been in `test` since
 * 2026-09-03; production holds zero, which is why two floor predicates read
 * worse there than reality.
 *
 * WHY THIS FILE EXISTS AT ALL. `npm run contracts:ingest` acts on whatever
 * DATABASE_URL names, and §4 deliberately points that at `test`. Reaching
 * production therefore meant an inline environment override -- exactly the
 * "easy to get subtly wrong, and getting it wrong is silent" hazard that
 * migrate-production.mjs was written to remove for migrations. CLAUDE.md §2
 * calls this a deliberate act; a deliberate act deserves a door, not an
 * incantation.
 *
 *   npm run contracts:ingest:production
 *
 * The connection string is never printed. The HOST is, per §4.
 *
 * ⚠️ NO "ALREADY LOADED" REFUSAL, AND THAT IS DELIBERATE. ingestContracts
 * reports `rows already held` and re-running is safe -- the register is
 * upserted, not appended. A guard against a second run would block the
 * correct way to refresh it. The count printed below is what tells an
 * operator whether anything actually changed. */
import { spawn } from "node:child_process";
import { resolveProductionTarget, PRODUCTION_ENDPOINT } from "./production-target.mjs";

let target;
try {
  target = resolveProductionTarget(process.env);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

console.log(`DATABASE_URL_PRODUCTION host : ${target.host}`);
console.log(`confirmed production (${PRODUCTION_ENDPOINT}).`);
console.log("\nLoading the Indiana EDS contract register — about 86 seconds.\n");

/* Spawned exactly as migrate-production.mjs spawns migrate.ts: the CLI reads
 * DATABASE_URL from its own process env and needs no knowledge of this
 * wrapper, so nothing in app/server changes to gain a production door. */
const child = spawn(
  process.execPath,
  ["--import", "tsx", "app/server/src/contracts/contracts-cli.ts"],
  { stdio: "inherit", env: { ...process.env, DATABASE_URL: target.url } },
);
child.on("exit", (code) => {
  if (code === 0) {
    console.log(
      "Done. `npm run fitness` still reads DATABASE_URL (test) — to measure what\n" +
        "production now holds, point it at production the same deliberate way.\n",
    );
  }
  process.exit(code ?? 0);
});
