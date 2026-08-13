/* Types shared by client and server.
 *
 * SP0 carries only what the health check needs. The domain model -- the
 * eleven objects of design spec §4 -- arrives in SP1, and the rule-bearing
 * comments from prototype/PROTOTYPE/src/app.js move here with it
 * (workflow spec §2). Do not add domain types before then. */

export interface HealthResponse {
  ok: boolean;
  /** Migrations applied, newest last. */
  migrations: string[];
  /** Server-side read of app_meta, proving the DB round-trips. */
  meta: Record<string, string>;
}

export interface PingResponse {
  ok: boolean;
  /** ISO timestamp just written to app_meta by the server. */
  wroteAt: string;
}
