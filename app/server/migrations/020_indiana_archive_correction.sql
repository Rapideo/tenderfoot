-- Indiana IDOA's archive_depth said Indiana could not be backtested. It can.
--
-- 003's row reads, verbatim:
--
--   "NONE. Closed solicitations are not published -- Indiana cannot be
--    backtested on the solicitation side (§8.2)."
--
-- The first sentence is still exactly right. The second is not, and was
-- overturned on 2026-09-03 by measurement rather than by argument: a HigherGov
-- saved search scoped to Indiana state and local returns 9,286 records reaching
-- back to 2013-06-19, continuous from 2017, while IDOA itself publishes 71 open
-- notices and no archive at all.
--
-- ⚠️ WHY THIS IS A NEW MIGRATION AND NOT AN EDIT TO 003.
-- migrate.ts tracks applied migrations BY FILENAME with no checksum, so editing
-- an applied file changes nothing on test or production while a freshly created
-- database gets different text. That divergence is silent and permanent, and it
-- is exactly the class of failure this project keeps catching elsewhere. An
-- applied migration is a historical record; corrections come after it.
--
-- Scope note: this corrects the CONSEQUENCE drawn from the finding, not the
-- finding. IDOA's own archive is still NONE, and nothing here suggests scraping
-- IDOA for history -- there is none to scrape. The archive exists because a
-- third party kept what the source discards.

UPDATE source
   SET archive_depth =
         'NONE AT IDOA. Closed solicitations are not published, and that is '
      || 'unchanged. ⚠️ CORRECTED 2026-09-03 (migration 020): the consequence '
      || 'recorded in 003 -- "Indiana cannot be backtested on the solicitation '
      || 'side" -- is WRONG. It cannot be backtested FROM THIS SOURCE. HigherGov '
      || 'holds 9,286 Indiana state+local records back to 2013-06-19, so Indiana '
      || 'Phase 0 MAY run on contract data rather than MUST. See the HigherGov '
      || 'row and docs/2026-09-03-platform-comparison.md §R3.',
       source_note = source_note
      || ' ⚠️ RED-FLAGGED 2026-09-02 by Matt: the page shows 71 open events and '
      || 'no history, so depth could only ever accumulate forward from a first '
      || 'scrape. An adapter was built against it (branch `idoa-adapter`, 673 '
      || 'tests, green, UNMERGED) before that was understood -- which is the '
      || 'cost of having had no source-admission rubric, and the acceptance '
      || 'test the 2026-09-03 rubric must reproduce. Superseded for coverage by '
      || 'HigherGov, which carries 69 of these 70 notices (99%).'
 WHERE name = 'Indiana IDOA solicitations';
