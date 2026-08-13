"""Build the Tenderfoot explainer PDF.

    python docs/explainer/build.py            # capture screens, then render
    python docs/explainer/build.py --render   # render only, reuse shots/

Reads the frozen prototype bundle and writes nothing back to prototype/ --
that directory is reference-only (see prototype/README.md).

Requires playwright with a Chrome channel available:  pip install playwright
"""
import sys, io, pathlib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
BUNDLE = ROOT / "prototype" / "PROTOTYPE" / "Tenderfoot UI Mockups V1.2.html"
SHOTS = HERE / "shots"
PDF = ROOT / "docs" / "Tenderfoot-Explainer.pdf"

# name -> (nav label or None for the default triage screen, viewport height)
# Heights are per-screen: a screen whose content stops short of 1000px gets a
# shorter viewport so the page image is content rather than empty canvas.
SCREENS = [("Radars", "06-radars", 880), ("Admin", "09-admin", 1000)]


def capture():
    SHOTS.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)

        def page(h=1000):
            pg = b.new_page(viewport={"width": 1600, "height": h}, device_scale_factor=2)
            pg.goto(BUNDLE.as_uri(), wait_until="load")
            pg.wait_for_timeout(3500)   # the x-dc runtime boots and paints
            return pg

        def shot(pg, name):
            pg.screenshot(path=str(SHOTS / f"{name}.png"))
            print(f"  {name}.png")

        pg = page()
        shot(pg, "01-triage-hero")
        pg.get_by_text("EXPAND ALL", exact=False).first.click()
        pg.wait_for_timeout(900)
        shot(pg, "02-triage-scores")
        pg.close()

        # Gated drawer, scrolled so the drawer itself is in frame.
        pg = page()
        pg.get_by_text("GATED ITEMS", exact=False).first.click()
        pg.wait_for_timeout(900)
        pg.get_by_text("FILED, NOT DELETED", exact=False).first.scroll_into_view_if_needed()
        pg.wait_for_timeout(600)
        pg.mouse.wheel(0, 260)
        pg.wait_for_timeout(500)
        shot(pg, "03-gated")
        pg.close()

        pg = page()
        pg.get_by_text("Open full detail", exact=False).first.click()
        pg.wait_for_timeout(1400)
        shot(pg, "04-detail")
        pg.close()

        for label, name, h in SCREENS:
            pg = page(h)
            pg.get_by_text("Show menu", exact=False).first.click()
            pg.wait_for_timeout(900)
            pg.get_by_text(label, exact=True).first.click()
            pg.wait_for_timeout(1200)
            shot(pg, name)
            pg.close()

        b.close()


def render():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        pg = b.new_page()
        pg.goto((HERE / "explainer.html").as_uri(), wait_until="load")
        pg.wait_for_timeout(2500)
        pg.emulate_media(media="print")

        # Fail loudly rather than shipping a page with content clipped off it.
        bad = pg.evaluate("""() => [...document.querySelectorAll('section.pg')]
            .map((s,i)=>[i+1, s.scrollHeight - s.clientHeight])
            .filter(([,o]) => o > 2)""")
        if bad:
            raise SystemExit(f"content overflows the page box on: {bad}")

        pg.pdf(path=str(PDF), width="8.5in", height="11in", print_background=True,
               margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
               prefer_css_page_size=True)
        b.close()
    print(f"\n{PDF.relative_to(ROOT)}  ({PDF.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    if "--render" not in sys.argv:
        print("capturing screens from the frozen bundle...")
        capture()
    render()
