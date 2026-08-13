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

run("typecheck");
run("test");

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  console.error(
    "DATABASE_URL_TEST is not set. Copy .env.example to .env and paste the Neon `test` " +
      "branch string, or run `vercel env pull`.",
  );
  process.exit(1);
}
/* The gate's own build step must never see production -- see I2 above. */
run("build", { ...process.env, DATABASE_URL: testUrl });

run("tokens");
