/* Thin CLI over scrape/run. Argument parsing and file naming only — no
 * scrape logic lives here, so the HTTP handler in Task 9 is an equally thin
 * wrapper over the same library rather than a second implementation. */
import { pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateRun, type RunRequest } from "./contract.js";
import { runScrape } from "./run.js";
import type { Adapter } from "./adapter.js";
import { ADAPTERS } from "./adapters/registry.js";
import { resolveSource } from "./resolve-source.js";
import { MAX_BATCH } from "../lib/batchLimit.js";

/* Flags that stand alone -- no following value is consumed. Everything else
 * keeps the existing "--name value" shape below. */
const BOOLEAN_FLAGS = new Set(["listings-only", "documents-only"]);

export function parseArgv(argv: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith("--")) {
      throw new Error(`Expected a flag starting with --, got: ${token}`);
    }
    const name = token.slice(2);

    if (BOOLEAN_FLAGS.has(name)) {
      out[name] = true;
      continue;
    }

    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) {
      throw new Error(`Flag --${name} requires a value (not another flag)`);
    }
    i++; /* consume the value */

    if (name === "budgetMs") {
      const num = Number(v);
      if (!Number.isFinite(num) || num <= 0) {
        throw new Error(`--budgetMs must be a positive number, got: ${v}`);
      }
      out[name] = num;
    } else {
      out[name] = v;
    }
  }
  return out;
}

/* The two passes, each independently invocable and independently testable
 * (see cli.test.ts's `runCliWith`, which replaces both with fakes that
 * merely record which ran -- neither of these functions ever executes
 * inside that test file, so neither needs a database connection there). */
interface CliPasses {
  listings(): Promise<void>;
  documents(): Promise<void>;
}

/* Unchanged from the pre-Task-9 body of `main`, only extracted so it can be
 * swapped out by a fake -- see CliPasses above. Resolves the source (and
 * refuses a disabled one) here, not before dispatch, precisely so a test
 * that fakes this pass out never has to touch the database at all. */
async function runListingsPass(req: RunRequest, adapter: Adapter): Promise<void> {
  const resolved = await resolveSource(req.source);
  req.sourceName = resolved.sourceName;

  const dir = resolve(process.cwd(), "runs");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const out = join(dir, `run-${req.source}-${stamp}.db`);

  const res = await runScrape(req, adapter, out);
  console.log(JSON.stringify(res, null, 2));
  /* FIX 4 (final review, 2026-08-15): the count adapter.ts promises is
   * "visible rather than silent" (§5.4) -- always present, even at 0,
   * so a caller does not have to guess whether its absence means zero
   * or means nobody wired it up. */
  if (res.undatedSkipped > 0) {
    console.log(
      `\n${res.undatedSkipped} record(s) had no usable date and were skipped ` +
        `(not silently -- spec §5.4). See the artifact's run.undated_skipped.`,
    );
  }
  /* Resume LOWERS THE CEILING, it does not raise the floor. Sources page
   * newest-first, so an interrupted run has covered the recent end of the
   * window and the untouched work is older -- `since` stays put and `until`
   * comes down to where we got to. Corrected 2026-08-15 after review. */
  if (!res.done) {
    if (res.noProgress) {
      /* FIX 5 (Critical, final review 2026-08-15): a tie block wider than
       * this run's budget -- see run.ts's module header. Printing the
       * ordinary "resume with" advice here would be actively wrong: this
       * exact resume marker was already re-fetched and re-written by THIS
       * run without moving, and re-invoking with it unchanged will do the
       * same thing again, forever, silently, unless something changes. */
      console.warn(
        `\nWARNING: no forward progress was made -- too many records share ` +
          `one timestamp (${res.nextUntil}) for this budget to walk past ` +
          `them. Re-invoking with --until ${res.nextUntil} unchanged will ` +
          `re-fetch and re-write the SAME records, not advance. Widen the ` +
          `window (adjust --since) or raise --budgetMs before re-invoking.`,
      );
    } else {
      console.log(`\nNot finished. Resume with:  --since ${req.since} --until ${res.nextUntil}`);
    }
  }
}

/* The document pass, wiring the SAME discover-then-extract machinery
 * routes/admin.ts's /discover and /extract already run for SAM -- see
 * discover.ts's own comment: "the CLI passes a generous budget, the HTTP
 * handler one below 300s, and the same code serves both." Nothing here is
 * new capability; this is that wiring, finally added to the CLI.
 *
 * `discoverAttachments`/`runExtract` are imported DYNAMICALLY, inside this
 * function, not statically at the top of the file -- both discover.ts and
 * run-extract.ts have a static top-level `import ... from "../db/index.js"`,
 * which throws at module-evaluation time with no DATABASE_URL set. A static
 * import here would make merely importing cli.ts (and so cli.test.ts, which
 * tests the DB-free parseArgv/main flag logic) require a database
 * connection -- exactly the gate resolve-source.ts's own header already
 * documents and protects with the same fix.
 *
 * Also resolves (and can refuse a disabled) source independently of
 * runListingsPass, so `--documents-only` gets the same fail-closed check a
 * chained or `--listings-only` run already gets. */
async function runDocumentsPass(req: RunRequest): Promise<void> {
  await resolveSource(req.source);
  const limit = req.limit ?? MAX_BATCH;

  const { discoverAttachments } = await import("../extract/discover.js");
  const { runExtract } = await import("../extract/run-extract.js");

  const discovered = await discoverAttachments(limit, undefined, req.budgetMs);
  console.log(
    `\nDiscover: ${discovered.documents} document(s) queued from ` +
      `${discovered.solicitations} solicitation(s) checked (${discovered.skipped} skipped, ` +
      `${discovered.refreshed} listing field(s) refreshed).`,
  );

  const extracted = await runExtract({ limit, budgetMs: req.budgetMs });
  console.log(
    `Extract: ${extracted.processed} processed, ${extracted.failed} failed, ` +
      `${extracted.remaining} remaining.`,
  );
}

export async function main(
  argv = process.argv.slice(2),
  passes: Partial<CliPasses> = {},
): Promise<void> {
  const parsed = parseArgv(argv);

  /* Extracted before validateRun sees `parsed` -- ALLOWED (contract.ts) does
   * not know either name, and would throw "Unknown run option" on both. */
  const listingsOnly = parsed["listings-only"] === true;
  const documentsOnly = parsed["documents-only"] === true;
  delete parsed["listings-only"];
  delete parsed["documents-only"];

  /* Passing both is refused, not silently ranked -- see the CHAINED BY
   * DEFAULT comment below for why a silent precedence rule is exactly the
   * failure this task exists to avoid. Checked before adapter resolution so
   * the mistake is cheap regardless of whether --source even names
   * something real. */
  if (listingsOnly && documentsOnly) {
    throw new Error(
      "--listings-only and --documents-only are mutually exclusive -- pass at most one " +
        "(or neither, to run both).",
    );
  }

  /* `depth` used to be required on every call; it is now orthogonal to
   * which pass(es) run (that is what the two flags above are for), so a
   * caller who only cares about listings-vs-documents should not also have
   * to name a depth. "listing" matches what routes/admin.ts's /run already
   * hardcodes for the same field. */
  if (parsed.depth === undefined) parsed.depth = "listing";

  /* The adapter lookup now has to happen BEFORE validateRun, not after --
   * validateRun needs the resolved adapter's `shape` (windowed vs
   * snapshot) as its second argument, so there is no "validate first, look
   * up the adapter second" ordering left that also knows the shape. */
  const sourceKey = typeof parsed.source === "string" ? parsed.source : undefined;
  /* Reported as ITS OWN failure, not folded into "no adapter named
   * undefined" below -- a missing --source and an unrecognised one are two
   * distinct mistakes, and collapsing them cost the clearer message when
   * the adapter lookup moved ahead of validateRun (fix round 1, 2026-09-02). */
  if (sourceKey === undefined) throw new Error("source is required");
  const entry = ADAPTERS[sourceKey];
  if (!entry) {
    throw new Error(`No adapter named ${sourceKey}. Known: ${Object.keys(ADAPTERS).join(", ")}`);
  }
  const adapter = entry.make();
  const req = validateRun(parsed, adapter.shape);

  const listings = passes.listings ?? (() => runListingsPass(req, adapter));
  const documents = passes.documents ?? (() => runDocumentsPass(req));

  /* CHAINED BY DEFAULT, and the distinction is the point (design §6).
   *
   * A separate PASS is Matt's ruling: documents get their own budget and their
   * own failure modes. A separately INVOKED pass is not a ruling -- it is an
   * accident of how SAM was built, and it is measurable: after two slices,
   * 12 of 9,883 SAM solicitations have documents. 0.1%. A second pass nobody
   * invokes does not happen.
   *
   * So one operator action runs both. The flags exist for when exactly one is
   * wanted, and passing both is refused rather than silently ranked. */
  if (!documentsOnly) await listings();
  if (!listingsOnly) await documents();
}

/* Only run when invoked directly, so importing this file in a test does not
 * start a scrape. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
