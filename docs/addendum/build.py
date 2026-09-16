"""Build the Tenderfoot explainer ADDENDUM PDF.

    python docs/addendum/build.py             # render the PDF
    python docs/addendum/build.py --proof     # also write proof/page-N.png for eyeballing

Render-only: the addendum carries no screenshots. It shares the explainer's
fonts (../explainer/fonts/) and stylesheet voice so the two read as one set.

Same rule as the explainer's build: it REFUSES to emit a PDF if any page's
content overflows its box, so a copy edit that pushes text off a page fails
loudly instead of silently truncating.

Requires playwright with a Chrome channel available:  pip install playwright
"""
import sys, io, pathlib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PDF = ROOT / "docs" / "Tenderfoot-Explainer-Addendum.pdf"
PROOF = HERE / "proof"


def render(proof: bool):
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        pg = b.new_page(viewport={"width": 816, "height": 1056}, device_scale_factor=2)
        pg.goto((HERE / "addendum.html").as_uri(), wait_until="load")
        pg.wait_for_timeout(2000)
        pg.emulate_media(media="print")

        # Per-page slack report: how much room each page has left, so a fit
        # is a measured fact rather than a look. Negative means overflow.
        report = pg.evaluate("""() => [...document.querySelectorAll('section.pg')]
            .map((s,i)=>({page:i+1, overflow:s.scrollHeight - s.clientHeight,
                          slack: Math.round((s.clientHeight - [...s.children]
                              .filter(c=>!c.classList.contains('foot'))
                              .reduce((acc,c)=>acc + c.getBoundingClientRect().height, 0)
                              - 0.72*96 - 0.92*96))}))""")
        for r in report:
            print(f"  page {r['page']}: overflow {r['overflow']}px, ~{r['slack']}px slack")
        bad = [(r["page"], r["overflow"]) for r in report if r["overflow"] > 2]
        if bad:
            raise SystemExit(f"content overflows the page box on: {bad}")

        pg.pdf(path=str(PDF), width="8.5in", height="11in", print_background=True,
               margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
               prefer_css_page_size=True)

        if proof:
            PROOF.mkdir(exist_ok=True)
            pages = pg.query_selector_all("section.pg")
            for i, s in enumerate(pages, 1):
                s.screenshot(path=str(PROOF / f"page-{i}.png"))
                print(f"  proof/page-{i}.png")
        b.close()
    print(f"\n{PDF.relative_to(ROOT)}  ({PDF.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    render(proof="--proof" in sys.argv)
