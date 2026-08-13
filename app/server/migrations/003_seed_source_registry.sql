-- SP1 T3. The Source Registry, seeded from verified research.
--
-- Every row below records something that was ESTABLISHED, not assumed --
-- design spec §5.7, §5.8, §10.1-10.2, and the source probes of 2026-08-12.
-- Where a fact is inferred rather than tested, the note says so.
--
-- EVERYTHING IS enabled = 0. SP3 turns the first one on deliberately, and
-- the ingestion window must exist in code before any of them runs
-- (docs/Pinned-Ingestion-Scaffolding.md).
--
-- since_default is an ISO-8601 duration and is only a SEED. The rule is
-- `since = last successful run`; a fixed lookback loses a day permanently
-- when a run fails.

-- ---------- FEDERAL -------------------------------------------------------
INSERT INTO source (name, jurisdiction, platform, adapter_tier, legal_posture,
                    legal_note, archive_depth, verified_facets, since_default,
                    enabled, source_note) VALUES

('SAM.gov', 'US', 'SAM', '1 api', 'in',
 'Public federal system. Anonymous search API, no credentials required. Verified 2026-08-04.',
 'API: latest active version only. Bulk CSV via Data Services goes back decades, refreshed weekly.',
 json('{"works":["naics","psc","noticeType","sort=-modifiedDate"],'
   || '"silently_ignored":["postedFrom","postedTo","publishDate","modifiedFrom",'
   || '"sort=-publishDate"],'
   || '"note":"§5.4. Four spellings of a date parameter were accepted and ignored. '
   || 'sort=-publishDate is accepted and ignored; sort=-modifiedDate works. Pagination '
   || 'must stop on modifiedDate, since modifiedDate >= publishDate always."}'),
 'P7D', 0,
 'Clean split: API for live, bulk CSV for backfill. Validates the `since` design in §3.1.'),

('USASpending', 'US', 'USASpending', '1 api', 'in',
 'Public federal system. Anonymous.',
 'FY2008 via Award Data Archive; FY2001 via custom download. Period-of-performance dates present.',
 NULL, 'P7D', 0,
 'Award/contract side. Deep enough for the entity chain (§4.3).'),

-- ---------- INDIANA -------------------------------------------------------
('Indiana IDOA solicitations', 'IN', 'IDOA static list', '3 html', 'in',
 'Public listing, anonymous-readable. Verified 2026-08-04.',
 'NONE. Closed solicitations are not published -- Indiana cannot be backtested on the solicitation side (§8.2).',
 json('{"note":"Plain HTML table. No RSS, API or bulk download. Event name, agency, '
   || 'event ID, description, due date, contact."}'),
 'P7D', 0,
 'Coverage floor is documented rather than unknown: only solicitations expected to exceed $75,000 are publicly posted. Email notifications exist but match on UNSPSC, so registration must be over-inclusive (§5.1, §6.2).'),

('Indiana EDS contract register', 'IN', 'IDOA contract search', '1 api', 'in',
 'Public register, anonymous JSON endpoint, no account. Verified 2026-08-10.',
 'FULL -- 204,439 contracts back to 2005.',
 json('{"works":["businessUnit","endDate","pageSize","sort=-modifiedDate"],'
   || '"silently_ignored":["sort=-publishDate"],'
   || '"note":"Pagination sorted on publishDate silently dropped ~33% of a window. '
   || 'Stop on modifiedDate instead."}'),
 'P7D', 0,
 'Where Indiana Phase 0 and the expiration radar actually run, since the solicitation side has no archive. WARNING: `amount` is EDS form field 6, a per-amendment delta that goes negative -- it is NOT a contract value. The running total is field 7 and exists only inside the PDF.'),

-- ---------- ILLINOIS ------------------------------------------------------
('Illinois BidBuy', 'IL', 'Periscope S2G', '3 html', 'in',
 'Public browse and advanced search, no login. Verified 2026-08-12.',
 'DEEP -- 2,155 closed solicitations, oldest opening date 2018-02-23.',
 json('{"works":["status","organization","classId","typeCode","categoryCode",'
   || '"openingDateFrom","openingDateTo"],'
   || '"verified":"status=Closed moved the count 127 -> 0 under openBids=true (empty '
   || 'intersection, so the parameter is honoured), then returned 2,155 unconstrained. '
   || '§5.4 method applied to a portal.",'
   || '"note":"Results carry awarded vendor. Statuses: Approved, Closed, Evaluated, '
   || 'Intent To Award, Opened, Bid to PO, Sent."}'),
 'P7D', 0,
 'THE FIND OF 2026-08-12. Overturns the working assumption that solicitation-side backtesting is federal-only. Illinois sits in the Firm Profile secondary geography, and one Periscope adapter also covers Arkansas and Montana (§5.7).'),

-- ---------- CGI ADVANTAGE: MICHIGAN AND KENTUCKY --------------------------
('Michigan SIGMA VSS', 'MI', 'CGI Advantage VSS', '3 html', 'in',
 'CLEARED BY MATT 2026-08-12. SIGMA displays "intended for government authorized users only... '
 || 'Disconnect immediately if you do not have express written authorization to access SIGMA." '
 || 'Reading: authorisation derives from holding a vendor account, which KP has or has had. '
 || 'Revisit if challenged. CONSEQUENCE: the adapter should AUTHENTICATE rather than read '
 || 'anonymously, which moves the governing text to KP''s account terms -- a different document.',
 'NONE for solicitations. Only open ones are listed.',
 json('{"silently_ignored":["Show Me"],'
   || '"note":"§5.4, FOURTH instance on a THIRD platform. Show Me set to All and to '
   || 'Recent Awards returned byte-identical result sets to Open -- same 20 rows, same '
   || 'near-future dates, every status Open. TOTALS ARE WITHHELD (1 - 20 of 20+ Records), '
   || 'so the vary-a-parameter health check CANNOT RUN here. This source needs a different '
   || 'rot signal.",'
   || '"beware":"Award History is GRANT disbursements, not procurement awards."}'),
 'P7D', 0,
 'Tier 3 and genuinely expensive: all traffic is a form POST to one endpoint with server-side session state, unlike Periscope which exposes real query parameters.'),

('Kentucky eMARS VSS', 'KY', 'CGI Advantage VSS', '3 html', 'in',
 'Cleared on the same reading as Michigan, same platform. NOT independently verified.',
 'Assume none, as Michigan. NOT verified.',
 json('{"note":"INFERRED FROM PLATFORM, not tested. Everything here is Michigan''s '
   || 'behaviour assumed to repeat. Verify before relying on it."}'),
 'P7D', 0,
 'The §5.7 platform-leverage claim in its purest form: one CGI Advantage adapter is intended to cover both states. That claim is untested here.'),

-- ---------- OHIO ----------------------------------------------------------
('Ohio OhioBuys', 'OH', 'Ivalua', '4 manual', 'manual-only',
 'CAPTCHA-gated. The public solicitation URL redirects to /bas/browser_check and fails '
 || 'automated navigation. Bot detection was NOT worked around. A person may read it; a '
 || 'scheduled adapter cannot. Matt 2026-08-12: marked for manual review, KP does little '
 || 'work in Ohio.',
 'Unknown -- not reachable to test.',
 NULL, NULL, 0,
 'Not a tier-3 adapter candidate as things stand. Recorded here rather than rediscovered by whoever writes the adapter.'),

-- ---------- EXCLUDED BY THEIR OWN TERMS -----------------------------------
('GovWin IQ', 'US', 'Aggregator', '4 manual', 'out',
 'Paywalled aggregator. Excluded by its terms of service (§5.5). Not accessed.',
 NULL, NULL, NULL, 0,
 'Standing exclusion. The precedent for §5.5.1: terms are respected even where access is technically possible.'),

('BidNet Direct', 'US', 'Aggregator', '4 manual', 'out',
 'Paywalled aggregator. Excluded by its terms of service (§5.5). Not accessed.',
 NULL, NULL, NULL, 0, 'Standing exclusion.'),

('BidPrime', 'US', 'Aggregator', '4 manual', 'out',
 'Paywalled aggregator. Excluded by its terms of service (§5.5). Not accessed.',
 NULL, NULL, NULL, 0, 'Standing exclusion.');
