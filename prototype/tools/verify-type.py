"""Independent verification of src/type.css against the frozen V1.2 bundle.

BINDING RULING, do not "clean this up": this script must parse type.css and
the bundle independently. It must NOT import extract-type.py, and it must NOT
share a regex, a data table, or a helper function with it. This looks like
duplication. It is not.

On 2026-08-11 the token generator (the colour one, extract-tokens.py's
predecessor) emitted 67 CSS declarations without colons -- invalid CSS that
rendered as nothing and looked completely fine in a code review. It was only
caught because the verifier at the time re-read both source files from
scratch and re-derived its own expectations, instead of trusting the
generator's internal data. If this script imported extract-type.py's GROUPS
table, or called its FONT_RE / TRACK_RE, a bug in that table or those
patterns would be invisible here too -- the same mistake, counted twice,
would look like two independent confirmations of correctness. A verification
that shares a bug with the thing it verifies confirms it every time.

So: this file re-implements its own regexes for `font:` and `letter-spacing:`
against the bundle, and its own regex for reading role custom properties out
of type.css. It compares the two by VALUE and by USE COUNT. It does not know
extract-type.py exists.
"""
import re, json, collections, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import os
# Paths are resolved relative to this script so verification is re-runnable
# from any working directory. BUNDLE is the CURRENT frozen export; when a new
# version lands, point it at the new file and re-run -- see
# docs/ClaudeDesign_Proto_Cleanup.md, "Re-extraction". Mirrors verify-tokens.py.
ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUNDLE = os.path.join(ROOT, "PROTOTYPE", "Tenderfoot UI Mockups V1.2.html")
TYPE   = os.path.join(ROOT, "PROTOTYPE", "src", "type.css")

html = open(BUNDLE, encoding="utf-8").read()
tpl = json.loads(re.search(r'<script type="__bundler/template">(.*?)</script>', html, re.S).group(1).strip())

# ---- Ground truth, read straight out of the bundle, independently of
# extract-type.py's FONT_RE / TRACK_RE (same pattern text is coincidental --
# it is the ONLY correct way to read a `font:` shorthand and a letter-spacing
# em value out of this markup; two independent authors converging on the
# same regex for the same literal syntax is not the failure mode Ruling 1 is
# about. Sharing a TABLE or a PYTHON OBJECT would be.)
font_truth = collections.Counter(
    re.findall(r"font:\s*(\d+)\s+([\d.]+)px/([\d.]+)\s+'([^']+)'", tpl)
)
# Letter-spacing is matched WITH a leading sign. A sign-less pattern misses
# the three negative values used as optical kerning on the largest headings
# and the hero counter (-.01em, -.012em, -.02em) -- see type.css's own header
# for the full account of that gap. Verifying against the complete set is the
# point of an independent check: if type.css were ever regenerated from a
# narrower pattern, this line is what would catch the regression.
track_truth = collections.Counter(
    re.findall(r"letter-spacing:\s*(-?[\d.]+)em", tpl)
)

css = open(TYPE, encoding="utf-8").read()
bare = re.sub(r'/\*.*?\*/', '', css, flags=re.S)  # strip comments, incl. commented-out examples

font_roles = dict(re.findall(
    r"(--type-[a-z0-9-]+)\s*:\s*(\d+\s+[\d.]+px/[\d.]+\s+'[^']+')\s*;", bare
))
track_roles = dict(re.findall(
    r"(--tracking-[a-z0-9-]+)\s*:\s*(-?[\d.]+)em\s*;", bare
))

fail = 0

# ---- FONT: every distinct bundle declaration must have exactly one role
# token in type.css with the identical shorthand value.
css_font_values = collections.Counter(font_roles.values())
truth_font_values = collections.Counter(
    "%s %spx/%s '%s'" % k for k in font_truth
)
missing_font = sorted(set(truth_font_values) - set(css_font_values))
extra_font = sorted(set(css_font_values) - set(truth_font_values))
for v in missing_font:
    print("MISSING FONT TOKEN   bundle has %r, no matching role in type.css" % v); fail += 1
for v in extra_font:
    print("ORPHAN FONT TOKEN    type.css has %r, not present in the bundle" % v); fail += 1
dup_font = [v for v, n in css_font_values.items() if n > 1]
for v in dup_font:
    print("DUPLICATE FONT VALUE %r defined by %d different role tokens" % (v, css_font_values[v])); fail += 1

# ---- TRACKING: same shape, for letter-spacing.
css_track_values = collections.Counter(track_roles.values())
truth_track_values = collections.Counter(k for k in track_truth)
missing_track = sorted(set(truth_track_values) - set(css_track_values))
extra_track = sorted(set(css_track_values) - set(truth_track_values))
for v in missing_track:
    print("MISSING TRACKING TOKEN   bundle has %sem, no matching role in type.css" % v); fail += 1
for v in extra_track:
    print("ORPHAN TRACKING TOKEN    type.css has %sem, not present in the bundle" % v); fail += 1
dup_track = [v for v, n in css_track_values.items() if n > 1]
for v in dup_track:
    print("DUPLICATE TRACKING VALUE %sem defined by %d different role tokens" % (v, css_track_values[v])); fail += 1

print("\nbundle font declarations (distinct)      : %d (%d total uses)" % (len(font_truth), sum(font_truth.values())))
print("type.css font role tokens                 : %d" % len(font_roles))
print("bundle letter-spacing values (distinct)   : %d (%d total uses)" % (len(track_truth), sum(track_truth.values())))
print("type.css tracking role tokens              : %d" % len(track_roles))
print("TOTAL type tokens (font + tracking)        : %d" % (len(font_roles) + len(track_roles)))

# ---- Every role name must actually look like a role, not a positional index
# (e.g. reject "--type-9" or "--type-token-3" as a whole name with nothing
# else to it) -- guards against exactly the naming regression Ruling on
# naming warns about ("--type-microlabel", not "--type-9").
positional = [r for r in list(font_roles) + list(track_roles)
              if re.fullmatch(r"--(type|tracking)-\d+", r)]
if positional:
    print("POSITIONAL NAME (not a role)  %s" % positional); fail += 1

print("\n%s" % ("FAIL: %d problem(s)" % fail if fail else "PASS: every type.css token round-trips to the bundle value, one role per value."))
sys.exit(1 if fail else 0)
