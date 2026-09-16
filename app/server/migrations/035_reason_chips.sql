-- REASON CHIPS RETURN, DERIVED -- rulings D20-D24, 2026-09-16.
--
-- SVRC Region 1.1.4 parked reason chips on 2026-08-11 with one condition: the
-- vocabulary "should be DERIVED from that hand-run rather than invented before
-- it", because pre-set categories flatten what a person would otherwise say.
-- Migration 013 recorded the discovery channel as the deliberate, narrow
-- exception to that rule (a channel is a closed factual set). This is the rule
-- itself, honoured: 150 decisions were taken in Matt's own words on
-- 2026-09-13 -- he declined the shortcut -- and the eleven values below are
-- what those words clustered into. The counts and the words are on the ruling
-- sheet; STATUS.md carries the link.
--
-- WHY AN ARRAY. The bundle's chips append (`picked` is an array), and about
-- six of the 139 passes carry two reasons at once ("not enough information,
-- but it is also medical supplies"). A single column would force a choice the
-- reader did not make. Empty, never NULL: a decision with no chips is a
-- decision with no chips, and `'{}'` says so without a second representation
-- of the same fact. Every pursuit row written before today therefore reads
-- as chip-less rather than unknown, which is exactly true of it.
--
-- THE CLASS IS NOT A COLUMN HERE, AND THAT IS DELIBERATE. Each chip id has
-- exactly one class (fit / evidence / notice / eligibility / capacity), fixed
-- in @tenderfoot/shared's REASON_CHIPS beside the label, so the class is a
-- property of the vocabulary and not of the row -- a row cannot carry a chip
-- in the "wrong" class any more than it can carry a chip outside the list.
-- Design spec §1's rule -- a capacity reason may be counted and never acted
-- on -- is therefore a filter on `no-capacity` in this array, and whatever
-- one day learns from reasons applies it before reading a single row.
ALTER TABLE pursuit ADD COLUMN reason_chips text[] NOT NULL DEFAULT '{}';

-- The vocabulary, pinned in the schema rather than in application code alone
-- (migration 013's discipline, and 006's before it): a value that reaches this
-- column by any path must be one of these, because a count over strings
-- nobody recognises is not a count. Adding a chip is a ruling, and a ruling
-- is worth a migration.
--
--   not-a-service       113 of 139 passes; the category noun stays in `reason`
--                       (D20-A) and seeds the negative profile (spec §4.2)
--   not-enough-info     13 passes and 1 Interested (+9 as a second reason);
--                       offered on BOTH steps (D23-A) -- class evidence
--   not-an-actual-bid   8 -- legal ads, vendor forums, emergency notices
--   seen-already        2 -- a merge defect wearing a reason's clothes
--   must-be-on-site     2 -- "remote opportunities only at this point"
--   too-specific        1 -- "hyper-specific to a single platform"
--   no-capacity         0 -- the one chip the corpus did not earn, shipped on
--                       1.1.4's mandate that the class exist on the way in
--                       (D24-A); excluded from anything that learns
--   perfect-fit         2   ┐
--   our-kind-of-work    5   │ the Interested step (D22-A), eleven decisions
--   could-source-it     2   │ behind them
--   new-market          1   ┘
ALTER TABLE pursuit ADD CONSTRAINT pursuit_reason_chips_valid
  CHECK (reason_chips <@ ARRAY[
    'not-a-service', 'not-enough-info', 'not-an-actual-bid', 'seen-already',
    'must-be-on-site', 'too-specific', 'no-capacity',
    'perfect-fit', 'our-kind-of-work', 'could-source-it', 'new-market'
  ]::text[]);

-- Which step a chip belongs to is NOT in the schema: `not-enough-info` sits on
-- both, and a Pass-only chip on an Interested row is an application error the
-- route answers with a 400 (recordDecision checks it), not a data-integrity
-- rule worth a second constraint that would have to be rewritten every time
-- the two lists move.

-- The negative-profile derivation (spec §4.2) and any future count read this
-- per decision. GIN because the question is always "which rows carry chip X",
-- never "what is row Y's array".
CREATE INDEX pursuit_reason_chips ON pursuit USING gin (reason_chips);
