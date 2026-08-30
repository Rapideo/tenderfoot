-- WE ASKED, AND THE ANSWER WAS NOTHING. That is a fact, and until now there
-- was nowhere to put it.
--
-- Discover's candidate query retires a solicitation exactly one way: by the
-- existence of a `document` row. A SAM.gov notice that legitimately carries
-- no attachments therefore never leaves the candidate window -- it has no
-- documents, so it qualifies again on the very next run, forever, and
-- discovery cannot advance past it. With the screen's `?limit=10`, ten
-- attachment-less notices at the head of the queue are enough to stall the
-- phase completely: every click re-issues the same ten HTTP requests to
-- SAM.gov and reports `documents: 0`.
--
-- This is not hypothetical. The 2026-08-30 browser click-through reported
-- exactly that -- "0 document(s) from 10 solicitation(s), 0 skipped" -- and
-- it was read at the time as the benign case (those notices have no files)
-- when it was ALSO the stuck case. `skipped: 0` proved the requests
-- succeeded; nothing proved discovery could ever move on.
--
-- WHY A COLUMN RATHER THAN A PREDICATE OVER EXISTING ROWS. The obvious
-- cheap fix is to retire a notice once `extracted_field` holds its listing
-- rows, since discover writes those for every candidate it walks. That is
-- wrong in a way that costs data: `writeListingRows` runs BEFORE the fetch,
-- so a notice whose attachment request merely FAILED -- a timeout, a 502,
-- the network -- would be retired as though it had been asked and answered.
-- A transient failure would permanently hide a solicitation's attachments.
--
-- So the fact recorded here is narrower and true: the moment SAM.gov
-- successfully answered "what is attached to this notice". It is stamped
-- only on a successful response, so a failed ask leaves it NULL and the
-- notice is asked again.
ALTER TABLE solicitation ADD COLUMN attachments_checked_at timestamptz;

-- The candidate query reads this on every run, alongside the source filter
-- migration 010 added.
CREATE INDEX solicitation_attachments_checked
  ON solicitation(source_id, attachments_checked_at);

-- ---------------------------------------------------------------------------
-- A BUNDLE'S MEMBERS ARE INSERTED BEFORE THE BUNDLE IS MARKED DONE, and that
-- ordering is deliberate (D9): a run killed mid-expansion leaves the parent
-- `pending` so the next run redoes it, rather than marking the bundle done
-- and stranding the members it had not written yet.
--
-- The cost of that choice is a second copy. A PLATFORM kill inside one large
-- bundle -- the case a time budget cannot cover, because the clock is only
-- checked BETWEEN documents -- leaves N members already inserted under a
-- parent that is still `pending`. The next run re-fetches, re-parses, and
-- inserts every member a second time; the first-attempt copies then fail
-- separately with "no source_url", which reads like a defect in the members
-- rather than the duplicate they are.
--
-- Nothing in the schema prevented it. This does. Partial, because
-- `parent_document_id` is NULL for every top-level document and several of
-- those legitimately share a filename -- two solicitations may each ship a
-- `Wage Determination.pdf`, and they are different documents.
CREATE UNIQUE INDEX document_member_unique
  ON document(parent_document_id, filename)
  WHERE parent_document_id IS NOT NULL;
