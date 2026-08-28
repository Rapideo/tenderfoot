/* One Node-level connection setting, and the reasoning for it.
 *
 * Imported for its SIDE EFFECT by db/index.ts, before any pool is created.
 * It lives in its own module rather than inside index.ts so that it can be
 * tested without a live DATABASE_URL, and so the reasoning has one home
 * instead of becoming a comment nobody re-reads.
 *
 * WHAT IT IS FOR. Node enables happy-eyeballs (`autoSelectFamily`) by
 * default and gives each resolved address only
 * `autoSelectFamilyAttemptTimeout` -- 250 ms -- before abandoning it and
 * moving to the next. When the list is exhausted, `pg` surfaces an
 * AggregateError whose members are one entry per address:
 *
 *   connect ETIMEDOUT  <ipv4>:5432
 *   connect ENETUNREACH <ipv6>:5432
 *   ...
 *
 * That is what a `npm run check` run produced on 2026-08-28 inside
 * `insert()`, failing two db/schema.test.ts cases that passed in isolation
 * and on re-run. It read like a schema flake and was a connection failure.
 *
 * WHY 250 ms IS THE WRONG NUMBER HERE. It is comfortably longer than the
 * round trip -- measured connects to this Neon endpoint were ~350 ms warm,
 * 1051 ms cold, 901 ms under a 100-way burst, all successful. What it is
 * NOT longer than is TCP's retransmit timer: a single dropped SYN waits
 * roughly a second on Windows before trying again. At 250 ms Node gives up
 * on that address first, so a momentary packet loss becomes a hard failure
 * instead of a hiccup. This machine has no IPv6 route either, so every AAAA
 * attempt fails instantly and the address list runs out fast.
 *
 * WHAT THIS DOES NOT DO. It does not fix a flaky network, and the packet-
 * loss trigger is inferred rather than reproduced -- cold-compute,
 * connection-burst and starved-event-loop hypotheses were each tested and
 * each failed to reproduce the error. See connect-tuning.test.ts for those
 * measurements. This only stops the 250 ms budget from pre-empting TCP's
 * own retry, which turns a lost SYN into a delay rather than a failed run.
 *
 * It is a global default, deliberately: every connection this process makes
 * goes to the same place and wants the same behaviour. */
import net from "node:net";

/** Longer than a ~1s TCP retransmit, short enough to still fail fast. */
export const CONNECT_ATTEMPT_TIMEOUT_MS = 2_000;

net.setDefaultAutoSelectFamilyAttemptTimeout(CONNECT_ATTEMPT_TIMEOUT_MS);
