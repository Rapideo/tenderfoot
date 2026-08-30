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
 * package.json's `build` script is `migrate:deploy && ...`, so loading .env
 * for the whole gate and then calling `npm run build` unmodified runs a
 * schema migration against whatever DATABASE_URL names. The build step
 * below therefore overrides DATABASE_URL with DATABASE_URL_TEST on this ONE
 * child process's environment. The `build` script's own definition is
 * untouched: a real `npm run build` (what Vercel's deploy actually runs)
 * still sees whatever DATABASE_URL its own environment provides.
 *
 * CORRECTION, 2026-08-29. This comment used to assert that ".env's
 * DATABASE_URL is the PRODUCTION pooler." IT IS NOT, and had not been for
 * some time. .env carries FOUR names for two different databases: the
 * production branch is DATABASE_URL_PRODUCTION (plus the POSTGRES_* set
 * Vercel injects), while DATABASE_URL and DATABASE_URL_TEST are currently
 * the SAME string, both pointing at the `test` branch. ci.yml does the same
 * thing deliberately and says so (`DATABASE_URL: secrets.DATABASE_URL_TEST`).
 *
 * That mattered more than a wrong comment usually does, because this one is
 * the entire justification for the override below -- so the override was
 * reading as a live safety mechanism while actually substituting a value
 * for itself. Worse, the comment described the DANGEROUS configuration as
 * the normal one, and DATABASE_URL_PRODUCTION is sitting in the same file
 * ready to be pasted across.
 *
 * The override is KEPT, not deleted. It costs nothing, and it is the only
 * thing standing between a local `npm run check` and a production migration
 * on the day someone does point DATABASE_URL at production. What has been
 * added is refuseToRunAgainstProduction() below, which checks that
 * invariant instead of assuming it -- a comment cannot fail a build. */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/* THE INVARIANT THE OVERRIDES BELOW REST ON, CHECKED RATHER THAN ASSUMED.
 *
 * Everything this script does with DATABASE_URL assumes it does not name
 * the production database. For most of this project's life that assumption
 * was recorded only in a comment, and the comment was wrong -- see the
 * CORRECTION above. This function is the same claim, enforced.
 *
 * Comparison is by DATABASE, not by string: Neon hands out a pooled host
 * (`ep-name-1234-pooler.…`) and a direct host (`ep-name-1234.…`) for the
 * one endpoint, so two URLs that differ textually can be the same database.
 * Stripping the `-pooler` suffix off the first label is what makes
 * DATABASE_URL_PRODUCTION and POSTGRES_URL_NON_POOLING compare equal, which
 * they should, because they are.
 *
 * The check is skipped, not failed, when DATABASE_URL_PRODUCTION is unset:
 * CI has no such variable (it supplies only DATABASE_URL and
 * DATABASE_URL_TEST) and there is nothing to compare against. A skip is
 * honest there; inventing a production hostname to compare against would
 * not be.
 *
 * The failure this guards is not hypothetical and got MORE likely the day
 * the Vercel CLI was installed here: `vercel env pull` with no path
 * argument overwrites .env wholesale, and Vercel's own DATABASE_URL is
 * production (verified 2026-08-29 -- it resolves to the same endpoint as
 * POSTGRES_URL, the `main` branch). .env's DATABASE_URL is a deliberate
 * local override of that value, and one routine pull silently undoes it.
 *
 * It also PRINTS which arrangement it found, every run. The fact that dev
 * and test currently share one branch is true, deliberate and matched by
 * ci.yml -- but it was discoverable only by diffing two secrets by hand,
 * which is how it stayed invisible long enough for the comment above to rot
 * around it. */
function databaseIdentity(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const [endpoint, ...rest] = u.hostname.split(".");
    return `${endpoint.replace(/-pooler$/, "")}.${rest.join(".")}${u.pathname}`;
  } catch {
    return null;
  }
}

/* REVIEW FINDING 3 (Medium, 2026-08-30): this used to check DATABASE_URL
 * ONLY -- and DATABASE_URL is not the value that reaches the migrating build.
 * The build step below runs `run("build", { ...process.env, DATABASE_URL:
 * process.env.DATABASE_URL_TEST })`, so DATABASE_URL_TEST is what
 * `migrate:deploy` actually connects to, and nothing compared it against
 * anything. Point DATABASE_URL_TEST at the production branch -- the same
 * `vercel env pull` accident this guard's own comment describes, one variable
 * over -- and the gate printed "OK  DATABASE_URL is not production" and then
 * migrated production. A guard that checks the variable the code discards is
 * not a guard. */
function refuseToRunAgainstProduction() {
  const dev = databaseIdentity(process.env.DATABASE_URL);
  const test = databaseIdentity(process.env.DATABASE_URL_TEST);
  const prod = databaseIdentity(process.env.DATABASE_URL_PRODUCTION);

  if (test && prod && test === prod) {
    console.error(
      `FAIL   DATABASE_URL_TEST names the PRODUCTION database (${prod}).\n` +
        `       That is the value this gate's build step SUBSTITUTES for DATABASE_URL,\n` +
        `       so it is what 'migrate:deploy' would actually connect to -- checking\n` +
        `       DATABASE_URL alone would have let this through.\n` +
        `       Point DATABASE_URL_TEST back at the test or staging branch; production\n` +
        `       is reached through DATABASE_URL_PRODUCTION and migrated by deploying.`,
    );
    process.exit(1);
  }

  if (dev && prod && dev === prod) {
    console.error(
      `FAIL   DATABASE_URL names the PRODUCTION database (${prod}).\n` +
        `       This gate runs 'npm run build', which runs 'migrate:deploy'.\n` +
        `       Most likely cause: 'vercel env pull' with no path argument, which\n` +
        `       overwrites .env -- Vercel's own DATABASE_URL IS production, and\n` +
        `       .env's is a deliberate local override of it.\n` +
        `       Point DATABASE_URL back at the test or staging branch; production is\n` +
        `       reached through DATABASE_URL_PRODUCTION and migrated by deploying.`,
    );
    process.exit(1);
  }

  if (!prod) {
    console.log("OK     DATABASE_URL_PRODUCTION is unset -- nothing to compare against (CI).");
  } else if (dev && dev === databaseIdentity(process.env.DATABASE_URL_TEST)) {
    console.log(
      `OK     DATABASE_URL is not production. Dev and test share ${dev}, so the\n` +
        `       build-step override below substitutes a value for itself -- deliberate,\n` +
        `       and the same arrangement ci.yml uses.`,
    );
  } else {
    console.log("OK     DATABASE_URL is not production, and is distinct from DATABASE_URL_TEST.");
  }
}

refuseToRunAgainstProduction();

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
/* C1 (2026-08-14 fix wave): this used to grep for a marker that lived ONLY
 * in Gallery.tsx's JS. That missed a real, currently-shipping defect: Vite
 * bundles a CSS side-effect import (`import "./Gallery.css"` in
 * Gallery.tsx) unconditionally, independently of whether the JS that
 * imports it is tree-shaken -- a clean build at HEAD shipped 18
 * `.gallery-*` selectors into dist/assets/index-*.css while this exact
 * function printed OK, because the marker it was grepping for had only ever
 * existed on the JS side. The marker now ALSO lives in Gallery.css (a
 * --dev-gallery-marker custom property -- a real declaration, not a
 * comment, because Vite's production CSS minifier strips comments and a
 * marker living only in one would never reach dist). This function's own
 * whole-dist-tree grep did not need to change to cover both; only the
 * marker's footprint did. Root cause fixed separately in router.tsx
 * (Gallery is now built only inside `if (import.meta.env.DEV)`, as a
 * React.lazy()-wrapped dynamic import(), so Rollup can prove the whole
 * branch -- JS and CSS alike -- is unreachable in production and drop it);
 * this check is what proves that fix actually holds, and what will catch a
 * regression if a future static import reintroduces the leak. */
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
        `app/client/src/dev/Gallery.tsx and app/client/src/dev/Gallery.css, ` +
        `both DEV-ONLY -- was found in:\n` +
        leaks.map((f) => `  ${f}`).join("\n") +
        `\n\nThis means /dev/gallery, or something that imports Gallery.tsx ` +
        `or Gallery.css from outside the import.meta.env.DEV branch in ` +
        `app/client/src/router.tsx, shipped to production. Find and remove ` +
        `whatever imports either file outside that guarded branch, then ` +
        `rebuild and re-run this check.`,
    );
    process.exit(1);
  }
  console.log(
    `OK     "${marker}" absent from ${distDir} -- the dev-only gallery route did not ship.`,
  );
}

/* SP2 T9: companion to checkGalleryMarkerAbsentFromBuild() below, and the
 * deferred item that check was carrying (progress.md, Task 3 minor --
 * "CARRIED INTO TASK 9"). That check greps the production BUILD for the
 * marker's absence; nothing anywhere asserted the marker was present in
 * SOURCE to begin with. Delete "dev-gallery-marker" from Gallery.tsx and
 * the absence check passes vacuously -- there is nothing to find in the
 * build because there was never anything to find, not because the route
 * didn't ship. Same shape as a test that cannot fail. Task 9 reorganises
 * the exact file that holds the marker, which is exactly when a string
 * with no visible purpose is most likely to be edited away. Runs first,
 * before typecheck/test/build, so a deleted marker fails fast rather than
 * burning the rest of the gate first. */
/* C1 (2026-08-14 fix wave): checks Gallery.css too, not just Gallery.tsx.
 * Gallery.css carries its own copy of the marker (a --dev-gallery-marker
 * custom property) precisely because a CSS side-effect import ships to
 * production independently of JS tree-shaking -- see the comment on
 * checkGalleryMarkerAbsentFromBuild() below. The same vacuous-pass risk
 * Task 3 found for the JS marker applies here identically: if someone
 * deletes the CSS marker while Gallery.css can still reach a build, the
 * absence check downstream would have nothing to find and would pass
 * whether or not the leak actually happened. */
function checkGalleryMarkerPresentInSource() {
  const marker = "dev-gallery-marker";
  const sources = [
    join(process.cwd(), "app", "client", "src", "dev", "Gallery.tsx"),
    join(process.cwd(), "app", "client", "src", "dev", "Gallery.css"),
  ];
  for (const path of sources) {
    const source = readFileSync(path, "utf8");
    if (!source.includes(marker)) {
      console.error(
        `FAIL: "${marker}" is missing from ${path}.\n` +
          `checkGalleryMarkerAbsentFromBuild() (later in this script) greps the ` +
          `production build for this exact string and treats its ABSENCE there ` +
          `as proof /dev/gallery -- JS and CSS alike -- did not ship. If the ` +
          `marker isn't in every one of its source files, that check passes ` +
          `whether or not the gallery actually shipped -- it would be proving ` +
          `nothing. Restore "${marker}" to ${path} and re-run.`,
      );
      process.exit(1);
    }
  }
  console.log(
    `OK     "${marker}" present in ${sources.length} dev-gallery source file(s) -- the build-absence check has something to grep for.`,
  );
}

checkGalleryMarkerPresentInSource();

run("typecheck");

/* DATABASE_URL is cleared from the `test` child's environment, on purpose
 * (post-merge re-review finding). Loading .env for the whole gate (C1/I2
 * above) puts DATABASE_URL into every child's environment unless it is
 * removed, and a test file is then one forgotten useTestSchema() call away
 * from connecting to whatever it names -- silently, because the connection
 * SUCCEEDS.
 *
 * This block's original wording said that variable was production. It is
 * not (see the CORRECTION at the top), and refuseToRunAgainstProduction()
 * above now enforces that it never becomes production without the gate
 * saying so. The clearing stays regardless, for a reason that never
 * depended on which database it named: a test that reaches ANY real
 * database outside its own schema is a test that can see another test's
 * rows.
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
const { DATABASE_URL: _keptOutOfTestEnvOnPurpose, ...testEnv } = process.env;
run("test", testEnv);

/* No redundant "is DATABASE_URL_TEST set" check here: `test` above already
 * requires it (useTestSchema() throws a named error the moment any test
 * file imports without it, and that failure exits this script before this
 * line is ever reached) -- a second check here could never actually run,
 * and an unreachable guidance message is worse than none, since someone
 * would trust it exists. The gate's own build step must never see
 * production -- see I2 and refuseToRunAgainstProduction() above. */
run("build", { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST });

checkGalleryMarkerAbsentFromBuild();

run("tokens");
