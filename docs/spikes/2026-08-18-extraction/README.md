# Extraction spike harness — 2026-08-18

Findings: [`../../2026-08-18-extraction-spike.md`](../../2026-08-18-extraction-spike.md).

**This is a spike, not product code.** It is committed because the SP4 runtime
ruling rests on its numbers, and a measurement nobody can re-run is an assertion.
It is deliberately **outside the workspaces and outside `npm run check`** — no test
covers it, and nothing in `app/` imports it.

## Running it

The dependencies are installed **here**, not in the root `package.json`, on purpose:
installing parsers into the project would pre-commit the repo to Node before the
ruling that this spike exists to inform.

```bash
cd docs/spikes/2026-08-18-extraction
npm install                 # mammoth, xlsx, adm-zip, unpdf
node run.mjs > results.json # walks ../../../corpus, ~17s
node report.mjs             # summary by format, every non-ok result
node docx-audit.mjs         # .docx vs <w:t> ground truth  <-- the load-bearing one
node pdf-audit.mjs          # per-page scan detection
node settle.mjs             # resolves the two scanners that disagreed
```

`results.json` is the committed output of the run described in the findings, so
`report.mjs` can be read without re-running anything.

⚠️ Paths to `corpus/` are absolute in these scripts. They were written to answer one
question on one machine and are not hardened.

## What each script is for

| Script | Question it answers |
|---|---|
| `run.mjs` | Does every corpus file parse at all, and how fast? |
| `report.mjs` | Summarised by format, with every non-`ok` result listed individually |
| `docx-audit.mjs` | **Does mammoth actually return the text the XML contains?** Compares against every `<w:t>` run rather than trusting the absence of an error |
| `pdf-audit.mjs` | Is any page a scan? Counted **per page** — one scanned page in a 40-page file is invisible in a file-level average |
| `settle.mjs` | Two of the above disagreed about one file. This settles it with a third independent method |

## Read this before trusting the numbers

`run.mjs` grades files with a **chars-per-byte heuristic** that produced **three
false alarms and zero true ones**, because file size is dominated by embedded fonts
and images rather than text. **The heuristic is retained in the code only so the
committed `results.json` reproduces**; every conclusion in the findings comes from
`docx-audit.mjs` and `pdf-audit.mjs` instead, which compare against ground truth and
count per page.

Two scanner bugs found in this spike — both in the spike's own code, both caught only
by a second measurement — are written up in the findings under *"Two scanner bugs,
both mine"*. They are the reason the heuristic was discarded rather than tuned.
