-- THE ONLY PLACE THAT KNOWS WHAT WE HAVE SPENT.
--
-- ⚖️ Ruling D2 (Matt, 2026-09-04). CLAUDE.md §5.2's staged-retrieval model
-- turns on a fact the vendor will not give us: HigherGov meters 10,000
-- records/month, and consumption CANNOT be read from the API -- no quota
-- field, no usage endpoint, no header. Only the account dashboard shows it,
-- which means a person reading a number is the sole instrument. So we keep
-- our own count, and it must answer "what did we spend since the 1st"
-- rather than "how many documents do we hold".
--
-- ⚠️ THIS DEVIATES FROM CLAUDE.md §5.1, WITH MATT'S APPROVAL (2026-09-05).
-- §5.1 says an unattended spender tallies in `ingest_run`. It cannot:
-- `ingest_run.artifact_sha256` is NOT NULL UNIQUE, an on-demand fetch has no
-- artifact, and a synthetic hash would fight both the column's meaning and
-- its uniqueness -- while every existing reader of `ingest_run`, the admin
-- run history included, would start seeing rows that are not ingests.
-- §5.1 is amended in the same slice (Task 7).
--
-- 🔴 `records` IS WHAT THE VENDOR BILLED, NOT WHAT WE KEPT. Verified
-- 2026-09-03 by an isolated test: the meter moved 478 -> 489 on ONE call
-- returning 1 opportunity + 10 documents. A call returning ten documents of
-- which we store three still cost eleven. Recording rows kept would
-- undercount precisely where the meter surprises.
CREATE TABLE api_spend (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id       integer NOT NULL REFERENCES source(id),
  endpoint        text NOT NULL CHECK (endpoint IN ('opportunity', 'document')),
  records         integer NOT NULL CHECK (records >= 0),
  solicitation_id integer REFERENCES solicitation(id),
  called_at       timestamptz NOT NULL DEFAULT now()
);

-- The one query this table exists to answer, and the shape it must be fast
-- for: spend for one source since the start of the calendar month.
CREATE INDEX api_spend_source_month ON api_spend(source_id, called_at DESC);

COMMENT ON COLUMN api_spend.records IS
  'Records the VENDOR billed for this call, not rows we kept. A free source writes 0 -- the row still proves the call happened.';
