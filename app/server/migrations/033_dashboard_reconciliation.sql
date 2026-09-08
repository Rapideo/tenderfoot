-- THE LEDGER WAS 150 RECORDS LIGHT, AND ONLY A PERSON READING THE DASHBOARD
-- COULD EVER HAVE FOUND IT.
--
-- Measured 2026-09-08, immediately before committing to a large archive pull.
-- Our ledger read **699**. Matt read the account dashboard: **847** before a
-- deliberate calibration call, **849** after it. The gap is **150**.
--
-- 🔑 THE CALIBRATION IS WHY THIS IS A FIXED OFFSET AND NOT A RATE ERROR, and
-- that distinction decided whether a ~9,000-record archive was safe to buy.
--
-- One listing call was made in isolation, returning exactly 2 records. The
-- dashboard moved 847 -> 849. **Delta 2.** So `records = body.results.length`
-- is exactly what the vendor bills: there is no per-call floor, no charge for
-- matched-but-unreturned rows, and every listing row this project has recorded
-- was recorded correctly. Had the delta been larger, the ledger would have
-- been wrong by a PERCENTAGE, and a 9,000-record pull would have overrun the
-- real allowance by ~20% while every guard reported healthy.
--
-- WHERE THE 150 CAME FROM. `api_spend` was created 2026-09-04 (migration 030).
-- The 490 reconciled in migration 032 was read from the dashboard on
-- 2026-09-03. **Anything spent between that reading and the ledger's first
-- write was never recorded by anything** -- there was no instrument in the
-- gap. That is the only interval unaccounted for, and 150 is its size.
--
-- ⚖️ SO THIS ROW IS AN OBSERVATION, NOT A DERIVATION. It is dated 2026-09-04
-- because that is the interval it must belong to; the exact calls are
-- unknowable and are not reconstructed here. `endpoint` is 'opportunity' for
-- the same reason migration 032 gives: the CHECK admits two values, the
-- ceiling query sums across both, and guessing a split would be inventing
-- detail the evidence does not carry.
--
-- ⚠️ THE GENERAL LESSON, which migration 032 stated and this one proves twice
-- over: a ledger answers "since the 1st" honestly only if it existed on the
-- 1st. 032 closed the gap before the table existed; this closes the gap
-- between the last external reading and the table's first write. Both were
-- invisible to every automated check in the project, and both were found only
-- because a person read a number the vendor will not expose to code.
--
-- 🔴 AND IT MUST NOT REACH A TEST SCHEMA -- see migration 032's own note for
-- the two ways an unguarded seed row bites (a foreign-key violation in
-- unrelated teardown helpers, and silently shifting every ceiling-dependent
-- test's arithmetic). `current_schema()` is 'public' in a real database and
-- the per-run schema name under test.

INSERT INTO api_spend (source_id, endpoint, records, called_at)
SELECT s.id, 'opportunity', 150, timestamptz '2026-09-04 12:00:00+00'
FROM source s
WHERE s.name = 'HigherGov'
  AND current_schema() = 'public'
  /* Idempotent, keyed on the exact reconciliation row, so a genuine future
   * 150-record call on another day still inserts normally. */
  AND NOT EXISTS (
    SELECT 1 FROM api_spend a
    WHERE a.source_id = s.id
      AND a.records = 150
      AND a.called_at = timestamptz '2026-09-04 12:00:00+00'
  );
