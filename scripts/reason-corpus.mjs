/* THE REASON CORPUS, LAID OUT FOR DERIVING A CHIP VOCABULARY FROM IT.
 *
 * SVRC Region 1.1.4 and D30: the reason chips are DERIVED from the hand-run,
 * never invented ahead of it. Matt ruled on 2026-09-13 that the whole 150-item
 * sample is written in his own words first, and the vocabulary comes after.
 * This is the "after": it reads every decision recorded against one triage
 * sample and writes a worksheet -- one block per decision with the facts a
 * reader needs beside the reason, grouped by which way it went -- so the
 * derivation is done against the corpus itself and not against a memory of
 * it.
 *
 * READ-ONLY. It writes nothing to the database and spends nothing. It runs
 * against whatever DATABASE_URL names, and says which at the top of the
 * output, because the corpus lives in the database the triage was done in.
 *
 * Usage:
 *   node --env-file-if-exists=.env scripts/reason-corpus.mjs --sample=2 [--out=path.md]
 *
 * Without --out the worksheet goes to stdout.
 *
 * WHAT THE "WORDS THAT RECUR" SECTION IS, AND IS NOT. It is a mechanical count
 * of the words and two-word phrases that appear most often in each branch's
 * reasons, minus a stoplist. It is a place to START reading from, not a
 * vocabulary: a chip is a judgement about what a reason MEANS, and a word
 * count cannot make that judgement. Per SVRC 1.1.4 the eventual chips also
 * carry a class on the way in, and the capacity class ("too big for us right
 * now") is excluded from anything that learns -- a count may be surfaced, it
 * may not be acted on. Nothing here classifies anything. */
import { writeFileSync } from "node:fs";
import pg from "pg";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "true"];
  }),
);
const sampleId = Number(args.sample);
if (!Number.isInteger(sampleId) || sampleId <= 0) {
  console.error("Usage: node --env-file-if-exists=.env scripts/reason-corpus.mjs --sample=<id> [--out=path.md]");
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(2);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
let out = "";
const line = (s = "") => { out += s + "\n"; };

try {
  const sample = (
    await client.query(
      `SELECT ts.id, ts.seed, ts.n_requested, ts.population_size, ts.drawn_at, ts.note, src.name AS source_name
         FROM triage_sample ts JOIN source src ON src.id = ts.source_id WHERE ts.id = $1`,
      [sampleId],
    )
  ).rows[0];
  if (!sample) {
    console.error(`No triage_sample with id ${sampleId}.`);
    process.exit(1);
  }

  /* The LATEST pursuit row per solicitation is the decision (migration 012's
   * own reading rule: created_at DESC, id DESC breaks a same-millisecond
   * tie). Undo writes a later row, so "latest" is what stands. */
  const rows = (
    await client.query(
      `WITH latest AS (
         SELECT DISTINCT ON (solicitation_id)
                solicitation_id, state, reason, discovery_channel, decided_by, created_at
           FROM pursuit
          ORDER BY solicitation_id, created_at DESC, id DESC)
       SELECT i.position, s.id AS solicitation_id, s.title, s.external_id,
              o.name AS buyer, s.place_of_performance, s.closes_at, s.posted_at,
              s.kind, s.set_aside, s.value_cents, s.codes,
              left(coalesce(s.description, ''), 320) AS description_head,
              length(coalesce(s.description, '')) AS description_len,
              l.state, l.reason, l.discovery_channel, l.decided_by, l.created_at AS decided_at
         FROM triage_sample_item i
         JOIN solicitation s ON s.id = i.solicitation_id
         LEFT JOIN organization o ON o.id = s.org_id
         LEFT JOIN latest l ON l.solicitation_id = i.solicitation_id
        WHERE i.sample_id = $1
        ORDER BY i.position`,
      [sampleId],
    )
  ).rows;

  const decided = rows.filter((r) => r.state && r.state !== "New");
  const interested = decided.filter((r) => r.state === "Interested");
  const passed = decided.filter((r) => r.state === "Not Interested");
  const undecided = rows.filter((r) => !r.state || r.state === "New");

  line(`# Reason corpus — sample #${sample.id} (${sample.source_name})`);
  line();
  line(`> Generated ${new Date().toISOString()} from \`${new URL(process.env.DATABASE_URL).host}\`. Read-only; spends nothing.`);
  line(`> Seed \`${sample.seed}\` · ${sample.n_requested} drawn of ${sample.population_size} · drawn ${new Date(sample.drawn_at).toISOString().slice(0, 10)}.`);
  if (sample.note) line(`> ${String(sample.note).replace(/\s+/g, " ")}`);
  line();
  line(`**${decided.length} of ${rows.length} decided** — ${interested.length} Interested · ${passed.length} Not Interested · ${undecided.length} undecided.`);
  line();
  line(`This is the hand-run SVRC 1.1.4 says the chip vocabulary is derived from. Each block carries the facts that were on the card beside the reason. The \`→ chip:\` line is blank on purpose: it is filled during derivation, not by this script.`);
  line();

  const fmtValue = (cents) => (cents == null ? "—" : `$${(Number(cents) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
  const block = (r, n) => {
    line(`### ${n}. ${r.title ?? "(untitled)"}`);
    line();
    line(`- **Buyer:** ${r.buyer ?? "—"} · **State:** ${r.place_of_performance ?? "—"} · **Kind:** ${r.kind ?? "—"}${r.set_aside ? ` · **Set-aside:** ${r.set_aside}` : ""}`);
    line(`- **Closes:** ${r.closes_at ?? "—"} · **Posted:** ${r.posted_at ?? "—"} · **Value:** ${fmtValue(r.value_cents)} · **Description:** ${r.description_len} chars`);
    if (r.state === "Interested") line(`- **Would have reached me via:** ${r.discovery_channel ?? "—"}`);
    line(`- **Decided:** ${r.decided_at ? new Date(r.decided_at).toISOString().slice(0, 16).replace("T", " ") : "—"} by ${r.decided_by ?? "—"} · sample position ${r.position} · solicitation ${r.solicitation_id}`);
    line();
    line(`> ${r.reason ? String(r.reason).replace(/\s+/g, " ") : "_(no reason recorded)_"}`);
    line();
    line(`→ chip:`);
    line();
  };

  line(`## Interested — ${interested.length}`);
  line();
  if (!interested.length) line(`_(none yet)_\n`);
  interested.forEach((r, i) => block(r, i + 1));

  line(`## Not Interested — ${passed.length}`);
  line();
  if (!passed.length) line(`_(none yet)_\n`);
  passed.forEach((r, i) => block(r, i + 1));

  /* A mechanical count, offered as a place to start reading -- see the header. */
  const STOP = new Set(("a an and are as at be but by for from has have if in is it its of on or that the this to was we with " +
    "our they their there these those not no yes so do does did would could should will can may might just also than then " +
    "them he she his her him you your i me my which what who when where why how very really any all some more most much " +
    "into out up down over under about after before again too only own same other such both each few off").split(" "));
  const tokens = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w) && w.length > 2);
  const count = (list, ngram) => {
    const m = new Map();
    for (const r of list) {
      const t = tokens(r.reason);
      const seen = new Set();
      for (let i = 0; i + ngram <= t.length; i++) {
        const g = t.slice(i, i + ngram).join(" ");
        if (seen.has(g)) continue; // count reasons containing it, not occurrences
        seen.add(g);
        m.set(g, (m.get(g) ?? 0) + 1);
      }
    }
    return [...m.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 25);
  };
  const table = (title, list) => {
    line(`### ${title}`);
    line();
    if (list.length < 2) { line(`_(too few reasons to count)_\n`); return; }
    const w = count(list, 1), b = count(list, 2);
    line(`| word | reasons | | phrase | reasons |`);
    line(`|---|---:|---|---|---:|`);
    for (let i = 0; i < Math.max(w.length, b.length); i++) {
      const [wk, wn] = w[i] ?? ["", ""];
      const [bk, bn] = b[i] ?? ["", ""];
      line(`| ${wk} | ${wn} | | ${bk} | ${bn} |`);
    }
    line();
  };
  line(`## Words that recur — a place to start reading, not a vocabulary`);
  line();
  line(`Counted per reason (a word appearing three times in one reason counts once), stoplist applied, threshold two. A chip is a judgement about what a reason means; this table cannot make it.`);
  line();
  table(`Interested`, interested);
  table(`Not Interested`, passed);

  line(`## Undecided — ${undecided.length}`);
  line();
  for (const r of undecided) line(`- ${r.position}. ${r.title ?? "(untitled)"} — ${r.buyer ?? "—"}`);
  line();
} finally {
  await client.end();
}

if (args.out) {
  writeFileSync(args.out, out, "utf8");
  console.log(`wrote ${args.out} (${out.length} chars)`);
} else {
  process.stdout.write(out);
}
