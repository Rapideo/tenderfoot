import { useEffect, useState } from "react";
import type { HealthResponse, PingResponse } from "@tenderfoot/shared";

/* SP0's demo surface. Deliberately unstyled -- no tokens, no primitives.
 * The design system is SP2 and carries a sign-off gate; styling anything
 * here would pre-empt it. */
export function Health() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [ping, setPing] = useState<PingResponse | null>(null);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth);
  }, []);

  async function doPing() {
    const r = await fetch("/api/health/ping", { method: "POST" });
    setPing(await r.json());
    setHealth(await (await fetch("/api/health")).json());
  }

  return (
    <main>
      <h1>Tenderfoot — SP0</h1>
      <p>Client → API → Postgres. No domain logic.</p>
      <h2>Read</h2>
      <pre>{health ? JSON.stringify(health, null, 2) : "loading…"}</pre>
      <h2>Write</h2>
      <button onClick={doPing}>Write a timestamp</button>
      {ping && <pre>{JSON.stringify(ping, null, 2)}</pre>}
    </main>
  );
}
