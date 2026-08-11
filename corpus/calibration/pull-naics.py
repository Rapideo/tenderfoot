import json, urllib.request, time, sys, os

SP = os.path.dirname(os.path.abspath(__file__))
CUTOFF = "2024-08-10"          # 24 months back from 2026-08-10
NAICS = ["541611","541612","541618","541690","541720",
         "611430","541511","541512","923120","541910"]
TYPES = ["o","k"]              # Solicitation, Combined Synopsis/Solicitation
BASE = ("https://sam.gov/api/prod/sgs/v1/search?index=opp&size=100"
        "&sort=-modifiedDate&is_active=false&naics={n}&notice_type={t}&page={p}")

def get(url, tries=3):
    for i in range(tries):
        try:
            rq = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(rq, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if i == tries - 1:
                print("  FAIL", e, flush=True)
                return None
            time.sleep(2 * (i + 1))

def pop(x):
    # placeOfPerformance is an object on some notices and a list on others.
    p = x.get("placeOfPerformance")
    if isinstance(p, list):
        p = p[0] if p else None
    if not isinstance(p, dict):
        return ""
    st = p.get("state")
    if isinstance(st, list):
        st = st[0] if st else None
    if isinstance(st, dict):
        return st.get("name") or st.get("code") or ""
    return st or ""

def org(x):
    h = x.get("organizationHierarchy") or []
    names = [o.get("name") for o in h if o.get("name")]
    return " / ".join(names[-2:]) if names else ""

rows, seen = [], set()
for n in NAICS:
    for t in TYPES:
        kept = 0
        for p in range(40):
            d = get(BASE.format(n=n, t=t, p=p))
            if not d:
                break
            rs = (d.get("_embedded") or {}).get("results") or []
            if not rs:
                break
            # Only -modifiedDate sorts; -publishDate is silently ignored. Since
            # modifiedDate >= publishDate always, paginating until modifiedDate
            # passes the cutoff is guaranteed to have seen every in-window record.
            stop = ((rs[-1].get("modifiedDate") or "")[:10] or "9999") < CUTOFF
            for x in rs:
                pub = (x.get("publishDate") or "")[:10]
                if pub and pub < CUTOFF:
                    continue
                i = x.get("_id")
                if not i or i in seen:
                    continue
                seen.add(i)
                rows.append({
                    "id": i,
                    "sol": x.get("solicitationNumber") or "",
                    "title": (x.get("title") or "").strip(),
                    "type": (x.get("type") or {}).get("value", ""),
                    "pub": pub,
                    "resp": (x.get("responseDate") or "")[:10],
                    "naics": [c.get("code") for c in (x.get("naics") or [])],
                    "agency": org(x),
                    "pop": pop(x),
                    "awarded": bool(x.get("award")),
                })
                kept += 1
            if stop:
                break
            time.sleep(0.25)
        print(f"{n} {t}: kept {kept}  (running total {len(rows)})", flush=True)

json.dump(rows, open(os.path.join(SP, "archive.json"), "w", encoding="utf-8"),
          ensure_ascii=False)
print("TOTAL UNIQUE:", len(rows))
