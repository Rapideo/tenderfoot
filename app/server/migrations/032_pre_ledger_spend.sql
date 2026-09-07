-- THE CEILING WAS BEING COMPUTED FROM A LEDGER THAT STARTED HALFWAY THROUGH
-- THE MONTH, AND IT WAS WRONG IN THE REASSURING DIRECTION BY 490 RECORDS.
--
-- Found 2026-09-07 by the first real `npm run ingest:highergov` dry run. The
-- command printed *"Remaining this month: 891 of 1000"*. The true figure was
-- 401. Nothing in the code was wrong -- `api_spend` faithfully summed every
-- row it held. The problem is that the table was created on 2026-09-04
-- (migration 030) and **490 records had already been spent on 2026-09-03**,
-- inside the same calendar month the ceiling query asks about.
--
-- 🔴 WHY THIS MATTERS MORE THAN ITS SIZE. The whole HigherGov ingest slice
-- exists to make sure a billed record cannot vanish from this table, because
-- a spend figure that is too LOW authorises spending we cannot afford --
-- against a ceiling the vendor will not report back to us. Two review passes
-- hunted that failure mode through every throw and early return in the code.
-- It was sitting in the table's own start date the entire time.
--
-- ⚠️ THE FAILURE MODE ARRIVED THROUGH HISTORY, NOT THROUGH CODE, and that is
-- the general lesson: a ledger answers "since the 1st" honestly only if it
-- existed on the 1st. Any table created mid-period to answer a
-- since-the-start-of-period question inherits a silent gap exactly the size
-- of what happened before it existed.
--
-- WHERE THE 490 COMES FROM. CLAUDE.md §5.1 records it, and it is the one
-- number in this project measured by a person reading the vendor's dashboard
-- rather than by any instrument we own: *"verified against the account
-- dashboard at 489, then 490"*. It is not an estimate.
--
-- ⚖️ ENDPOINT ATTRIBUTION, STATED RATHER THAN GLOSSED. The 490 was a MIXTURE
-- of opportunity and document calls -- the 2026-09-03 platform testing made
-- both, and the split was never recorded, because at the time nothing was
-- counting. The CHECK constraint admits only 'opportunity' or 'document', so
-- one row must pick one. It is recorded as 'opportunity' because that is
-- where most of that day's calls went, and because the ONLY query this table
-- exists to serve sums `records` across endpoints and is therefore unaffected.
-- Anyone reading this row as evidence about endpoint mix specifically should
-- read this comment first and then not do that.
--
-- `called_at` is 2026-09-03, the day it was actually spent, so it lands in
-- September's window and will correctly age out of October's.
--
-- ⚠️ THIS MIGRATION MUST REACH PRODUCTION TOO. `api_spend` is per-database,
-- so production's ceiling arithmetic carries the identical 490-record gap.
-- Applying it there is a deliberate operator act (CLAUDE.md §2) and is not
-- done by writing this file.

-- 🔴 AND IT MUST NOT REACH A TEST SCHEMA, which the first version of this
-- file got wrong and the suite caught within minutes.
--
-- `useTestSchema()` gives every test file its own schema and sets the pool's
-- search_path to it (`db/index.ts` -- `options: -c search_path=...`), then
-- `resetSchema()` runs EVERY migration into it. So an unguarded INSERT here
-- seeds 490 records of spend into every test fixture in the project. Two ways
-- that bites, and both were observed:
--
--   1. `api_spend.source_id` is NOT NULL REFERENCES source(id), so an
--      unscoped `DELETE FROM source` in a test's own reset() helper starts
--      violating a foreign key -- surfacing as red tests in files that have
--      never heard of api_spend.
--   2. Worse, because it is silent: every test that exercises the monthly
--      CEILING would compute against a 490-record head start it did not set
--      up and cannot see, so its arithmetic would drift without its
--      assertions ever mentioning spend.
--
-- `current_schema()` is 'public' in a real database and the per-run schema
-- name under test, so this guard is exact. A reconciliation of one real
-- account's history is not a fixture, and must not become one.

INSERT INTO api_spend (source_id, endpoint, records, called_at)
SELECT s.id, 'opportunity', 490, timestamptz '2026-09-03 12:00:00+00'
FROM source s
WHERE s.name = 'HigherGov'
  AND current_schema() = 'public'
  /* Idempotent: re-running must not double-count the one thing this file
   * exists to count. Keyed on the exact reconciliation row, so a genuine
   * future 490-record call on a different day still inserts normally. */
  AND NOT EXISTS (
    SELECT 1 FROM api_spend a
    WHERE a.source_id = s.id
      AND a.records = 490
      AND a.called_at = timestamptz '2026-09-03 12:00:00+00'
  );
