-- HigherGov -- THE FIRST SOURCE IN THIS PROJECT THAT COSTS MONEY.
--
-- Every value below was MEASURED on 2026-09-03 against a live trial key, not
-- quoted from documentation. Full evidence, including the arithmetic and the
-- calls that produced each number: docs/2026-09-03-platform-comparison.md
-- sections R0-R11.
--
-- enabled = false, like every other row. Nothing is ever seeded on.
--
-- ⚠️ READ CLAUDE.md §5 BEFORE CALLING THIS API. It is metered at 10,000 records
-- per month, consumption cannot be read from the API at all, and no call may be
-- made without Matt's explicit approval (ruled 2026-09-03).

INSERT INTO source (name, jurisdiction, platform, adapter_tier, legal_posture,
                    legal_note, archive_depth, verified_facets, since_default,
                    enabled, source_note, cost_posture, annual_cost_usd,
                    watermark_field, field_completeness) VALUES

('HigherGov', 'US', 'HigherGov API', '1 api', 'in',

 -- §5.5.1 requires the evidence for posture `in` to live ON THE ROW. This is
 -- the only paid aggregator with documented permission; GovWin IQ, BidNet
 -- Direct and BidPrime remain `out` by their own terms and are NOT superseded
 -- by this row.
 'Paid subscription, $500/yr, API access at every tier. Matt''s ATTORNEY '
 || 'cleared storing HigherGov data in our own store -- the "documented '
 || 'permission" §5.5.1 requires to move a source to `in`. Recorded 2026-09-02, '
 || 'key obtained and exercised 2026-09-03. This clearance is specific to '
 || 'HigherGov and does not reach the three excluded aggregators.',

 -- The finding that overturned design spec §5.8 and §10.2.
 'DEEP, and it overturns a documented assumption. 9,286 Indiana state+local '
 || 'records reaching back to 2013-06-19, continuous from 2017 -- where IDOA '
 || 'itself publishes 71 open notices and NO archive of any kind. Design spec '
 || '§5.8 and §10.2 still say Indiana cannot be backtested on the solicitation '
 || 'side; that is now true of IDOA and false of Indiana.',

 -- §5.4. The most expensive thing to rediscover about this source.
 ('{"works":["source_type","search_id","captured_date","posted_date",'
   || '"source_id","agency_key","opp_key","version_key","ordering"],'
   || '"silently_ignored":["pop_state","state","place_of_performance_state"],'
   || '"verified":"source_type=bogus_value returned count 0 while the '
   || 'unfiltered day returned 5,266, so source_type is genuinely honoured. The '
   || 'three state parameters each returned HTTP 200 with the count UNCHANGED at '
   || '5,266 -- accepted and ignored. Confirmed against their OpenAPI schema at '
   || '/api-external/schema/: /opportunity/ takes twelve parameters and NONE is '
   || 'a location.",'
   || '"note":"FIFTH §5.4 instance, FOURTH platform, and the first on a PAID '
   || 'API. State filtering is only possible through a saved search (search_id), '
   || 'whose supported fields include State (State and Local Only). Verified '
   || 'honoured: 20/20 returned rows were pop_state=IN. ⚠️ The UI offers six '
   || 'filters the API does not list -- Agency Distribution, Agency Type, Match, '
   || 'Product/Service, Exclude No Bid, My Favorites -- and unsupported fields '
   || 'are expected to be silently dropped when a saved search is used via the '
   || 'API. UNVERIFIED; verify before relying on such a search.",'
   || '"never_use":"Match is HigherGov''s own fit score. Wiring it into an '
   || 'ingest would import an external qualification engine wholesale, which '
   || '§7.10 clause 2 and the 2026-09-03 ruling 1A forbid."}')::jsonb,

 'P7D', false,

 'MEASURED 2026-09-03 against the 71-item IDOA answer key: coverage recall '
 || '69/70 (99%), relevance recall 5/5. Their source_id for Indiana IS IDOA''s '
 || 'own 15-digit Event ID, which makes exact matching possible. '
 || 'source_type enum: sam · dibbs · sled · sbir · grant, plus sled_forecast '
 || 'which is NOT in their documented enum. '
 || '⚠️ QUOTA IS THE BINDING CONSTRAINT AND CANNOT BE READ FROM THE API. '
 || '10,000 records/month; the meter counts records RETURNED (proved by an '
 || 'isolated test, 478 -> 489 on one call returning 1 opportunity + 10 '
 || 'documents). There is no quota field, no usage endpoint and no header, so '
 || 'only the account dashboard shows consumption and any unattended run must '
 || 'keep its own tally. A full Indiana backfill is ~9,286 records -- 93% of one '
 || 'month -- and must not share a billing period with operating use. '
 || 'DOCUMENTS ARE BILLED PER RECORD: a bulk document pass over Indiana is '
 || '93,000-176,000 records, nine to seventeen months of allowance, so it is '
 || 'structurally impossible and documents are fetched on triage demand only, '
 || 'page one and stop. See CLAUDE.md §5.2 for the staged-retrieval model.',

 'paid', 500, 'captured_date',

 -- R7, measured. Two populations, deliberately kept apart: the answer-key rows
 -- are state-agency notices IDOA publishes itself, and they are much richer
 -- than the feed as a whole. Quoting the first as if it described the second is
 -- the error this column exists to prevent.
 ('{"measured_on":"2026-09-03",'
   || '"idoa_matched_n69":{"description_text":"69/69","val_est":"69/69",'
   || '"document_path":"69/69","due_date":"69/69","set_aside":"69/69",'
   || '"description_median_chars":930,"description_p10_chars":436},'
   || '"indiana_feed_n100":{"description_text":"66/100","val_est":"92/100",'
   || '"document_path":"100/100","due_date":"100/100",'
   || '"state_agency_description":"47/66","substate_description":"11/26",'
   || '"substate_buyers":"34/100","distinct_agencies":33},'
   || '"caveat":"val_est_low/high are INFERRED BANDS, not published figures -- '
   || 'ten records returned only six distinct low values. SAM publishes no '
   || 'estimate for open notices, so these are modelled. Derived data: it must '
   || 'carry its own origin and must never be written into value_cents beside '
   || 'sourced facts. ai_summary and document.summary are derived likewise.",'
   || '"documents":"/document/ returns file_name, file_type, file_size, '
   || 'posted_date, text_extract, summary, download_url. text_extract is ALREADY '
   || 'POPULATED for .docx (8,884 / 22,190 / 3,687 chars observed) but NULL for '
   || '.xlsx -- which is where cost proposals live. Default page is 10 of 19.",'
   || '"quirks":"Titles carry a scraping artifact -- anchor text glued on, e.g. '
   || '\"...WW RemovalBid Documents\". Several source_id lookups return count=2 '
   || '(versioning via version_key); a dedup rule is needed. opp_type is a '
   || 'NESTED OBJECT, not a string. /sl-contract/ rejects captured_date despite '
   || 'documenting it; start_date works."}')::jsonb);
