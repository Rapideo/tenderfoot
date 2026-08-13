import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    /* Proxy rather than CORS in the browser: the client calls /api/* on its
     * own origin in dev and in production alike, so there is no environment
     * where the URL differs. */
    proxy: { "/api": "http://localhost:3003" },
  },
});
