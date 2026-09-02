# IDOA current-business-opportunities page facts

**Captured:** 2026-09-02 19:15 UTC
**Source URL:** `https://www.in.gov/idoa/procurement/current-business-opportunities/`
**Fixture:** `app/server/src/scrape/adapters/fixtures/idoa-listing.html`
**Fixture size:** 157,588 bytes (`wc -c`)

The capture is a normal server-rendered HTML document — no SPA shell markers
(`id="root"`, `__NEXT_DATA__`, `ng-app`) were found, and the tables/rows are
present directly in the markup with no client fetch required to populate
them. The page's own DataTables config (`order: []`, see below) confirms the
table is not client-side re-sorted on load either — what's in the HTML is
what a browser shows by default. The "static HTML" premise in the design
holds.

## Table inventory

There are exactly **3** `<table>` elements on the page (confirms the earlier
manual count).

| # | Location / section | Headers | Rows (excl. header) |
|---|---|---|---|
| 0 | `<section id="sourcing_event_live_stream_links_1019641">`, heading "Pre-Proposal Conference" | `Solicitation Name`, `Session Time and Event Link`, `IGCS Conference Room Location` | 3 |
| 1 | `<section id="additional_rfp_1045754">`, heading "Additional Business Opportunities" → "RFP 23420 Group 71022 - Business Consulting Services", table `id="table05781"` | `Event Name`, `Agency`, `Event ID`, `Event Description`, `Response Due By`, `Contact` | 1 |
| 2 | Main listing, table `id="events-table"` (DataTables-enabled: `$(tableSelector).DataTable({ order: [ ], pageLength: 50, ... })`) | `Event Name`, `Agency`, `Event ID`, `Event Description`, `Response Due By`, `Contact` | 70 |

## Question 1: which tables contain solicitations, and what's the total?

Table 0 (pre-bid/pre-proposal conference schedule) has a **different header
shape** (`Solicitation Name` / `Session Time and Event Link` / `IGCS
Conference Room Location`) — it is a schedule of conference sessions
referencing solicitations already listed elsewhere, not a solicitations
table itself. **Excluded.**

Tables 1 and 2 share the **identical** six-column header
(`Event Name, Agency, Event ID, Event Description, Response Due By,
Contact`). Table 1 is real, and it is a genuinely distinct second category,
not a rendering artifact:

- It sits under its own `<h2>Additional Business Opportunities</h2>` section,
  separate from the main listing.
- Its one row is **RFP 23420 Group 71022 - Business Consulting Services**, a
  NASPO ValuePoint cooperative-purchasing RFP issued by the **State of New
  York** (Agency = "State of New York Executive Department - Office of
  General Services") — not an Indiana agency.
- Its Event ID is the **literal string `NA`**, not a 15-digit numeric ID like
  every row in table 2.

So the earlier manual observation was correct: this is a second,
smaller class of opportunity that the main `events-table` alone does not
capture. Any adapter that parses only the biggest/DataTables table will
silently drop it.

**TOTAL solicitations row count across both matching-header tables: 71**
(1 from `table05781` "Additional Business Opportunities" + 70 from
`events-table`).

Note for the parser/schema design: table 1's row has `Event ID = "NA"`
(non-numeric, unlike the 15-digit IDs elsewhere) and no agency based in
Indiana — a schema that assumes a 15-digit numeric Event ID or an Indiana
agency will need to special-case this row or explicitly document its
exclusion as a numbered deviation.

## Question 2: what is the row ordering?

**Finding: the main `events-table` (70 rows) is sorted ascending by
`Response Due By` (date, then time-of-day). It is NOT sorted by Event ID.**

Evidence (script output, per-row extraction from the `events-table` body,
converting `Response Due By` to a `YYYYMMDDHHMMSS` sort key with 12h→24h
conversion):

- All 70 rows have a parseable `Response Due By` value.
- **69 of 69 adjacent row pairs are non-decreasing** by that due-date+time
  key; **zero violations**. First 5 due dates in document order:
  `09/03/2026 10:00AM, 09/04/2026 11:00AM, 09/05/2026 1:30PM,
  09/07/2026 10:00AM, 09/07/2026 10:00AM`.
- Event IDs in document order are **not** ascending
  (`asc(ids) === false`), and — more importantly — where multiple rows
  share the exact same due date, their Event IDs are in no discernible
  order. Example ties observed in this capture:
  - `09/07/2026 10:00:00AM` → IDs `003000000088191, 003000000088044,
    003000000088030` (descending, unrelated)
  - `09/08/2026` (three different times, still same date) → IDs
    `003000000087945, 003000000088036, 003000000088015, 001000000088108`
  - `09/16/2026` (six rows across three times) → IDs
    `003000000088287, 003000000088285, 003000000088060, 003000000088057,
    001000000085295, 004100000086873`

  Within each tie, rows are still ordered by time-of-day ascending, which is
  a second confirmation of due-date ordering, not insertion or ID ordering.

This is stronger evidence than the brief's original observation (two rows
sharing a due date with unrelated IDs) — this capture didn't happen to
reproduce that exact pair (the site's live content changes daily; today's
first two rows have different due dates, 09/03 and 09/04), but it produced
five separate same-due-date clusters (2–6 rows each) with the same property:
IDs unrelated within the tie, time-of-day still ascending. The underlying
claim — sorted by due date, not by ID or insertion — holds and is now backed
by exhaustive evidence (100% of adjacent pairs), not a two-row sample.

**Consequence for design (§8):** row *position* in the main table encodes
due-date rank, not posting recency. **No order-derived "recency" or "newest
first" signal may be derived from position in this table.** A solicitation
appearing near the top only means it is due sooner, not that it was posted
more recently — treating position as a posting-recency proxy would fabricate
a sequence the data does not support. (Table 1's single-row
"Additional Business Opportunities" table has no ordering to establish with
one row; no claim is made about it.)

## Anything else surprising

- The manual pre-check's premise (first two rows share a due date) did not
  reproduce verbatim in this capture because the live page's content changed
  since that manual look — expected for a daily-updated listing, not a sign
  of a wrong page. The underlying ordering finding is unaffected and is now
  more strongly evidenced (5 tie-clusters, 100% of adjacent pairs checked)
  than the original two-row anecdote.
- `events-table`'s own DataTables initializer explicitly sets `order: []`
  (no default JS sort) — confirming the ascending-by-due-date order visible
  in the raw HTML is the server's own ordering, not something a browser's
  JS imposes afterward.
- The raw 15-digit-ID regex from the brief's script matches **170** hits
  across the whole document against only 70 rows in `events-table`, because
  each row embeds the same Event ID more than once (e.g. in more than one
  link). A scraper must scope its ID extraction to one field per row rather
  than using a whole-document regex, or it will pick up duplicates.
