-- The `contract` table has existed since migration 002 and has never held a
-- row. Loading the Indiana EDS register needs four columns it does not have.
--
-- Design: docs/superpowers/specs/2026-09-03-indiana-contract-register-design.md

-- `contract` has NO source column at all -- a row today cannot say where it
-- came from. Every other ingested table carries one.
ALTER TABLE contract ADD COLUMN source_id integer REFERENCES source(id);

-- THE CONTRACT ID IS NOT UNIQUE. Measured 2026-09-03: A337-6-CWI-104 appears
-- as amendment 0 (New, $40,000) and amendment 1 (Amendment, $70,000). The
-- amendment number is half the identity.
ALTER TABLE contract ADD COLUMN amendment integer;

-- New | Amendment | Renewal | Unknown. ⚠️ 1,583 of 2,000 sampled rows are
-- "Unknown" -- that is a real property of the source, not a parse failure, and
-- anything treating action_type as reliable needs to know it.
ALTER TABLE contract ADD COLUMN action_type text;

-- ⚠️ THIS IS NOT value_cents, AND THE DISTINCTION IS THE POINT.
--
-- `amount` is EDS form field 6: a per-amendment DELTA. The running total is
-- field 7 and exists only inside the PDF, so no single row carries a contract's
-- value. Summing deltas per contract id is well-supported -- an amendment
-- adding $0 while extending an end date is a no-cost time extension, which only
-- makes sense as a delta -- but NOT verified.
--
-- value_cents will one day hold PUBLISHED figures from HigherGov's
-- /sl-contract/. Writing a derived sum into it beside sourced facts is the
-- provenance error extracted_field.origin and precedence.ts exist to prevent.
-- Ruled by Matt 2026-09-03: value_cents stays NULL.
ALTER TABLE contract ADD COLUMN amount_cents bigint;

-- What makes a re-run idempotent rather than duplicating. Partial, because
-- rows predating this ingest (there are none today) would have NULLs.
CREATE UNIQUE INDEX contract_natural_key
  ON contract (source_id, external_id, amendment)
  WHERE source_id IS NOT NULL AND external_id IS NOT NULL AND amendment IS NOT NULL;

CREATE INDEX contract_ends_at ON contract (ends_at);
