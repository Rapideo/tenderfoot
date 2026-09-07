/* Reading the buying organisation out of a sighting's raw payload.
 *
 * THIS FILE IS SOURCE-COUPLED ON PURPOSE, and it is the only place in the
 * merge that is. `merge.ts` groups sightings from every source together and
 * must not know what any of them look like; but "who issued this" lives at a
 * different path in every payload, and there is nowhere else to put that
 * knowledge. Keeping it in one named, tested module is the honest version of
 * a coupling that cannot be designed away -- burying the same paths inline in
 * merge.ts would hide it without removing it.
 *
 * The alternative considered and rejected: have each adapter normalise an
 * organisation name at scrape time. That would mean writing a derived field
 * into the artifact, and `sighting.raw` is specified as "the payload as
 * received, unmodified" (002_entity_graph.sql:191). Deriving at merge time
 * keeps the sighting a faithful record and lets this mapping be corrected
 * later WITHOUT a re-scrape -- which matters, because a re-scrape cannot
 * recover a window that has since closed.
 *
 * A source with no entry here yields an empty chain, and an empty chain
 * leaves org_id NULL. That is deliberate: inventing an organisation from a
 * payload nobody has characterised is how the corpus loader once tagged 62
 * federal agencies with jurisdiction 'IN' (SP1 execution record, defect 4).
 * Silence is recoverable; a wrong organisation is not.
 */

/* ⚠️ A TOLERANCE THAT TEACHES NOTHING IS HALF A FIX, and this is the other
 * half. The HigherGov case below accepts a flat `agency_name` OR a nested
 * `agency.agency_name` because the code and the field-mapping document
 * disagree and settling it live costs metered records (CLAUDE.md §5.1). As
 * first written, whichever shape was real, the merge would quietly succeed
 * and nobody would ever find out which -- so the guess would still be
 * unresolved after the run that could have answered it for free.
 *
 * This warns exactly ONCE PER PROCESS when the nested branch is the one that
 * produced the name, which is the only case that carries information: it
 * means the document is right and the code's original flat assumption was
 * wrong. The flat branch firing tells us nothing new, so it says nothing.
 *
 * Once, not per row: a merge walks every group, and if the nested shape is
 * the real one this would otherwise print thousands of identical lines and
 * bury the rest of the run's output.
 *
 * NON-FATAL, AND ENFORCED, NOT MERELY ASSERTED (final review, fix 1): the
 * name has already been read into `names` by the time this is called, and
 * the call itself is wrapped in a try/catch at its call site below -- a
 * console.warn that throws (a broken stream, a hijacked global) is swallowed
 * there, not left to propagate out of orgChain and take the whole merge down
 * with it. As first written this call sat one line BEFORE the assignment and
 * unguarded, so the claim below used to be false; it is checked by
 * org-chain.test.ts's "the warning never changes what the chain resolves to"
 * with a console.warn that actually throws, not just one that is mocked
 * quiet. The warning is a note to a reader, never a control-flow
 * decision. */
let nestedAgencyWarned = false;

function warnNestedAgency(name: string): void {
  if (nestedAgencyWarned) return;
  nestedAgencyWarned = true;
  console.warn(
    `WARNING: HigherGov's buying agency arrived NESTED -- agency.agency_name ` +
      `= ${JSON.stringify(name)}, with no flat agency_name beside it. That ` +
      `settles a question this code could not settle for free: ` +
      `docs/2026-09-03-highergov-field-mapping.md:55 is right and the flat ` +
      `read org-chain.ts shipped with was an assumption no captured response ` +
      `ever backed. Drop the flat branch and this warning together. ` +
      `(Printed once per process, however many rows arrive this way.)`,
  );
}

/** Top-level first, buying office last. Empty when the source is unknown or
 * the payload carries nothing usable. */
export function orgChain(sourceName: string, raw: unknown): string[] {
  const r = raw as Record<string, any> | null | undefined;
  if (!r) return [];

  let names: unknown[];
  switch (sourceName) {
    case "SAM.gov":
      /* `organizationHierarchy` is an array of {level, name}, level 1 the
       * department and level 5 the office. Sorted rather than trusted in
       * array order -- nothing in §5.4's characterisation covered ordering
       * of this field, and this repo has been bitten by trusting an
       * unverified property of a SAM response before (sort=-publishDate). */
      names = Array.isArray(r.organizationHierarchy)
        ? [...r.organizationHierarchy]
            .sort((a, b) => Number(a?.level ?? 0) - Number(b?.level ?? 0))
            .map((h) => h?.name)
        : [];
      break;

    case "USASpending":
      /* One level only: the adapter requests "Awarding Agency" and not
       * "Awarding Sub Agency", so this source resolves to a shallower chain
       * than SAM.gov's for the same buyer. Recorded rather than papered
       * over -- widening it means changing the adapter's field list, which
       * is a scrape-side change and a re-characterisation. */
      names = [r["Awarding Agency"]];
      break;

    case "Indiana IDOA solicitations":
      /* One level only, and unlike USASpending's case above, there is no
       * deeper field being left unread -- IDOA's listing publishes a single
       * plain-string `agency` ("Alcohol & Tobacco Comm", "Education",
       * "Indiana Dept of Transportation") with no department/office
       * hierarchy underneath it, not even one this adapter chose not to
       * request. This is the source's own granularity, not a limitation of
       * the parse, so a one-element chain is recorded rather than the
       * string being split on punctuation or given a synthetic "State of
       * Indiana" parent -- either would fabricate structure IDOA does not
       * publish. */
      names = [r.agency];
      break;

    /* One level, not a chain -- the sub-state buyers this source is bought
     * for ("Allen County", "Natural Resources") have no parent chain
     * underneath them to walk, the same granularity IDOA's own case above
     * already documents, not a limitation of the parse.
     *
     * The SHAPE of that one level is where this case used to assert more
     * than it knew: it read a flat `r.agency_name`, a shape with no evidence
     * behind it -- no fixture captured from a live response backs it, only
     * one hand-built to match this code. `docs/2026-09-03-highergov-field-mapping.md:55`,
     * built from HigherGov's published OpenAPI schema and from records
     * already pulled, records the field as NESTED: `agency.agency_name`.
     * Rather than guess which spelling a real response uses, both are
     * accepted -- flat first, so today's assumed behaviour is unchanged
     * where it already works, nested as the fallback the field-mapping
     * document says to expect. `agency` itself is read defensively because
     * its shape is exactly what is in question here: absent, null, a bare
     * string, or an object are all handled without throwing. */
    case "HigherGov": {
      const flat = typeof r.agency_name === "string" ? r.agency_name.trim() : "";
      const agency = r.agency;
      const nested =
        agency && typeof agency === "object" ? (agency as Record<string, any>).agency_name : undefined;
      names = [flat || nested];
      /* MOVED AFTER `names` IS ASSIGNED, AND WRAPPED (final review, fix 1).
       * Only the NESTED branch actually deciding the name is worth a word --
       * see warnNestedAgency above for why that asymmetry is the whole
       * point. `flat` is already trimmed to "" when unusable, so this fires
       * on exactly the rows the fallback rescued and on no others.
       *
       * The try/catch is not defence in depth -- it is the whole point. This
       * call used to sit one line ABOVE the `names` assignment, unwrapped:
       * a throwing console.warn would have propagated straight out of
       * orgChain, past this switch, past the loop below that builds `chain`,
       * and out of the function entirely -- taking the row's organisation,
       * and the whole merge run calling it, down with a diagnostic. A
       * warning must never be able to do that. */
      if (!flat && typeof nested === "string" && nested.trim()) {
        try {
          warnNestedAgency(nested.trim());
        } catch {
          /* Swallowed on purpose: see the comment above. */
        }
      }
      break;
    }

    default:
      return [];
  }

  const seen = new Set<string>();
  const chain: string[] = [];
  for (const n of names) {
    const name = typeof n === "string" ? n.trim() : "";
    if (!name) continue;
    /* A REPEATED NAME IS DROPPED, not carried. Real production data does
     * this: one DLA record reads [DEPT OF DEFENSE, DEFENSE LOGISTICS
     * AGENCY, DLA AVIATION, DLA AV RICHMOND, DLA AVIATION]. Because
     * organisation identity is name-only, keeping the repeat would make
     * that row its own grandparent -- a cycle in a table whose consumers
     * walk parent_id upward. */
    if (seen.has(name)) continue;
    seen.add(name);
    chain.push(name);
  }
  return chain;
}
