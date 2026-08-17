import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

/* The defect this file exists to make impossible to reintroduce.
 *
 * Every type token in type.css names 'IBM Plex Sans' or 'IBM Plex Mono', and
 * Admin.css names them again in fifteen more places -- and until 2026-08-17
 * NOTHING IN THE APP EVER FETCHED EITHER ONE. No <link> in index.html, no
 * @font-face anywhere under src/. Every screen rendered in whatever the
 * viewer had installed, /dev/gallery at the SP2 sign-off gate included.
 *
 * Nothing failed. That is the whole problem: a page that names a font it
 * never loads renders perfectly, in the wrong face, and reports success --
 * the same shape as the SAM `is_active=false` run that scraped 5.5M archived
 * notices and called itself done. The only signal is the source itself.
 *
 * So these are static tests over the stylesheets, not render tests. jsdom
 * does not load fonts and would agree that everything is fine either way. */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..");
const FONTS_CSS = resolve(HERE, "fonts.css");

/* Comments in this repo's CSS quote real declarations from the bundle --
 * Button.css alone carries six `font:600 14px/1 'IBM Plex Sans'` lines inside
 * a comment block. Scanning them would invent requirements the app does not
 * have, so they come out first. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function everyCssFile(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...everyCssFile(full));
    else if (entry.name.endsWith(".css")) out.push(full);
  }
  return out;
}

type Use = { family: string; weight: number; where: string };

/* Matches a font shorthand VALUE -- weight, size/line-height, quoted family --
 * without caring which property it was assigned to. That breadth is the
 * point, and an earlier narrower version of this regex is why:
 *
 *   font: 600 17px/1.2 "IBM Plex Sans";              <- Admin.css, a rule
 *   --type-display: 600 64px/1 'IBM Plex Mono';      <- type.css, a token
 *
 * Anchoring on `font:` found the first form and none of the second, which
 * skipped type.css entirely -- the file that names the families 88 times and
 * the whole reason this test exists. It matched 14 usages and looked healthy.
 * Match the value, not the property name. */
const SHORTHAND = /(\d{3})\s+[\d.]+px(?:\s*\/\s*[\d.]+)?\s+['"]([^'"]+)['"]/g;

function usagesIn(file: string): Use[] {
  const css = stripComments(readFileSync(file, "utf8"));
  const where = relative(SRC, file).replace(/\\/g, "/");
  const uses: Use[] = [];
  for (const m of css.matchAll(SHORTHAND)) {
    const [, weight, family] = m;
    /* Both groups are mandatory in the pattern, so an absent one means the
     * pattern was edited and this scan no longer parses what it claims to.
     * Throwing beats coercing: a silently-undefined family would drop the
     * usage and shrink the very set these tests measure. */
    if (weight === undefined || family === undefined) {
      throw new Error(`SHORTHAND matched without both groups in ${where}: ${m[0]}`);
    }
    uses.push({ family, weight: Number(weight), where });
  }
  return uses;
}

type Face = { family: string; min: number; max: number; urls: string[] };

function declaredFaces(): Face[] {
  const css = stripComments(readFileSync(FONTS_CSS, "utf8"));
  const faces: Face[] = [];
  for (const block of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = block[1] ?? "";
    const family = body.match(/font-family\s*:\s*['"]([^'"]+)['"]/)?.[1];
    const weight = body.match(/font-weight\s*:\s*([^;]+);/)?.[1]?.trim();
    if (!family || !weight) throw new Error(`@font-face missing family or weight:\n${body}`);
    /* "100 700" is a variable axis range; "400" is a static face. Both are
     * legal CSS and they mean different things -- a range covers every weight
     * inside it, a single value covers exactly one. */
    const parts = weight.split(/\s+/).map(Number);
    const min = parts[0];
    const max = parts[parts.length - 1];
    if (min === undefined || max === undefined || Number.isNaN(min) || Number.isNaN(max)) {
      throw new Error(`@font-face has an unreadable font-weight "${weight}" for ${family}`);
    }
    const urls = [...body.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].flatMap((u) =>
      u[1] === undefined ? [] : [u[1]],
    );
    faces.push({ family, min, max, urls });
  }
  return faces;
}

const USES = everyCssFile(SRC).flatMap(usagesIn);
const FACES = declaredFaces();

test("the scan found real usages, so a silent parse failure cannot pass this file", () => {
  /* Without this, a regex that stopped matching would make every test below
   * vacuously true -- the exact "passed because it checked nothing" failure
   * the sync-tokens guard was written to prevent. */
  expect(USES.length).toBeGreaterThan(50);
  expect(FACES.length).toBeGreaterThan(0);
  expect(new Set(USES.map((u) => u.family)).size).toBeGreaterThan(1);
});

test("every font family the stylesheets name has a face that fetches it", () => {
  const declared = new Set(FACES.map((f) => f.family));
  const missing = [...new Set(USES.map((u) => u.family))].filter((f) => !declared.has(f));
  expect(missing, `named in CSS but never fetched: ${missing.join(", ")}`).toEqual([]);
});

test("every weight the stylesheets ask for is covered by a declared face", () => {
  const uncovered = USES.filter(
    (u) => !FACES.some((f) => f.family === u.family && u.weight >= f.min && u.weight <= f.max),
  ).map((u) => `${u.family} ${u.weight} (${u.where})`);
  expect([...new Set(uncovered)], "asked for, not declared").toEqual([]);
});

test("every file a face points at exists and is a non-empty woff2", () => {
  for (const face of FACES) {
    expect(face.urls.length, `${face.family} declares no src`).toBeGreaterThan(0);
    for (const url of face.urls) {
      const path = resolve(HERE, url);
      expect(existsSync(path), `${face.family} -> missing ${url}`).toBe(true);
      expect(statSync(path).size, `${face.family} -> empty ${url}`).toBeGreaterThan(1000);
      /* woff2 files begin with the four-byte signature "wOF2". A truncated
       * or wrong-format file would still satisfy the size check. */
      const sig = readFileSync(path).subarray(0, 4).toString("latin1");
      expect(sig, `${url} is not a woff2`).toBe("wOF2");
    }
  }
});

test("main.tsx actually imports fonts.css", () => {
  /* A face block nobody imports is the original bug wearing a hat: declared,
   * correct, and never loaded. Vite only emits the woff2 files because this
   * import pulls the stylesheet into the graph. */
  const main = readFileSync(resolve(SRC, "main.tsx"), "utf8");
  expect(main).toMatch(/import\s+["']\.\/tokens\/fonts\.css["']/);
});

test("no font-family declaration form goes unscanned", () => {
  /* The shorthand is the only form this codebase uses today. If someone adds
   * a standalone `font-family:` rule, the scan above would not see it and the
   * coverage tests would quietly stop covering it. Fail here instead, so the
   * scanner gets extended rather than silently outgrown. */
  const strays: string[] = [];
  for (const file of everyCssFile(SRC)) {
    if (file === FONTS_CSS) continue; // its own @font-face rules are the point
    const css = stripComments(readFileSync(file, "utf8"));
    if (/font-family\s*:/.test(css)) strays.push(relative(SRC, file).replace(/\\/g, "/"));
  }
  expect(strays, "standalone font-family found; extend the scanner in fonts.test.ts").toEqual([]);
});
