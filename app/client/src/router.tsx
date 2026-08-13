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
 * replaces import.meta.env.DEV with false in a production build, so the
 * branch and everything it imports are dropped by tree-shaking.
 *
 * Verified by Task 3 step 4 rather than assumed -- a dev-only route that
 * quietly ships is a route someone eventually links to. */
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
