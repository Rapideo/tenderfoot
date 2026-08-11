import json, os, random

SP = os.path.dirname(os.path.abspath(__file__))

naics_pool = json.load(open(os.path.join(SP, "archive.json"), encoding="utf-8"))
psc_pool = json.load(open(os.path.join(SP, "archive_psc.json"), encoding="utf-8"))

# Merge, remembering which facet surfaced each record. A record found by both
# is not "better" — it just has two provenance tags.
by_id = {}
for r in naics_pool:
    r["via"] = ["naics"]
    by_id[r["id"]] = r
for r in psc_pool:
    if r["id"] in by_id:
        by_id[r["id"]]["via"].append("psc")
    else:
        r["via"] = ["psc"]
        by_id[r["id"]] = r
pool = list(by_id.values())

# PSC is a structural signal: R410 *is* program evaluation, no keyword needed.
PSC_W = {"R410": 8, "R422": 6, "U008": 6, "U099": 5, "B506": 4, "B599": 4,
         "R408": 3, "R707": 2, "R699": 1, "R499": 1}

STRONG = ["program evaluation", "external quality review", "quality review",
          "managed care", "medicaid", "outcome evaluation", "evaluation services",
          "performance measure", "needs assessment", "organizational assessment",
          "technical assistance", "strategic plan", "process improvement",
          "business process", "change management", "stakeholder engagement",
          "focus group", "public opinion", "survey research", "workforce development",
          "talent development", "professional development", "curriculum",
          "project management office", "independent verification", "iv&v",
          "ai governance", "continuous quality improvement"]
SECTOR = ["medicaid", "public health", "behavioral health", "human services",
          "child welfare", "aging", "long-term care", "health equity",
          "social services", "workforce", "education", "nonprofit"]
NEGATIVE = ["construction", "renovation", "roofing", "hvac", "janitorial",
            "custodial", "grounds maintenance", "paving", "ammunition", "weapon",
            "firearm", "vehicle", "fuel", "furniture", "uniform", "food service",
            "laundry", "pest control", "landscaping", "snow removal",
            "hardware refresh", "license renewal", "warranty", "spare parts"]
MIDWEST = {"Indiana", "Illinois", "Ohio", "Michigan", "Kentucky", "Wisconsin"}

def score(r):
    t = (r.get("title") or "").lower()
    s = 0
    for c in (r.get("psc_codes") or []):
        s += PSC_W.get(c, 0)
    s += 4 * sum(1 for k in STRONG if k in t)
    s += 2 * sum(1 for k in SECTOR if k in t)
    s -= 6 * sum(1 for k in NEGATIVE if k in t)
    if r.get("pop") in MIDWEST:
        s += 2
    return s

for r in pool:
    r["s"] = score(r)

ranked = sorted(pool, key=lambda r: (-r["s"], r["pub"]))
enriched = ranked[:80]

taken = {e["id"] for e in enriched}
rest = [r for r in pool if r["id"] not in taken]
random.seed(20260810)
unbiased = random.sample(rest, min(60, len(rest)))

for r in enriched:
    r["set"] = "enriched"
for r in unbiased:
    r["set"] = "unbiased"

json.dump(enriched + unbiased,
          open(os.path.join(SP, "calibration.json"), "w", encoding="utf-8"),
          ensure_ascii=False)

print("naics pool:", len(naics_pool), " psc pool:", len(psc_pool),
      " merged unique:", len(pool))
print("overlap:", sum(1 for r in pool if len(r["via"]) == 2))
print("enriched:", len(enriched), "score", enriched[-1]["s"], "-", enriched[0]["s"])
print("\nTop 25 enriched:")
for r in enriched[:25]:
    print(f"  {r['s']:>3} {r['pub']} {'/'.join(r.get('psc_codes') or []):<10} {r['title'][:66]}")
print("\nUnbiased sample of 8:")
for r in unbiased[:8]:
    print(f"  {r['s']:>3} {r['pub']} {'/'.join(r.get('psc_codes') or []):<10} {r['title'][:66]}")
