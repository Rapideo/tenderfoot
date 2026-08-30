-- The accuracy measurement (extract/precedence.ts) self-joins document rows
-- against THE listing row for a field. Two listing rows for one field would
-- multiply every count and peg the result near 50% no matter how the extractor
-- performs -- a broken measurement that still looks like a measurement.
--
-- Partial, because the constraint is only true of listing rows: a solicitation
-- legitimately has MANY document rows per field. That is the whole design --
-- three PDFs disagreeing about one deadline is the case this slice exists for.
CREATE UNIQUE INDEX extracted_field_one_listing
    ON extracted_field (solicitation_id, field_name)
 WHERE origin = 'listing';
