/* Runs the server and the client together.
 *
 * package.json used to do this with `npm run dev --workspace app/server &
 * npm run dev --workspace app/client`. THAT DOES NOT WORK ON WINDOWS: npm
 * runs scripts through cmd.exe, where `&` is a sequential separator rather
 * than a backgrounding operator, so the server started, never exited, and
 * THE CLIENT NEVER RAN AT ALL. Silent -- `npm run dev` printed a server
 * banner and looked healthy, and the missing Vite banner is easy to read as
 * scrollback. Found 2026-08-16 when /admin would not load.
 *
 * Same spawn-and-forward shape as scripts/check.mjs, and no new dependency:
 * a concurrently/npm-run-all install would be a package added to fix a
 * shell quoting difference.
 */
import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const children = ["app/server", "app/client"].map((ws) =>
  spawn(npm, ["run", "dev", "--workspace", ws], {
    stdio: "inherit",
    /* Windows resolves npm.cmd through the shell; without this, spawn
     * raises EINVAL on a .cmd target under Node's stricter child_process
     * argument handling. */
    shell: process.platform === "win32",
  }),
);

/* If either half dies, take the other with it. A half-running dev
 * environment is the failure this file exists to stop, so it must not be
 * reachable by one process crashing either. */
let closing = false;
function stopAll(code) {
  if (closing) return;
  closing = true;
  for (const c of children) c.kill();
  process.exit(code ?? 0);
}

for (const c of children) c.on("exit", (code) => stopAll(code ?? 0));
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
