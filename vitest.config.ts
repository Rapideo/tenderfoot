import { defineConfig } from "vitest/config";

/* No root Vitest config existed before Task 4 of SP2 -- every prior test
 * file lived under app/server, whose tsconfig emits to an outDir named
 * "dist", which Vitest's own default exclude list already matches.
 *
 * app/client's tsconfig emits to an outDir named "dist-types" instead -- a
 * different literal path segment, so the default exclude list does not
 * match it. `tsc --build` (run by `npm run typecheck`, which `npm run
 * check` runs before `npm test`) compiles every .tsx under src, test files
 * included, into dist-types. Vitest's default include glob then discovers
 * those compiled .test.js files too and tries to run them a second time --
 * and they fail, because tsc does not copy co-located .css side-effect
 * imports, so `import "./Chip.css"` has nothing to resolve to from the
 * compiled dist-types/primitives/Chip.js.
 *
 * This surfaced only now because Task 4 is the first to add client-side
 * test files (app/client/src/primitives, the *.test.tsx files). Fixed by
 * explicitly excluding the dist-types directory alongside Vitest's own
 * defaults (see vitest.dev/config, the "exclude" option), which this array
 * must repeat in full: providing test.exclude REPLACES the default list
 * rather than extending it. */
export default defineConfig({
  test: {
    /* 🔴 THE 5-SECOND DEFAULT IS WRONG FOR THIS PROJECT, AND 23 FILES ALREADY
     * SAID SO ONE AT A TIME.
     *
     * Almost every server test talks to a REMOTE Postgres (Neon, us-east-1),
     * and many build their own schema first. That is tens of round trips
     * before an assertion runs, so Vitest's 5s default is not a generous
     * ceiling here -- it is below the honest cost of the work.
     *
     * The project already knew this and encoded it the expensive way: 23 of
     * 31 server test files pass an explicit `}, 120000)` on their tests or
     * hooks. Eight did not, and on 2026-09-07 those eight produced 14 timeout
     * failures in a single gate run -- scattered across unrelated files, which
     * reads exactly like a flaky database rather than a missing setting.
     * `routes.test.ts` cost this project a separate debugging session earlier
     * the same day for the identical reason: a beforeAll hook on the default
     * while its own tests took 13.3s.
     *
     * ⚖️ So it is set ONCE, here, where every file converges -- rather than
     * remaining a value each new file must remember to repeat. The existing
     * per-file 120000 arguments are now redundant; they are harmless and are
     * left alone rather than touched in eight files for no behaviour change.
     *
     * ⚠️ WHAT THIS COSTS, STATED RATHER THAN DISCOVERED: a genuinely hung test
     * now takes two minutes to report instead of five seconds. That is the
     * deliberate trade -- a slow failure is annoying, whereas a fast failure
     * that is really a slow database is MISLEADING, and this project has now
     * twice spent real time chasing infrastructure for what was a timeout
     * value. hookTimeout matches, because a beforeAll that builds a schema is
     * the single slowest thing in the suite. */
    testTimeout: 120_000,
    hookTimeout: 120_000,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/dist-types/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
    ],
  },
});
