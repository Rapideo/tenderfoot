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

export interface FeedNotice {
  /** Their `source_id`. For Indiana this IS IDOA's own 15-digit Event ID,
   * which is what makes exact-match comparison possible at all. */
  externalId: string;
  capturedDate: string | null;
  versionKey: string | null;
  title: string | null;
  raw: Record<string, unknown>;
}

export interface FeedResult {
  notices: FeedNotice[];
  /** What the VENDOR billed: the row count, BEFORE dedup. */
  records: number;
  /** meta.pagination.count -- the saved-search change detector. */
  feedCount: number | null;
  /** meta.pagination.pages. This client fetches page one only and never
   * pages further -- spending more records is a design decision, not this
   * client's to make. Exposing this is the minimum fix for the alternative:
   * a caller silently treating a truncated day as HigherGov not having the
   * rows, which is a false miss. */
  pages: number | null;
}

export interface HigherGovClient {
  fetchDay(capturedDate: string, fetchImpl?: typeof fetch): Promise<FeedResult>;
  fetchBySourceId(sourceId: string, fetchImpl?: typeof fetch): Promise<FeedResult>;
}

/* Matches an api_key wherever it appears in a string, in any nesting. Broad
 * on purpose: the failure mode of over-redacting is an unreadable diagnostic,
 * and the failure mode of under-redacting is a rotated credential and an
 * incident. */
const KEY_IN_STRING = /api_key=[^&\s"']+/gi;

export function redact<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(KEY_IN_STRING, "api_key=REDACTED") as unknown as T;
  }
  if (Array.isArray(value)) return value.map(redact) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redact(v);
    }
    return out as unknown as T;
  }
  return value;
}

interface RawResult {
  source_id?: unknown;
  captured_date?: unknown;
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
   * else, so "we only copy four fields" is no longer the guarantee. */
  const { document_path: _dropped, ...rest } = r as Record<string, unknown>;
  return {
    externalId,
    capturedDate: str(r.captured_date),
    versionKey: str(r.version_key),
    title: str(r.title),
    raw: rest,
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
        "unscoped fetchDay call would ask for every opportunity captured " +
        "nationwide that day and pay for every row (measured: 5,266 records " +
        "for one unfiltered Indiana day, against a 10,000/month allowance " +
        "that cannot be read back from the vendor).",
    );
  }
  return id;
}

async function get(url: URL, fetchImpl: typeof fetch): Promise<FeedResult> {
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
  const res = await fetchImpl(url.toString(), {
    headers: { accept: "application/json" },
  });
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
   * `console.error(err)` -- can print it raw even by accident. */
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
   * throws either way. Accounting for that money is run.ts's job, not this
   * module's -- same separation this file's header states (client fetches
   * and parses, the caller decides what it cost). run.ts wraps both call
   * sites in a try/catch and tallies a conservative estimate
   * (thresholds.ts's `unparseableResponseRecords`) before letting whatever
   * this function throws propagate, so a call this guard rejects still lands
   * a row in api_spend instead of disappearing from it. */
  const results = body.results ?? [];
  if (!Array.isArray(results)) {
    throw new Error(
      `HigherGov returned a non-array "results" field (got ${typeof results}). ` +
        `Refusing to grade a shape this client does not recognise.`,
    );
  }

  const notices = results.map(toNotice).filter((n): n is FeedNotice => n !== null);
  const count = body.meta?.pagination?.count;
  const pages = body.meta?.pagination?.pages;
  return {
    notices,
    /* The row count, not notices.length: a row we could not parse was still
     * billed. Under-reporting is the dangerous direction against a ceiling
     * that cannot be read back (api-spend.ts). */
    records: results.length,
    feedCount: typeof count === "number" ? count : null,
    pages: typeof pages === "number" ? pages : null,
  };
}

export const higherGovClient: HigherGovClient = {
  async fetchDay(capturedDate, fetchImpl = fetch) {
    const url = new URL(`${HOST}/opportunity/`);
    url.searchParams.set("api_key", apiKey());
    url.searchParams.set("captured_date", capturedDate);
    /* 🔴 R1: /opportunity/ takes twelve parameters and NONE is a location.
     * pop_state, state and place_of_performance_state were all accepted and
     * SILENTLY IGNORED. State filtering exists only through a saved search,
     * so HIGHERGOV_SEARCH_ID is the Indiana filter -- and it lives in their
     * account, not in our code. run.ts records it per run for exactly that
     * reason. Unconditional, not `if (searchId)`: an unset scope must fail
     * LOUD (searchId() throws) rather than silently billing every row
     * nationwide -- see searchId()'s own comment. */
    url.searchParams.set("search_id", searchId());
    return get(url, fetchImpl);
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
};
