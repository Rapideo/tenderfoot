import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
/* Token layer, imported first so every custom property is defined before any
 * component style can reference one. These two files are copies, not a
 * pointer into prototype/ (workflow spec §2, prototype/ stays read-only and
 * nothing at runtime points back into it) -- "npm run tokens" fails the
 * build if either copy drifts from prototype/PROTOTYPE/src/. Regenerate with
 * `npm run sync:tokens` after `prototype/tools/extract-*.py` produces a new
 * version. See scripts/sync-tokens.mjs. */
import "./tokens/tokens.css";
import "./tokens/type.css";
import { Router } from "./router";

/* The route table itself -- Health plus the dev-only gallery -- now lives in
 * router.tsx (SP2 T3), so it can carry the DEV guard and its own imports
 * without main.tsx needing to know about either. */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
