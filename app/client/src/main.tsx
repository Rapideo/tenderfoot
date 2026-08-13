import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
/* Token layer, imported first so every custom property is defined before any
 * component style can reference one. These two files are copies, not a
 * pointer into prototype/ (workflow spec §2, prototype/ stays read-only and
 * nothing at runtime points back into it) -- "npm run tokens" fails the
 * build if either copy drifts from prototype/PROTOTYPE/src/. Regenerate with
 * `npm run sync:tokens` after `prototype/tools/extract-*.py` produces a new
 * version. See scripts/sync-tokens.mjs. */
import "./tokens/tokens.css";
import "./tokens/type.css";
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
