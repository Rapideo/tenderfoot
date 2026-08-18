-- Targets for the generic URL probe (health/probes/generic-url.ts). Each was
-- opened by hand on 2026-08-18 and returned 200 without a session -- see the
-- per-row comment below for what was actually checked.
--
-- The listing page, never the home page: a portal home page can serve
-- happily while the search behind it is broken, which would report health on
-- a source that cannot actually be scraped.
--
-- SAM.gov and USASpending are deliberately absent -- they have adapter
-- probes that ask a real question, and a probe_url would never be read.
--
-- The four excluded rows are deliberately absent too. A probe_url on GovWin
-- IQ or Ohio OhioBuys would be a loaded gun for the next probe loop; the
-- eligibility rule is the guard, and this is the second lock.

-- Illinois BidBuy. The repo recorded no URL at all; the candidate paths
-- from a web search (external/publicBids.sdo, external/advsearch/
-- searchBid.sdo) both 404. The real "Open Bids" listing, linked from the
-- portal's own home page as the "Bid Search" category tile, is a plain GET
-- with no session: 132 open bids server-rendered in the HTML on the date
-- checked, statuses matching 003's note (Sent, Opened, ...). Checked
-- 2026-08-18, HTTP 200.
UPDATE source SET probe_url = 'https://www.bidbuy.illinois.gov/bso/view/search/external/advancedSearchBid.xhtml?openBids=true'
 WHERE name = 'Illinois BidBuy';

-- Indiana EDS contract register. The public "Active Contracts and QPAs"
-- page (in.gov/idoa) turns out to be a redirect target for the Indiana
-- Transparency Portal, whose "Public Contract Search" tool is a separate
-- single-page app at secure.in.gov/apps/idoa/contractsearch/. That app's
-- own settings.json (fetched by hand) names its API base as "api" under the
-- app path; GET .../api/contracts/search returns HTTP 200 with a fresh,
-- explicitly no-store JSON response every time (a 404 on any other path
-- under api/, so this is real routing, not a catch-all) -- the live
-- contract-data endpoint itself, not the app shell. Checked 2026-08-18,
-- HTTP 200.
--
-- NOTE: a bare GET returns `{}`, not contract rows -- the real search is a
-- POST (confirmed by hand: POSTing an empty JSON body to this same URL
-- returns the real `{results, pagination}` shape). This probe verifies the
-- route responds, not that the search is serving results. That is the
-- documented limit of every `generic-url` probe (it structurally cannot
-- return 'rot' -- see probe.ts / generic-url.ts), and `health_method`
-- records which kind ran, so a reader of `ok` here knows exactly how much
-- that claim is worth.
UPDATE source SET probe_url = 'https://secure.in.gov/apps/idoa/contractsearch/api/contracts/search'
 WHERE name = 'Indiana EDS contract register';

-- Indiana IDOA solicitations. The repo's one recorded candidate,
-- https://www.in.gov/idoa/proc/solicitations/files/, is DEAD -- HTTP 403,
-- confirmed independently from two networks (this probe's own curl and a
-- separate fetch tool), so it is stale rather than merely a file directory.
-- The current page is https://www.in.gov/idoa/procurement/
-- current-business-opportunities/: a plain HTML table (Event Name, Agency,
-- Event ID, Description, Due Date, Contact -- exactly 003's field list),
-- server-rendered, no login. Checked 2026-08-18, HTTP 200.
UPDATE source SET probe_url = 'https://www.in.gov/idoa/procurement/current-business-opportunities/'
 WHERE name = 'Indiana IDOA solicitations';

-- Kentucky eMARS VSS and Michigan SIGMA VSS are DELIBERATELY LEFT NULL.
-- Both are CGI Advantage VSS, and both expose the identical path shape --
-- .../Advantage4 (sigma.michigan.gov/PRDVSS1X1/Advantage4 and
-- vss.ky.gov/vssprod-ext/Advantage4) -- which is the signal 003 called for:
-- one future CGI-Advantage-specific probe could cover both rows at once.
-- That GET does return 200, with a fresh session (Set-Cookie: JSESSIONID,
-- a new Adv-Session-Id each request) -- but it is the app's session-
-- bootstrap landing screen, not the solicitation grid. 003's own research
-- already established, independently for Michigan, that the "Advertised
-- Solicitations" search is a form POST to one endpoint with server-side
-- session state, unlike Periscope's real query parameters -- confirmed
-- again here: no bookmarkable GET link to the grid was found despite
-- checking the app's embedded routing JSON and a working individual-
-- solicitation deep link (which is itself a GET, but names one bid, not a
-- listing, and would go stale the moment that bid closes).
-- genericUrlProbe only ever issues a GET (health/probes/generic-url.ts), so
-- there is no URL for this platform that would measure the thing that
-- actually matters -- the search -- rather than the shell that happens to
-- surround it. An unverifiable URL that lies is worse than an honest gap.

-- (No UPDATE for Kentucky eMARS VSS or Michigan SIGMA VSS -- probe_url
-- stays NULL, as seeded.)
