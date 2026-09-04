import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_field_completeness");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, run } = await import("../db/index.js");
const { measureCompleteness, measureAllSources } = await import("./field-completeness.js");
const { R7 } = await import("./thresholds.js");

/* The seed ships a registry and a firm profile. This suite reasons about what a
 * source HOLDS, so it clears the holdings and builds exactly what each test
 * needs. firm_profile is left alone -- completeness never reads it. */
beforeAll(async () => {
  await migrate(false);
  await reset();
}, 120000);
afterAll(async () => {
  await close();
});

async function reset(): Promise<void> {
  await run(`DELETE FROM document`);
  await run(`DELETE FROM contract`);
  await run(`DELETE FROM sighting`);
  await run(`DELETE FROM solicitation`);
  await run(`DELETE FROM source`);
}

async function source(name: string): Promise<number> {
  return insert(`INSERT INTO source (name, jurisdiction) VALUES ($1, 'IN') RETURNING id`, [name]);
}

/* Bulk-inserted in ONE round trip. The population floor is 100 rows, so a
 * per-row insert would make every graded test a hundred trips to Neon. */
async function solicitations(
  sourceId: number,
  n: number,
  opts: { description?: string; valueCents?: number | null; kind?: string | null } = {},
): Promise<void> {
  await run(
    `INSERT INTO solicitation
       (title, source_id, posted_at, posted_at_origin, closes_at, kind, description, value_cents)
     SELECT 'fixture ' || g, $1, now() - interval '10 days', 'published',
            now() + interval '30 days', $2, $3, $4
       FROM generate_series(1, $5) AS g`,
    [sourceId, opts.kind ?? null, opts.description ?? null, opts.valueCents ?? null, n],
  );
}

async function contracts(
  sourceId: number,
  n: number,
  opts: {
    vendor?: boolean;
    /** The EDS register's real shape: a raw name, never resolved to a vendor row. */
    rawVendorName?: boolean;
    value?: boolean;
    endsAt?: boolean;
  } = {},
): Promise<void> {
  const vendorId = opts.vendor
    ? await insert(`INSERT INTO vendor (name) VALUES ('fixture vendor') RETURNING id`, [])
    : null;
  await run(
    `INSERT INTO contract (source_id, external_id, vendor_id, value_cents, ends_at, source_note)
     SELECT $1, 'c' || g, $2, $3,
            CASE WHEN $4 THEN now() + interval '1 year' ELSE NULL END, $6
       FROM generate_series(1, $5) AS g`,
    [
      sourceId,
      vendorId,
      opts.value ? 100000 : null,
      opts.endsAt ?? false,
      n,
      opts.rawVendorName ? "vendorName: TIMOTHY WARRICK" : null,
    ],
  );
}

/* ------------------------------------------------- the population floor -- */

test("below the population floor every property is `unknown`, never `weak`", async () => {
  await reset();
  const id = await source("tiny");
  /* 45 rows, IDOA's real population, all with empty descriptions and no value.
   * Every sub-measure is as bad as it can be -- and none of them may grade
   * `weak`, because §5.3 forbids reading absence of evidence as evidence of
   * absence. Forty-five rows is not a measurement. */
  await solicitations(id, R7.minPopulation - 1, { description: "" });

  const m = await measureCompleteness(id);
  expect(m.population_n).toBe(R7.minPopulation - 1);
  for (const prop of ["P6", "P7", "P8", "P14"] as const) {
    expect(m[prop], prop).toBe("unknown");
  }
});

/* --------------------------------------------------------------- P6 -- */

test("a source of 57-character descriptions grades P6 `weak`", async () => {
  await reset();
  const id = await source("thin");
  /* SAM.gov's real p10 on production, to the character. */
  await solicitations(id, R7.minPopulation, { description: "x".repeat(57) });

  const m = await measureCompleteness(id);
  expect(m.P6).toBe("weak");
  expect(m.evidence.description_p10_chars).toBe(57);
});

test("a source of readable descriptions grades P6 `strong`", async () => {
  await reset();
  const id = await source("rich");
  await solicitations(id, R7.minPopulation, {
    description: "y".repeat(R7.p6DescriptionP10Strong),
  });

  const m = await measureCompleteness(id);
  expect(m.P6).toBe("strong");
});

/* --------------------------------------------------------------- P7 -- */

test("P7 is `unknown` when nothing defers to a document — there is nothing to reach", async () => {
  await reset();
  const id = await source("no deferrals");
  await solicitations(id, R7.minPopulation, { description: "z".repeat(500) });

  const m = await measureCompleteness(id);
  /* Zero of zero is not zero percent. F7 takes the same position. */
  expect(m.P7).toBe("unknown");
});

test("P7 grades `weak` when rows defer to a document we do not hold", async () => {
  await reset();
  const id = await source("deferring");
  await solicitations(id, R7.minPopulation, {
    description: "Dental prosthetics - BPA - see SOW and additional items list",
  });

  const m = await measureCompleteness(id);
  expect(m.P7).toBe("weak");
  expect(m.evidence.document_reachability).toBe(0);
});

/* --------------------------------------------------------------- P8 -- */

test("a source carrying no value at all grades P8 `weak`", async () => {
  await reset();
  const id = await source("valueless");
  /* 0 of 9,883 is production's real figure for every source it holds. */
  await solicitations(id, R7.minPopulation, { description: "a".repeat(500), valueCents: null });

  const m = await measureCompleteness(id);
  expect(m.P8).toBe("weak");
  expect(m.evidence.value_presence).toBe(0);
});

/* -------------------------------------------------- a contract source -- */

test("a contract source grades P14 and P8, and leaves the solicitation properties `unknown`", async () => {
  await reset();
  const id = await source("Indiana EDS contract register");
  await contracts(id, R7.minPopulation, { vendor: true, value: true, endsAt: true });

  const m = await measureCompleteness(id);
  expect(m.P14).toBe("strong");
  /* P8 is "value presence" — for a register the value is on the contract, and
   * reading it there is what gives a contract source two known properties
   * rather than one. With only one, R7 could never grade it at all. */
  expect(m.P8).toBe("strong");
  expect(m.P6).toBe("unknown");
  expect(m.P7).toBe("unknown");
  expect(m.population_n).toBe(R7.minPopulation);
});

test("an UNRESOLVED vendor name still counts as a vendor — it is the register's real shape", async () => {
  await reset();
  const id = await source("Indiana EDS contract register");
  /* 🔴 THE DEFECT THIS PINS. The EDS ingest lands the raw vendor name in
   * `source_note` and leaves `vendor_id` NULL on all 204,920 rows, by a
   * documented v1 ruling: "vendor resolution -- vendor_alias knowing TIMOTHY
   * WARRICK and Timothy Warrick, Inc. are one -- is its own slice, and a corpus
   * with un-normalised vendors is useful where a corpus that does not exist is
   * not" (contracts/import.ts).
   *
   * Measuring vendor presence as `vendor_id IS NOT NULL` therefore graded the
   * register P14 `weak` on 204,920 rows that DO carry a vendor. That is a
   * measurement penalising a deliberate decision, and it would have been
   * recorded into the registry as fact. */
  await contracts(id, R7.minPopulation, { rawVendorName: true, value: true, endsAt: true });

  const m = await measureCompleteness(id);
  expect(m.P14).toBe("strong");
  /* But the limitation is real for incumbency and must stay visible: you cannot
   * group a vendor's contracts by a name nobody has normalised. */
  expect(m.evidence.contracts_vendor_unresolved).toBe(R7.minPopulation);
});

test("a register missing end dates grades P14 `weak` — the radar needs all three on one row", async () => {
  await reset();
  const id = await source("no end dates");
  await contracts(id, R7.minPopulation, { vendor: true, value: true, endsAt: false });

  const m = await measureCompleteness(id);
  expect(m.P14).toBe("weak");
});

/* --------------------------------------------------------------- P11 -- */

test("P11 is never graded — created_at is our insert time, not a capture time", async () => {
  await reset();
  const id = await source("anything");
  await solicitations(id, R7.minPopulation, { description: "b".repeat(500) });

  const m = await measureCompleteness(id);
  expect(m.P11).toBe("unknown");
  /* But the number is still recorded, so ratifying a real capture column later
   * has a baseline to compare against. */
  expect(m.evidence).toHaveProperty("insert_lag_median_days");
});

/* ------------------------------------------------- the biddable filter -- */

test("award notices are excluded from the population, as they are from F6", async () => {
  await reset();
  const id = await source("mixed");
  await solicitations(id, R7.minPopulation, { description: "c".repeat(500) });
  await solicitations(id, 50, { description: "", kind: "Award Notice" });

  const m = await measureCompleteness(id);
  /* An award notice's empty description is not a defect — there is nothing to
   * decide. Counting it would drag P6 down for a reason unrelated to quality. */
  expect(m.population_n).toBe(R7.minPopulation);
  expect(m.P6).toBe("strong");
});

/* ------------------------------------------------------ the whole sweep -- */

test("measureAllSources returns every source, including those holding nothing", async () => {
  await reset();
  const held = await source("holds rows");
  await source("holds nothing");
  await solicitations(held, R7.minPopulation, { description: "d".repeat(500) });

  const all = await measureAllSources();
  expect(all.map((r) => r.name).sort()).toEqual(["holds nothing", "holds rows"]);
  const empty = all.find((r) => r.name === "holds nothing")!;
  /* A source that has never ingested is `unknown` on every property. It is not
   * a bad source; it is an unmeasured one. */
  expect(empty.measurement.population_n).toBe(0);
  expect(empty.measurement.P6).toBe("unknown");
});
