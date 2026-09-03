-- WHERE DID THIS DATE COME FROM? Nothing has ever asked.
--
-- Ruled by Matt 2026-09-02: "Adapters return what they can, and the merge
-- layer sorts out what's trustworthy." That ruling only works if merge can
-- TELL. `extracted_field` already carries origin and confidence; listing-level
-- dates are merged bare, so a first-seen-derived posted_at written into the
-- same column is indistinguishable from SAM's published one -- and the
-- distinction is lost silently, which is the shape of every field-level defect
-- this project has already paid for.
--
--   published  the source states this date. SAM.gov's postedDate.
--   observed   WE first saw the row on this date. IDOA and every other
--              snapshot source, which publish no posting date at all.
--
-- NULL when posted_at is NULL: a provenance for a value that does not exist
-- would be inventing the thing this column exists to prevent.
ALTER TABLE solicitation ADD COLUMN posted_at_origin text;

-- BACKFILL BEFORE THE CONSTRAINT, DELIBERATELY OUT OF THE ORDER YOU'D WRITE
-- IT READING TOP TO BOTTOM. Every row that exists today came from SAM.gov,
-- which publishes postedDate -- correct, cheap, and true, not a default
-- chosen for convenience. But `ADD CONSTRAINT ... CHECK` validates every
-- EXISTING row immediately, in the same statement, and every existing row
-- with posted_at set still has posted_at_origin NULL until this UPDATE runs.
-- Adding the constraint first fails the migration outright against any table
-- that already has posted_at populated -- which this one does.
UPDATE solicitation SET posted_at_origin = 'published' WHERE posted_at IS NOT NULL;

-- ⚠️ `posted_at_origin IS NOT NULL AND` is load-bearing, not redundant with
-- the IN() beside it. Without it, a row with posted_at set and
-- posted_at_origin NULL evaluates the second branch as
-- (TRUE AND (NULL IN (...))) = (TRUE AND NULL) = NULL -- and Postgres CHECK
-- constraints ALLOW a NULL result, rejecting only an outright FALSE. That
-- would let exactly the row this constraint exists to forbid -- a date with
-- no provenance -- insert silently. Same NULL-as-not-false trap this
-- codebase has already hit with `<>` against NULL in merge.ts; caught here by
-- the test that inserts posted_at with a NULL origin and asserts rejection.
ALTER TABLE solicitation ADD CONSTRAINT solicitation_posted_at_origin_valid
  CHECK (
    (posted_at IS NULL AND posted_at_origin IS NULL)
    OR (posted_at IS NOT NULL AND posted_at_origin IS NOT NULL AND posted_at_origin IN ('published', 'observed'))
  );
