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
