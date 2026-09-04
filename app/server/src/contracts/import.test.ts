import { afterAll, beforeAll, expect, test } from "vitest";
import { useTestSchema, resetSchema } from "../db/testdb.js";

useTestSchema("test_contract_import");
await resetSchema();

const { migrate } = await import("../db/migrate.js");
const { close, insert, one, all, run } = await import("../db/index.js");
const { importContracts } = await import("./import.js");

let src: number;

beforeAll(async () => {
  await migrate(false);
  src = await insert(`INSERT INTO source (name) VALUES ('EDS import fixture') RETURNING id`);
}, 120000);
afterAll(async () => {
  await close();
});

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "A337-6-CWI-104",
  vendorName: "TIMOTHY WARRICK",
  agencyName: "Adjutant General",
  businessUnit: "00110",
  startDate: "2006-05-01T00:00:00.0000000",
  endDate: "2007-04-30T00:00:00.0000000",
  amount: 40000,
  actionType: "New",
  amendment: 0,
  zipCode: "47441",
  pdfUrl: "https://contracts.idoa.in.gov/x.pdf",
  ...over,
});

test("a contract lands with its amount in amount_cents and value_cents NULL", async () => {
  await run(`DELETE FROM contract WHERE source_id = $1`, [src]);
  const out = await importContracts(src, [row() as any]);
  expect(out.written).toBe(1);

  const c = await one<{
    external_id: string; amendment: number; action_type: string;
    amount_cents: string; value_cents: string | null; starts_at: string; ends_at: string;
  }>(`SELECT external_id, amendment, action_type, amount_cents, value_cents,
             starts_at, ends_at FROM contract WHERE source_id = $1`, [src]);

  expect(c?.external_id).toBe("A337-6-CWI-104");
  expect(c?.amendment).toBe(0);
  expect(c?.action_type).toBe("New");
  /* Dollars in, CENTS stored -- the column says cents and the source says
   * dollars, and getting that wrong is a hundredfold error nobody notices. */
  expect(Number(c?.amount_cents)).toBe(4_000_000);
  /* 🔴 Ruled by Matt 2026-09-03. amount is a per-amendment delta, not a value. */
  expect(c?.value_cents).toBeNull();
  /* Dates are truncated to ISO days -- the source ships .0000000 fractions. */
  expect(c?.starts_at).toBe("2006-05-01");
  expect(c?.ends_at).toBe("2007-04-30");
});

/* 🔴 unknown must never collapse into something that reads as measured.
 * Number(null) is 0 and Number("") is also 0, so a naive coercion would store
 * a null/blank amount as $0.00 -- indistinguishable from a genuine $0 row,
 * and this corpus has real ones (E8-1-JA015,
 * docs/2026-09-03-eds-ingest-run.md). cents() must return NULL instead. */
test("a null or blank amount stores amount_cents NULL, not $0.00", async () => {
  await importContracts(src, [
    row({ id: "AMOUNT-NULL-1", amendment: 0, amount: null }) as any,
    row({ id: "AMOUNT-BLANK-1", amendment: 0, amount: "" }) as any,
    row({ id: "AMOUNT-ZERO-1", amendment: 0, amount: 0 }) as any,
  ]);

  const rows = await all<{ external_id: string; amount_cents: string | null }>(
    `SELECT external_id, amount_cents FROM contract
      WHERE source_id = $1 AND external_id LIKE 'AMOUNT-%' ORDER BY external_id`,
    [src],
  );
  expect(rows.find((r) => r.external_id === "AMOUNT-NULL-1")?.amount_cents).toBeNull();
  expect(rows.find((r) => r.external_id === "AMOUNT-BLANK-1")?.amount_cents).toBeNull();
  /* A genuine zero must stay distinguishable -- 0, not null. */
  expect(Number(rows.find((r) => r.external_id === "AMOUNT-ZERO-1")?.amount_cents)).toBe(0);
});

test("re-importing the same rows writes nothing new", async () => {
  const before = await one<{ n: string }>(
    `SELECT count(*) n FROM contract WHERE source_id = $1`, [src]);
  const out = await importContracts(src, [row() as any]);
  const after = await one<{ n: string }>(
    `SELECT count(*) n FROM contract WHERE source_id = $1`, [src]);

  expect(out.written).toBe(0);
  expect(out.skipped).toBe(1);
  expect(after!.n).toBe(before!.n);
});

/* The contract id repeats across amendments. Two amendments are two rows. */
test("a second amendment of the same contract is a second row", async () => {
  const out = await importContracts(src, [
    row({ amendment: 1, actionType: "Amendment", amount: 70000 }) as any,
  ]);
  expect(out.written).toBe(1);

  const rows = await all<{ amendment: number; amount_cents: string }>(
    `SELECT amendment, amount_cents FROM contract
      WHERE source_id = $1 AND external_id = 'A337-6-CWI-104' ORDER BY amendment`, [src]);
  expect(rows.map((r) => r.amendment)).toEqual([0, 1]);
  expect(rows.map((r) => Number(r.amount_cents))).toEqual([4_000_000, 7_000_000]);
});

/* Renamed (final whole-branch review, 2026-09-03) -- the old name said "via
 * the shared org chain", but Ruling 2 (progress.md) dropped the orgChain
 * import entirely: the EDS payload publishes a flat agencyName with no
 * hierarchy to walk, so v1 resolves it directly by name (resolveOrgIds,
 * mirroring merge.ts's read-then-insert pattern) rather than through
 * org-chain.ts. This test verifies THAT resolution, not a chain walk. */
test("the agency name resolves to an organization by direct lookup, not org-chain", async () => {
  const c = await one<{ org_id: number | null }>(
    `SELECT org_id FROM contract WHERE source_id = $1 AND amendment = 0`, [src]);
  expect(c?.org_id).not.toBeNull();
  const o = await one<{ name: string }>(`SELECT name FROM organization WHERE id = $1`,
    [c!.org_id]);
  expect(o?.name).toBe("Adjutant General");
});

/* 🔴 THE GUARD THAT MATTERS MOST. Design spec §2: nothing in the contract path
 * may touch solicitation, sighting or pursuit. A contract reaching the triage
 * queue would be work already awarded presented as an opportunity. */
test("importing contracts writes NOTHING to solicitation, sighting or pursuit", async () => {
  const before = await one<{ s: string; g: string; p: string }>(
    `SELECT (SELECT count(*) FROM solicitation) s,
            (SELECT count(*) FROM sighting) g,
            (SELECT count(*) FROM pursuit) p`);
  await importContracts(src, [
    row({ id: "QUEUE-GUARD-1", amendment: 0 }) as any,
    row({ id: "QUEUE-GUARD-2", amendment: 0 }) as any,
  ]);
  const after = await one<{ s: string; g: string; p: string }>(
    `SELECT (SELECT count(*) FROM solicitation) s,
            (SELECT count(*) FROM sighting) g,
            (SELECT count(*) FROM pursuit) p`);
  expect(after).toEqual(before);
});
