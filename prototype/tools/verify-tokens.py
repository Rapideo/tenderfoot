"""Independent verification of src/tokens.css against the frozen V1.2 bundle.

Deliberately does NOT reuse gen.py's data structures. It re-reads both files and
resolves the alias chain, so a bug in the generator's map cannot also pass here.
"""
import re, json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import os
# Paths are resolved relative to this script so the extraction is re-runnable
# from any working directory. BUNDLE is the CURRENT frozen export; when a new
# version lands, point it at the new file and re-run -- see
# docs/ClaudeDesign_Proto_Cleanup.md, "Re-extraction".
ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUNDLE = os.path.join(ROOT, "PROTOTYPE", "Tenderfoot UI Mockups V1.2.html")
TOKENS = os.path.join(ROOT, "PROTOTYPE", "src", "tokens.css")


html = open(BUNDLE, encoding="utf-8").read()
tpl = json.loads(re.search(r'<script type="__bundler/template">(.*?)</script>', html, re.S).group(1).strip())
truth = {}
for n, v in re.findall(r'(--[A-Za-z0-9_-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*[;}]', tpl):
    truth.setdefault(n, v.lower())

css = open(TOKENS, encoding="utf-8").read()
# strip comments so commented-out example values cannot be mistaken for definitions
bare = re.sub(r'/\*.*?\*/', '', css, flags=re.S)

roles = dict(re.findall(r'(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;', bare))
alias = dict(re.findall(r'(--[a-z0-9-]+)\s*:\s*var\(\s*(--[a-z0-9-]+)\s*\)\s*;', bare))

fail = 0
for gen, want in sorted(truth.items()):
    if gen not in alias:
        print("MISSING ALIAS  %s" % gen); fail += 1; continue
    role = alias[gen]
    if role not in roles:
        print("ALIAS -> UNDEFINED ROLE  %s -> %s" % (gen, role)); fail += 1; continue
    got = roles[role]
    if got != want:
        print("VALUE DRIFT    %s -> %s : bundle %s, tokens.css %s" % (gen, role, want, got)); fail += 1

print("\nbundle tokens          : %d" % len(truth))
print("role tokens defined    : %d" % len(roles))
print("aliases defined        : %d" % len(alias))

orphan = [r for r in roles if r not in set(alias.values()) and not r.startswith('--radius')]
if orphan:
    print("role tokens with no generated source: %s" % orphan)

rad = {k: v for k, v in re.findall(r'(--radius-[a-z-]+)\s*:\s*([^;]+);', bare)}
print("radius tokens          : %d (%d numeric + round)" % (len(rad), len(rad) - 1))

# every radius literal in the bundle must have a token
lit = set()
for m in re.finditer(r'border(?:-[a-z]+)?-radius\s*:\s*([^;{}"\']+)', tpl):
    for t in m.group(1).split():
        lit.add(t.strip())
covered = set(v.strip() for v in rad.values())
gap = lit - covered
print("radius literals in bundle: %d -> uncovered: %s" % (len(lit), sorted(gap) if gap else "none"))

# ---- CONSERVATION CHECK (I3, 2026-08-14 fix wave) ------------------------
# Everything above proves every colour VALUE `truth` holds round-trips into
# tokens.css. It cannot prove `truth` holds everything the bundle defines:
# truth.setdefault() (above) keeps only the FIRST definition of each --name,
# so a name defined a second time with a DIFFERENT value is matched, then
# silently dropped, and nothing above ever sees it happen -- the same shape
# of gap Ruling 5 closed for type.css's font/letter-spacing counts, never
# propagated to this file. It was live: the bundle defines every one of
# these 67 names TWICE -- once under :root, again under
# `[data-theme="dark"]` -- 134 raw --name:#hex definitions for 67 distinct
# names, a complete second (dark) palette. Both this script and
# extract-tokens.py dropped the second half without a word. This does not
# ask "are the light values right" (the checks above already answer that);
# it asks "does the bundle define anything this file never looked at",
# using the SAME regex `truth` was built from, just not collapsed by name.
all_defs = re.findall(r'(--[A-Za-z0-9_-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*[;}]', tpl)
by_name = {}
for n, v in all_defs:
    by_name.setdefault(n, []).append(v.lower())
redefined = {n: vs for n, vs in by_name.items() if len(set(vs)) > 1}

# Known and disclosed at extract-tokens.py's header ("SECOND PALETTE, NOT
# EXTRACTED"): every one of the 67 names carries exactly one differently-
# valued second definition -- the dark palette. This is NOT asking the
# bundle to build dark mode; it is a count that must not drift silently. If
# it ever does, a name was added/removed or a light/dark pair converged to
# the same value, and that is worth a human looking rather than another
# quiet drop.
EXPECTED_REDEFINED = 67
print("\nraw --name:#hex definitions in bundle : %d (%d distinct names)" % (len(all_defs), len(by_name)))
if len(redefined) != EXPECTED_REDEFINED:
    print(
        "DARK-PALETTE COUNT DRIFT  expected %d token names with a second, "
        "differently-valued definition (the disclosed dark palette), found %d -- "
        "either a name was added or removed, or a light/dark pair now shares a "
        "value; re-check extract-tokens.py's header against the bundle."
        % (EXPECTED_REDEFINED, len(redefined))
    )
    fail += 1
else:
    sample = sorted(redefined)[0]
    print(
        "dark-palette conservation OK          %d light token(s) each carry exactly "
        "one differently-valued dark counterpart, disclosed at extract-tokens.py's "
        "header, not extracted (e.g. %s: light %s, dark %s)"
        % (len(redefined), sample, by_name[sample][0], by_name[sample][1])
    )

print("\n%s" % ("FAIL: %d problem(s)" % fail if fail or gap else "PASS: every token round-trips to the bundle value."))
sys.exit(1 if (fail or gap) else 0)
