-- THE KEY THE DOCUMENT ENDPOINT ACTUALLY WANTS, AND NOTHING IN THE DATABASE
-- HAD IT.
--
-- Found 2026-09-13 in the vendor's own OpenAPI description of /document/,
-- read from their public schema page at zero metered cost: "The related_key
-- is required and is found in the document_path field in the Opportunity
-- endpoint." The endpoint accepts exactly five parameters -- api_key,
-- related_key, ordering, page_number, page_size -- and `source_id`, which
-- fetch-documents-for.ts had been sending, is not among them. Every live
-- attempt's `HigherGov answered 400` was that: a rejected request, never a
-- burned key (§5.3's own tell -- a burned key answers 403).
--
-- WHY NO ROW HAD IT. `document_path` is a credential-bearing URL (it embeds
-- the api_key) and highergov-client.ts drops it at parse time, correctly, per
-- CLAUDE.md §5.3 -- but without first lifting `related_key` out of it. The
-- key is an identifier, not a credential: it is a separate query parameter on
-- the same URL. The client now reads that one parameter before the drop and
-- carries it in `raw` as `document_key`; the merge lands it here.
--
-- NULLABLE, AND NULL MEANS "WE NEVER CAPTURED IT". Every one of the 3,238
-- HigherGov solicitations ingested before this migration was parsed by a
-- client that threw the key away, and the artifacts on disk were written
-- after that parse, so it is not on disk either. Those rows can only get a
-- key from a fresh opportunity fetch -- a metered call -- which is a spending
-- decision for Matt, not a backfill this migration may perform. Until then
-- fetch-documents-for.ts reports such a row as `no-document-key`, spends
-- nothing and leaves it unstamped, rather than guessing a key and paying for
-- the 400.
--
-- Not on `document`: a document row is one file; this key names the SET the
-- vendor holds for an opportunity, and it is the opportunity we ask about.

ALTER TABLE solicitation ADD COLUMN document_key text;

COMMENT ON COLUMN solicitation.document_key IS
  'HigherGov''s related_key for this notice''s document set, lifted out of '
  'document_path at parse time (the api_key beside it is dropped). Required by '
  '/document/; nothing else identifies the set. NULL = never captured: the row '
  'was ingested before 2026-09-13, and only a fresh (metered) opportunity fetch '
  'can supply it. Other sources: always NULL.';
