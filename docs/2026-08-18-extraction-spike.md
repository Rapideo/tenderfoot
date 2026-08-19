# Extraction spike — can Node parse the real corpus?

**Run 2026-08-18, on the ruling of the same day: measure before choosing a runtime.**
Harness and raw results in [`spikes/2026-08-18-extraction/`](spikes/2026-08-18-extraction/).

---

## The answer

**Node parsed everything. 172 parse attempts, 0 failures, 0 empty results.**

The claim the entire SP4 decision rested on — *"Node is the weakest major runtime
for this"* (`Stack-Requirements.md`) — **did not hold against a single file of the
real corpus.** It was never measured; it was inherited, and then treated as a
constraint for six days.

| Format | files | parsed | failed | empty | median | notes |
|---|---|---|---|---|---|---|
| `.docx` | 105 | 105 | 0 | 0 | 41 ms | `mammoth` |
| `.pdf` | 37 | 37 | 0 | 0 | 243 ms | `unpdf` (pdf.js) |
| `.xlsx` | 22 | 22 | 0 | 0 | 42 ms | SheetJS — ⚠️ see below |
| `.xls` | 6 | 6 | 0 | 0 | 9 ms | SheetJS, legacy binary |
| `.pptx` | 2 | 2 | 0 | 0 | 9 ms | ⚠️ hand-rolled, no library |
| `.zip` | 9 | 9 opened | 0 | — | — | 86 members reached |

**80.1 MB in 16.9 s — 4.8 MB/s.** Counts exceed the 96 files on disk because the
`docs.zip` bundles duplicate the loose files; both copies were parsed.

---

## What "parsed" was actually made to mean

**A parser that returns an empty string has "succeeded" by every signal except the
one that counts.** That is the same shape as the two defects found hours earlier the
same day, so success was not taken to mean *did not throw*.

**`.docx` was checked against independent ground truth.** For all 52 distinct files,
`mammoth`'s output was compared against every `<w:t>` run in the document's own XML
(body, headers and footers), which is where Word literally stores text:

| mammoth kept | files |
|---|---|
| ≥ 99% | 39 |
| ≥ 95% | 13 |
| < 95% | **0** |

**`.pdf` was checked page by page, not per file** — one scanned page inside a
40-page document is invisible in a whole-file average. **457 pages across 20 files:
zero pages with no extractable text.** Three pages under 100 characters, all section
dividers.

> **So there is no OCR requirement in this corpus — and that is a fact about the
> corpus, not a property of government documents.** It is federal + Indiana and
> entirely digital-native. The first scanned bundle needs OCR, and **no runtime
> choice avoids that**: it would be equally missing in Python. It is a smart-mode
> question, filed here so it is not discovered as a surprise.

---

## ⚠️ The real cost is supply chain, not parsing

**This is the finding that changes the decision, and no amount of arguing would have
produced it.**

**npm's `xlsx` is frozen at 0.18.5 with two high-severity advisories and
`No fix available`** — prototype pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS
(GHSA-5pgg-2g8v-p4x9). SheetJS **left npm**; current versions ship only from
`cdn.sheetjs.com`. So the Node spreadsheet story is: take a package with unfixable
published advisories, or take a dependency from outside the npm registry.

**It parses 28/28 spreadsheets flawlessly, including legacy `.xls` binary.** The
problem is not capability. **Python's `openpyxl` has no equivalent problem** — which
is the strongest surviving argument for the sidecar, and it is an argument about
provenance rather than parsing.

**`.pptx` has no maintained Node library.** The 2 results came from unzipping the
file and reading `<a:t>` runs out of the slide XML by hand — about ten lines, and it
worked, but it is **hand-rolled code where the other formats have libraries**, and
the corpus contains exactly **one** distinct `.pptx`. A sample of one.

---

## ⚠️ Two scanner bugs, both mine, both in this spike

**Recorded because the pattern has now appeared three times in one day, and it is
the same lesson `fonts.test.ts` taught on 08-17: a scanner is worth exactly what it
actually matches.**

1. **A `/message/` test matched the literal string `"no messages"`**, so the first
   report claimed *105/105 .docx produced mammoth warnings*. The true figure is
   **1 of 52**.
2. **A `<w:t[^>]*>` regex also matches `<w:tbl>`**, so it opened on table tags and
   captured raw XML markup as document text. It reported a 3.7 MB form holding
   10,675 characters of which mammoth returned only 568 — **an apparent 95% silent
   data loss, which does not exist.** Of those 10,675 characters, **10,161 were
   angle-bracket markup.**

**Settled by a third, independent method** (strip every tag, keep what remains):
514 characters, agreeing exactly with the strict scanner. **mammoth returned 568 —
it extracted everything.** The file is 3.7 MB because it embeds **6.9 MB of
obfuscated fonts** (`word/fonts/*.odttf`) and contains no images at all.

> **The size heuristic was discarded as a result.** All three of its "thin" flags
> were false alarms caused by file weight that had nothing to do with text. Every
> conclusion above rests on ground-truth comparison or per-page counting instead.
> **A heuristic that flags by size cannot tell a font-heavy file from a lossy
> parser**, and had the same document been 100 KB it would have been graded fine.

---

## Known limits of this spike

- **`.docx` is the only format checked against ground truth.** PDF is checked for
  per-page emptiness; spreadsheets and `.pptx` are checked only for *plausible
  output*. A spreadsheet silently dropping one sheet would not have been caught.
- **Nested `.zip` at depth 2 was not traversed.** One member
  (`Att L - Bidders Library.zip`, inside `docs.zip`) was skipped by the harness; its
  single `.docx` was reached anyway through the loose copy on disk, so nothing went
  unmeasured — but **the recursion gap is real and a bundle that only ships the
  nested copy would lose it.**
- **Formatting is not text.** Every measurement here is about *characters
  recovered*. Whether tables keep their structure — which matters for a cost
  proposal — is untested.
- **One corpus, one day.** Federal and Indiana, no scans, one `.pptx`.

---

## Recommendation — Matt's to rule

**Node libraries throughout**, on the measurement rather than on the reputation, with
the spreadsheet dependency decided deliberately rather than inherited:

1. **`.docx` / `.pdf` — settled.** `mammoth` and `unpdf` cleared the corpus with
   verified fidelity. No sidecar is justified for the two formats that carry the
   scope of work.
2. **Spreadsheets — choose the dependency consciously.** Pin SheetJS from
   `cdn.sheetjs.com` rather than accept a package with unfixable advisories in a
   public repo. **This, not parsing capability, is the live argument for a Python
   sidecar** — and it is worth deciding on its own terms.
3. **Smart mode stays available and unbuilt**, per the modes design, with the data
   recording which mode produced each field. **The corpus gave it nothing to fix**,
   which is the honest reason not to build it yet.

⚠️ **What this does NOT rule.** Node clearing *this* corpus rules Node in for *these
files*. §8.4 still holds — with no scores in V1, extraction accuracy is the only
thing the system can be right or wrong about — so the correct posture is to re-run
this harness against the first bundle that looks unlike the corpus, not to close the
question.
