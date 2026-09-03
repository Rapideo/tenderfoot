/* Indiana IDOA "Current Business Opportunities" snapshot adapter.
 *
 * ⚠️ RETAINED AS A TEST FIXTURE, NOT AS A SOURCE WE INTEND TO RUN.
 * Ruled by Matt 2026-09-03. IDOA is RED-FLAGGED: it publishes 71 open notices
 * and no archive at all, and HigherGov carries 69 of those 70 (99%) with
 * values, documents and deadlines IDOA's own page never had. `source.enabled`
 * is false and is not expected to change.
 *
 * SO WHY IS IT STILL HERE. Because it is the ONLY second source this codebase
 * has, and D27 established what that is worth: four defects in supposedly
 * source-agnostic layers, one root cause, none caught by the 653 tests passing
 * at the time -- because every fixture was SAM-shaped too. Proto2PRD lesson
 * 2.26: a layer is only proven source-agnostic by a second source; an elegant
 * abstraction at N=1 is a hypothesis, not a property.
 *
 * Deleting this parser would return every source-agnostic test to SAM plus a
 * string constant, in the weeks before a paid API whose payload resembles
 * nothing here. That is running D27's experiment again and ignoring the result.
 *
 * 🗓️ NAMED DELETION TRIGGER, so this is a scheduled consequence and not a good
 * intention: DELETE THIS PARSER, ITS FIXTURE AND ITS TESTS WHEN THE HIGHERGOV
 * ADAPTER LANDS and becomes the second live source shape. Not before.
 *
 * IDOA publishes no posting date -- `SnapshotItem` has no `modifiedAt` by
 * design (adapter.ts), and this parser must not manufacture one from
 * anything, including row position (see the ordering note at the bottom).
 * Every count below is pinned against the committed fixture by
 * docs/2026-09-02-idoa-page-facts.md (Task 1); re-derive nothing from the
 * live site, which changes daily.
 *
 * FOUR TRAPS this file exists to survive (task-7-brief.md):
 *
 *  1. TWO solicitations tables share an IDENTICAL six-column header: the
 *     main `events-table` (70 rows) and a separate "Additional Business
 *     Opportunities" table (`table05781`, 1 row -- a NASPO ValuePoint
 *     cooperative RFP issued by the State of New York, not Indiana). A
 *     third table (a pre-proposal-conference schedule) has a DIFFERENT
 *     header and is not a solicitations table. So matching is by header
 *     shape, never by table id, position, or "the biggest table" -- that
 *     last heuristic is exactly what would silently drop table05781.
 *
 *  2. The Event ID comes from the Event ID COLUMN (the 3rd <td>) and
 *     nowhere else. Row 52 ("300 FW Wilbur Wright FWA 4-year Tenant Farm
 *     Lease") carries a live data-entry error: its Event ID column reads
 *     003000000088390, but its free-text description says
 *     "RFQ# 003000000088930" -- the last two digits transposed. A
 *     whole-row regex for a 15-digit string would happily return either
 *     one, and the wrong one looks exactly as valid as the right one.
 *
 *  3. Event ID is not always a 15-digit number. table05781's one row
 *     carries the literal string "NA". Ruling: that row is INCLUDED --
 *     cooperative vehicles are in scope for this product -- but "NA" is
 *     neither unique nor stable as an externalId. So externalId is the
 *     Event ID when it matches /^\d{15}$/, otherwise a slug derived from
 *     the event name (de-duplicated if two non-numeric rows ever collide).
 *
 *  4. Not every row has a Bid Documents link: 66 unique .zip hrefs for 71
 *     rows, so 5 have none. `documentsUrl` is nullable, and its value is
 *     the scraped href verbatim -- never constructed from the Event ID,
 *     which would silently 404 across every row at once if IDOA's naming
 *     pattern ever changed.
 *
 * ORDERING: the main table is sorted ascending by Response Due By (Task 1:
 * 69/69 adjacent pairs non-decreasing), not by insertion or Event ID.
 * Nothing here reads row position as a signal -- doing so would fabricate
 * a posting-recency sequence the data does not support.
 */
import type { SnapshotAdapter, SnapshotItem, SnapshotPage } from "../adapter.js";

export const IDOA_URL = "https://www.in.gov/idoa/procurement/current-business-opportunities/";

export interface IdoaRawItem {
  eventId: string;
  eventName: string;
  agency: string;
  description: string;
  responseDueBy: string;
  contact: string;
  documentsUrl: string | null;
}

/* The six-column header shared by both solicitations tables (Task 1). The
 * pre-proposal-conference table's header ("Solicitation Name", "Session
 * Time and Event Link", "IGCS Conference Room Location") does not match
 * this shape and is excluded by that mismatch alone -- not by table id. */
const HEADER_CELLS = [
  "Event Name",
  "Agency",
  "Event ID",
  "Event Description",
  "Response Due By",
  "Contact",
];

/* The small set of named entities actually observed in a captured page
 * (nbsp, amp, rsquo, gt, copy) plus the handful any HTML document might
 * carry. Numeric entities (&#39; etc.) are handled separately below. */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  copy: "©",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, code: string) => {
    if (code.startsWith("#")) {
      const isHex = code[1] === "x" || code[1] === "X";
      const num = parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : whole;
    }
    return code in NAMED_ENTITIES ? NAMED_ENTITIES[code]! : whole;
  });
}

/* Turns one <td>/<a> cell's inner HTML into flat text: line/block
 * boundaries (<br>, </p>, </div>, </li>, </tr>) become spaces so words
 * don't run together (e.g. table05781's <p>-wrapped cells), every other
 * tag is dropped, entities are decoded, and whitespace is collapsed. No
 * `raw` field needs its inline markup preserved -- it is read as plain
 * text, never re-rendered. */
function htmlToText(cellHtml: string): string {
  const withBreaks = cellHtml
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|tr)>/gi, " ");
  const stripped = withBreaks.replace(/<[^>]*>/g, "");
  return decodeEntities(stripped).replace(/\s+/g, " ").trim();
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

export function parseIdoaPage(html: string): { items: SnapshotItem[] } {
  const items: SnapshotItem[] = [];
  const seen = new Set<string>();

  /* Tables never nest on this page (Task 1: exactly 3 <table> elements),
   * so a non-greedy match out to the next </table> never over-runs into a
   * sibling table. */
  const tableRe = /<table[^>]*>[\s\S]*?<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(html))) {
    const tableHtml = tableMatch[0];
    const headerMatch = /<thead>([\s\S]*?)<\/thead>/i.exec(tableHtml);
    if (!headerMatch) continue;

    const headerCells: string[] = [];
    const thRe = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    let thMatch: RegExpExecArray | null;
    while ((thMatch = thRe.exec(headerMatch[1]!))) {
      headerCells.push(htmlToText(thMatch[1]!));
    }
    /* Trap 1: matched by header shape, not by table id or "the biggest
     * table wins". */
    const isSolicitationsTable =
      headerCells.length === HEADER_CELLS.length &&
      headerCells.every((cell, i) => cell === HEADER_CELLS[i]);
    if (!isSolicitationsTable) continue;

    const bodyHtml = tableHtml.slice(headerMatch.index + headerMatch[0].length);
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(bodyHtml))) {
      const cells: string[] = [];
      const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(rowMatch[1]!))) {
        cells.push(cellMatch[1]!);
      }
      if (cells.length < 6) continue;
      const nameCell = cells[0]!;
      const agencyCell = cells[1]!;
      const idCell = cells[2]!;
      const descCell = cells[3]!;
      const dueCell = cells[4]!;
      const contactCell = cells[5]!;

      /* Trap 4: the Bid Documents anchor is found by its link text, never
       * assumed to be "the second anchor" or "the only anchor" -- 5 rows
       * across the page have no such anchor at all. The event name is the
       * FIRST anchor's text when one exists (its href is a static
       * bidder-registration page, never the source of the name);
       * table05781's row has no anchor in this cell at all, so the name
       * falls back to the cell's plain text. */
      const anchorRe = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let anchorMatch: RegExpExecArray | null;
      let eventName = "";
      let documentsUrl: string | null = null;
      let sawAnchor = false;
      while ((anchorMatch = anchorRe.exec(nameCell))) {
        const href = anchorMatch[1]!;
        const text = htmlToText(anchorMatch[2]!);
        if (!sawAnchor) {
          eventName = text;
          sawAnchor = true;
        }
        if (text === "Bid Documents") {
          /* Take the scraped href verbatim (resolved against the page's
           * own host) -- never build it from the Event ID (spec §6.1). */
          documentsUrl = new URL(href, IDOA_URL).toString();
        }
      }
      if (!sawAnchor) eventName = htmlToText(nameCell);

      /* Trap 2: the Event ID comes from this column and nowhere else --
       * never from a regex over the row or the description text. */
      const eventId = htmlToText(idCell);
      const agency = htmlToText(agencyCell);
      const description = htmlToText(descCell);
      const responseDueBy = htmlToText(dueCell);
      const contact = htmlToText(contactCell);

      /* Trap 3: only a genuine 15-digit Event ID is trusted as the
       * external id. table05781's "NA" row (and anything else
       * non-numeric) falls back to a name-derived slug, de-duplicated
       * against any future collision. */
      const base = /^\d{15}$/.test(eventId) ? eventId : slugify(eventName);
      let externalId = base;
      let suffix = 2;
      while (seen.has(externalId)) externalId = `${base}-${suffix++}`;
      seen.add(externalId);

      const raw: IdoaRawItem = {
        eventId,
        eventName,
        agency,
        description,
        responseDueBy,
        contact,
        documentsUrl,
      };
      items.push({ externalId, raw });
    }
  }

  return { items };
}

export function idoaAdapter(fetchImpl: typeof fetch = fetch): SnapshotAdapter {
  return {
    shape: "snapshot",
    name: "Indiana IDOA solicitations",
    async fetchSnapshot(_cursor: string | null): Promise<SnapshotPage> {
      const res = await fetchImpl(IDOA_URL);
      const payload = await res.text();
      const { items } = parseIdoaPage(payload);
      /* One page, no pagination on this source. §4.1: a snapshot does not
       * resume across invocations, so there is no cursor to carry between
       * runs -- nextCursor is always null here. */
      return { items, nextCursor: null, requestUrl: IDOA_URL, httpStatus: res.status, payload };
    },
  };
}
