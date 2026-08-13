import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { Health } from "./Health";

/* One route in SP0, purely to prove routing works. The real route table
 * follows the SVRC's seven screens and is SP2/SP6 work.
 *
 * Routing is an ADDITION to the IDE8 stack and a pre-authorised deviation
 * from the prototype, which has none (design spec §7.10). */
const router = createBrowserRouter([{ path: "/", element: <Health /> }]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
