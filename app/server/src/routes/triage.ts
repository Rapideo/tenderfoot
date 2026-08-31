import { Router } from "express";
import { one } from "../db/index.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAdminSecret } from "../lib/adminSecret.js";
import { queuePage } from "../triage/queue.js";
import { drawSample, getSample, listSamples } from "../triage/sample.js";
import { recordDecision, ReasonRequiredError } from "../triage/decide.js";
import { interestedPerHundred, volumePerSourcePerWeek } from "../triage/metrics.js";

/* SP6. Reads open, writes gated -- the rule routes/index.ts already
 * follows. Reads stay open so the screens load without turning a shared
 * bearer secret into a login, which design spec §7 says it is not.
 *
 * The writes are gated for a concrete reason rather than a ceremonial one:
 * production is public BY DECISION (§5), and a stranger clicking Pass would
 * corrupt the gate's own measurement. */
export const triage = Router();

const clampInt = (raw: unknown, fallback: number, min: number, max: number): number => {
  const n = Number(raw);
  /* Number("") is 0 and Number(undefined) is NaN, so `Number(x) || fallback`
   * would accept a NEGATIVE -- SP4's Task 11 shipped exactly that bug, where
   * -5 is truthy and Math.min does not catch it. Validate, then clamp. */
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(Math.trunc(n), max));
};

/* task-7-brief.md's own "Consumes" list names `getSample` as an interface
 * this router uses, but its worked example never imports or calls it --
 * only `drawSample` and `listSamples` are pulled from sample.js. Without a
 * check here, `?sample=<unknown id>` reaches queuePage(), which throws a
 * bare `Error` for a sample that does not exist (queue.ts: "No sample N.").
 * asyncHandler forwards that straight to the global handler as an
 * unhandled 500 -- inconsistent with every other unknown-id lookup this
 * router (and routes/index.ts, and admin.ts) makes: source, solicitation,
 * adapter key and probe source name all answer 404, never a fault. Checked
 * with getSample() BEFORE queuePage() runs, same shape as the source and
 * solicitation existence checks below. */
triage.get(
  "/queue",
  asyncHandler(async (req, res) => {
    /* MINOR fix (SP6 final review). clampInt's fallback-on-NaN design is
     * right for limit/offset -- an unparseable page size should just take
     * the default page -- but wrong here: clampInt(req.query.sample, ...)
     * falls back to 0 for anything non-numeric, `if (sampleId)` then reads
     * that 0 as falsy, and the request silently degrades to mode: "all",
     * the whole queue, with no error. `?sample=999999` correctly 404s (the
     * getSample() check below), but `?sample=abc` did not -- an operator
     * who typos the id would triage the firehose believing it is a bounded
     * sample. Checked BEFORE clampInt runs, so a non-numeric sample never
     * reaches it. */
    if (req.query.sample !== undefined && !Number.isFinite(Number(req.query.sample))) {
      return res
        .status(400)
        .json({ error: `Invalid sample id: ${String(req.query.sample)}.`, field: "sample" });
    }
    const sampleId = req.query.sample ? clampInt(req.query.sample, 0, 1, 2 ** 31 - 1) : undefined;
    if (sampleId) {
      const sample = await getSample(sampleId);
      if (!sample) return res.status(404).json({ error: `No sample ${sampleId}.` });
    }
    res.json(
      await queuePage({
        limit: clampInt(req.query.limit, 25, 1, 200),
        offset: clampInt(req.query.offset, 0, 0, 2 ** 31 - 1),
        sampleId,
      }),
    );
  }),
);

triage.get(
  "/triage/samples",
  asyncHandler(async (_req, res) => {
    res.json({ samples: await listSamples() });
  }),
);

triage.post(
  "/triage/samples",
  requireAdminSecret,
  asyncHandler(async (req, res) => {
    const { source_id, n, seed, note } = req.body ?? {};
    const sourceId = Number(source_id);
    if (!Number.isInteger(sourceId)) {
      return res.status(400).json({ error: "source_id must be an integer.", field: "source_id" });
    }
    const src = await one(`SELECT id FROM source WHERE id = $1`, [sourceId]);
    if (!src) return res.status(404).json({ error: `No source ${sourceId}.` });

    const sample = await drawSample({
      sourceId,
      n: clampInt(n, 100, 1, 1000),
      seed: typeof seed === "string" && seed.trim() ? seed.trim() : undefined,
      note: typeof note === "string" ? note : undefined,
    });
    res.status(201).json(sample);
  }),
);

triage.post(
  "/solicitations/:id/decision",
  requireAdminSecret,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const exists = await one(`SELECT id FROM solicitation WHERE id = $1`, [id]);
    if (!exists) return res.status(404).json({ error: `No solicitation ${id}.` });

    const { state, reason, decided_by, require_reason_on_pass } = req.body ?? {};
    try {
      const latest = await recordDecision({
        solicitationId: id,
        state,
        reason,
        decidedBy: typeof decided_by === "string" ? decided_by : null,
        requireReasonOnPass: require_reason_on_pass !== false,
      });
      return res.status(201).json(latest);
    } catch (err) {
      if (err instanceof ReasonRequiredError) {
        return res.status(400).json({ error: err.message, field: "reason" });
      }
      throw err;
    }
  }),
);

triage.get(
  "/triage/metrics",
  asyncHandler(async (_req, res) => {
    res.json({
      volume: await volumePerSourcePerWeek(),
      interested: await interestedPerHundred(),
    });
  }),
);
