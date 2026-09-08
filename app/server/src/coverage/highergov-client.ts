/* ASKING HIGHERGOV WHAT IT CARRIED, AND NOTHING ELSE.
 *
 * ⚠️ NO DATABASE ACCESS HERE, DELIBERATELY -- same posture as
 * extract/document-clients.ts. A client fetches and parses; the caller
 * decides what to write and what it cost. That is what lets run.ts own the
 * spend guard, the tally and the abort in one place.
 *
 * 🛑 THIS IS THE FIRST COMMITTED CODE IN THIS PROJECT TO CALL THIS API. The
 * 2026-09-03 work ran in throwaway scripts, and it leaked a live key. All
 * three CLAUDE.md §5.3 rules are structural here rather than remembered:
 *
 *   1. document_path is a CREDENTIAL. It is dropped at parse time -- it
 *      never enters a FeedNotice, so no caller can persist or print it.
 *   2. Scrubbing happens at the BOUNDARY. redact() walks every value, and it
 *      is what any diagnostic path must pass through. The leak happened
 *      because a scrub() helper covered every ERROR path while field VALUES
 *      printed raw -- the key was thought of as something in the REQUEST,
 *      not something that comes BACK.
 *   3. The URL is built HERE, from the environment. Never in a shell
 *      command, where it would land in history and process listings.
 *
 * ⚠️ NOT REGISTERED IN scrape/adapters/registry.ts, AND THAT IS DELIBERATE
 * (spec §7.1). Registering it would make a source still under test reachable
 * by the real ingest path, which is the whole argument of spec §5.1. */

const HOST = "https://www.highergov.com/api-external";

/* Seeded by migration 019 as the first source in this project that costs
 * money. Hand-typed here because HigherGov has no ADAPTERS entry to derive
 * it from -- see the header. run.ts asserts this row exists before spending,
 * which is what turns a rename into a loud failure rather than a silent
 * miscount against the wrong source_id. */
export const HIGHERGOV_SOURCE_NAME = "HigherGov";

/* ⚖️ THE AXIS A WINDOW IS WALKED ON. Ruled 2026-09-07 by Matt and recorded as
 * an amendment to the design spec's §3.2: **the BACKFILL runs on
 * `posted_date`; LIVE operation stays on `captured_date`.**
 *
 * `captured_date` is HigherGov's CRAWL watermark (R9). For live operation --
 * "what did they notice since yesterday" -- it is exactly the right question,
 * and nothing about that changes. For a BACKFILL it is the wrong question and
 * expensively so: a historical crawl window returns whatever their crawler
 * touched that day, INCLUDING re-captures of notices we already hold. The
 * vendor bills per record RETURNED (CLAUDE.md §5.1), so a re-capture costs
 * full price and delivers nothing -- the merge layer dedups it correctly and
 * the money is gone. `posted_date` asks what was PUBLISHED in the window,
 * which is what a backfill actually means.
 *
 * The values ARE the vendor's own parameter names rather than nicknames for
 * them, so `url.searchParams.set(axis, day)` is the whole implementation and
 * there is no mapping table to drift out of step. Both are accepted
 * parameters -- R1 read /opportunity/'s twelve from their own OpenAPI schema
 * (docs/2026-09-03-platform-comparison.md) and these are two of them.
 *
 * 🔴 WHICHEVER AXIS IS WALKED IS THE AXIS `modifiedAt` MUST REPORT. Querying
 * on one and reporting the other gives a notice published in June but crawled
 * in September a September `modifiedAt` -- outside the window just requested.
 * scrape/adapters/highergov.ts is where that is enforced; this comment exists
 * because the two files must not drift. */
export type FeedAxis = "captured_date" | "posted_date";

/** Every accepted axis in one place, so a caller validating operator input
 * checks against this rather than against a second hand-typed list. */
export const FEED_AXES: readonly FeedAxis[] = ["captured_date", "posted_date"];

/** ⚠️ `captured_date` ON PURPOSE, and it must stay that way. An invocation
 * that names no axis has to produce the request it produced before axes
 * existed -- the same "default provably inert" discipline `pageSize` follows
 * in fetchDay below. */
export const DEFAULT_FEED_AXIS: FeedAxis = "captured_date";

export interface FeedNotice {
  /** Their `source_id`. For Indiana this IS IDOA's own 15-digit Event ID,
   * which is what makes exact-match comparison possible at all. */
  externalId: string;
  capturedDate: string | null;
  /** The vendor's own PUBLICATION date -- docs/2026-09-03-highergov-field-
   * mapping.md §1 maps it to `posted_at`, and merge/posted-at.ts already
   * reads it off `sighting.raw`. Parsed HERE, beside `capturedDate`, because
   * the adapter must be able to report either one as `modifiedAt` depending
   * on which axis the window is being walked on -- and a field the adapter
   * has to dig out of `raw` by hand is a field the next reader will forget
   * to keep in step with the query parameter. */
  postedDate: string | null;
  versionKey: string | null;
  title: string | null;
  raw: Record<string, unknown>;
}

/* ⚖️ THE VENDOR'S OWN HARD CAP ON ONE RESPONSE, MEASURED 2026-09-08 AND NOT
 * ASSUMED. A run asking for `--page-size=300` produced 14 calls returning
 * EXACTLY 100 records each (STATUS.md, "page_size IS CAPPED AT 100 BY THE
 * VENDOR"). So `page_size` above 100 buys nothing, and 100 is the most a
 * single page can ever bill.
 *
 * 🔴 IT IS USED AS A PRICE, NOT AS A DESCRIPTION. `walkDay` below decides
 * whether it may afford the NEXT page before buying it, and the only honest
 * figure available at that moment is "the most that page could cost". Under-
 * pricing it would let a walk step over a budget it had already been told it
 * could not cross -- and the vendor's meter cannot be read back at all
 * (CLAUDE.md §5.1), so an overrun cannot be noticed, let alone undone. */
export const VENDOR_PAGE_RECORD_CAP = 100;

/* 🛑 THE HARD PER-DAY PAGE CEILING. NOT A BUDGET -- A BACKSTOP, and it is
 * the one guard that does not depend on any caller remembering to pass
 * anything.
 *
 * A paging loop is the first code in this project that decides for itself how
 * many billed responses to buy. Every other guard here reads a number the
 * VENDOR reported (`meta.pagination.pages`) or a number a CALLER supplied
 * (`maxRecords`). Both can be wrong: a vendor bug reporting `pages: 90000`
 * and a caller that forgot its budget produce exactly the same unbounded
 * walk, and there is no way to un-buy it.
 *
 * TEN, and here is the arithmetic that picked it:
 *
 *  - 10 pages x 100 records (the measured cap above) = 1,000 records, the
 *    absolute worst case for ONE day. That is 1/9 of MONTHLY_RECORD_CEILING
 *    (9,000, extract/api-spend.ts) -- so even a vendor reporting something
 *    absurd cannot spend more than an ninth of a month's allowance on a
 *    single day before this stops it.
 *  - It is ~5x the largest day this project has ever measured. The widest
 *    saved search we own (five states) ran 2026-06-09 -> 2026-09-07 for
 *    2,605 records across ~91 days, and 14 of 20 sampled weekdays exceeded
 *    100 -- i.e. real busy days are low hundreds, two or three pages. A
 *    ceiling of 10 will not truncate a real day.
 *
 * So it is high enough never to bind in practice and low enough that binding
 * is survivable. A day that hits it comes back marked PARTIAL (see
 * `isPartialDay`), which is a finding, not a silent truncation. */
export const MAX_PAGES_PER_DAY = 10;

/** The most a SINGLE page can bill, given whatever `page_size` was asked for.
 * `pageSize` above the vendor's own cap buys nothing (see
 * VENDOR_PAGE_RECORD_CAP); `pageSize` below it genuinely lowers the price of
 * a page, and pricing every page at 100 regardless would refuse affordable
 * pages on a small page size. Exported because ingest/highergov-cli.ts needs
 * the same figure to budget its dry-run sample down to exactly one page. */
export function singlePageBudget(pageSize?: number): number {
  return Math.min(pageSize ?? VENDOR_PAGE_RECORD_CAP, VENDOR_PAGE_RECORD_CAP);
}

export interface FeedResult {
  notices: FeedNotice[];
  /** What the VENDOR billed: the row count, BEFORE dedup.
   *
   * 🔴 SINCE PAGING, THIS IS THE SUM ACROSS EVERY PAGE FETCHED, not one
   * response's row count. It is what api_spend records and what every
   * ceiling calculation reads, and under-reporting it is the dangerous
   * direction (extract/api-spend.ts's header). */
  records: number;
  /** meta.pagination.count -- the saved-search change detector. */
  feedCount: number | null;
  /** meta.pagination.pages, as reported by PAGE ONE: how many pages the
   * VENDOR says this day has. Null when the vendor said nothing, which is
   * "unknown", never "one". */
  pages: number | null;
  /** How many pages this call actually fetched AND PAID FOR. Compare it
   * against `pages` -- that comparison, and only that comparison, is what
   * distinguishes a whole day from a half-bought one. `isPartialDay()` below
   * is the single place that comparison is written down. */
  pagesFetched: number;
}

/** Did this day come back INCOMPLETE? True when the vendor said there were
 * more pages than the walk actually bought -- a budget stop, the per-day page
 * ceiling, or an empty page ending the walk early.
 *
 * ⚠️ `pages === null` reads as NOT partial, deliberately: with no vendor
 * figure at all there is nothing to be short of, and inventing a truncation
 * from silence would abort every run against a response shape we have never
 * seen. That is the same posture coverage/run.ts's old `pages !== null &&
 * pages > 1` guard took, kept rather than quietly reversed. */
export function isPartialDay(result: Pick<FeedResult, "pages" | "pagesFetched">): boolean {
  return result.pages !== null && result.pagesFetched < result.pages;
}

/* 🔴 A THROW PARTWAY THROUGH A DAY MUST NOT LOSE THE PAGES ALREADY PAID FOR.
 *
 * Every existing tally-then-rethrow site in this repo (coverage/run.ts,
 * extract/fetch-documents-for.ts, ingest/highergov-cli.ts) was written for a
 * SINGLE call: it charges `COVERAGE.unparseableResponseRecords` and lets the
 * error propagate. A paged day breaks that assumption -- three pages can
 * succeed, bill 300 records, and the fourth throw. The error carries no hint
 * of that, so those sites would tally 40 for a day the vendor billed 300+
 * for: an under-report of the exact kind api-spend.ts calls the dangerous
 * direction.
 *
 * So the walk re-throws with the already-billed figure ATTACHED, and each
 * tally site adds `recordsAlreadyBilled(err)` to its own conservative
 * estimate for the page that failed.
 *
 * ⚠️ ONLY WRAPS WHEN SOMETHING WAS ACTUALLY BILLED. A failure on page one
 * throws the original error untouched, so a single-page day's failure
 * behaves exactly as it did before paging existed.
 *
 * ⚠️ NO `cause`, and the message is re-redacted. Same reasoning as
 * fetchValidated's transport guard below: console.error prints a cause
 * chain, and nothing here can vouch for what a runtime put in one. redact()
 * is idempotent, so re-scrubbing an already-scrubbed message costs nothing
 * and closes the case where the error came from somewhere that did not. */
export class PartialDayBilledError extends Error {
  readonly recordsBilled: number;
  readonly pagesFetched: number;
  constructor(message: string, recordsBilled: number, pagesFetched: number) {
    super(message);
    this.name = "PartialDayBilledError";
    this.recordsBilled = recordsBilled;
    this.pagesFetched = pagesFetched;
  }
}

/** What a caught error says was ALREADY BILLED before it was thrown. Zero for
 * anything that carries no such figure, which is every error in this codebase
 * except the one above.
 *
 * ⚠️ DUCK-TYPED RATHER THAN `instanceof`, on purpose: several test files
 * reach this module through `await import()`, and an error crossing a module
 * boundary that resolved twice would fail an `instanceof` check and silently
 * report zero -- an under-report, which is the one direction that must never
 * happen by accident. */
export function recordsAlreadyBilled(err: unknown): number {
  const billed = (err as { recordsBilled?: unknown } | null | undefined)?.recordsBilled;
  return typeof billed === "number" && Number.isFinite(billed) && billed > 0 ? billed : 0;
}

/* Task 7. The vendor's OWN schema doc for /document/ (docs/2026-09-03-
 * highergov-field-mapping.md §2, written from their published OpenAPI schema,
 * zero live calls) lists only seven fields: file_name, file_type, file_size,
 * text_extract, posted_date, summary, download_url. No stable per-document id
 * is documented -- download_url IS the address, and that doc's own
 * conclusion is explicit: "download_url (expires in 60 minutes)" must never
 * be stored, same as document_path. This repo's own /opportunity/ fixtures
 * instead show `document_path` carrying a URL that points AT /document/ (see
 * highergov-opportunity.json), so the live per-document field name is not
 * fully pinned down between the two -- but the outcome is identical either
 * way: nothing URL-shaped from this endpoint is fit to persist. There is
 * deliberately no `documentId` field here (the plan's own sketch proposed
 * one) -- inventing a field the vendor's schema does not name would be
 * exactly the guessed-shape failure CLAUDE.md warns against. */
export interface FetchedDoc {
  fileName: string;
  /* Task 7 review round 2. `text_extract` is NOT credential-shaped (unlike
   * document_path/download_url) -- it is the vendor's own already-extracted
   * text, 8,884-22,190 chars observed on `.docx` per the field-mapping doc,
   * NULL for `.xlsx`. Field-mapping doc §2's own conclusion: for HigherGov
   * documents the whole mechanical-extraction stack "becomes a field read".
   * Safe to carry all the way out of this module, unlike the two URL fields
   * above it. */
  textExtract: string | null;
}

export interface DocumentsResult {
  docs: FetchedDoc[];
  /** What the VENDOR billed: the raw result count, before we discard any
   * (mirrors FeedResult.records above). */
  records: number;
}

export interface HigherGovClient {
  /* `pageSize`: OPTIONAL and OFF BY DEFAULT, on purpose -- see fetchDay's own
   * implementation below for the full economics. Omitting it (or passing
   * `undefined`) must produce a request byte-identical to one that never
   * knew this parameter existed.
   *
   * `axis`: which date field the `day` is asked against -- see FeedAxis
   * above. Also OFF BY DEFAULT in the same sense: omitted, it is
   * `captured_date`, which is what every caller asked for before this
   * parameter existed. The first argument is named `day` rather than
   * `capturedDate` precisely because it is no longer always one.
   *
   * `maxRecords`: THE CALLER'S BUDGET FOR THIS ONE DAY -- "you may bill at
   * most this many records here". Omitted, the only limit is
   * MAX_PAGES_PER_DAY. When the next page would cross it the walk STOPS and
   * the day comes back marked partial (`isPartialDay`), rather than
   * overrunning a budget that cannot be un-spent.
   *
   * ⚠️ PAGE ONE IS NOT BUDGETED, and that is deliberate rather than an
   * oversight: calling fetchDay at all IS the decision to buy the day's
   * first page, and there is no way to learn what a day costs without
   * buying it. The budget governs every page AFTER that -- which is exactly
   * where a paging loop's own spending decisions begin. */
  fetchDay(
    day: string,
    fetchImpl?: typeof fetch,
    pageSize?: number,
    axis?: FeedAxis,
    maxRecords?: number,
  ): Promise<FeedResult>;
  fetchBySourceId(sourceId: string, fetchImpl?: typeof fetch): Promise<FeedResult>;
  /* WARNING: ~11 records per call, verified 2026-09-03 (the meter moved
   * 478 -> 489 on one call returning 1 opportunity + 10 documents). This is
   * the single most expensive thing in the codebase per invocation. */
  fetchDocuments(sourceId: string, fetchImpl?: typeof fetch): Promise<DocumentsResult>;
}

/* Matches an api_key wherever it appears in a string, in any nesting. Broad
 * on purpose: the failure mode of over-redacting is an unreadable diagnostic,
 * and the failure mode of under-redacting is a rotated credential and an
 * incident. */
const KEY_IN_STRING = /api_key=[^&\s"']+/gi;

/* 🔴 KEYS AS WELL AS VALUES, AND THE FIX IS THE `redact(k)` BELOW.
 *
 * This used to be `out[k] = redact(v)` -- it recursed into VALUES only and
 * copied property NAMES verbatim. `toNotice` sets `raw: redact(rest)`, so a
 * key-shaped string sitting in a property NAME survived this boundary
 * untouched and rode `raw` into scrape/run.ts's `writeSighting`, into the
 * hashed artifact, and finally into Postgres `sighting.raw` jsonb --
 * permanently, in the one place hardest to retract. The adapter's
 * string-level `scrubPayload` caught it for `page.payload` and ONLY for
 * `page.payload`; `items[].raw` had no such second pass. That asymmetry is
 * closed here rather than at either call site, because the boundary is where
 * CLAUDE.md §5.3 rule 2 says the scrub belongs.
 *
 * ⚠️ STILL IDEMPOTENT, and that is load-bearing (adapters/highergov.ts).
 * `KEY_IN_STRING` rewrites `api_key=<anything>` to `api_key=REDACTED`, and
 * `api_key=REDACTED` is itself a match that rewrites to the identical
 * string -- so a second pass over an already-redacted name or value returns
 * the same bytes, at any depth.
 *
 * ⚠️ TWO NAMES CAN NOW COLLIDE -- `?api_key=A` and `?api_key=B` both become
 * `?api_key=REDACTED`, and the later wins. That is a deliberate trade: losing
 * one member of a pair of credential-shaped property names is cheaper than
 * persisting either of them, and no real vendor field name is key-shaped. */
export function redact<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(KEY_IN_STRING, "api_key=REDACTED") as unknown as T;
  }
  if (Array.isArray(value)) return value.map(redact) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[redact(k)] = redact(v);
    }
    return out as unknown as T;
  }
  return value;
}

interface RawResult {
  source_id?: unknown;
  captured_date?: unknown;
  posted_date?: unknown;
  version_key?: unknown;
  title?: unknown;
  [key: string]: unknown;
}

interface RawBody {
  meta?: { pagination?: { count?: unknown; pages?: unknown } };
  results?: RawResult[];
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function toNotice(r: RawResult): FeedNotice | null {
  const externalId = str(r.source_id);
  if (!externalId) return null;
  /* document_path is REMOVED here, not merely unread. Deleting it from a
   * copy is what makes "no caller can leak what it never received" true of
   * `raw` as well as of the named fields -- the ingest needs everything
   * else, so "we only copy four fields" is no longer the guarantee. Then
   * redact() walks every remaining value recursively to scrub any key-shaped
   * strings nested at any depth -- CLAUDE.md §5.3 rule 2: scrubbing happens
   * at the BOUNDARY, making this the one place the guarantee is enforced. */
  const { document_path: _dropped, ...rest } = r;
  return {
    externalId,
    /* 🔴 BOTH DATES GO THROUGH redact(), and it is not decoration. Either one
     * can become the item's `modifiedAt` (scrape/adapters/highergov.ts), and
     * `modifiedAt` is persisted -- scrape/run.ts folds it into the run's
     * low-water resume marker, which rides into the hashed artifact. These are
     * vendor-controlled strings like any other field on the row, so the
     * boundary rule (CLAUDE.md §5.3 rule 2) applies to them exactly as it
     * applies to `raw`. redact() is the identity on a real date, and it is
     * idempotent, so this costs nothing and closes the one route by which a
     * key-shaped string could reach a persisted scalar without ever passing
     * through `raw`. */
    capturedDate: redact(str(r.captured_date)),
    postedDate: redact(str(r.posted_date)),
    versionKey: str(r.version_key),
    title: str(r.title),
    raw: redact(rest),
  };
}

function apiKey(): string {
  const key = process.env.HIGHERGOV_API_KEY;
  if (!key) {
    throw new Error(
      "HIGHERGOV_API_KEY is not set. It is a URL parameter for this API -- " +
        "build the URL in this module, never in a shell command (CLAUDE.md §5.3).",
    );
  }
  return key;
}

/* /opportunity/ has no location parameter -- the saved search IS the
 * geographic filter (R1, recorded on fetchDay below). A missing api_key
 * costs nothing and fails closed; a missing search_id costs MONEY and would
 * fail open, silently billing every row nationwide for the day. That
 * asymmetry is why this throws unconditionally rather than falling back to
 * an unfiltered call the way a `if (searchId)` guard once did. */
function searchId(): string {
  const id = process.env.HIGHERGOV_SEARCH_ID;
  if (!id) {
    throw new Error(
      "HIGHERGOV_SEARCH_ID is not set. /opportunity/ has no location " +
        "parameter -- the saved search is the ONLY geographic filter, so an " +
        "unscoped fetchDay call would ask for every opportunity nationwide on " +
        "the requested day, on whichever axis, and pay for every row " +
        "(measured: 5,266 records " +
        "for one unfiltered Indiana day, against a 10,000/month allowance " +
        "that cannot be read back from the vendor).",
    );
  }
  return id;
}

/* Extracted from the original `get()` for Task 7: fetchDocuments needs the
 * exact same fetch-and-validate plumbing (the VITEST guard, the OK check, the
 * redact()-wrapped parse, the non-array "results" guard) against a different
 * endpoint whose rows map to a different shape. Duplicating this instead of
 * sharing it would be the drift document-clients.ts's own header warns
 * against -- two implementations of "how do we safely talk to this API"
 * silently diverging. `get()` and `getDocuments()` below are now both a thin
 * map over this. Every error message here is UNCHANGED from the pre-Task-7
 * `get()` -- this is a pure extraction, not a rewrite. */
async function fetchValidated(url: URL, fetchImpl: typeof fetch): Promise<RawBody & { results: RawResult[] }> {
  /* Structural, not merely discipline. Every test in this file injects
   * fetchImpl; a future test that forgets the argument would fall through to
   * the real global fetch and make a live, billed call against the API that
   * leaked a key on 2026-09-03 (CLAUDE.md §5.1). Only the untouched default
   * -- reference equality against the real global fetch -- trips this; any
   * injected fake fetchImpl never does. */
  if (fetchImpl === fetch && process.env.VITEST) {
    throw new Error(
      "highergov-client: refusing a live fetch under vitest. Inject a fake " +
        "fetchImpl -- CLAUDE.md §5.1 forbids a live call from a test.",
    );
  }
  /* 🔴 THE FETCH LAYER THROWS TOO, AND IT WAS THE HOLE IN THE CLAIM BELOW.
   * The parse guard's own comment used to promise that "nothing downstream
   * -- including the CLI's own console.error(err) -- can print it raw", and
   * that was true of the PARSE path only. `fetchImpl` rejects with whatever
   * the runtime attached: undici's `TypeError: fetch failed` carries a
   * `cause`, and `console.error` prints a cause chain. Nothing here can know
   * in advance whether some runtime, proxy or polyfill put the requested URL
   * -- which carries the api_key as a query parameter -- into that chain.
   *
   * So the rejection is re-thrown as a NEW Error with a redacted message and
   * NO `cause`: the chain is dropped rather than trusted. That is what makes
   * the claim below true of every throw this function can produce, not just
   * of the one it was written about. The message is deliberately distinct
   * from "HigherGov answered N" (a real HTTP response) so an operator can
   * still tell a transport failure from a rejected request. */
  let res: Response;
  try {
    res = await fetchImpl(url.toString(), {
      headers: { accept: "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`HigherGov request failed before any response: ${redact(message)}`);
  }
  if (!res.ok) {
    /* The URL is NOT in this message: it carries the api_key. */
    throw new Error(`HigherGov answered ${res.status}`);
  }
  /* 🔴 THE PARSE MUST NOT THROW RAW. A truncated or malformed 200 can make
   * JSON.parse throw a SyntaxError whose message quotes a window of raw
   * input around the error position -- for a truncated body that window
   * sits near the END of the payload, exactly where document_path (and the
   * api_key it embeds on every row) lives. redact() is the boundary rule
   * made real: the message is scrubbed before it is ever wrapped in a new
   * Error, so nothing downstream -- including the CLI's own
   * `console.error(err)` -- can print it raw even by accident. Every OTHER
   * throw this function produces is now held to the same standard: the
   * transport guard above re-wraps a runtime rejection, the two guards
   * below are hand-written strings, and the CLI redacts what it prints as
   * defence in depth (ingest/highergov-cli.ts's own bottom block). */
  let body: RawBody;
  try {
    body = (await res.json()) as RawBody;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`HigherGov returned a malformed JSON body: ${redact(message)}`);
  }

  /* 🔴 A NON-ARRAY "results" MUST NOT REACH .map(). `?? []` only catches
   * null/undefined; a truthy-but-wrong shape (an object, a string) would
   * still throw a bare TypeError from .map(), whose message could quote
   * whatever unexpected shape the vendor actually sent. This guard's job
   * stops there: it turns that into a NAMED, redaction-safe error -- the same
   * posture as the JSON.parse guard immediately above -- so a caller's own
   * console.error can never print something raw by accident.
   *
   * It does NOT make the call free. The vendor bills on the response it
   * sent, not on whether this client can make sense of it, and this still
   * throws either way. Accounting for that money is the CALLER's job, not
   * this module's -- same separation this file's header states (client
   * fetches and parses, the caller decides what it cost).
   *
   * ⚠️ THREE CALL SITES DEPEND ON THIS, NOT TWO. run.ts wraps its two
   * (fetchDay, fetchBySourceId) in a try/catch and tallies a conservative
   * estimate (thresholds.ts's `unparseableResponseRecords`) before letting
   * whatever this function throws propagate. Task 7 opened a THIRD:
   * fetch-documents-for.ts, reached through document-clients.ts's
   * higherGovDocumentClient, calls fetchDocuments -- which is this same
   * fetchValidated() underneath. Before HigherGov's document client existed
   * that third site only ever saw SAM.gov, which is free and could not lose
   * anything by going untallied. Registering the first METERED document
   * client made the gap live, and fetch-documents-for.ts now tallies the
   * same conservative estimate before rethrowing, for the same reason. Any
   * FOURTH call site added later must do the same, or a call this guard
   * rejects vanishes from api_spend instead of landing a row in it.
   *
   * ⚠️ AND SINCE PAGING, THE CONSERVATIVE ESTIMATE ALONE IS NO LONGER THE
   * WHOLE ANSWER at the two fetchDay sites. A day is now several calls, and
   * this guard can fire on the fourth of them with three already billed --
   * so those sites must ADD `recordsAlreadyBilled(err)` (see
   * PartialDayBilledError above) to whatever they charge for the call that
   * failed. The document site is unaffected: /document/ is still one call. */
  const results = body.results ?? [];
  if (!Array.isArray(results)) {
    throw new Error(
      `HigherGov returned a non-array "results" field (got ${typeof results}). ` +
        `Refusing to grade a shape this client does not recognise.`,
    );
  }
  return { ...body, results };
}

/** ONE response, parsed. Deliberately NOT a FeedResult: a single page has no
 * opinion about how many pages were fetched, and only the walk that assembles
 * them can answer that. */
interface FeedPage {
  notices: FeedNotice[];
  records: number;
  feedCount: number | null;
  pages: number | null;
}

async function getPage(url: URL, fetchImpl: typeof fetch): Promise<FeedPage> {
  const body = await fetchValidated(url, fetchImpl);
  const notices = body.results.map(toNotice).filter((n): n is FeedNotice => n !== null);
  const count = body.meta?.pagination?.count;
  const pages = body.meta?.pagination?.pages;
  return {
    notices,
    /* The row count, not notices.length: a row we could not parse was still
     * billed. Under-reporting is the dangerous direction against a ceiling
     * that cannot be read back (api-spend.ts). */
    records: body.results.length,
    feedCount: typeof count === "number" ? count : null,
    pages: typeof pages === "number" ? pages : null,
  };
}

/** A one-page fetch, presented as a FeedResult. Used by the exact-id lookups,
 * which are not day walks: a `source_id` query answers about ONE notice, so
 * paging it would be buying pages of a result set that is a single row by
 * construction. `pagesFetched: 1` says exactly that, and `isPartialDay` will
 * report the (never-observed) multi-page case honestly rather than hiding it. */
async function get(url: URL, fetchImpl: typeof fetch): Promise<FeedResult> {
  const page = await getPage(url, fetchImpl);
  return { ...page, pagesFetched: 1 };
}

/* 🛑 THE MOST DANGEROUS FUNCTION IN THIS REPOSITORY, AND IT IS WORTH SAYING
 * SO AT THE DEFINITION.
 *
 * Every other paid call in this system buys exactly one response. This one
 * decides for itself how many to buy, against an allowance that CANNOT BE
 * READ BACK FROM THE VENDOR (CLAUDE.md §5.1) -- only a person reading the
 * account dashboard can see consumption, and a runaway loop cannot be undone.
 * So the guards come first and the feature comes second. There are four, and
 * none of them is optional:
 *
 *  1. PAGE ONE PRICES THE REST. The first response is the only one bought
 *     without a forecast, because there is no way to forecast it. It reports
 *     `pages`, and from that moment the whole remaining cost is knowable
 *     BEFORE anything more is bought: at most `(pages - 1) * <one page's
 *     price>`. Every decision below is made from that figure rather than
 *     discovered by spending.
 *
 *  2. THE HARD PAGE CEILING. `MAX_PAGES_PER_DAY` bounds the walk regardless
 *     of what the vendor reported and regardless of whether a caller
 *     remembered to pass a budget -- see its own definition for the
 *     arithmetic that picked 10.
 *
 *  3. THE CALLER'S BUDGET. `maxRecords` is checked BEFORE each page after
 *     the first, priced at the most that page could bill. When the next page
 *     would cross it the walk stops and the day is reported partial. Stopping
 *     short is recoverable; overrunning is not.
 *
 *  4. EVERY PAGE TALLIES. A throw on page four does not un-bill pages one
 *     through three, so the error carries what was already spent --
 *     PartialDayBilledError above, read back by `recordsAlreadyBilled` at
 *     each tally site.
 *
 * ⚠️ AN EMPTY PAGE ENDS THE WALK. A day whose `pages` says five but whose
 * third page carries no rows has told us its own pagination is not to be
 * trusted, and continuing to walk on an untrustworthy figure is precisely
 * the unbounded-walk risk this function exists to bound. It stops, and
 * because `pagesFetched` is then short of `pages` the day is reported
 * PARTIAL -- "we do not know what we missed" rather than "we got it all",
 * which is the safe direction for a caller deciding whether to grade it. */
async function walkDay(
  buildUrl: (pageNumber: number) => URL,
  fetchImpl: typeof fetch,
  pageSize: number | undefined,
  maxRecords: number | undefined,
): Promise<FeedResult> {
  const first = await getPage(buildUrl(1), fetchImpl);
  const notices = [...first.notices];
  let records = first.records;
  let pagesFetched = 1;
  const assemble = (): FeedResult => ({
    notices,
    records,
    feedCount: first.feedCount,
    pages: first.pages,
    pagesFetched,
  });

  /* GUARD 1, first half: the vendor's own answer to "is there more". Null
   * (it said nothing) is treated as "no more" rather than as a licence to
   * probe page two and see -- probing costs records. */
  if (first.pages === null || first.pages <= 1) return assemble();

  /* GUARD 1, second half, and GUARD 2. `nextPagePrice` is the most one more
   * page can bill; `(first.pages - 1) * nextPagePrice` is therefore the most
   * the whole remainder can cost, known here, before a single further record
   * is bought. `ceiling` is where the walk may run to -- the vendor's figure
   * or this project's own backstop, whichever is smaller. */
  const nextPagePrice = singlePageBudget(pageSize);
  const ceiling = Math.min(first.pages, MAX_PAGES_PER_DAY);

  for (let pageNumber = 2; pageNumber <= ceiling; pageNumber += 1) {
    /* GUARD 3, and the ONE line where the budget is actually enforced. It is
     * checked BEFORE the call, priced at what that call could cost -- never
     * after, when the money is already gone. */
    if (maxRecords !== undefined && records + nextPagePrice > maxRecords) break;

    let next: FeedPage;
    try {
      next = await getPage(buildUrl(pageNumber), fetchImpl);
    } catch (err) {
      /* GUARD 4. The pages already bought were already billed. */
      const message = err instanceof Error ? err.message : String(err);
      throw new PartialDayBilledError(
        `${redact(message)} -- ${records} record(s) across ${pagesFetched} page(s) were ` +
          `ALREADY BILLED for this day before page ${pageNumber} failed.`,
        records,
        pagesFetched,
      );
    }
    notices.push(...next.notices);
    records += next.records;
    pagesFetched += 1;
    if (next.records === 0) break;
  }

  return assemble();
}

/* 🔴 See the FetchedDoc comment above: whatever URL-shaped field this row
 * carries (document_path or download_url) is never read here, on purpose --
 * not read-and-discarded, simply never touched. The only field this client
 * trusts from a /document/ row is file_name.
 *
 * 🔴 AND BOTH FIELDS ARE REDACTED, for the same reason toNotice() redacts
 * `raw` (CLAUDE.md §5.3 rule 2: scrub at the BOUNDARY, never at the call
 * site). Not reading `document_path` protects against the field we KNOW
 * carries the key; it says nothing about a key-shaped string arriving
 * somewhere else. `file_name` is vendor-controlled text, and `text_extract`
 * is the vendor's own extraction of a document that may itself quote a
 * signed URL -- and extract/fetch-documents-for.ts writes that text straight
 * into `document.extracted_text`, permanently. The opportunity path has had
 * this boundary since it was written; the document path shipped without one,
 * which is the asymmetry the 2026-09-03 leak was made of. */
function toFetchedDoc(r: RawResult): FetchedDoc | null {
  const fileName = str(r.file_name);
  if (!fileName) return null;
  return { fileName: redact(fileName), textExtract: redact(str(r.text_extract)) };
}

async function getDocuments(url: URL, fetchImpl: typeof fetch): Promise<DocumentsResult> {
  const body = await fetchValidated(url, fetchImpl);
  const docs = body.results.map(toFetchedDoc).filter((d): d is FetchedDoc => d !== null);
  return {
    docs,
    /* Same reasoning as get()'s `records` above: the row count billed, not
     * docs.length -- a row we dropped (no usable file_name) was still
     * billed, and under-reporting against a ceiling that cannot be read back
     * from the vendor is the dangerous direction. */
    records: body.results.length,
  };
}

export const higherGovClient: HigherGovClient = {
  async fetchDay(day, fetchImpl = fetch, pageSize, axis = DEFAULT_FEED_AXIS, maxRecords) {
    /* 🔴 A BUILDER, NOT A URL, and the reason is the whole inertness
     * argument. Every page of a day asks the identical question except for
     * `page_number` -- so the URL is built per page from one place rather
     * than mutated in a loop, where a stale parameter from the previous
     * iteration would be invisible.
     *
     * PAGE ONE SETS NO `page_number` AT ALL. Not `page_number=1`, which
     * would behave identically today but would stop the first request being
     * provably byte-identical to one built before paging existed -- the same
     * standard `page_size` and `axis` are already held to below, and for the
     * same reason: this is a metered API, and a silently changed request is
     * a silently changed bill. */
    const buildUrl = (pageNumber: number): URL => {
      const url = new URL(`${HOST}/opportunity/`);
      url.searchParams.set("api_key", apiKey());
      /* ⚖️ ONE CODE PATH, ONE PARAMETER, SELECTED -- not a branch, and above
       * all not a second `fetchPostedDay` sibling. This file handles a
       * credential, and the 2026-09-03 leak is what one place is worth (spec
       * §3.1): a second method would be a second VITEST guard, a second scrub,
       * a second searchId() check, all of them free to drift.
       *
       * `axis` IS the parameter name (FeedAxis above), so this line is the
       * entire implementation of the ruling. Defaulted to `captured_date`,
       * which makes a call that names no axis byte-identical on the wire to one
       * made before axes existed -- the same provable inertness `page_size`
       * below is held to, and for the same reason: this is a metered API and a
       * silent change to what every existing run asks for is a silent change to
       * what it costs. */
      url.searchParams.set(axis, day);
      /* 🔴 R1: /opportunity/ takes twelve parameters and NONE is a location.
       * pop_state, state and place_of_performance_state were all accepted and
       * SILENTLY IGNORED. State filtering exists only through a saved search,
       * so HIGHERGOV_SEARCH_ID is the Indiana filter -- and it lives in their
       * account, not in our code. run.ts records it per run for exactly that
       * reason. Unconditional, not `if (searchId)`: an unset scope must fail
       * LOUD (searchId() throws) rather than silently billing every row
       * nationwide -- see searchId()'s own comment. */
      url.searchParams.set("search_id", searchId());
      /* 🔴 page_size IS AN EXPLICIT, OPT-IN KNOB -- and an easy one to
       * misunderstand, so the economics are spelled out here rather than only
       * at its one caller (ingest/highergov-cli.ts's `--page-size` flag).
       *
       * `pageSize === undefined` (the default: nothing threaded a flag through)
       * sends NO `page_size` parameter at all, not the vendor's own default
       * written out explicitly -- that is what makes today's request provably
       * BYTE-IDENTICAL to a request built before this parameter existed. Never
       * change this to `url.searchParams.set("page_size", String(pageSize ??
       * 10))` or similar: that would still be inert today, but it stops being
       * provable from the URL alone, which is the whole point of the test that
       * pins this branch.
       *
       * RAISING page_size DOES NOT REDUCE SPEND. CLAUDE.md §5.1's meter counts
       * records RETURNED -- a bigger page returns more rows and therefore
       * bills MORE per call, not less. Now that this client PAGES, it pays for
       * itself only in HTTP round trips (and therefore in
       * coverage/thresholds.ts's `maxCallsPerRun`): the same day's records
       * arrive in fewer calls, at exactly the same price in records.
       *
       * ⚠️ AND ABOVE 100 IT BUYS NOTHING AT ALL. Measured 2026-09-08: the
       * vendor caps every response at 100 rows whatever `page_size` asks for
       * (VENDOR_PAGE_RECORD_CAP at the top of this file) -- a run requesting
       * 300 produced 14 calls of exactly 100. `page_size=300` is therefore
       * indistinguishable on the wire's RESULTS from `page_size=100`; it is
       * kept accepted only because refusing a value the vendor tolerates is
       * not this client's call to make. */
      if (pageSize !== undefined) {
        url.searchParams.set("page_size", String(pageSize));
      }
      if (pageNumber > 1) {
        url.searchParams.set("page_number", String(pageNumber));
      }
      return url;
    };
    return walkDay(buildUrl, fetchImpl, pageSize, maxRecords);
  },

  async fetchBySourceId(sourceId, fetchImpl = fetch) {
    const url = new URL(`${HOST}/opportunity/`);
    url.searchParams.set("api_key", apiKey());
    url.searchParams.set("source_id", sourceId);
    /* No search_id: an exact-id lookup must not be narrowed by a saved
     * search, or a notice outside the search would read as a MISS when it
     * was merely out of scope -- a false miss is the one error that would
     * un-shelve the adapter backlog for no reason. */
    return get(url, fetchImpl);
  },

  async fetchDocuments(sourceId, fetchImpl = fetch) {
    const url = new URL(`${HOST}/document/`);
    url.searchParams.set("api_key", apiKey());
    url.searchParams.set("source_id", sourceId);
    /* 🔴 No search_id, for the exact reason fetchBySourceId gives above: this
     * is a lookup by a specific notice's id, and narrowing it by a saved
     * search would report real documents as absent merely because the
     * opportunity fell outside that search's scope. */
    return getDocuments(url, fetchImpl);
  },
};
