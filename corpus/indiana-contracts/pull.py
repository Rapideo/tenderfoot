import json, os, time, urllib.request

SP = os.path.dirname(os.path.abspath(__file__))
URL = "https://secure.in.gov/apps/idoa/contractsearch/api/contracts/search"
TODAY = "2026-08-10"
HORIZON = "2028-02-10T00:00:00"      # 18 months out — the §4.6 radar window

# Agencies matched to KP's stated sectors: state/local health, human services,
# education, workforce. businessUnit is a VERIFIED filter (204,439 -> 49 on a
# real unit, -> 0 on a bogus one).
AGENCIES = {
    "00405": "Family & Social Svcs Admin",
    "00503": "FSSA Medicaid Policy & Plan",
    "00410": "FSSA Mental Health & Addiction",
    "00497": "FSSA Disability & Rehab Svcs",
    "00498": "FSSA Aging",
    "00500": "FSSA Family Resources",
    "00400": "Indiana Dept of Health",
    "00502": "Child Services",
    "00501": "Early Child Learning",
    "00510": "Dept of Workforce Development",
    "00512": "Governor's Workforce Cabinet",
    "00700": "Education",
    "00719": "Comm for Higher Education",
    "00061": "Dept of Administration",
    "00067": "Ofc of Technology",
    "00035": "Gov Cncl for Ppl w/Disab",
}

def post(body, tries=3):
    data = json.dumps(body).encode()
    for i in range(tries):
        try:
            rq = urllib.request.Request(URL, data=data, headers={
                "Content-Type": "application/json", "Accept": "application/json",
                "User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(rq, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if i == tries - 1:
                print("  FAIL", e, flush=True)
                return None
            time.sleep(2 * (i + 1))

rows = []
for bu, name in AGENCIES.items():
    page, kept, total = 1, 0, None
    while True:
        d = post({"pageNumber": page, "pageSize": 2000,
                  "businessUnit": bu, "endDate": HORIZON})
        if not d:
            break
        total = d["pagination"]["totalResults"]
        rs = d["results"]
        for x in rs:
            end = (x.get("endDate") or "")[:10]
            # endDate filter is "<=" only; the lower bound is applied here.
            if end and end >= TODAY:
                x["agencyBU"] = bu
                rows.append(x)
                kept += 1
        if page * 2000 >= total or not rs:
            break
        page += 1
        time.sleep(0.2)
    print(f"{bu} {name[:30]:<32} scanned {total:>6}  expiring-in-window {kept}", flush=True)

json.dump(rows, open(os.path.join(SP, "in_expiring.json"), "w", encoding="utf-8"),
          ensure_ascii=False)
print("\nTOTAL expiring within 18 months:", len(rows))
