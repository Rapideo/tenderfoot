# Claude Design → prototype cleanup

**Written:** 2026-08-10 · Companion to `Proto2PRD.md` §4.3.2
**Applies when:** a bake-off direction was generated in Claude Design and now has to become a specification-grade prototype in the repo.

---

## Why this exists

`Proto2PRD.md` §4.3.2 records the fork: **Claude Design buys you the direction, not the specification.** This document is the far side of that handoff — the procedure that turns a generated bundle into something production can be built from.

Run it once per direction, after selection, before build-out.

**The one-line summary:** the generator produces excellent *data* and no *rules*. The cleanup adds the rules, names the colours, and leaves the design alone.

---

## What a Claude Design export actually is

A single HTML file, typically 500KB–1MB, that is **not** the page you see. It is a bundler envelope:

| Part | What it holds |
|---|---|
| `<script type="__bundler/manifest">` | JSON map of `uuid → {mime, compressed, data}`; `data` is base64 of gzip |
| `<script type="__bundler/ext_resources">` | CDN dependencies, vendored by uuid (e.g. React UMD) |
| `<script type="__bundler/template">` | **JSON-encoded string** containing the real document |
| `<script type="__bundler/page_order">` | Page ordering; often `[]` |
| `#__bundler_thumbnail` | An inline SVG preview shown before boot |

Inside the decoded template:

- an `<x-dc>` root and a `<helmet>` block with `@font-face` rules whose `src` are **uuid references**, resolved at runtime from the manifest
- the rendered markup, with styling as **inline `style=` attributes**
- a `<script type="text/x-dc" data-props="...">` — the DSL script, holding **the seed data and the logic**, plus a props schema describing the editable knobs

> **Read the `text/x-dc` script before judging the artifact.** Counting `style=` and `class=` attributes in the markup tells you nothing about whether a mock layer exists — the data lives in the DSL script. This mistake was made on Tenderfoot and recorded in Proto2PRD §4.3.2.1.

---

## The procedure

### 0. Commit the bundle unmodified, first

Before touching anything. It is the record of what the direction looked like before anyone cleaned it up, and it is the only artifact that can be diffed against a later re-export.

**Never edit the bundle in place.** Its template is a JSON string inside a `<script>` tag; edits are possible and pointless, because a re-export from the design tool discards them. Treat it as a frozen source artifact and extract *out* of it.

### 1. Decode

```python
tpl = json.loads(re.search(r'<script type="__bundler/template">(.*?)</script>', html, re.S).group(1).strip())
xdc = re.search(r'<script type="text/x-dc"[^>]*>(.*?)</script>', tpl, re.S).group(1)
```

Decompress manifest entries with `gzip.decompress(base64.b64decode(entry["data"]))` when `compressed` is set. Expect fonts as `woff2` entries — they are bundled, which is good, though a `fonts.googleapis.com` preconnect often survives alongside them and should go.

### 2. Lift the seed data into a real mock layer

This is the highest-value step and the reason the cleanup pays.

Pull each top-level `const NAME = [...]` out of the DSL script and rebuild them per `Proto2PRD.md` §4.1.1: an IIFE, a single `window.NAMESPACE`, the data verbatim.

**Then write the comments, because the generator wrote none.** This is the actual work, and it cannot be automated:

- Every non-obvious field gets a comment saying **which rule it enforces and where that rule is written down** (`§6.2`, a findings document, a decision log).
- Every field that exists because of a *real-world failure* says so. A generator can produce a `conflict` field if asked; it cannot know the field exists because a real bundle shipped two deadlines and the wrong one would have killed the best opportunity three weeks early. That sentence is what production gets built from.
- Every **invented vocabulary** is marked provisional. Reason chips, status enums, and category lists produced by a generator are plausible rather than derived, and plausible taxonomies are sticky — they get built before anyone notices nobody chose them.
- Every **contradiction with the spec** gets flagged rather than silently fixed. On Tenderfoot the generated chip list included a capacity reason in a system the spec makes capacity-agnostic. Fixing it quietly would have hidden a real disagreement; flagging it forces the choice.
- **Presentation leaking into data** gets a schema note. Stored colours (`deadlineColor`) should be derived at render time. Leave the value, flag it, decide before it becomes a migration.

Since the production data model is *this dataset normalized* (§4.1.1), a field here is a schema decision. Comment accordingly.

### 3. Name the colours

Extract every hex literal, count occurrences, and write a token file. Expect 40–60 distinct values from a generated direction.

Group by **role, not by hue**: accent, semantic (verdict/health — always separate from the accent), ink ramp, surfaces, borders. A hex used 88 times is carrying meaning that the literal does not record.

**Extraction only. Do not change a colour.** The direction belongs to whoever chose it.

§4.5 also wants each token to name the element it was sampled from. That only applies when a slot-4 palette source exists; where the palette came out of the generator rather than a measured artifact, **say so in the file** — the tokens then record *what* but not *why*, and the not-revisiting discipline has nothing to anchor to until a source is named.

### 4. Tokenise the radii — but do not collapse them

Generated directions do not use a scale. Tenderfoot's had **ten values**: 1/3/4/5/6/7/8/9/10/20px.

Tokenise them **as they are**, and write the proposed scale into a comment. Collapsing radii visibly changes the design, which makes it a design decision and not a cleanup. Hand it back.

### 5. Sweep the small things

- Drop CDN preconnects for assets that are bundled.
- Check for screens rendered that the outline marked **deferred** — a mockup showing a feature is fine, but it should not read as in scope. Note it rather than deleting it.
- Confirm the losing directions are committed to `archive/` before promoting the winner (§4.4). If the bake-off ran outside the repo, this is the moment they get imported, and the moment they are easiest to lose.

---

## What this procedure does **not** do

**It does not rewrite the rendering.** The markup depends on the `x-dc` runtime for asset resolution and logic; converting it to static HTML is a rebuild, not an extraction, and it risks losing fidelity to the direction that was just chosen. The bundle still renders for review.

Whether the rendering layer eventually gets rebuilt in the repo is a build-out decision, not a cleanup one. Cleanup delivers **the tokens and the mock layer** — the two things production actually inherits.

---

## Cost, measured on Tenderfoot

One direction, 401-line bundle, 114KB decoded template, 692-line DSL script.

| Step | Effort |
|---|---|
| Decode and inspect | Minutes, scripted |
| Lift seed data → `app.js` | Minutes to move; **the comments are the real work** |
| Palette → `tokens.css` | Minutes, mechanical |
| Radii | Minutes, plus a decision handed back |
| Rendering layer | **Not attempted** |

Output: `src/app.js` (482 lines, 5 opportunity records with cited scores, gate reasons, a modelled deadline conflict) and `src/tokens.css` (59 colours named by role).

**The honest verdict on the fork.** Generation was fast and the coverage was startling — a working prototype off an outline, carrying decisions made hours earlier. Cleanup was cheap for tokens and data, and the expensive part was writing down rules that were never in the artifact to begin with. **Those rules would have had to be written either way** — building in the repo from the start does not avoid them, it just writes them earlier and interleaved with the design.

So on this evidence the fork holds. Worth re-measuring on a project where the bake-off runs three directions rather than one, since that is where generation should pay most and where the archiving discipline is most at risk.

---

## Re-extraction: the cost this procedure actually carries

**Measured the same evening.** V1.1 of the Tenderfoot prototype arrived hours after V1 was extracted, and moved underneath it. That is not a mishap — **it is the steady state.** Any iteration in the design tool invalidates the extraction, so plan for the procedure to run every round rather than once.

What changed between two versions a few hours apart: template 114 KB → 160 KB, DSL 44.8 KB → 70 KB, a new top-level data structure, **and 67 CSS custom properties where there had been none.**

Three lessons, and the third is the important one.

**1. The generator will close the mechanical gaps by itself, given another pass.** The token layer that step 3 of this procedure creates by hand appeared in V1.1 unprompted — 67 tokens, 774 `var()` usages. So hand-tokenising an early version can be wasted work. **If more iterations are expected, defer step 3** and keep only the naming proposal, since generated token names tend to be positional (`--acc`, `--brdctl4`, `--accbg2/3/4`) where a human names by role.

**2. It will not fix what it cannot know.** The radius count went *up*, 10 values to 12. Nothing that requires a decision gets decided by iterating.

**3. Comments never regenerate, and they are the only thing that must survive.** V1.1's DSL was 25 KB larger and still carried **zero comments**. A generator produces better data every round and never produces a rule, because rules are facts about why a field exists — a real bundle shipped two deadlines, a spec section forbids a category, a chip contradicts a stated non-goal. **So re-extraction is not re-running the script. It is diffing the new data against the old, then carrying the previous round's comments forward onto shapes that may have moved.**

That reframes the procedure. Steps 3 and 4 are provisional and may be worth skipping while iteration continues. **Step 2 is the durable one**, and its comment block is the only artifact in the whole cleanup that accumulates value rather than being replaced.

**Practical consequence for step 0:** keep every version, not just the current one. The diff between them is what tells you which comments still apply.
