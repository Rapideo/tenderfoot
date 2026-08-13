import re, json, collections, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import os
# Paths are resolved relative to this script so the extraction is re-runnable
# from any working directory. BUNDLE is the CURRENT frozen export; when a new
# version lands, point it at the new file and re-run -- see
# docs/ClaudeDesign_Proto_Cleanup.md, "Re-extraction". Mirrors extract-tokens.py.
ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUNDLE = os.path.join(ROOT, "PROTOTYPE", "Tenderfoot UI Mockups V1.2.html")
TYPE   = os.path.join(ROOT, "PROTOTYPE", "src", "type.css")

html = open(BUNDLE, encoding="utf-8").read()

# The version label is DERIVED from the bundle filename, never hardcoded --
# same discipline as extract-tokens.py, added there on 2026-08-13 after the
# header kept claiming "in V1.1" while the script counted V1.2. Hardcoding a
# version is how a comment outlives the thing it describes.
VERSION = re.sub(r"^Tenderfoot UI Mockups |\.html$", "", os.path.basename(BUNDLE)).replace(",", ".") or "unversioned"

tpl = json.loads(re.search(r'<script type="__bundler/template">(.*?)</script>', html, re.S).group(1).strip())

# ---- FONT SHORTHANDS --------------------------------------------------------
# The brief's illustrative regex for this step omits a leading "-", which
# misses every negative letter-spacing value (see TRACKING below). The font
# shorthand has no such gap: every raw "font:" occurrence in the bundle
# matches this pattern except one, "font:inherit" (a reset on native
# controls, not a type declaration), confirmed by diffing the full set of
# `font:[^;"]*` substrings against this regex before writing this table.
FONT_RE = re.compile(r"font:\s*(\d+)\s+([\d.]+)px/([\d.]+)\s+'([^']+)'")
font_uses = collections.Counter(FONT_RE.findall(tpl))

# ---- LETTER-SPACING ----------------------------------------------------------
# The brief specifies `letter-spacing:\s*([\d.]+em)` -- no leading "-". Run
# literally, that pattern finds 7 distinct values (67 uses) and was the
# source of the brief's "7 distinct letter-spacing values" framing. Checked
# against the bundle directly: `letter-spacing:[^;"]*` has 72 raw
# occurrences, all 72 matching `-?[\d.]+em`, not 67. The positive-only
# pattern silently drops 3 distinct values -- -.01em, -.012em, -.02em (5
# uses) -- all of them optical kerning on the largest headings and the
# hero counter (cur.title, ent.name, the 64px queue-cleared "0"). That is
# exactly the "looks complete, isn't" shape Ruling 1 warns about: a pattern
# that matches cleanly and quietly omits real declarations. Extracting here
# with the leading "-" included is a deliberate, documented deviation from
# the brief's illustrative regex, in service of the fidelity mandate the
# brief itself states outranks everything else. See task-1-report.md for
# the count reconciliation (7 vs. 10).
TRACK_RE = re.compile(r"letter-spacing:\s*(-?[\d.]+)em")
track_uses = collections.Counter(TRACK_RE.findall(tpl))

# ============================================================================
# NAMING. Every key below is a (weight, size, line-height, family) tuple read
# out of the bundle. Names are assigned by ROLE -- what the declaration is
# doing where it appears, established by reading its surrounding markup, not
# by a positional index. Where several distinct declarations serve
# recognizably the same job at different exact metrics (e.g. two "microlabel"
# treatments, or a heading at three leadings), the family name repeats with a
# distinguishing suffix -- same convention as tokens.css's --ground-recess-1..4
# and --line-control-2/3/4: the role is the name, the suffix is position
# within it, and every one of the 88 distinct declarations below still gets
# its own custom property. NONE ARE MERGED. Two declarations 0.5px apart that
# read as "the same size" to the eye are not the same CSS value, and pixel
# parity is what this whole layer exists to protect.
# ============================================================================

GROUPS = [
 ("DISPLAY & HERO METRICS -- the largest figures in the direction", [
  ("--type-display",            "600", "64",   "1",    "IBM Plex Mono", "the queue-cleared hero counter -- the only display-scale figure in the direction"),
  ("--type-metric-hero",        "600", "34",   "1",    "IBM Plex Mono", "the largest KPI figure (dashboard stat tile)"),
 ]),
 ("HEADING -- sans 600, page and section titles, largest first", [
  ("--type-heading-hero",       "600", "27",   "1.24", "IBM Plex Sans", "opportunity headline in the triage/detail view"),
  ("--type-heading-hero-modal", "600", "24",   "1.25", "IBM Plex Sans", "opportunity headline inside the brief modal"),
  ("--type-heading-entity",     "600", "22",   "1.25", "IBM Plex Sans", "entity / firm-profile name"),
  ("--type-heading-status",     "600", "22",   "1.3",  "IBM Plex Sans", "large status confirmation copy (\"Queue cleared.\")"),
  ("--type-heading-panel",      "600", "18",   "1.2",  "IBM Plex Sans", "panel/section h2 (Expiration Radar, Teaming Radar, Pipeline Board, Organizations)"),
  ("--type-heading-brief",      "600", "18",   "1.25", "IBM Plex Sans", "\"RECOMMENDED POSTURE\" heading inside the brief modal"),
  ("--type-heading-tour",       "600", "18",   "1.35", "IBM Plex Sans", "product-tour step title"),
  ("--type-heading-modal",      "600", "17",   "1.2",  "IBM Plex Sans", "modal/drawer h2 (Source Yield, Firm Profile, Source Registry)"),
  ("--type-heading-editor",     "600", "16",   "1.25", "IBM Plex Sans", "editor drawer title"),
  ("--type-heading-stat-label", "600", "15",   "1",    "IBM Plex Sans", "stat block label paired with a mono value"),
  ("--type-heading-list",       "600", "15",   "1.2",  "IBM Plex Sans", "\"Live opportunities\" list heading"),
  ("--type-heading-entry",      "600", "14",   "1.3",  "IBM Plex Sans", "timeline entry title"),
  ("--type-heading-callout",    "600", "13",   "1.3",  "IBM Plex Sans", "callout headline (contracts-expire banner, ingest notice)"),
  ("--type-heading-timeline",   "600", "13",   "1.4",  "IBM Plex Sans", "timeline entry heading, second variant"),
  ("--type-heading-count",      "600", "11.5", "1.3",  "IBM Plex Sans", "column-count heading"),
 ]),
 ("METRIC -- mono 600, numeric values throughout the record and dashboard cards", [
  ("--type-metric-lg",          "600", "22",   "1",    "IBM Plex Mono", "stat-tile value / progress percentage"),
  ("--type-metric-counter",     "600", "20",   "1",    "IBM Plex Mono", "queue counter badge / large stat value"),
  ("--type-metric-counter-2",   "600", "20",   "1.1",  "IBM Plex Mono", "counter value, tighter leading"),
  ("--type-metric-stat",        "600", "17",   "1.1",  "IBM Plex Mono", "stat value under a DEADLINE / EST. VALUE / POSTED microlabel"),
  ("--type-metric-field",       "600", "16",   "1.15", "IBM Plex Mono", "field value inside a record card"),
  ("--type-metric-conflict",    "600", "14",   "1.2",  "IBM Plex Mono", "conflicting value pair in the deadline-disagreement card"),
  ("--type-metric-score",       "600", "13",   "1",    "IBM Plex Mono", "score value"),
  ("--type-metric-source",      "600", "12.5", "1",    "IBM Plex Mono", "source-record interested count"),
 ]),
 ("ICON, BUTTON, WORDMARK -- one-off structural roles", [
  ("--type-icon-bell",          "400", "15",   "1",    "IBM Plex Sans", "the bell glyph"),
  ("--type-button",             "600", "14",   "1",    "IBM Plex Sans", "primary action buttons (Interested / Pass)"),
  ("--type-wordmark",           "600", "13.5", "1",    "IBM Plex Sans", "the TENDERFOOT brand wordmark"),
 ]),
 ("SUBHEAD -- sans 500, row and list-item titles", [
  ("--type-subhead",            "500", "13",   "1.35", "IBM Plex Sans", "row/list-item title -- the most common subhead"),
  ("--type-subhead-field",      "500", "13",   "1.45", "IBM Plex Sans", "field value emphasis"),
  ("--type-subhead-source",     "500", "12.5", "1.35", "IBM Plex Sans", "source-record name"),
  ("--type-subhead-history",    "500", "12.5", "1.4",  "IBM Plex Sans", "history entry title"),
  ("--type-subhead-note",       "500", "12.5", "1.45", "IBM Plex Sans", "note title"),
 ]),
 ("BODY -- sans 400, prose and secondary copy, largest first", [
  ("--type-body-buyer",         "400", "14",   "1.5",  "IBM Plex Sans", "buyer name under a title"),
  ("--type-body-summary",       "400", "14",   "1.6",  "IBM Plex Sans", "queue-cleared summary paragraph"),
  ("--type-body-brief",         "400", "14",   "1.65", "IBM Plex Sans", "brief modal prose (WHAT IT IS / WHY IT FITS)"),
  ("--type-body-loose-sm",      "400", "13.5", "1.5",  "IBM Plex Sans", "compact prose, looser leading"),
  ("--type-body-caveat",        "400", "13.5", "1.55", "IBM Plex Sans", "caveat / footnote copy"),
  ("--type-body-citation",      "400", "13.5", "1.65", "IBM Plex Sans", "citation / tour body copy"),
  ("--type-body-plain",         "400", "13",   "1",    "IBM Plex Sans", "short inline copy, tight leading"),
  ("--type-body-title-sm",      "400", "13",   "1.35", "IBM Plex Sans", "grouped-item title"),
  ("--type-body-blurb",         "400", "13",   "1.55", "IBM Plex Sans", "entity blurb / field-value prose"),
  ("--type-body-label",         "400", "12.5", "1.4",  "IBM Plex Sans", "field label paired with a value"),
  ("--type-body-compact",       "400", "12.5", "1.5",  "IBM Plex Sans", "compact body copy"),
  ("--type-body-list",          "400", "12.5", "1.55", "IBM Plex Sans", "list-row prose (citation, editor preview)"),
  ("--type-body-default",       "400", "12.5", "1.6",  "IBM Plex Sans", "a common paragraph style (empty state, citation, posture-why)"),
  ("--type-body-decision",      "400", "12",   "1",    "IBM Plex Sans", "last-decision toast text"),
  ("--type-body-meta",          "400", "12",   "1.35", "IBM Plex Sans", "metadata row (file name, vendor, cycle, M/WBE)"),
  ("--type-body-party",         "400", "12",   "1.4",  "IBM Plex Sans", "counterparty name"),
  ("--type-body-note",          "400", "12",   "1.5",  "IBM Plex Sans", "a common secondary-note style"),
  ("--type-body-caveat-sm",     "400", "12",   "1.55", "IBM Plex Sans", "short caveat copy"),
  ("--type-body-loose",         "400", "12",   "1.6",  "IBM Plex Sans", "loosely-leaded body copy"),
  ("--type-body-help",          "400", "11.5", "1",    "IBM Plex Sans", "helper text under a prompt"),
  ("--type-body-platform",      "400", "11.5", "1.3",  "IBM Plex Sans", "platform/source note"),
  ("--type-body-small",         "400", "11.5", "1.5",  "IBM Plex Sans", "small supporting body text"),
  ("--type-body-field",         "400", "11",   "1.35", "IBM Plex Sans", "field label"),
  ("--type-body-default-2",     "400", "11",   "1.4",  "IBM Plex Sans", "the most common note/detail line (deadlineIn, valueNote, conflictASrc) -- highest use-count of any BODY-family token (11)"),
  ("--type-body-note-sm",       "400", "11",   "1.5",  "IBM Plex Sans", "small note text"),
 ]),
 ("UI -- sans 500/600, controls and interactive labels", [
  ("--type-ui-action",          "500", "12.5", "1",    "IBM Plex Sans", "control label (Back / Cancel / confirm actions)"),
  ("--type-ui-action-loose",    "500", "12.5", "1.3",  "IBM Plex Sans", "control label, looser leading"),
  ("--type-ui-action-primary",  "600", "12.5", "1",    "IBM Plex Sans", "primary control label (tour Next, editor Save)"),
  ("--type-ui-link",            "500", "12",   "1",    "IBM Plex Sans", "inline link-style action"),
  ("--type-ui-title",           "500", "12",   "1.4",  "IBM Plex Sans", "card title control"),
  ("--type-ui-view",            "500", "11.5", "1",    "IBM Plex Sans", "saved-view label / control (\"+ New view\")"),
  ("--type-ui-menu",            "500", "11",   "1",    "IBM Plex Sans", "menu/control text (\"Show menu\", \"Restore\")"),
 ]),
 ("DATA -- mono, inline values without letter-spacing (not microlabels)", [
  ("--type-data-count",         "400", "12.5", "1",    "IBM Plex Mono", "pipeline stage count (ingested / gated / triaged)"),
  ("--type-data-org",           "500", "12.5", "1",    "IBM Plex Mono", "organization stat value (solicitations / awarded / awards / value)"),
  ("--type-data-value",         "500", "12",   "1",    "IBM Plex Mono", "the most common inline data value (expires / value / deadline)"),
  ("--type-data-value-loose",   "500", "12",   "1.4",  "IBM Plex Mono", "data value, looser leading"),
  ("--type-data-diff",          "500", "12",   "1.6",  "IBM Plex Mono", "diff value in the deadline-disagreement card"),
  ("--type-data-conf",          "500", "11.5", "1",    "IBM Plex Mono", "confidence / relative-time value"),
  ("--type-data-date",          "500", "11.5", "1.6",  "IBM Plex Mono", "event date"),
  ("--type-data-placeholder",   "500", "11",   "1.5",  "IBM Plex Mono", "\"DOCUMENT RENDER -- PLACEHOLDER\" notice text"),
  ("--type-data-misc",          "600", "11",   "1",    "IBM Plex Mono", "bold inline mono value"),
  ("--type-data-source",        "400", "10.5", "1.3",  "IBM Plex Mono", "source field / subcontract note"),
  ("--type-data-archive",       "400", "10.5", "1.4",  "IBM Plex Mono", "archive note"),
  ("--type-data-meta",          "400", "10.5", "1.45", "IBM Plex Mono", "meta note"),
  ("--type-data-badge",         "400", "10",   "1.3",  "IBM Plex Mono", "badge text (EXPIRING <=18MO, SECTOR MATCH)"),
  ("--type-data-tiny",          "400", "9.5",  "1.3",  "IBM Plex Mono", "tiny inline label"),
  ("--type-data-badge-sm",      "500", "9",    "1",    "IBM Plex Mono", "smallest badge text"),
 ]),
 ("MICROLABEL -- mono, uppercase, carries letter-spacing. Ordered by use.", [
  ("--type-microlabel",         "500", "9.5",  "1",    "IBM Plex Mono", "the dominant uppercase mono microlabel (DEADLINE, EST. VALUE, table headers...) -- the single most-used type declaration in the bundle"),
  ("--type-microlabel-queue",   "500", "10",   "1",    "IBM Plex Mono", "uppercase mono queue/nav microlabel -- second-most-used"),
  ("--type-microlabel-cmd",     "500", "11",   "1",    "IBM Plex Mono", "uppercase mono command/label text -- third-most-used"),
  ("--type-microlabel-source",  "400", "10.5", "1",    "IBM Plex Mono", "uppercase mono source-health microlabel"),
  ("--type-microlabel-time",    "400", "10",   "1",    "IBM Plex Mono", "timestamp / order / hint microlabel"),
  ("--type-microlabel-alert",   "600", "10",   "1",    "IBM Plex Mono", "uppercase mono alert microlabel, bold"),
  ("--type-microlabel-gate",    "500", "10.5", "1",    "IBM Plex Mono", "gate status microlabel"),
  ("--type-microlabel-badge",   "500", "9.5",  "1.25", "IBM Plex Mono", "badge micro text (\"IN\")"),
 ]),
]

TRACKING = [
 ("--tracking-wordmark",      ".16",   "the widest tracking in the direction -- the TENDERFOOT wordmark"),
 ("--tracking-label-wide",    ".14",   "uppercase microlabels, primary widening (DEADLINE, EST. VALUE, POSTED, CLEARING QUEUE)"),
 ("--tracking-label",         ".12",   "uppercase microlabels and command text -- the most common positive tracking"),
 ("--tracking-label-tight",   ".1",    "table-header row labels and doc counts"),
 ("--tracking-hint",          ".08",   "keyboard hints and \"ALL SCORES\" style labels"),
 ("--tracking-hint-tight",    ".06",   "note counts, CLEAR, relative timestamps -- tightest positive tracking"),
 ("--tracking-hairline",      ".005",  "near-zero tracking on a single sans control label"),
 ("--tracking-heading",       "-.01",  "optical tightening on 22-24px sans headings"),
 ("--tracking-heading-tight", "-.012", "optical tightening on the largest sans heading (27px)"),
 ("--tracking-display",       "-.02",  "optical tightening on the largest mono figures (the hero counter and its stat)"),
]

# ---- Completeness check: every extracted key mapped exactly once, no extras.
font_keys = [(w, s, lh, f) for _, items in GROUPS for _, w, s, lh, f, _ in items]
assert len(font_keys) == len(set(font_keys)), "duplicate font key in the map"
missing_fonts = [k for k in font_uses if k not in set(font_keys)]
extra_fonts = [k for k in font_keys if k not in font_uses]
assert not missing_fonts, "UNMAPPED font declarations: %s" % (missing_fonts,)
assert not extra_fonts, "map references font declarations that do not exist in the bundle: %s" % (extra_fonts,)
print("OK: all %d distinct font declarations mapped exactly once, no extras." % len(font_keys))

track_keys = [v for _, v, _ in TRACKING]
assert len(track_keys) == len(set(track_keys)), "duplicate tracking key in the map"
missing_track = [k for k in track_uses if k not in set(track_keys)]
extra_track = [k for k in track_keys if k not in track_uses]
assert not missing_track, "UNMAPPED letter-spacing values: %s" % (missing_track,)
assert not extra_track, "map references letter-spacing values that do not exist in the bundle: %s" % (extra_track,)
print("OK: all %d distinct letter-spacing values mapped exactly once, no extras." % len(track_keys))

TOTAL = len(font_keys) + len(track_keys)

HEAD = '''/* ============================================================================
 * Tenderfoot type tokens
 * ============================================================================
 * EXTRACTED FROM: prototype/PROTOTYPE/Tenderfoot UI Mockups V1.2.html
 * PROCEDURE:      docs/ClaudeDesign_Proto_Cleanup.md, steps 3 and 4 (typography
 *                 was not covered there; this file closes that gap)
 * GENERATED BY:   an extraction script, so every value below is read out of the
 *                 bundle rather than transcribed. The comments are hand-written;
 *                 they are the part the generator cannot produce.
 *
 * WHY THIS EXISTS. tokens.css covers 67 colours and 12 radii, both verified
 * against the bundle. It carries no typography. The bundle uses %d distinct
 * `font:` shorthands and %d distinct `letter-spacing` values, none of them
 * previously tokenized -- every inline style attribute in the bundle spells
 * out weight, size, line-height and family as a literal. The fidelity mandate
 * (design spec 7.10) requires "same spacing scale, radii, shadows, typography",
 * so this was the one layer with no verified source.
 *
 * %d, NOT 37. An earlier estimate of "37 distinct font: shorthands" is close
 * to the count of distinct (weight, size) PAIRS in the bundle (also 37, not a
 * coincidence) -- but line-height and font-family vary independently of that
 * pair, and every one of those variations is a real, separate declaration in
 * the markup. Collapsing to (weight, size) would be exactly the kind of
 * near-duplicate merge 7.10 forbids: it breaks pixel parity. The true count
 * of distinct `font:` shorthands is %d. See task-1-report.md for the full
 * reconciliation.
 *
 * TRACKING COUNT ALSO REVISED. The extraction step as specified matches
 * `letter-spacing:\\s*([\\d.]+em)` -- no leading "-" -- which finds 7 distinct
 * values. The bundle actually has 10: three more values (-.01em, -.012em,
 * -.02em) are used as optical kerning on the largest headings and the hero
 * counter, and a pattern missing the sign silently drops them. Extracted here
 * with the sign included; flagged loudly rather than following the narrower
 * pattern into a quiet gap. See verify-type.py's docstring for why this
 * script is not the place that catches that kind of thing on its own.
 *
 * NO GENERATED NAMES TO ALIAS. Unlike colours, the bundle never tokenized its
 * own typography -- there is no `--font-N` custom property anywhere to map
 * from, only inline `font:` and `letter-spacing:` literals. So this file has
 * no compatibility block: role names are the only names. Provenance is
 * recorded as a per-token literal-value-plus-use-count instead of a
 * generated-name alias.
 *
 * NAMED BY ROLE. Every property below is named for what it was observed
 * doing in the bundle -- not by size, not by a sequence number. Where several
 * declarations share a recognizable job at different exact metrics (three
 * "heading" leadings, several "microlabel" sizes), the family name repeats
 * with a distinguishing suffix, same convention as tokens.css's
 * --ground-recess-1..4. Every declaration still gets its own property; none
 * are merged.
 * ==========================================================================*/

:root {
'''

TRACKHEAD = '''  /* ---- TRACKING (letter-spacing) -- widest first ------------------------
   * %d steps. Positive values widen uppercase micro-copy; the three negative
   * values are optical tightening on the largest headings and figures, where
   * default tracking reads as loose at that size.
   * -------------------------------------------------------------------- */''' % len(track_keys)

TAIL_NOTE = '''
/* ============================================================================
 * COUNT SUMMARY: %d font-shorthand tokens + %d tracking tokens = %d distinct
 * type tokens total. Not reduced. Not a problem to solve -- a fact about the
 * prototype for Matt to rule on at the sign-off gate.
 * ==========================================================================*/
''' % (len(font_keys), len(track_keys), TOTAL)

out = []
w = out.append
w(HEAD % (len(font_keys), len(track_keys), len(font_keys), len(font_keys)))
name_width = max(len(role) for _, items in GROUPS for role, *_ in items) + 1
for title, items in GROUPS:
    w("  /* ---- " + title + " " + "-" * max(3, 74 - len(title)) + " */")
    for role, weight, size, lh, fam, note in items:
        value = "%s %spx/%s '%s'" % (weight, size, lh, fam)
        w("  %-*s %s;  /* %s" % (name_width + 1, role + ":", value, note))
        n = font_uses[(weight, size, lh, fam)]
        w("     * %d use%s in %s */" % (n, "" if n == 1 else "s", VERSION))
    w("")

w(TRACKHEAD)
tname_width = max(len(role) for role, _, _ in TRACKING) + 1
for role, value, note in TRACKING:
    w("  %-*s %sem;  /* %s" % (tname_width + 1, role + ":", value, note))
    n = track_uses[value]
    w("     * %d use%s in %s */" % (n, "" if n == 1 else "s", VERSION))
w("}")
w(TAIL_NOTE)

open(TYPE, "w", encoding="utf-8").write("\n".join(out))
print("wrote type.css (%d lines)" % len(out))
print("font tokens: %d, tracking tokens: %d, total: %d" % (len(font_keys), len(track_keys), TOTAL))
