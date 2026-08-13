#!/usr/bin/env node
/* Orchestrates `npm run check` (C1 + I2, SP1.5 final review).
 *
 * C1: nothing loaded .env, so `npm run check` only ever worked in a shell
 * that already had DATABASE_URL / DATABASE_URL_TEST set by some other
 * means -- every "gate green" claim in this slice rested on that
 * unrecorded precondition. package.json's "check" script now runs this
 * file via `node --env-file-if-exists=.env`, so .env is loaded before a
 * single child process starts. `--env-file-if-exists` (not `--env-file`)
 * is deliberate: CI has no .env file at all -- it's gitignored, so it
 * isn't even in the checked-out tree -- and supplies DATABASE_URL /
 * DATABASE_URL_TEST directly as job env (ci.yml). The "if-exists" variant
 * is a silent no-op there; the plain flag would hard-fail CI on a missing
 * file.
 *
 * I2: the obvious fix -- just load .env -- is wrong on its own. Root
 * package.json's `build` script is `migrate:deploy && ...`, and .env's
 * DATABASE_URL is the PRODUCTION pooler (it's the same file Vercel's real
 * deploy needs). Loading .env for the whole gate and then calling `npm run
 * build` unmodified would run a schema migration against production from
 * a local test run, the moment a new migration exists to apply -- today
 * it's a no-op only because all four are already applied. So the build
 * step below runs with DATABASE_URL overridden to DATABASE_URL_TEST on
 * this ONE child process's environment only. The `build` script's own
 * definition is untouched: a real `npm run build` (what Vercel's deploy
 * actually runs) still sees whatever DATABASE_URL its own environment
 * provides. */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function run(npmScript, env = process.env) {
  // One joined command string, not a separate args array -- npmScript is
  // always one of the fixed literals below, never external input, and
  // passing shell:true together with an args array trips Node's DEP0190
  // (unescaped argv concatenation) for no benefit here.
  const result = spawnSync(`npm run ${npmScript}`, { stdio: "inherit", shell: true, env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/* SP2 T3 review (Important): the DEV guard on /dev/gallery in
 * app/client/src/router.tsx is convention-enforced, not tool-enforced --
 * nothing stops a future `import { Gallery } from "./dev/Gallery"` from
 * outside that guarded branch (a debug link, a barrel export, a lazy import
 * "for convenience") from shipping it anyway. A comment on the guard cannot
 * catch that; only something that runs is a guard.
 *
 * So this runs. app/client/src/dev/Gallery.tsx carries a marker string that
 * exists nowhere else in the source tree. This function greps the actual
 * production build for it -- after `build` below has produced dist/ --
 * and fails the gate if it is present, whatever route it arrived by. */
function checkGalleryMarkerAbsentFromBuild() {
  const marker = "dev-gallery-marker";
  const distDir = join(process.cwd(), "app", "client", "dist");
  const leaks = [];
  for (const rel of readdirSync(distDir, { recursive: true })) {
    const full = join(distDir, rel);
    if (statSync(full).isDirectory()) continue;
    if (readFileSync(full, "utf8").includes(marker)) leaks.push(full);
  }
  if (leaks.length > 0) {
    console.error(
      `FAIL: a dev-only surface reached the production build.\n` +
        `"${marker}" -- a marker that exists ONLY in ` +
        `app/client/src/dev/Gallery.tsx, a DEV-ONLY component -- was found in:\n` +
        leaks.map((f) => `  ${f}`).join("\n") +
        `\n\nThis means /dev/gallery, or something that imports Gallery.tsx ` +
        `from outside the import.meta.env.DEV branch in ` +
        `app/client/src/router.tsx, shipped to production. Find and remove ` +
        `whatever imports Gallery.tsx outside that guarded branch, then ` +
        `rebuild and re-run this check.`,
    );
    process.exit(1);
  }
  console.log(
    `OK     "${marker}" absent from ${distDir} -- the dev-only gallery route did not ship.`,
  );
}

run("typecheck");

/* DATABASE_URL is cleared from the `test` child's environment, on purpose
 * (post-merge re-review finding). .env's DATABASE_URL is PRODUCTION, and
 * loading .env for the whole gate (C1/I2 above) puts it in every child's
 * environment unless removed. It is safe today ONLY because all four test
 * files call useTestSchema() -- which overwrites process.env.DATABASE_URL
 * with the test branch's connection string -- before importing
 * db/index.ts. A future test file that forgot that call would otherwise
 * connect straight to production instead of failing to find a database at
 * all.
 *
 * That is the exact failure shape this project has already paid for three
 * times: a loud failure quietly becoming a silent one pointed at
 * production (a migration CLI exiting 0 while doing nothing; an import
 * reporting success while dropping a row; a gate that only ever passed
 * because of an unrecorded shell precondition). Clearing DATABASE_URL here
 * restores the loud failure -- a test file that skips useTestSchema() now
 * has NO DATABASE_URL at all and dies immediately with "DATABASE_URL is
 * not set" (db/index.ts) instead of quietly reaching production.
 * DATABASE_URL_TEST is left untouched; useTestSchema() needs it to build
 * the connection string it installs.
 *
 * Do not "fix" this by putting DATABASE_URL back into testEnv -- that is
 * the bug this block exists to close. */
const { DATABASE_URL: _productionUrlKeptOutOfTestEnv, ...testEnv } = process.env;
run("test", testEnv);

/* No redundant "is DATABASE_URL_TEST set" check here: `test` above already
 * requires it (useTestSchema() throws a named error the moment any test
 * file imports without it, and that failure exits this script before this
 * line is ever reached) -- a second check here could never actually run,
 * and an unreachable guidance message is worse than none, since someone
 * would trust it exists. The gate's own build step must never see
 * production -- see I2 above. */
run("build", { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST });

checkGalleryMarkerAbsentFromBuild();

run("tokens");
