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
- ~~**Formatting is not text.** Whether tables keep their structure is untested.~~
  ✅ **Answered by part two below (2026-08-19)** — and the answer was not the one
  the limit implied: `.docx` tables survive completely, `.xlsx` structure is native,
  and the real hazards turned out to be phantom rows and cached formula values
  rather than lost structure.
- **One corpus, one day.** Federal and Indiana, no scans, one `.pptx`.

---

## Part two, 2026-08-19 — does STRUCTURE survive?

**Part one answered "how many characters came back". For the documents that decide a
bid that is the right answer to the wrong question:** a cost proposal's meaning is
*which number sits in which row and column*, and a parser can recover every character
while destroying all of it. This was listed as a known limit; here it is measured.

**The structure-critical documents in this corpus are `.xlsx` and `.docx`, not `.pdf`.**
All three cost proposals are `.xlsx`; the technical and business proposals are `.docx`.
The PDFs are narrative RFP text, where flat text is the correct output.

### `.docx` tables survive completely

| | tables | rows | cells |
|---|---|---|---|
| XML declares (`<w:tbl>`/`<w:tr>`/`<w:tc>`) | 244 | 758 | 1651 |
| mammoth HTML (`<table>`/`<tr>`/`<td>`) | **244** | **758** | 1587 |

**The 64-cell gap is not loss, and checking that mattered.** It occurs in four files —
the same IVOSB form appearing in four bundles. On that file the gap is **16 cells and
there are exactly 16 vertical-merge *continuation* cells** (`<w:vMerge>` without
`restart`). Those are not separate cells; they are the lower half of a merged one, and
HTML represents them with `rowspan` on the first — mammoth emits **12 `rowspan` and 8
`colspan`** on that document. Text fidelity on it is **100%**.

> Use `convertToHtml`, not `extractRawText`, wherever structure matters.
> `extractRawText` flattens tables **by design** — it is not losing anything, it is
> answering a different question, and SP4 must ask the right one per field.

### `.xlsx` — two traps, and neither is about Node

**1. Declared dimensions are fiction: 89–99% phantom rows.**

| sheet | declared `!ref` | `sheet_to_json` rows | last row with data | noise |
|---|---|---|---|---|
| `1. Title` | `A1:Z1000` | 1000 | 14 | **99%** |
| `2. Cost Summary` | `A1:AA1002` | 1002 | 18 | **98%** |
| `3. Staff Rates` | `A1:AT991` | 991 | 62 | **94%** |
| `Cost Proposal` | `A1:Z1004` | 1004 | 27 | **97%** |

Naive extraction of a cost proposal yields **~1,000 empty rows per sheet**. SP4 must
compute the populated range, never trust `!ref`.

**2. ⚠️ SheetJS does not EVALUATE formulas — it replays whatever Excel last cached.**

Proved by round-trip rather than assumed: a formula written with **no** cached value
reads back as `v=undefined, f=undefined`. Every formula in the real corpus does carry
a cached value, so today this is invisible — **and that is exactly what makes it
dangerous.** A submitted workbook saved by a tool that did not recalculate yields a
**stale total with no signal that it is stale**, and the totals are the numbers that
decide the bid. These sheets are formula-dense: one has **587 formulas**, and they
reference across sheets (`'5. Transition'!H18`), so citing "the total" means citing a
chain.

> **This is a property of reading a spreadsheet file rather than running Excel, and is
> almost certainly true of `openpyxl` too — but that was NOT measured here**, and after
> what part one found about inherited claims, it is not going to be asserted.

### `.pdf` — the format has no table structure to preserve

`extractText` returns a flat string: rows and columns are gone. **All 20 PDFs carry
per-item x/y geometry** (`transform`, `width`), so reconstruction is *possible* — it is
simply **not provided**, and would be ours to build.

> **Python's `pdfplumber` / `camelot` do offer table extraction and Node has no
> equivalent of comparable maturity.** ⚠️ **Unmeasured** — stated as the reason to
> measure it *if* PDF tables ever land on the critical path. They are not on it now:
> the documents where structure decides the bid are `.xlsx` and `.docx`.

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

**Part two adds no runtime argument — it adds three extraction-design requirements**,
which hold whichever runtime is chosen: use `convertToHtml` where structure matters,
compute the populated range instead of trusting `!ref`, and **record that a spreadsheet
total is a cached value rather than a computed one**, because a stale cache is
indistinguishable from a fresh one and §8.4 makes that the only thing V1 can be wrong
about.

⚠️ **What this does NOT rule.** Node clearing *this* corpus rules Node in for *these
files*. §8.4 still holds — with no scores in V1, extraction accuracy is the only
thing the system can be right or wrong about — so the correct posture is to re-run
this harness against the first bundle that looks unlike the corpus, not to close the
question.
