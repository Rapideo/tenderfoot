-- WHERE ELSE WOULD THIS HAVE REACHED YOU? Nothing has ever asked.
--
-- Design spec §8.5 names the gate's measure and calls it the whole one:
-- "Discovery -- qualified opportunities surfaced that would not have been
-- seen." Plan of Action §6.-1 puts the same thing as the question SP6 exists
-- to answer: "does reading everything from active sources surface work KP
-- would pursue AND HAD NOT OTHERWISE SEEN?"
--
-- Measured 2026-09-01: nothing in the schema or the UI recorded it, so the
-- gate could not answer its own question however much triaging happened. This
-- column is that answer.
--
-- WHY A CHANNEL RATHER THAN A YES/NO, ruled by Matt 2026-09-01. "Would you
-- have found this without Tenderfoot?" is §8.5's literal question but it is a
-- counterfactual judgement made inside a ten-second decision, and those get
-- answered inconsistently. Naming the channel is closer to recall than to
-- judgement -- and `nowhere` IS the discovery count, while every other value
-- says which existing channel Tenderfoot is merely duplicating. That second
-- half is information no yes/no can give, and it is what tells KP what they
-- could stop doing.
--
-- ⚠️ THE VOCABULARY IS INVENTED, NOT DERIVED, and that cuts against this
-- project's own precedent. SVRC Region 1.1.4 parked reason CHIPS on exactly
-- this reasoning: "the chip vocabulary should be DERIVED from that hand-run
-- rather than invented before it", because pre-set categories flatten what a
-- person would otherwise say in their own words. Recorded as deviation D21.
-- The argument for overriding it here is narrow and should stay narrow:
-- a REASON is an open-ended judgement, whereas a CHANNEL is a closed factual
-- set (an alert either exists or it does not), and free text cannot be
-- counted -- so a derived-later vocabulary yields no discovery number from
-- the session it is needed for. `other` and `not_sure` are the escape
-- hatches, and if either dominates, the vocabulary was wrong and the values
-- themselves will say so.
--
-- NULL IS MEANINGFUL AND STAYS ALLOWED. Every pursuit row written before
-- today has no channel, and Pass decisions never carry one -- §8.5 asks about
-- QUALIFIED opportunities, so the prompt fires on Interested alone rather
-- than taxing all ~900 decisions and attacking the "clear the queue" habit
-- the product depends on (§7.1). A NOT NULL default would have to invent a
-- value for both cases, and inventing data to satisfy a constraint is how a
-- denominator stops being defensible.
ALTER TABLE pursuit ADD COLUMN discovery_channel text;

-- The vocabulary, pinned in the schema rather than in application code alone.
-- Same discipline as migration 006's source_health_valid: a value that reaches
-- this column by any path -- a CLI, a fixture, a future route, a hand-written
-- UPDATE -- must be one the metric can count, because the alternative is a
-- discovery rate quietly computed over strings nobody recognises.
--
--   already_knew    already on KP's radar before Tenderfoot showed it
--   indiana_email   Indiana's own notifications would have caught it (§5.7)
--   portal          a procurement portal KP checks directly
--   colleague       someone would have mentioned it
--   nowhere         NOTHING would have surfaced it -- the discovery count
--   not_sure        answered honestly rather than skipped invisibly
--   other           none of the above; detail goes in the existing reason
ALTER TABLE pursuit ADD CONSTRAINT pursuit_discovery_channel_valid
  CHECK (discovery_channel IS NULL OR discovery_channel IN (
    'already_knew', 'indiana_email', 'portal', 'colleague',
    'nowhere', 'not_sure', 'other'
  ));

-- The metric reads this per decision, filtered to Interested. Small table for
-- now (0 rows on production at the time of writing), but the gate's headline
-- number is computed from it and that will not stay true.
CREATE INDEX pursuit_discovery_channel
  ON pursuit (discovery_channel)
  WHERE discovery_channel IS NOT NULL;
