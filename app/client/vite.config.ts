import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    /* Proxy rather than CORS in the browser: the client calls /api/* on its
     * own origin in dev and in production alike, so there is no environment
     * where the URL differs. */
    /* The target is overridable because 3003 is not always ours: this machine
     * also runs IDE8, whose server takes 3003 first if it started first, and a
     * hardcoded target then sends every /api call to the wrong application —
     * which answers 404 rather than failing, so it reads as a broken route.
     * Found 2026-09-08. `VITE_API_TARGET=http://localhost:3010 npm run dev
     * --workspace app/client` pairs with `PORT=3010` on the server. */
    proxy: { "/api": process.env.VITE_API_TARGET ?? "http://localhost:3003" },
  },
});
