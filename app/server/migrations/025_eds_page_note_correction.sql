-- 024's `page_note` describes the fetch strategy the DESIGN SPEC proposed
-- before implementation, not the one that shipped. It reads:
--
--   "Completeness comes from splitting a date window and comparing
--    pagination.totalResults against results.length."
--
-- Ruling 3 (.superpowers/sdd/2026-09-03-indiana-contract-register/progress.md)
-- ABANDONED date-window chunking the same day 024 was written: `startDate`/
-- `endDate` filters fully-contained-within, not overlaps-with, so no window
-- can tile a register where most contracts cross a year boundary -- single-
-- year windows recovered only 24,933 of 204,991, an 88% shortfall. See
-- docs/2026-09-03-eds-window-semantics.md.
--
-- Left as written, 024's note points the next ingest author at the exact
-- approach that loses 88% of the register. It is corrected HERE rather than
-- by editing 024 because 024 is already applied (verified on the `test`
-- branch's schema_migrations) and migrate.ts tracks migrations by filename
-- with no checksum: editing an applied file leaves databases that already ran
-- it unchanged while a fresh database gets different text -- silent,
-- permanent divergence. Same reasoning as Ruling 5, which corrected 023's
-- duplicate index the same way.
--
-- What actually shipped (eds-client.ts, completeness.ts): TWO requests, no
-- windows at all. One with pageSize: 1, purely to read
-- pagination.totalResults. Then one for that many rows plus a fixed margin,
-- so a handful of contracts filed between the count and the fetch cannot
-- truncate the run. assertComplete() checks the one thing this asserts:
-- results.length === pagination.totalResults. See
-- docs/superpowers/specs/2026-09-03-indiana-contract-register-design.md
-- (amended) and docs/2026-09-03-eds-ingest-run.md for the real run.
UPDATE source
   SET verified_facets = verified_facets || jsonb_build_object(
         'page_note',
           'MEASURED 2026-09-03: pages 1, 2 and 100 at pageSize 50 returned '
        || 'identical record sets, 50 of 50 ids overlapping. There is no cursor. '
        || 'Completeness comes from TWO requests, not date windows: one with '
        || 'pageSize 1 to read pagination.totalResults, then one for that many '
        || 'rows plus a fixed margin, asserting results.length equals the '
        || 'reported total. Date windows were tried and abandoned -- '
        || 'startDate/endDate filters fully-contained-within, so single-year '
        || 'windows recovered only 24,933 of 204,991 (88% shortfall); see '
        || 'docs/2026-09-03-eds-window-semantics.md and '
        || 'docs/superpowers/specs/2026-09-03-indiana-contract-register-design.md §3-4.')
 WHERE name = 'Indiana EDS contract register';
