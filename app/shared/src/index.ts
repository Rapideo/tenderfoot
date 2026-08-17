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

/* The four-state health vocabulary, corrected at the SP2 sign-off gate on
 * 2026-08-14. There are FOUR states, not three, and "degraded" was never one
 * of them: the bundle reads Healthy / Rot suspected / Failing / Not
 * ingested, and `StatusDot` was renamed to carry these exactly. They run
 * green / yellow / red / grey in plain ascending severity, and the apparent
 * inversion that prompted the review ("rot" yellow, "failing" red) is
 * correct -- a suspicion warns, a confirmation errors. */
export type SourceHealth = "Healthy" | "Rot suspected" | "Failing" | "Not ingested" | "unknown";

/* ⚠️ `unknown` IS THE FIFTH VALUE, AND IT IS THE ONLY ONE IN PRODUCTION.
 *
 * Found 2026-08-16 by rendering the screen against real data rather than a
 * fixture -- every one of the 13 rows reads "unknown". The column is
 * `health text NOT NULL DEFAULT 'unknown'` with NO CHECK constraint, so the
 * schema's vocabulary and the bundle's four states were never the same set,
 * and nothing anywhere writes this column.
 *
 * A SECOND VOCABULARY MISMATCH OF THE SAME SHAPE AS legal_posture, and the
 * tests could not have caught it: they supplied the bundle's words as
 * fixtures, so they asserted the mapping worked on values production does
 * not contain.
 *
 * DO NOT COLLAPSE `unknown` INTO `Not ingested`. They are different facts
 * and the difference is live right now: SAM.gov has been ingested twice
 * (530 rows and 57 rows on 2026-08-16), so rendering it "Not ingested"
 * would be false. `unknown` means nobody has measured; "Not ingested" means
 * measured and empty.
 *
 * WHAT FILLS IT: nothing yet, and that is precisely the work §6.4 A3 moved
 * in front of the GO gate on 2026-08-16 -- a read-only liveness surface.
 * This column is its output. Until then the honest render is a grey dot and
 * the literal word. */

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
  /* Typed `string`, not `SourceHealth`, and that is deliberate. The column is
   * NOT NULL so it is never absent -- but it has NO CHECK constraint, so
   * `SourceHealth` documents the vocabulary anyone SHOULD write while the
   * type admits what the database can actually hand back. Narrowing this to
   * the union would be a claim the schema does not enforce, and a consumer
   * that exhaustively switched on it would be wrong the first time a typo
   * landed. Render unrecognised values; do not assume them away. */
  health: string;
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
 *   health    -> source.health         the four states above
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
