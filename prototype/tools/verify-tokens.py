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

print("\n%s" % ("FAIL: %d problem(s)" % fail if fail or gap else "PASS: every token round-trips to the bundle value."))
sys.exit(1 if (fail or gap) else 0)
