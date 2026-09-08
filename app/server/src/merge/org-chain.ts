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
     * ✅ THE SHAPE IS NESTED, AND THAT IS MEASURED RATHER THAN ASSUMED.
     * Across 1,856 captured HigherGov rows spanning five states and 552
     * buyers: `agency.agency_name` present on 1,856, flat `agency_name`
     * present on 0. `docs/2026-09-03-highergov-field-mapping.md:55` was
     * right; the flat read this case shipped with was an assumption no
     * captured response has ever backed.
     *
     * This case USED to accept both shapes, flat first, and warn once per
     * process when the nested branch was the one that produced the name --
     * a tolerance held deliberately because settling the question live cost
     * metered records (CLAUDE.md §5.1). The warning fired on the first row,
     * and fired again on an entirely different four-state buyer set. That is
     * the answer it was built to collect, so the flat branch and the warning
     * were deleted together, exactly as the warning's own text instructed.
     *
     * `agency` is still read DEFENSIVELY, and that is not leftover caution:
     * absent, null, a bare string and a number must each yield no
     * attribution rather than a throw. A merge reads whatever a source
     * stored, and inventing an organisation -- or crashing over one -- is
     * how the corpus loader once tagged 62 federal agencies 'IN'. */
    case "HigherGov": {
      const agency = r.agency;
      names = [
        agency && typeof agency === "object" ? (agency as Record<string, any>).agency_name : undefined,
      ];
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
