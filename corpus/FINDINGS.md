# Corpus findings — what real documents taught us

**From:** band A document pull, 2026-08-04
**Holdings:** 8 Indiana bundles (~100 files), 2 federal notices, all extracted and readable

Every finding below came from real documents inside the first hour. None of them would have
appeared in invented sample data. This is the case for §4.1.1's realistic-data rule, made
concrete.

---

## 1. The deadline discrepancy — and why it is a live danger

**The single most important finding here.**

The FSSA *External Quality Reviews for MCO Programs* RFP (26-87847, event `005030000087847`) —
the closest thing to a bullseye in the whole corpus — ships a bundle containing **three
boilerplate PDFs with two different submission deadlines**:

| File in the bundle | Submission due date |
|---|---|
| `RFP Boilerplate Document.pdf` | August 26, 2026 |
| **`RFP Boilerplate Document 2.pdf`** | **September 17, 2026** ← correct |
| `RFP26-87847 Boilerplate Document.pdf` | August 26, 2026 |

The portal listing metadata says **09/17**. So the *correct* date lives in the file with the
**least specific name**, and the file named with the actual solicitation number carries the
**stale** date.

Every obvious heuristic picks wrong:

- "Prefer the file whose name matches the solicitation number" → **wrong**
- "Take the first PDF alphabetically" → **wrong**
- "Take the most specifically-named document" → **wrong**

### Why this is not merely annoying

§6.1 Stage 0 includes a deterministic hard gate for **deadline passed**. Fed the extracted date
of August 26, that gate would **silently eliminate KP's single best-fit opportunity on August
27 — three weeks before it actually closes.**

That is precisely the silent-recall failure the system exists to prevent, and it is no longer
hypothetical. It is a documented instance, in the first bundle examined, on the best-matching
solicitation in the corpus.

Two design consequences:

1. **Listing metadata outranks document text for dates.** The portal's structured field was
   right; all three documents were unreliable. This precedence rule is not currently stated in
   the spec and should be.
2. **§6.2's "gated items are filed, not deleted" is load-bearing, not a nicety.** It is the only
   thing that makes this failure recoverable. A rejection you cannot inspect is a bug you will
   never find.

### What the built extractor actually does with this bundle — measured 2026-08-30

**SP4 shipped, so this finding now has an outcome rather than a prediction.** Run against these
three PDFs, the mechanical extractor states `2026-09-17` and nothing else. It never produces the
stale 26 August at all.

**That is the right answer reached by the wrong route, and the distinction matters.** The
extractor is not preferring the correct date over the stale one — it cannot see the stale one.
The cover pages read:

```
Submission Due Date and Time:
August 26, 2026
```

Cue and date on **different lines**. `fields.ts` clamps its lookback at a block boundary, so the
cue falls outside the window and the date is never classified. The schedule tables read
`Submission Due Date/Time September 17, 2026` on **one** line, which is why 17 September *is*
found. So the system is safe here **by accident**, and the day that clamp is relaxed — a
natural-looking improvement — these documents begin stating 26 August and the precedence rule in
consequence 1 becomes load-bearing for real.

**Which is why the regression test is in two parts** (`app/server/src/extract/seam.test.ts`): one
over these real files asserting only what must always hold — the listing wins, and the stale date
really is in the bundle — and a separate one pinning precedence with the documented values fed in
directly, where no change to `fields.ts` can quietly empty it out. Deliberately **not** pinned:
the absence of a conflict. That is today's accident, and pinning an accident makes a future
improvement look like a regression.

**Consequence 1 is now in the spec**, as this document asked: `specs/2026-08-28-sp4-fetch-extraction-design.md`
§6. Consequence 2 is built — `resolveField` keeps the losing rows with their quotes — but ⚠️ **nothing
in the product displays them**, because the record view belongs to SP6. The mechanism is tested
and has never been seen by a person.

---

### The addendum does not save you

`RFP26-87847 Addendum 1.docx` exists and enumerates its own changes — edits to Attachment I,
and rewrites of Sections 1.1 and 1.3. **It says nothing about moving the deadline.**

So change detection cannot rely on an addendum's self-description. **It has to diff.**

The addendum also quietly renames the solicitation from *External Quality Reviews for **MCO**
Programs* to *External Quality Reviews for **MCR MCO** Programs* — a title change mid-flight,
which the Sighting/canonical-record model (§4.4) has to absorb without spawning a duplicate.

---

## 2. Bundle anatomy — what "the document" actually means

There is no such thing as *the* RFP file. The EQR bundle holds **22 files**; Community Supports
IT Systems holds 19, including a nested `Att L - Bidders Library.zip`.

A representative Indiana bundle:

| Kind | Files |
|---|---|
| Main RFP / boilerplate | 1–3 PDFs *(see finding 1)* |
| Scope of work | `Att K` — sometimes `.docx`, sometimes `.pdf` |
| Proposal templates | Business, Technical, Cost — `.docx` and `.xlsx` |
| Terms | Sample Contract, IaaS/PaaS/SaaS terms, HIPAA agreement |
| Forms | IVOSB participation, Economic Impact, Reference Check, Attestation, Q&A template |
| Extras | Pre-proposal conference `.pptx`, addenda, infrastructure overview |

**Implications for the fetch pipeline (2H) and extraction (2I):**

- Formats span `.pdf`, `.docx`, `.xlsx`, `.xls`, `.pptx`, and nested `.zip`. PDF-only extraction
  covers maybe half of what matters — and the **scope of work**, the single most important
  document for fit scoring, is a `.docx` in the EQR bundle.
- Bundles run to 21 MB (Community Supports IT Systems). §5.3's *fetch depth follows score* is a
  cost control, not an elegance.
- The cost-to-pursue ingredients (§6.3) are **directly countable** here: number of required
  forms, presence of a mandatory pre-proposal conference, reference count, notarization. The
  fact panel can be populated mechanically.

---

## 3. Every Indiana bundle now carries AI-governance requirements

Seven of eight band A bundles include an `Artificial Intelligence — Technical Proposal
Questions.docx`. It is boilerplate across unrelated agencies — Education, FSSA, Criminal Justice
Institute, IDOA.

KP lists **AI governance** as a service line. A recurring, standardized AI-requirements
attachment across an entire state's procurements is both a **fit signal** worth detecting and a
possible **positioning advantage**. ~~Worth a look during the hand-run.~~ The hand-run is
retired (plan of action §A2); this now belongs to whoever reads the first real ingest.

---

## 4. Federal RFIs are a different document class

Both federal band A entries are pre-solicitation: a **Sources Sought** (IHS) and an **RFI**
(FHWA). The FHWA notice states it plainly:

> "This is NOT a solicitation for proposals, proposal abstracts, or quotations. FHWA is
> conducting market research to identify potential sources for a series of anticipated
> contracts/task order awards."

These are **lead-time signals, not biddable work** — the pre-RFP layer §4.6 is built around.
They should score as high-timing-value intelligence, not as opportunities to pursue, and the
Pursuit lifecycle needs a state for *responded to an RFI* that is not *bid*.

Attachments are two API hops: `/opportunities/{uuid}/resources` for the manifest, then
`/opportunities/resources/files/{resourceId}/download` per file. Both work without credentials.

---

## 5. Smaller mechanics, recorded so they are not rediscovered

- **Not every event has documents.** Two band A events shipped a single flat PDF with no bundle;
  three Indiana events in the wider list link no documents at all.
- **Timezone labels are unreliable.** Indiana's listing says `EST` for August dates; the
  documents say `ET`. The state is on EDT in August. Prefer the document's `ET` or normalize
  from the jurisdiction.
- **File names cannot be trusted as identifiers.** Two bundles name their main document by event
  ID (`007000000087845.pdf`); others use free text. Both patterns appear in the same portal.
- **Q&A deadlines are separate and earlier.** EQR: questions due Aug 5, proposals Sept 17 — a
  six-week gap. The earlier date is often the one that actually forecloses a real bid, since
  clarification is impossible after it.

---

## What to do about it

| # | Finding | Change |
|---|---|---|
| 1 | Deadline discrepancy | Add an extraction precedence rule to §5.3: **listing metadata outranks document text for dates.** Flag disagreement rather than silently choosing. |
| 1 | Stale-date hard gate | ~~Confirm §6.2's file-don't-delete rule is implemented from the first gate~~ — **no gate in V1** (spec §1.1), so there is nothing to file and the drawer that would have caught this is parked (SVRC 1.1.5). **The bundle still ships two deadlines, so the risk is undiminished and now rests entirely on flagging the disagreement (finding 1 above).** Reinstate the moment anything gates. **Still make the deadline seam test (SP4) use this exact bundle** — that part gets *more* important, not less. |
| 1 | Addendum self-description | Change detection diffs documents; it never trusts a summary-of-changes. |
| 2 | Multi-format bundles | Extraction must handle `.docx` and `.xlsx` from day one, not as a follow-up. The SOW is often `.docx`. |
| 4 | RFIs are not bids | Pursuit needs a non-bid response state; RFIs score as lead-time signal. |

**This bundle is now the canonical fixture for the SP4 extraction seam test.** It is a real
document set with a known-correct answer and three plausible wrong ones.
