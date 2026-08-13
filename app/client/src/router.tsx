import {
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
} from "react-router-dom";
import { Health } from "./Health";
import { Gallery } from "./dev/Gallery";

/* The gallery is a DEV-ONLY route. It exists so every primitive can be seen
 * and signed off before any feature is built on it (plan of action §6, SP2's
 * gate). It is not a product surface and must not ship: Vite statically
 * replaces import.meta.env.DEV with false in a production build, so this
 * branch and everything it imports are dropped by tree-shaking.
 *
 * That guard is convention-enforced, not tool-enforced -- nothing here stops
 * a future `import { Gallery } from "./dev/Gallery"` written outside this
 * branch (a debug link, a barrel export, a lazy import "for convenience")
 * from shipping it anyway. What actually enforces the absence is
 * checkGalleryMarkerAbsentFromBuild() in scripts/check.mjs, wired into
 * `npm run check` right after `build`: it greps the real dist/ output for a
 * marker string that exists only in Gallery.tsx and fails the gate if it's
 * there, whichever way it arrived. */
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<Health />} />
      {import.meta.env.DEV && (
        <Route path="/dev/gallery" element={<Gallery />} />
      )}
    </>,
  ),
);

export function Router() {
  return <RouterProvider router={router} />;
}
