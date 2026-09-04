-- `page` is silently ignored by the Indiana EDS contract API, and 003 does not
-- say so. It lists page among neither the working nor the ignored parameters,
-- which reads as untested rather than as dangerous.
--
-- MEASURED 2026-09-03: pages 1, 2 and 100 at pageSize 50 returned IDENTICAL
-- record sets -- 50 of 50 ids overlapping, same first id (A6-6-CO-006), same
-- last (A179-4-IGBWLA-001). A bogusParam control returned the same baseline
-- count, which is what proves "unchanged" means "ignored" rather than
-- "misspelled by us". vendorName and agencyName are ignored on the same
-- evidence.
--
-- The sixth §5.4 instance in this project and the fourth platform. Recording it
-- HERE rather than only in a spec, because the next person to write an ingest
-- against this source will read the registry row, and a pagination loop built
-- on `page` loads the same 2,000 records once per window and reports success.
UPDATE source
   SET verified_facets = verified_facets || jsonb_build_object(
         'silently_ignored', jsonb_build_array(
             'sort=-publishDate', 'page', 'vendorName', 'agencyName'),
         'page_note',
           'MEASURED 2026-09-03: pages 1, 2 and 100 at pageSize 50 returned '
        || 'identical record sets, 50 of 50 ids overlapping. There is no cursor. '
        || 'Completeness comes from splitting a date window and comparing '
        || 'pagination.totalResults against results.length. See '
        || 'docs/superpowers/specs/2026-09-03-indiana-contract-register-design.md §3.',
         'works_verified_2026_09_03', jsonb_build_array(
             'pageSize', 'startDate', 'endDate', 'businessUnit'))
 WHERE name = 'Indiana EDS contract register';

-- Ruling 5. Migration 023 created contract_ends_at on contract(ends_at),
-- duplicating contract_ends created by 002_entity_graph.sql:146 on the same
-- column. Two btrees on one column cost write throughput and disk for no read
-- benefit, and this table has just taken 204,991 rows.
--
-- It is dropped HERE rather than edited out of 023 because 023 has already been
-- applied: migrate.ts tracks migrations by filename with no checksum, so
-- editing an applied file leaves every database that ran it unchanged while a
-- fresh one gets different text. Silent, permanent divergence. Corrections come
-- after, never in place.
DROP INDEX IF EXISTS contract_ends_at;
