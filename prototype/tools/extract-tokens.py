import re, json, collections, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import os
# Paths are resolved relative to this script so the extraction is re-runnable
# from any working directory. BUNDLE is the CURRENT frozen export; when a new
# version lands, point it at the new file and re-run -- see
# docs/ClaudeDesign_Proto_Cleanup.md, "Re-extraction".
ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUNDLE = os.path.join(ROOT, "PROTOTYPE", "Tenderfoot UI Mockups V1,1.html")
TOKENS = os.path.join(ROOT, "PROTOTYPE", "src", "tokens.css")

html = open(BUNDLE, encoding="utf-8").read()
tpl = json.loads(re.search(r'<script type="__bundler/template">(.*?)</script>', html, re.S).group(1).strip())
defs, order = {}, []
for n, v in re.findall(r'(--[A-Za-z0-9_-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*[;}]', tpl):
    if n not in defs:
        defs[n] = v.lower()
        order.append(n)
uses = collections.Counter(re.findall(r'var\(\s*(--[A-Za-z0-9_-]+)', tpl))

NOTE_LABEL = (
    "ALL-CAPS mono microlabels: DEADLINE, EST. VALUE, key hints.\n"
    "     * The most-used text colour in the direction after --text-primary.\n"
    "     * Contrast on --ground-surface is ~2.6:1, BELOW WCAG AA for body text.\n"
    "     * It carries labels rather than prose, so this may be acceptable, but it\n"
    "     * is a decision and not a cleanup. Flagged, not changed."
)
NOTE_WATCH = (
    "a second caution hue, carried on status dots.\n"
    "     * Named for its job, not its hue -- a token called --yellow cannot be\n"
    "     * changed without lying. Whether the direction needs two caution hues is open."
)
NOTE_NEG = "negative. Overloaded -- see the note at the foot of this group."

GROUPS = [
 ("GROUND -- light backgrounds, ordered by depth", [
  ("--ground-surface",  "--surface",  "cards, panels, the raised plane. The default ground."),
  ("--ground-recess-1", "--surface3", "one step below the surface plane"),
  ("--ground-recess-2", "--surface2", "two steps below"),
  ("--ground-recess-3", "--surface4", "three steps below"),
  ("--ground-recess-4", "--surface5", "four steps below"),
  ("--ground-chip",     "--chip2",    "chip and tag fill"),
  ("--ground-chip-alt", "--chip",     "second chip fill"),
  ("--ground-canvas",   "--app",      "the page behind everything; the deepest ground"),
  ("--ground-hover",    "--hover",    "row and control hover. A state, not a depth."),
 ]),
 ("LINE -- borders and rules, faintest first", [
  ("--line-row",       "--brdrow",   "table row rules; the faintest division that still reads"),
  ("--line-soft",      "--brdsoft",  "internal panel divisions. The default soft rule."),
  ("--line-soft-alt",  "--brdsoft2", "second soft rule"),
  ("--line-mid",       "--brdmid",   "grid cell and section borders"),
  ("--line-card",      "--brd",      "card and panel outline. The default card border."),
  ("--line-control",   "--brdctl",   "buttons, inputs, selects. The default control border."),
  ("--line-control-2", "--brdctl2",  "second control border"),
  ("--line-control-3", "--brdctl3",  "third control border"),
  ("--line-control-4", "--brdctl4",  "fourth control border"),
  ("--line-dashed",    "--brddash",  "dashed affordance: empty states, add-new targets"),
  ("--line-dashed-2",  "--brddash2", "second dashed affordance"),
 ]),
 ("TEXT -- foreground on light ground, darkest first", [
  ("--text-primary",     "--text",   "body and headings. The default foreground."),
  ("--text-primary-2",   "--text2",  "second primary"),
  ("--text-secondary",   "--text3",  "supporting prose"),
  ("--text-secondary-2", "--text3b", "second supporting"),
  ("--text-tertiary",    "--text4",  "captions and secondary controls"),
  ("--text-muted",       "--text5",  "timestamps and de-emphasised metadata"),
  ("--text-faint",       "--text6",  "faint metadata"),
  ("--text-label",       "--text7",  NOTE_LABEL),
  ("--text-disabled",    "--text8",  "disabled and placeholder"),
 ]),
 ("INK -- dark inverted grounds: toasts, command bar, tour, dark modal", [
  ("--ink-surface",   "--ink",  "the inverted ground"),
  ("--ink-surface-2", "--ink2", "second inverted ground"),
  ("--ink-raised",    "--ink3", "controls sitting on ink (Show menu, UNDO)"),
  ("--ink-raised-2",  "--ink4", "second raised level on ink"),
  ("--ink-line",      "--ink5", "borders on ink (the ESC keycap)"),
  ("--ink-line-2",    "--ink6", "second border on ink"),
 ]),
 ("ON-INK -- foreground on the inverted ground, lightest first", [
  ("--on-ink-primary",   "--inktx5", "primary text on ink"),
  ("--on-ink-secondary", "--inktx4", "supporting text on ink"),
  ("--on-ink-tertiary",  "--inktx6", "tertiary text on ink"),
  ("--on-ink-muted",     "--inktx",  "muted text on ink"),
  ("--on-ink-faint",     "--inktx2", "faint text on ink"),
  ("--on-ink-disabled",  "--inktx3", "disabled text on ink (the version stamp)"),
 ]),
 ("ACCENT -- the brand hue, held constant across the bake-off (Proto2PRD 4.3.1)", [
  ("--accent",          "--acc",      "the brand teal."),
  ("--accent-line",     "--accbrd",   "border on accent-filled controls"),
  ("--accent-deep",     "--accdk",    "pressed / deepest accent"),
  ("--accent-bright",   "--accbrd2",  "brightest accent"),
  ("--accent-wash",     "--accbg",    "accent-tinted fill"),
  ("--accent-wash-2",   "--accbg2",   "second accent wash"),
  ("--accent-wash-3",   "--accbg3",   "third accent wash"),
  ("--accent-wash-4",   "--accbg4",   "fourth accent wash"),
  ("--accent-soft",     "--accsoft",  "accent at low saturation"),
  ("--accent-soft-2",   "--accsoft2", "second soft accent"),
  ("--accent-soft-3",   "--accsoft3", "third soft accent"),
  ("--on-accent-muted", "--accon",    "muted text on an accent fill"),
  ("--on-accent-2",     "--accon2",   "second text on accent"),
 ]),
 ("SIGNAL -- semantic. Kept separate from --accent by rule (Proto2PRD 4.5).", [
  ("--signal-pos",          "--ok",      "positive."),
  ("--signal-pos-wash",     "--okbg",    "positive fill"),
  ("--signal-caution",      "--warn",    "caution."),
  ("--signal-caution-text", "--warntx",  "caution, darkened for text contrast"),
  ("--signal-caution-wash", "--warnbg",  "caution fill"),
  ("--signal-caution-line", "--warnbrd", "caution border"),
  ("--signal-watch",        "--yellow",  NOTE_WATCH),
  ("--signal-neg",          "--bad",     NOTE_NEG),
  ("--signal-neg-deep",     "--baddk",   "negative, deepened"),
  ("--signal-neg-wash",     "--badbg",   "negative fill"),
  ("--signal-neg-wash-2",   "--badbg2",  "second negative fill"),
  ("--signal-neg-line",     "--badbrd",  "negative border"),
  ("--signal-neg-line-2",   "--badbrd2", "second negative border"),
 ]),
]

FOOTERS = {
 "LINE -- borders and rules, faintest first": '''  /* NEAR-DUPLICATES, MEASURED, NOT MERGED.
   * 90 pairs among these 67 colours sit below deltaE76 2.3 -- the classic
   * just-noticeable-difference threshold. Most are harmless: a background and a
   * border are allowed to share a value. The ones worth a decision are pairs
   * doing the SAME job at an indistinguishable distance, because there the
   * second value buys nothing and doubles what has to be maintained:
   *
   *   --line-soft    / --line-soft-alt        dE 0.35    #edf1f3 / #eef2f4
   *   --ground-recess-2 / --ground-recess-1   dE 0.36    #fafcfd / #fbfcfd
   *   --line-control-2  / --line-control-4    dE 0.69    #e2e8ec / #e2e7ea
   *   --ground-chip     / --ground-chip-alt   dE 0.84    #f3f6f7 / #f1f4f6
   *
   * And one that is arguably a defect rather than a redundancy:
   *   --ground-recess-3 / --ground-hover      dE 0.44    #f7f9fa / #f7fafb
   * A hover state a fifth of a JND away from a resting surface will not read as
   * feedback. Worth confirming against the running bundle before changing.
   *
   * NONE OF THESE ARE MERGED HERE. Merging changes what the direction looks
   * like, which makes it a design decision, and cleanup does not make those.
   * Same discipline as the radii. Handed back. */
''',
 "SIGNAL -- semantic. Kept separate from --accent by rule (Proto2PRD 4.5).": '''  /* --signal-neg IS OVERLOADED, and this is the note referred to above.
   * One value, three jobs, observed in the bundle:
   *   1. a data-quality flag  -- "DEADLINE DISAGREEMENT -- NOT RESOLVED"
   *   2. a destructive action -- "Delete view"
   *   3. a score or verdict   -- low fit, Pass
   *
   * These are not the same thing and they do not always co-occur. A record can
   * carry a deadline conflict while scoring well; a destructive button is not a
   * judgement about an opportunity. Rendering all three in the same red means
   * the interface cannot say "this is wrong" and "this is bad news" differently.
   *
   * This matters more here than it would elsewhere, because the whole system is
   * a judgement tool -- see docs/Proto2PRD.md 4.5, where the REASON outranks the
   * decision. A colour that conflates data integrity with a verdict undercuts
   * that.
   *
   * NOT SPLIT HERE. Splitting introduces a colour, which is a design decision.
   * Recorded so the choice is deliberate rather than inherited. */
''',
}

covered = [g for _, items in GROUPS for _, g, _ in items]
assert len(covered) == len(set(covered)), "duplicate generated name in the map"
missing = [n for n in order if n not in set(covered)]
extra = [n for n in covered if n not in defs]
assert not missing, "UNMAPPED tokens: %s" % missing
assert not extra, "map references tokens that do not exist: %s" % extra
print("OK: all %d generated tokens mapped exactly once, no extras." % len(order))

RADII = [
 ("--radius-mark",       "1px",  "the 8x8 inner square of a checked box"),
 ("--radius-bar",        "2px",  "progress bars and tour dots (16x3)"),
 ("--radius-micro",      "3px",  "score meters, keycaps, checkbox outer"),
 ("--radius-chip",       "4px",  "chips and tags"),
 ("--radius-control-sm", "5px",  "compact controls and inline callouts"),
 ("--radius-control",    "6px",  "controls and small cards"),
 ("--radius-button",     "7px",  "buttons, toolbars, toasts"),
 ("--radius-action",     "8px",  "primary actions (Interested / Pass), grid cells, alerts"),
 ("--radius-card",       "9px",  "cards and content panels"),
 ("--radius-panel",     "10px",  "outer containers"),
 ("--radius-modal",     "12px",  "modals and dialogs"),
 ("--radius-pill",      "20px",  "filter pills"),
]

HEAD = '''/* ============================================================================
 * Tenderfoot design tokens
 * ============================================================================
 * EXTRACTED FROM: prototype/PROTOTYPE/Tenderfoot UI Mockups V1,1.html
 * SUPERSEDES:     the V1 hand-extraction that previously lived in this file
 * PROCEDURE:      docs/ClaudeDesign_Proto_Cleanup.md, steps 3 and 4
 * GENERATED BY:   an extraction script, so every value below is read out of the
 *                 bundle rather than transcribed. The comments are hand-written;
 *                 they are the part the generator cannot produce.
 *
 * WHAT CHANGED FROM V1. V1 defined no custom properties at all -- every colour
 * was an inline hex literal, and this file was a hand-built token layer standing
 * in for one. V1.1 generated its own: 67 properties, 774 var() usages. That
 * closed the gap and made the hand-built layer obsolete as a source of VALUES.
 *
 * What it did not close is NAMING. The generated names are positional --
 * --acc, --brdctl4, --accbg2/3/4 -- which records that a value was added when
 * one was needed, not that a scale was designed. A positional name cannot tell
 * you whether a new component should use --brdctl2 or --brdctl3, because the
 * numbers do not mean anything.
 *
 * SO THIS FILE RENAMES AND DOES NOT RETINT. Every value is byte-identical to
 * V1.1. Names describe what each token was observed doing in the bundle -- which
 * CSS property it is assigned to, which elements carry it -- not the family
 * prefix it happened to be given. The direction belongs to whoever chose it;
 * cleanup never changes a colour.
 *
 * HOW TO USE IT. The role names hold the values. The compatibility block at the
 * foot maps every generated name onto its role name, so markup lifted out of the
 * frozen bundle keeps rendering unchanged. Write new code against role names.
 * When nothing references a generated name, delete that block in one step.
 *
 * PALETTE SOURCE: none. Proto2PRD 4.5 asks each token to name the element it was
 * sampled from, which applies only where a slot-4 palette source exists. These
 * came out of the generator, so the tokens record WHAT but not WHY, and the
 * do-not-revisit discipline has nothing to anchor to until a source is named.
 * ==========================================================================*/

:root {
'''

RADHEAD = '''  /* ---- RADII ------------------------------------------------------------
   * Twelve steps, adopted as-is on 2026-08-11. V1 used ten; V1.1 added a 2 and
   * a 12 rather than converging, which settled the question the other way: the
   * ramp is not noise. It tracks element size -- radius grows with the box.
   * An 8x8 mark takes 1px, a 22x22 checkbox 3px, a chip 4px, a button 7px,
   * a card 9px, a 540px modal 12px.
   *
   * Named for the element, so a new component picks its radius by asking what
   * it IS rather than how round it ought to look. That is the whole benefit of
   * keeping twelve: the scale is legible even though it is dense.
   * -------------------------------------------------------------------- */'''

TAIL = '''/* ============================================================================
 * COMPATIBILITY -- generated name -> role name
 * ============================================================================
 * The frozen V1.1 bundle refers to these 67 names 774 times. Aliasing rather
 * than rewriting keeps the bundle authoritative for the direction and this file
 * authoritative for naming, with no third state in which the two disagree.
 *
 * Temporary by design. Delete when nothing references a generated name.
 * ==========================================================================*/

:root {'''

out = []
w = out.append
w(HEAD)
for title, items in GROUPS:
    w("  /* ---- " + title + " " + "-" * max(3, 70 - len(title)) + " */")
    for role, gen, note in items:
        w("  %-25s %s;  /* %s" % (role + ":", defs[gen], note))
        n = uses.get(gen, 0)
        w("     * was %s, %d use%s in V1.1 */" % (gen, n, "" if n == 1 else "s"))
    w("")
    if title in FOOTERS:
        w(FOOTERS[title])

w(RADHEAD)
for name, val, note in RADII:
    w("  %-25s %-6s /* %s */" % (name + ":", val + ";", note))
w("  %-25s %-6s /* status dots and anything circular." % ("--radius-round:", "50%;"))
w("     * Not a step in the scale -- a separate primitive. */")
w("}")
w("")
w(TAIL)
for title, items in GROUPS:
    for role, gen, _ in items:
        w("  %-12s var(%s);" % (gen + ":", role))
w("}")
w("")

open(TOKENS, "w", encoding="utf-8").write("\n".join(out))
print("wrote tokens.css (%d lines)" % len(out))
