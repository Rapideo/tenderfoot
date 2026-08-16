/* The adapter framework (build inventory 2A).
 *
 * Every adapter takes `since` — this is what makes backfill and live the
 * same code path (§3.1). Adapters bind to PLATFORM + config, not
 * jurisdiction (§5.7).
 *
 * `modifiedAt` is the field the caller compares against the window. It is
 * named for what it is rather than "postedAt" because at least one real
 * source sorts only by modification date and silently ignores a request to
 * sort by publication date (see adapters/sam.ts).
 */
export interface ListingItem {
  externalId: string;
  modifiedAt: string;
  raw: unknown;
}

export interface ListingPage {
  items: ListingItem[];
  /** Opaque to the caller. Null means the source has no more pages. */
  nextCursor: string | null;
  requestUrl: string;
  httpStatus: number;
  /** The response body exactly as received. Stored as a capture. */
  payload: string;
}

export interface Adapter {
  name: string;
  fetchListing(since: string, until: string, cursor: string | null): Promise<ListingPage>;
}
