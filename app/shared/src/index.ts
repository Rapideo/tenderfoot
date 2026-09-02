/* Types shared by client and server.
 *
 * SP1 T12 -- THE TRANSFER POINT (workflow spec §2). From here on
 * `app/shared/` is the authority for the rule-bearing comments that used to
 * live only in `prototype/PROTOTYPE/src/app.js`, and the prototype's copy is
 * a historical artifact.
 *
 * ===========================================================================
 * T12 -- WHAT THE RE-EXTRACTION ACTUALLY FOUND, 2026-08-16
 * ===========================================================================
 * The task was written expecting the dataset to have MOVED between the
 * bundle app.js was extracted from (2026-08-10) and the frozen reference.
 * It did not. Compared against `Tenderfoot UI Mockups V1.2.html`:
 *
 *   - all five opportunity ids identical, and in the same order
 *     (in-fssa-ltss, naspo-ogs, in-doh-cboa, in-doe-transport, in-fssa-mco)
 *   - all five titles byte-identical
 *   - every field name in app.js is present in the bundle
 *
 * Consistent with V1.2's own verification (colours 132 -> 132, media queries
 * 0 -> 0, one disclosed wrapper). So the re-extraction is a NO-OP on the
 * opportunity data, and the comments in app.js did not need carrying onto
 * changed shapes.
 *
 * THE REAL FINDING IS THE OTHER DIRECTION. The bundle carries 291 distinct
 * keys; app.js captured 61. The 2026-08-10 extraction took the OPPORTUNITY
 * dataset and left three others behind entirely:
 *
 *   sources[]  -- the Source Registry rows        (View 6.2, `Pri 5`)
 *   profile[]  -- the Firm Profile fields         (View 6.1)
 *   yields[]   -- the per-source yield table
 *
 * Those are exactly the datasets the admin screens are built from, so the
 * gap was invisible until something needed them. They are recorded below
 * rather than added to app.js: app.js is the frozen prototype's artifact and
 * this file is now the authority.
 * ===========================================================================
 */

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

/* ---- SOURCE REGISTRY -----------------------------------------------------
 *
 * RULE: sources are DATA ROWS, NOT CODE (design spec §5, SVRC View 6.2).
 * Adding a source is a row and a config, never a deploy. The prototype's own
 * subtitle states it: "Sources are rows, not code. Adding one is a row and a
 * config."
 *
 * RULE: this screen is V1's ENTIRE CONTROL SURFACE. The SVRC scores it one
 * of only two `Pri 5` nodes -- "switching a source on or off is the only
 * lever there is" -- because nothing in V1 filters or ranks. What the user
 * sees is decided here and nowhere else.
 *
 * RULE: legal posture is a FIRST-CLASS FIELD, not a note (§5.5). Ambiguous
 * terms default a source to `out`; only documented permission moves it `in`.
 * The registry is where that is visible and enforced, rather than
 * remembered -- View 6.2's own "Known gaps" names this.
 */
export type LegalPosture = "in" | "manual-only" | "out";

/* StatusDot's FOUR display states were corrected at the SP2 sign-off gate on
 * 2026-08-14 -- Healthy / Rot suspected / Failing / Not ingested, running
 * green / yellow / red / grey in plain ascending severity ("rot" warns
 * yellow because it is a suspicion, "failing" errors red because it is a
 * confirmation). `StatusDot` still carries exactly these four words today
 * (see `StatusDot.tsx`) -- nothing here changes that.
 *
 * `SourceHealth` USED TO BE that same vocabulary, and that was the defect.
 * D6/T13 found 2026-08-16, by rendering the screen against real data rather
 * than a fixture, that `source.health` never held any of those four words:
 * the column was `health text NOT NULL DEFAULT 'unknown'` and, at the time,
 * had NO CHECK constraint, so the schema's real vocabulary and the bundle's
 * display words had never been the same set. Every one of the 13 production
 * rows read `unknown` -- the tests could not have caught this, because they
 * supplied the bundle's words as fixtures and so asserted a mapping over
 * values production does not contain. The same shape of mismatch as
 * `legal_posture` (see D2 in `docs/admin-deviations.md`).
 *
 * `unknown` was never collapsed into `Not ingested`, on purpose: "nobody has
 * measured" and "measured, and it's empty" are different facts, and the
 * difference was live at the time -- SAM.gov had been ingested twice (530
 * rows, 57 rows, both 2026-08-16) and still read `unknown`.
 *
 * RESOLVED by migration 006 (SP3.6, 2026-08-18): `source_health_valid` now
 * CHECKs `health` against exactly these five values, and an operator-invoked
 * probe subsystem writes them --
 * `docs/superpowers/specs/2026-08-17-source-health-design.md`. `off` /
 * "Not ingested" is deliberately NOT one of the five (design spec §12, H1):
 * under "health = is it up", a disabled-but-reachable source has no
 * ingestion fact to carry here -- that already lives in `enabled` and
 * `last_run_at`. `StatusDot`'s four states are unchanged by any of this;
 * this is only about which values the HEALTH COLUMN may hold, which is now
 * a different, smaller set than what the primitive can render. */
export type SourceHealth = "ok" | "failing" | "rot" | "excluded" | "unknown";

export interface SourceRow {
  id: number;
  name: string;
  jurisdiction: string | null;
  /** §5.7: adapters bind to PLATFORM plus config, not to jurisdiction.
   * States mostly license about five platforms rather than building
   * portals, so one Periscope adapter covers several states. This field is
   * what makes the registry scale. */
  platform: string | null;
  adapter_tier: string | null;
  legal_posture: LegalPosture;
  legal_note: string | null;
  archive_depth: string | null;
  /** §5.4. Which request parameters this source was OBSERVED to honour, and
   * which it accepted and silently ignored. The SVRC listed this as View
   * 6.2's open question -- "should the registry record verified facets per
   * source?" -- because that knowledge lived in markdown where no adapter
   * could read it. ANSWERED IN PRACTICE 2026-08-16: the `is_active` finding
   * was written here the day it was found, and this is now where a
   * parameter's status is recorded. */
  verified_facets: unknown;
  since_default: string | null;
  last_run_at: string | null;
  /* Typed `string`, not `SourceHealth`, was deliberate through 2026-08-18.
   * The column was NOT NULL so it was never absent -- but it had NO CHECK
   * constraint, so `SourceHealth` documented the vocabulary anyone SHOULD
   * write while the type admitted what the database could actually hand
   * back. Narrowing it would have been a claim the schema did not enforce,
   * and a consumer that exhaustively switched on it would have been wrong
   * the first time a typo landed.
   *
   * Migration 006 (SP3.6) made that premise false: `source_health_valid` now
   * CHECKs this column against exactly `SourceHealth`'s five values, so the
   * union is no longer a claim the schema declines to enforce -- it IS what
   * the schema enforces. Narrowed accordingly. */
  health: SourceHealth;
  /* Migration 006 (SP3.6). A verdict with no timestamp is the stale-green
   * trap: health is only measured when an operator asks, so a value can be
   * arbitrarily old and a green dot from three weeks ago would read as
   * current. NULL on every row nothing has measured (`excluded`, `unknown`)
   * -- a timestamp on an unprobed row would be the same lie this column
   * exists to prevent. */
  health_checked_at: string | null;
  /* Migration 006 (SP3.6). WHICH probe ran -- `generic-url` and a
   * platform-specific probe (e.g. `sam`) are different strengths of claim,
   * and only the latter can ever produce `rot`. NULL wherever
   * `health_checked_at` is NULL, for the same reason. */
  health_method: string | null;
  /* Migration 006 (SP3.6). WHY -- `connect ETIMEDOUT`, `HTTP 503`, `query
   * returned 0 rows` for a real probe result; the exclusion rule (e.g.
   * `legal_posture=out`) for an excluded row, so the reason survives even a
   * read that drops the neighbouring columns. Without it `failing` is a red
   * dot with no lead. */
  health_note: string | null;
  /* Migration 006 (SP3.6). The generic probe's target URL. NULL where a
   * platform-specific probe exists instead (SAM, USASpending today) -- see
   * `app/server/src/health/probes/registry.ts`. */
  probe_url: string | null;
  enabled: boolean;
  source_note: string | null;
}

/* ---- T13: RECONCILIATION AGAINST THE PROTOTYPE'S DATA MODEL --------------
 *
 * Proto2PRD §4.1.1 makes the production model "this dataset normalised", so
 * a field the prototype shows and the schema lacks is a finding. Checked
 * 2026-08-16 against V1.2's `sources[]` and `profile[]`.
 *
 * SOURCE REGISTRY -- five of six columns map cleanly:
 *
 *   name      -> source.name           name
 *   archive   -> source.archive_depth  "archive: 24mo"
 *   platform  -> source.platform       "Periscope"
 *   tier      -> source.adapter_tier   "T1 API"
 *   health    -> source.health         the vocabulary above at the time --
 *                                       superseded 2026-08-18 by migration
 *                                       006's five-value DB enum; see
 *                                       `SourceHealth`
 *
 * ONE MISMATCH, AND IT IS A VOCABULARY MISMATCH, NOT A MISSING COLUMN.
 * The prototype's LEGAL column reads "ToS OK" / "Rate-limited" / "EXCLUDED".
 * The schema stores a posture: 'in' / 'manual-only' / 'out'. These are not
 * the same axis. "EXCLUDED" maps to `out` and "ToS OK" to `in`, but
 * "Rate-limited" describes a CONSTRAINT while `manual-only` describes a
 * POSTURE -- a rate-limited source may still be `in`. The prototype's three
 * strings are display labels blending posture with rationale, and the
 * rationale half has a home already: `legal_note`.
 *
 * NOT resolved by inventing a mapping. The registry is editable in T15, and
 * an editor must write the real enum rather than a display string, so the
 * built screen shows the posture and records this as a deviation. See
 * `docs/admin-deviations.md`.
 *
 * FIRM PROFILE -- all five prototype fields map, and the fifth is the
 * interesting one:
 *
 *   SERVICE LINES                        -> capabilities
 *   CERTIFICATIONS                       -> certifications
 *   GEOGRAPHY                            -> geography
 *   ELIGIBILITY FACTS - GATE INPUTS ONLY -> hard_limits
 *   PAST PERFORMANCE LIBRARY             -> past_performance
 *
 * The prototype renders PAST PERFORMANCE as EMPTY, greyed, captioned "Field
 * kept in the model so the capability can return without a migration
 * (§4.2)". The schema comment, written independently, reads "Deferred
 * 2026-08-10: records not accessible. Stays in the model, stays empty,
 * NOTHING may be designed to depend on it (§7.3)." THE PROTOTYPE AND THE
 * SCHEMA AGREE, including on the deferral and its reason. That is the
 * strongest evidence yet that §4 and the prototype's model are the same
 * model -- which is precisely what T13 existed to find out and what nobody
 * had checked.
 *
 * Three schema columns the prototype does not render -- `codes`,
 * `remote_ok`, `negative_profile` -- are deliberate omissions rather than
 * gaps. `negative_profile` in particular "lost its last source when the
 * hand-run was retired 2026-08-11; fills from real decisions or not at all."
 *
 * STILL IN app.js AND NOT YET MOVED: the opportunity model (`OPPS`,
 * `DETAILS`, `GATED`) and its chip vocabularies. Those belong to the triage
 * queue, which SP6 composes; moving them here now would be speculative, and
 * the scope note at the head of app.js (V1 has no scores) still governs them.
 */
export interface FirmProfile {
  id: number;
  vendor_id: number;
  vendor_name: string;
  /** Free text; the prototype labels this SERVICE LINES. */
  capabilities: string | null;
  codes: unknown;
  certifications: unknown;
  geography: unknown;
  remote_ok: boolean;
  /** ELIGIBILITY THRESHOLDS ONLY (§1). These answer "can KP legally bid
   * this", never "should KP take this on". The system is capacity-agnostic,
   * and that rule binds the machine rather than the user. The prototype's
   * own label carries the guard in capitals: "GATE INPUTS ONLY". */
  hard_limits: unknown;
  /** Deferred 2026-08-10, records not accessible. Stays in the model, stays
   * empty, and NOTHING may be designed to depend on it (§7.3). */
  past_performance: string | null;
  negative_profile: string | null;
  updated_at: string;
}

/** The fields `PATCH /api/sources/:id` accepts. `enabled` is the lever the
 * SVRC calls the only one there is.
 *
 * TWO SERVER-SIDE RULES A UI MUST EXPECT TO FAIL AGAINST, both verified in
 * `routes/index.ts` rather than assumed from the plan:
 *
 *   1. Changing `legal_posture` REQUIRES a new `legal_note` recording the
 *      evidence for THIS change -- the existing note documents the previous
 *      posture, so carrying it forward would leave a row reading "in" beside
 *      evidence for "manual-only", which is worse than no note because it
 *      looks documented.
 *
 *   2. Setting `enabled` true REQUIRES a `since_default` window, existing or
 *      supplied. A source enabled with no window would let a first run pull
 *      everything.
 *
 * Both return 400. A screen that swallows them turns a fail-closed guard
 * into a control that silently does nothing. */
export interface SourcePatch {
  enabled?: boolean;
  legal_posture?: LegalPosture;
  legal_note?: string;
  since_default?: string;
  health?: SourceHealth;
}

/* ===========================================================================
 * THE DISCOVERY CHANNEL — migration 013, 2026-09-02
 * ===========================================================================
 * Design spec §8.5 names discovery "the whole measure": qualified
 * opportunities surfaced THAT WOULD NOT HAVE BEEN SEEN. `nowhere` is that
 * count; every other value names the channel Tenderfoot is merely
 * duplicating, which is the half a yes/no cannot give.
 *
 * THIS LIVES IN `shared` FOR THE `SourceHealth` REASON, and it is the same
 * mistake avoided twice. Migration 013's CHECK constraint is the authority;
 * a union declared next to one consumer becomes a second authority that
 * drifts silently, and a value the constraint allows but a consumer omits is
 * a decision the metric cannot count. Server (`triage/decide.ts`) and client
 * (`triage/Queue.tsx`) both read THIS array, so the vocabulary exists once.
 *
 * ORDER IS THE MIGRATION'S ORDER, and it is also the order the chips render
 * in. `nowhere` sits fifth rather than first on purpose: it is the answer the
 * gate wants to be true, and putting the flattering option under the cursor
 * is how a measurement talks itself into a number.
 */
export const DISCOVERY_CHANNELS = [
  /** already on KP's radar before Tenderfoot showed it */
  "already_knew",
  /** Indiana's own notifications would have caught it (§5.7) */
  "indiana_email",
  /** a procurement portal KP checks directly */
  "portal",
  /** someone would have mentioned it */
  "colleague",
  /** NOTHING would have surfaced it -- the discovery count */
  "nowhere",
  /** answered honestly rather than skipped invisibly */
  "not_sure",
  /** none of the above; detail goes in the existing reason box */
  "other",
] as const;

export type DiscoveryChannel = (typeof DISCOVERY_CHANNELS)[number];
