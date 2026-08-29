-- WHERE A SOLICITATION CAME FROM, ON THE SOLICITATION.
--
-- Until now the only record of a solicitation's origin was a `sighting` row,
-- and nothing that filtered by source could do it without a two-table join.
-- SP4's Discover step needs exactly that filter -- it asks SAM.gov "what
-- files are attached to notice X?", so it must only ever ask about notices
-- SAM.gov issued -- and it shipped with the join spelled out inline. That
-- worked, but it put a correctness-critical predicate somewhere easy to omit:
-- the version of that query WITHOUT the join selected every portal's rows and
-- posted Indiana purchasing ids to a federal API.
--
-- WHAT THE COLUMN MEANS: the source whose payload this record currently
-- reflects. That is deliberately the same definition merge.ts already uses
-- for `latest_source_id` -- the most recent sighting's source, the one whose
-- raw payload the merge read to build the row. It is NOT "first seen from".
-- Keeping one definition means the column and the merge cannot drift into
-- disagreeing about the same row.
--
-- WHY A SCALAR IS SAFE HERE, AND WHEN IT WOULD STOP BEING: `sighting` is
-- deliberately many-to-one (002's own comment: "many sightings, one
-- solicitation"), so in principle two sources could see the same
-- solicitation and one column could not hold both. Measured before writing
-- this, on production and on test: ZERO solicitations are seen by more than
-- one source, and every `sighting.external_id` equals its solicitation's.
-- The day cross-source merging actually happens, this column keeps a
-- well-defined meaning -- the payload in force -- and `sighting` remains the
-- complete record of who saw what. Nothing here discards that.
ALTER TABLE solicitation ADD COLUMN source_id integer REFERENCES source(id);

-- Backfill by the SAME rule merge.ts applies: the latest sighting wins, ties
-- broken by id, which is the ordering merge.ts uses to pick `latest_raw` and
-- `latest_source_id` together. A backfill on any other rule would silently
-- disagree with every row merge writes from here on.
UPDATE solicitation s
   SET source_id = x.source_id
  FROM (SELECT DISTINCT ON (sg.solicitation_id)
               sg.solicitation_id, sg.source_id
          FROM sighting sg
         WHERE sg.solicitation_id IS NOT NULL
         ORDER BY sg.solicitation_id, sg.seen_at DESC, sg.id DESC) x
 WHERE x.solicitation_id = s.id
   AND s.source_id IS NULL;

-- NOT NULL is the whole point, not a tidy-up. A nullable source_id would let
-- a future insert path forget the column, and a row with a NULL source is
-- INVISIBLE to `WHERE source_id = ...` -- silently excluded, never counted,
-- never explained. That is precisely the failure this slice already suffered
-- once: `left(closes_at, 10) >= ...` yields NULL for a NULL closes_at, WHERE
-- reads NULL as false, and every SAM.gov solicitation vanished from a query
-- that looked like it was working. A constraint is the only thing that makes
-- the next such omission fail loudly instead of quietly.
--
-- This statement fails if any solicitation has no sighting to inherit from.
-- Measured as zero on both branches; if it ever fires, the right response is
-- to find out how a solicitation came to exist with no record of who showed
-- it to us, NOT to relax the constraint.
ALTER TABLE solicitation ALTER COLUMN source_id SET NOT NULL;

CREATE INDEX solicitation_source ON solicitation(source_id);
