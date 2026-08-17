/* Thin CLI over ingest/import-artifact. Mirrors scrape/cli.ts's shape: no
 * import logic lives here, only argument handling and process wiring -- this
 * is what makes SP3's demo criterion ("importing it lands sightings")
 * actually performable, since importArtifact() alone is a library function
 * nothing calls (task-6 review, finding 3).
 *
 * Takes ONE positional argument, the artifact path -- no flags, unlike
 * scrape/cli.ts, because there is nothing else to specify: the artifact
 * itself already carries which source, window, and outcome it is. */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { importArtifact } from "./import-artifact.js";

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const arg = argv[0];
  if (!arg) {
    throw new Error("Usage: import <artifact-path>");
  }
  const path = resolve(process.cwd(), arg);
  if (!existsSync(path)) {
    throw new Error(`No artifact file at ${path}`);
  }

  const res = await importArtifact(path);
  console.log(JSON.stringify(res, null, 2));
}

/* Only run when invoked directly, so importing this file in a test does not
 * start an import or open a database pool. */
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
