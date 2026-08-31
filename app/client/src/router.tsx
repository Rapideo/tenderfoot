import { Suspense, lazy } from "react";
import {
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
} from "react-router-dom";
import { Health } from "./Health";
import { Admin } from "./admin/Admin";
import { Shell } from "./shell/Shell";
import { Queue } from "./triage/Queue";

/* Placeholder -- the route move (root -> Queue) and the shell are one
 * reviewable unit; Task 11 replaced Queue with the real screen above. Task
 * 13 replaces Record. Still obviously provisional: no data, no behaviour,
 * just enough to prove the route wiring and the shell render together. */
const Record = () => <Shell>Record lands in Task 13.</Shell>;

/* The gallery is a DEV-ONLY route. It exists so every primitive can be seen
 * and signed off before any feature is built on it (plan of action §6, SP2's
 * gate). It is not a product surface and must not ship.
 *
 * C1 (2026-08-14 fix wave): this USED to be a plain static import,
 * `import { Gallery } from "./dev/Gallery"`, on the reasoning that Vite
 * statically replaces import.meta.env.DEV with false in a production build
 * and tree-shaking drops the dead branch and everything it imports. That is
 * true for the JS -- Gallery.tsx's own compiled output, including its
 * "dev-gallery-marker" string, was genuinely absent from every production
 * build. It is NOT true for CSS: Vite/Rollup treats a CSS side-effect import
 * (Gallery.tsx's own `import "./Gallery.css"`) as unconditional the moment
 * a static `import` edge reaches that module, regardless of whether the JS
 * that consumes it later gets tree-shaken from the same bundle. A clean
 * build at HEAD shipped 18 `.gallery-*` selectors into
 * dist/assets/index-*.css while scripts/check.mjs's marker grep -- which
 * only ever looked for the JS-side string -- reported the build clean.
 *
 * The fix is to break the STATIC import edge, not just detect its
 * consequence: `Gallery` is now built only inside `if (import.meta.env.DEV)`,
 * as a React.lazy()-wrapped dynamic import(). Vite's production build
 * replaces import.meta.env.DEV with the literal `false`, and Rollup's dead
 * -code elimination can then prove the `if` block -- lazy() call, import()
 * target, and all -- is unreachable and drops it along with the chunk it
 * would otherwise have emitted. Confirmed: a clean production build now
 * emits a single JS file and a single CSS file, with zero `.gallery-*`
 * selectors and no trace of "dev-gallery-marker" anywhere in dist/.
 *
 * That guard is still convention-enforced, not tool-enforced -- nothing
 * here stops a future `import { Gallery } from "./dev/Gallery"` written
 * outside the `if` above (a debug link, a barrel export, a static import
 * "for convenience") from reintroducing exactly this defect. What actually
 * enforces the absence is checkGalleryMarkerAbsentFromBuild() in
 * scripts/check.mjs, wired into `npm run check` right after `build`: it
 * greps the real dist/ output for a marker string that now exists in BOTH
 * Gallery.tsx (the <h1>) and Gallery.css (a --dev-gallery-marker custom
 * property, added the same day as this fix) and fails the gate if it's
 * found in either, whichever way it arrived. */
let Gallery: ReturnType<typeof lazy> | undefined;
if (import.meta.env.DEV) {
  Gallery = lazy(() =>
    import("./dev/Gallery").then((m) => ({ default: m.Gallery })),
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* The queue is the daily driver and takes the root. The Health page
        * moves to /health; `GET /api/health` -- the endpoint production
        * verification actually calls -- is untouched by this. */}
      <Route path="/" element={<Queue />} />
      <Route path="/solicitation/:id" element={<Record />} />
      <Route path="/health" element={<Health />} />
      {/* NOT dev-only, unlike the gallery above, and that is a departure
        * from SP1's plan text ("a dev-only route ...").
        *
        * That wording was written on 2026-08-12, when the reason was
        * explicit: "SP2 owns the design system and carries the sign-off
        * gate; styling here would pre-empt it." SP2 has since shipped and
        * signed off, so the reason has expired. What remains is the SVRC,
        * which scores View 6.2 one of only two `Pri 5` nodes and calls it
        * V1's entire control surface, and §9.6, which put the scrape
        * trigger on this screen. A control surface behind
        * `import.meta.env.DEV` is not a control surface.
        *
        * ⚠️ It is unauthenticated. The endpoints behind it already were,
        * so this adds no exposure that did not exist -- but it makes it
        * clickable, and production is gated only by Vercel Deployment
        * Protection. "Auth in V1" is open on Matt's list. */}
      <Route path="/admin" element={<Admin />} />
      {import.meta.env.DEV && Gallery && (
        <Route
          path="/dev/gallery"
          element={
            <Suspense fallback={null}>
              <Gallery />
            </Suspense>
          }
        />
      )}
    </>,
  ),
);

export function Router() {
  return <RouterProvider router={router} />;
}
