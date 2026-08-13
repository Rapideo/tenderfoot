/* Vercel function entry. Express 4 runs behind a single catch-all function.
 *
 * WHY EXPRESS AND NOT ROUTE HANDLERS: ruled 2026-08-13, workflow spec §9.5.
 * Keeps commonality with IDE8, and keeps this slice reviewable as a driver
 * swap rather than a driver swap plus an API restructure. The question stays
 * open on its own terms.
 *
 * WHY THIS FILE LIVES AT api/, NOT app/api/ (the brief's original path):
 * empirically confirmed 2026-08-13. Vercel's zero-config Serverless Function
 * detection only scans a literal top-level `api/` directory relative to the
 * project root -- it does not walk the tree for a folder named `api`
 * anywhere else. A vercel.json `functions` entry naming `app/api/index.ts`
 * deployed cleanly as far as file upload, then failed build-config
 * validation before the build command ever ran: "doesn't match any
 * Serverless Functions inside the `api` directory." Changing the project's
 * Root Directory setting would also fix this, but that is a Vercel
 * project-resource change and out of scope for this slice. */
export { app as default } from "../app/server/src/index.js";
