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
/* The human-readable half of the same array. Deliberately NOT zipped with
 * codeList's output into pairs: the two are filtered independently (a code
 * can be null while its value is present, and vice versa), so positional
 * pairing would silently mis-associate a label with the wrong code. Two flat
 * lists is honest about that; a reader wanting the label for a specific code
 * should read the payload. */
function labelList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const value = (item as Record<string, unknown> | null)?.value;
    if (typeof value === "string" && value.trim()) out.push(value.trim());
  }
  return [...new Set(out)];
}

function codeList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (x as Record<string, unknown> | null)?.code)
    .filter((c): c is string => typeof c === "string" && c.length > 0);
}

/* ⚠️ THE SYMMETRIC CASE org-chain.ts's warnNestedAgency ALREADY SOLVED
 * (final review, fix 3) -- this file had no version of it until now. NAICS
 * and PSC are read as NESTED objects on the sole authority of
 * docs/2026-09-03-highergov-field-mapping.md:56-57. If that document is
 * wrong about the shape, `nestedCode` below silently returns `[]`,
 * `listingCodes` silently returns `null`, and the row loses its codes with
 * nothing anywhere to say why -- pushing a triager who could have rejected
 * for free onto a document fetch instead (~11 billed records, CLAUDE.md
 * §5.2's own arithmetic).
 *
 * UNLIKE THE AGENCY FIELD, THERE IS NO FALLBACK HERE, AND NONE SHOULD BE
 * ADDED. org-chain.ts accepts flat-or-nested because the CODE already
 * asserted a flat shape and the document contradicted it -- two competing
 * claims, and reading both was how it reconciled them without spending a
 * record to find out which was right. Here the code asserted nothing before
 * the document did, so there is no second claim to honour -- only a
 * disagreement to notice. A tolerance nobody could have predicted teaches
 * nothing; it just quietly does the wrong thing forever. Warn only, and let
 * the first live run that disagrees answer the question for free, exactly as
 * org-chain.ts's own warning does for the agency.
 *
 * Two independent flags, not one shared boolean: NAICS and PSC are two
 * separate claims about two separate fields (§56 and §57 of the mapping doc
 * respectively), and one arriving bare must not silence a warning about the
 * other arriving bare on a later row. */
const bareCodeWarned = new Set<string>();

function warnBareCode(field: string, value: string): void {
  if (bareCodeWarned.has(field)) return;
  bareCodeWarned.add(field);
  console.warn(
    `WARNING: HigherGov's ${field} arrived FLAT -- ${field} = ${JSON.stringify(value)}, ` +
      `not the nested { ${field}: { ${field}: ... } } shape ` +
      `docs/2026-09-03-highergov-field-mapping.md:56-57 says to expect. That ` +
      `settles a question this code could not settle for free: the document is ` +
      `wrong about this field's shape, and nestedCode() has been silently ` +
      `returning [] for every row that arrives this way -- each one losing its ` +
      `${field} and, with it, a free rejection this source is priced on ` +
      `(CLAUDE.md §5.2). No fallback was added on purpose -- see this file's own ` +
      `header just above -- so fix the read once this is seen, and delete this ` +
      `warning with it. (Printed once per process, however many rows arrive ` +
      `this way.)`,
  );
}

/** One code out of one of HigherGov's nested code objects -- `{naics_code:
 *  {naics_code: "541611", …}}` -- returned as the same one-or-zero-length
 *  list SAM's arrays produce, so both cases feed `codes` the same shape.
 *
 *  The container is read defensively because a wrong guess about it is
 *  precisely what this costs money for: an array, a bare string or a null
 *  where an object was expected must yield NO code rather than a thrown
 *  merge or a stringified `[object Object]` sitting in the column looking
 *  like a real one. A non-empty bare STRING is the one case worth a word,
 *  not just silent absence -- see warnBareCode above: it is the one shape
 *  that would mean the field-mapping document is wrong. */
function nestedCode(container: unknown, key: string): string[] {
  if (typeof container === "string") {
    if (container.trim()) warnBareCode(key, container.trim());
    return [];
  }
  if (!container || typeof container !== "object" || Array.isArray(container)) return [];
  const code = (container as Record<string, unknown>)[key];
  return typeof code === "string" && code.trim() ? [code.trim()] : [];
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
    /* ⚖️ Ruling ③, 2026-09-07. `sled_forecast` is a real source_type and is
     * NOT in the vendor's documented enum (R4) -- the pre-RFP layer design
     * spec §4.6 asks for, arriving unrequested.
     *
     * 🔴 THIS IS THE ONLY PRODUCER OF 'forecast', and NOT_BIDDABLE is its
     * only consumer. Without this case the ruling is inert: nothing would
     * ever carry the kind, forecasts would sit in the biddable queue, and
     * every test would still pass.
     *
     * Everything else returns null rather than inventing a kind. SAM's own
     * case above reads a published `type.value`; HigherGov publishes no
     * equivalent, and a fabricated kind feeds NOT_BIDDABLE -- which would
     * silently remove real biddable work from the queue. */
    case "HigherGov":
      return r.source_type === "sled_forecast" ? "forecast" : null;

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
): { naics: string[]; psc: string[]; naics_labels: string[]; psc_labels: string[] } | null {
  const r = raw as Record<string, unknown> | null | undefined;
  if (!r) return null;

  switch (sourceName) {
    case "SAM.gov": {
      const naics = codeList(r.naics);
      const psc = codeList(r.psc);
      /* LABELS, added 2026-09-02 and ADDITIVELY on purpose.
       *
       * `codes` is jsonb and existing readers reach for `.naics` / `.psc`,
       * so widening those arrays into objects would break them silently.
       * New sibling keys leave every existing reader working untouched.
       *
       * Why bother: the card showed nothing about what a notice IS, and a
       * bare "339116" only helps a reader who knows their codes by heart.
       * "Dental Laboratories" is the same fact a person can act on. SAM has
       * carried both all along -- `{code, value}` -- and we stored half. */
      const naicsLabels = labelList(r.naics);
      const pscLabels = labelList(r.psc);
      return naics.length || psc.length
        ? { naics, psc, naics_labels: naicsLabels, psc_labels: pscLabels }
        : null;
    }

    /* HIGHERGOV, ADDED 2026-09-07, AND THIS ONE IS MONEY RATHER THAN
     * DISPLAY. CLAUDE.md §5.2 prices human triage at ZERO on the strength of
     * what the listing card carries -- "NAICS, PSC, `set_aside` ... and a
     * description 66% of the time". Strip the codes and a triager looking at
     * a sub-state notice with no description (58% of that segment, which is
     * the segment this source was bought for) has nothing left to reject on,
     * so they open documents: ~11 billed records each against a 1,000/month
     * ceiling. Roughly 90 opens exhausts the month. The omission converts the
     * free triage stage into the paid one.
     *
     * ⚠️ NESTED OBJECTS, NOT STRINGS, and the field name repeats inside the
     * object: `naics_code.naics_code`, `psc_code.psc_code`
     * (docs/2026-09-03-highergov-field-mapping.md:56-57). This is the same
     * trap the same document records for `opp_type` -- "printed as
     * [object Object] on first read" -- and the same one the agency field
     * sprang on this branch. A flat read yields `undefined`, silently, with
     * every test still green.
     *
     * ONE CODE EACH, NOT AN ARRAY. SAM publishes `naics[]`/`psc[]` and this
     * source publishes a single object per code, so the arrays here are
     * one-or-zero long by the source's own shape rather than by a choice
     * made here.
     *
     * NO LABELS, DELIBERATELY. `*_labels` were added for SAM because SAM
     * carries `{code, value}` and we were storing half of it. Nothing in the
     * field-mapping document records a description field on HigherGov's code
     * objects, so guessing at one (`naics_description`? `value`?) would be
     * inventing a field name -- and the card reads labels with optional
     * chaining, so an absent label is a missing chip and not a broken row.
     * Empty lists are what "we have the code and not its label" looks like.
     *
     * A BARE-STRING FALLBACK WAS CONSIDERED AND REJECTED. `org-chain.ts`
     * accepts flat-or-nested for the agency because the CODE already
     * asserted a flat shape and the document contradicted it -- two
     * competing claims and no free way to settle them. Here the code
     * asserted nothing at all, so the document is the only evidence there
     * is, and a tolerance nobody can ever learn from is exactly the defect
     * the warning in org-chain.ts now exists to avoid repeating. */
    case "HigherGov": {
      const naics = nestedCode(r.naics_code, "naics_code");
      const psc = nestedCode(r.psc_code, "psc_code");
      return naics.length || psc.length
        ? { naics, psc, naics_labels: [], psc_labels: [] }
        : null;
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

    /* HIGHERGOV, ADDED 2026-09-07. Flat, unlike its two neighbours in the
     * field-mapping document -- `naics_code` and `psc_code` are flagged
     * nested there and `set_aside` deliberately is not
     * (docs/2026-09-03-highergov-field-mapping.md:58), so this reads the
     * top-level string and no object is walked.
     *
     * 100% PRESENT ON INDIANA, which is what makes it the cheapest rejection
     * signal this source carries and the reason its absence costs money
     * rather than polish -- see listingCodes above for the arithmetic.
     *
     * ⚠️ `"NONE"` IS A VALUE, NOT A NULL, exactly as it is for SAM directly
     * above. Nothing special is done to preserve it -- and that is the
     * point: the temptation is to add `if (v === "NONE") return null` and
     * "tidy" the column, which would destroy the same we-looked /
     * we-did-not-look distinction View 2.3 enforces everywhere else, in the
     * one place a reader has no citation to check it against. A test pins
     * it so the tidy-up fails loudly. */
    case "HigherGov": {
      const sa = r.set_aside;
      return typeof sa === "string" && sa.trim() ? sa.trim() : null;
    }

    default:
      return null;
  }
}
