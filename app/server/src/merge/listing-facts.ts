/* FACTS THE SOURCE STATES ABOUT ITSELF, read out of its own stored payload.
 *
 * THE THIRD INSTANCE, and STATUS predicted it. closes-at.ts was the first
 * defect of this shape and posted-at.ts the second; STATUS's own note said
 * "assume a third instance exists until someone looks." Someone looked, on
 * 2026-09-01, and it is not one column but FIVE. Measured across all 1,724
 * SAM.gov-sourced solicitations, every one of these was null:
 *
 *   kind         0 / 1724     while type.value                    is on 1724
 *   codes        0 / 1724     while naics[] / psc[]               are on ~1687
 *   set_aside    0 / 1724     while solicitation.setAside.code    is on  969
 *   status       0 / 1724     -- deliberately still null, see below
 *   value_cents  0 / 1724     -- NOT AVAILABLE, see below
 *
 * WHY ONE FILE AND NOT THREE. closes-at.ts and posted-at.ts each earned their
 * own module because each had to CHOOSE between competing candidate fields and
 * justify the choice with a measurement. Nothing here chooses anything: each
 * value is a single stated fact copied verbatim. Three near-identical 30-line
 * files would be boilerplate pretending to be structure.
 *
 * ─── TWO COLUMNS THIS FILE DELIBERATELY DOES NOT FILL ────────────────────
 *
 * `status` CARRIES NO INFORMATION FROM THIS SOURCE. The adapter requests
 * `is_active=true`, so isActive is true on 1724 of 1724 by construction, and
 * isCanceled measured `false` on 1724 of 1724. A status column populated from
 * these would hold one value forever. Writing it would look like progress and
 * add nothing a reader could act on; leaving it null and saying so here is the
 * honest report. If the adapter ever stops filtering on is_active, revisit.
 *
 * `value_cents` IS NOT IN THE LISTING, and this answers a question the gate
 * has been blocked on. SAM's search index publishes `award.amount`, which is
 * present on 361 of 1724 -- and that count tracks the 359 rows whose
 * type.value is "Award Notice" almost exactly. It is the amount somebody ALREADY
 * WON, not an estimate on an open opportunity. Reading it into `value_cents`
 * would put award amounts on solicitations and make every value-weighted number
 * wrong in a way nobody could see. **Value-weighting the GO/NO-GO gate cannot
 * be unblocked from SAM listing metadata; the estimate is not published.** It
 * would have to come from document extraction, which is parked.
 */

/** SAM's psc/naics arrays carry objects whose `code` is sometimes null, and
 *  sometimes a category label rather than a code ("R4 - PROFESSIONAL
 *  SERVICES"). Both are kept verbatim -- see `kind` below on why this file
 *  does not clean up a source's vocabulary -- but nulls are dropped, because
 *  a null is the absence of a code rather than a code. */
function codeList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (x as Record<string, unknown> | null)?.code)
    .filter((c): c is string => typeof c === "string" && c.length > 0);
}

/* THE NOTICE TYPE, IN SAM'S OWN WORD. Ruled by Matt, 2026-09-01.
 *
 * `solicitation.kind`'s column comment says `RFP | RFI | RFQ | IFB |
 * sources-sought`. SAM says `Combined Synopsis/Solicitation`, `Award Notice`,
 * `Presolicitation`, `Special Notice`, `Sources Sought`, `Justification`,
 * `Sale of Surplus Property`. **These are not the same vocabulary**, and this
 * is the same collision D2 records for the admin screen's LEGAL column, where
 * the bundle's three strings did not match the schema's three postures.
 *
 * The ruling is to store SAM's word and invent no mapping. A mapping would be
 * a judgement about what a notice IS, made in a merge function, unreviewable,
 * and wrong the first time SAM adds a type. The column holds what the source
 * said; anything that wants a taxonomy can build one where it can be seen.
 *
 * ⚠️ WHAT THIS MAKES VISIBLE, and it is the reason this column mattered most:
 * 495 of 1,724 rows -- 29% -- are Award Notices (359), Special Notices (111),
 * Justifications (23) and Sale of Surplus Property (2). None of those is an
 * opportunity to bid on. **Ruled 2026-09-01: the queue does NOT filter them**,
 * holding spec §1.1 ("V1 returns everything an active source returns"). That
 * ruling was made with the 29% measured and in front of it. The consequence
 * is recorded rather than mitigated: the gate's Interested-per-hundred is
 * computed over a denominator that includes them. */
export function noticeKind(sourceName: string, raw: unknown): string | null {
  const r = raw as Record<string, unknown> | null | undefined;
  if (!r) return null;

  switch (sourceName) {
    case "SAM.gov": {
      const t = r.type as Record<string, unknown> | null | undefined;
      const v = t?.value;
      return typeof v === "string" && v.trim() ? v.trim() : null;
    }
    /* USASpending reports awards, which have no notice type. Naming one would
     * invent a fact; the corpus path sets kind at ingest and never gets here. */
    default:
      return null;
  }
}

/** NAICS and PSC, in the shape `ingest/corpus.ts` already writes so both paths
 *  agree: `{ naics: [...], psc: [...] }`. Returns null when the payload has
 *  neither, so a source with no codes never overwrites a populated column with
 *  an empty object. */
export function listingCodes(
  sourceName: string,
  raw: unknown,
): { naics: string[]; psc: string[] } | null {
  const r = raw as Record<string, unknown> | null | undefined;
  if (!r) return null;

  switch (sourceName) {
    case "SAM.gov": {
      const naics = codeList(r.naics);
      const psc = codeList(r.psc);
      return naics.length || psc.length ? { naics, psc } : null;
    }
    default:
      return null;
  }
}

/* THE SET-ASIDE, AND `NONE` IS A VALUE, NOT AN ABSENCE.
 *
 * Measured distribution: null 755, SBA 603, NONE 195, SDVOSBC 85, WOSB 34,
 * ISBEE 15, HZC 7, 8A 7.
 *
 * `NONE` means the buyer stated there is no set-aside. `null` means the notice
 * did not say. Collapsing them would destroy exactly the we-looked / we-did-
 * -not-look distinction `View 2.3` enforces on every extracted field, and
 * would do it in the one place a reader has no citation to check it against.
 * So `NONE` is stored as the string "NONE" and only a genuinely missing field
 * yields null. */
export function setAside(sourceName: string, raw: unknown): string | null {
  const r = raw as Record<string, unknown> | null | undefined;
  if (!r) return null;

  switch (sourceName) {
    case "SAM.gov": {
      const sol = r.solicitation as Record<string, unknown> | null | undefined;
      const sa = sol?.setAside as Record<string, unknown> | null | undefined;
      const code = sa?.code;
      if (typeof code === "string" && code.trim()) return code.trim();
      /* `originalSetAside` is a defensive fallback only. It disagrees with
       * `setAside` when a notice was amended, and the CURRENT posture is the
       * one a bidder acts on -- so it is read only when the current one is
       * absent entirely. */
      const orig = sol?.originalSetAside as Record<string, unknown> | null | undefined;
      const ocode = orig?.code;
      return typeof ocode === "string" && ocode.trim() ? ocode.trim() : null;
    }
    default:
      return null;
  }
}
