-- Two columns the HigherGov mapping found missing, and one fact the registry
-- already knew and never recorded.
--
-- Evidence for all three: docs/2026-09-03-highergov-field-mapping.md.

-- ---------------------------------------------------------------------------
-- 1. sole_source -- THE ONE §6.4 SIGNAL THE SPEC ASKS FOR BY NAME
-- ---------------------------------------------------------------------------
-- Design spec §6.4 lists five explicit NEGATIVE winnability signals: an
-- unusually short response window, qualifications so specific only one firm
-- holds them, an incumbent named in the scope, no preceding RFI, and
-- SOLE-SOURCE JUSTIFICATION LANGUAGE.
--
-- HigherGov publishes `sole_source_flag` as a pre-computed boolean on every
-- opportunity. It is the only one of the five available to us for free, and
-- there has never been anywhere to put it.
--
-- ⚠️ STORED, NOT WIRED. §6.4's signals "score as low winnability, not high fit"
-- -- and scoring is precisely what ruling 1A keeps parked and §7.10 clause 2
-- guards. This column exists so the fact is captured while it is cheap to
-- capture. Nothing may filter, rank or sort on it until qualification is
-- designed.
--
-- NULL means "not stated by the source", which is a third state and not `false`.
ALTER TABLE solicitation ADD COLUMN sole_source boolean;

-- ---------------------------------------------------------------------------
-- 2. source_key -- BECAUSE external_id IS NOT GLOBALLY UNIQUE, AND merge.ts
--    ASSUMES IT IS
-- ---------------------------------------------------------------------------
-- merge.ts's own header states the assumption plainly:
--
--   "grouping is by `external_id` ALONE. That is only correct if external_ids
--    are unique across every source that ever writes a sighting."
--
-- MEASURED 2026-09-03 AND THE ASSUMPTION IS FALSE. IDOA publishes 15-digit
-- Event IDs (003000000088067). Allen County, arriving through HigherGov,
-- publishes `132`, `134`, `135`. Two unrelated solicitations sharing the
-- string "134" would be FUSED INTO ONE by the merge grouping -- silently, and
-- with no constraint anywhere to catch it.
--
-- Production is clean TODAY -- 0 duplicate (source_id, external_id) pairs, 0
-- external_ids shared across sources, and only 2 of 9,883 are six characters or
-- fewer -- and it is clean for one reason: only one source has ever been
-- ingested. This is a LATENT defect of exactly D27's shape, which a second
-- source makes live.
--
-- source_key holds the source's own GLOBALLY unique identity where it publishes
-- one: HigherGov's `opp_key`, a 32-character hash. external_id keeps holding
-- the portal's human-facing id, because that is what a person searches for and
-- what the IDOA answer key matched on.
--
-- ⚠️ THIS MIGRATION DOES NOT FIX merge.ts. Adding the column is not the repair;
-- changing what merge groups by is, and that is a merge-internals slice with
-- its own review. This column is the precondition, and the hazard is recorded
-- here so the next person to ingest a second source meets it first.
ALTER TABLE solicitation ADD COLUMN source_key text;

CREATE INDEX solicitation_source_key ON solicitation(source_key);

-- ---------------------------------------------------------------------------
-- 3. SAM.gov's watermark was verified working and never written down
-- ---------------------------------------------------------------------------
-- The rubric's first production run graded SAM.gov `R9 UNKNOWN` -- "no
-- watermark known, a run may have to re-read everything". That is not an
-- unmeasured fact; it is a measured fact nobody recorded.
--
-- 003's own verified_facets for SAM.gov already say `sort=-modifiedDate` works
-- while `sort=-publishDate` is accepted and silently ignored, and note that
-- "pagination must stop on modifiedDate, since modifiedDate >= publishDate
-- always." The registry knew. The column did not exist until migration 018.
UPDATE source SET watermark_field = 'modifiedDate' WHERE name = 'SAM.gov';

-- Same for the Indiana register, and it is `modifiedDate` rather than the
-- `endDate` a reader might reach for. 003's row records why: "Pagination sorted
-- on publishDate silently dropped ~33% of a window. Stop on modifiedDate
-- instead." endDate is a FILTER parameter on that API; the watermark is what a
-- resume may safely order by, and they are not the same thing.
UPDATE source SET watermark_field = 'modifiedDate' WHERE name = 'Indiana EDS contract register';
