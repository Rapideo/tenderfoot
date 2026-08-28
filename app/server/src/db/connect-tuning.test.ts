import { expect, test } from "vitest";
import net from "node:net";
import { CONNECT_ATTEMPT_TIMEOUT_MS } from "./connect-tuning.js";

/* THE FLAKE THIS FILE EXISTS FOR, 2026-08-28.
 *
 * Two cases in db/schema.test.ts failed during one `npm run check` and
 * passed in isolation and on re-run with no code between. The error was not
 * a schema problem at all -- it was `insert()` failing to get a connection:
 *
 *   AggregateError
 *     connect ETIMEDOUT  54.92.227.85:5432
 *     connect ENETUNREACH 2600:1f10:...:5432
 *     connect ETIMEDOUT  3.215.191.145:5432
 *     connect ENETUNREACH 2600:1f10:...:5432
 *
 * That alternating shape is Node's happy-eyeballs path. `autoSelectFamily`
 * is on by default and gives each address `autoSelectFamilyAttemptTimeout`
 * -- 250 ms -- before abandoning it. Forcing that value to 1 ms reproduces
 * the signature exactly.
 *
 * THREE HYPOTHESES WERE TESTED AND ALL THREE WERE WRONG, which is why the
 * number below is a mitigation and not a cure:
 *   - cold compute? A genuinely cold Neon connect took 1051 ms and still
 *     SUCCEEDED at the 250 ms default. The proxy completes the TCP
 *     handshake promptly and makes you wait at the TLS/Postgres layer,
 *     which happy-eyeballs does not police.
 *   - connection burst? 100 simultaneous connects, zero failures.
 *   - starved event loop? Blocking it for 3 s only delayed the connect to
 *     3363 ms; the timer does not fire spuriously.
 *
 * What no probe here can stage is PACKET LOSS. A dropped SYN waits for
 * TCP's retransmit timer -- ~1 second on Windows -- which is four times the
 * 250 ms budget. Node abandons the address rather than letting TCP retry,
 * and with IPv6 unreachable on this machine the address list runs out fast.
 * That is consistent with a failure that is rare, random, and indifferent
 * to load and temperature. Consistent with, not proven.
 *
 * So this does not fix a flaky network. It stops a 250 ms budget from
 * pre-empting TCP's own retransmit, turning a lost SYN into a delay rather
 * than a failed gate run. */

test("the connect attempt budget outlasts a TCP retransmit, not just an RTT", () => {
  /* ~1s is the retransmit timer this exists to survive; anything at or
   * below it re-opens the hole. */
  expect(CONNECT_ATTEMPT_TIMEOUT_MS).toBeGreaterThan(1000);
});

test("importing the module actually applies it to Node's default", () => {
  /* The export alone proves nothing -- the side effect is the point. */
  expect(net.getDefaultAutoSelectFamilyAttemptTimeout()).toBe(CONNECT_ATTEMPT_TIMEOUT_MS);
});
