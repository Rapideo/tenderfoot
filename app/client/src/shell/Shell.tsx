import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { HeaderLockup, StatusBar } from "../primitives";
import "./Shell.css";

interface SourceRow {
  id: number;
  name: string;
  health: string;
  enabled: boolean;
  last_run_at: string | null;
}

/* Region A.2 exists so a GO/NO-GO is not measured during an outage nobody
 * noticed: known risks record five silent-failure instances across three
 * source platforms, and a gate measured while a source was quietly dead is a
 * measurement of the outage, not of the market.
 *
 * `excluded` is NOT counted. It is a LEGAL POSTURE, not a fault -- counting
 * it would report a permanent failure for a source we have decided never to
 * ingest. */
function summarise(sources: SourceRow[]) {
  const live = sources.filter((s) => s.health !== "excluded");
  const stamps = sources
    .map((s) => s.last_run_at)
    .filter((v): v is string => Boolean(v))
    .sort();
  return {
    sources: live.length,
    failing: live.filter((s) => s.health === "failing").length,
    rotSuspected: live.filter((s) => s.health === "rot").length,
    lastRun: stamps.length ? stamps[stamps.length - 1]! : "never",
  };
}

export function Shell({
  queueCount,
  reduced = false,
  children,
}: {
  queueCount?: number;
  reduced?: boolean;
  children: ReactNode;
}) {
  const [sources, setSources] = useState<SourceRow[] | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/sources")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => live && setSources(rows as SourceRow[]))
      .catch(() => live && setSources([]));
    return () => {
      live = false;
    };
  }, []);

  const summary = sources ? summarise(sources) : null;

  return (
    <div className={`shell${reduced ? " shell--reduced" : ""}`}>
      <header className="shell__header">
        <HeaderLockup />
        {!reduced && (
          <nav role="navigation" className="shell__nav">
            <Link to="/">Queue</Link>
            <Link to="/admin">Admin</Link>
          </nav>
        )}
        {queueCount !== undefined && (
          <span className="shell__count" aria-label="Queue count">
            {queueCount}
          </span>
        )}
      </header>

      <main className="shell__main">{children}</main>

      {/* Absent, not zero, until the sources are known: a status bar that
        * renders zeros while the request is in flight says "all clear"
        * before it knows anything. */}
      {summary && (
        <>
          {/* DEVIATION (task-9, RED phase): StatusBar's own copy is the
            * bundle's display string verbatim -- "N DEGRADED", not "N
            * failing" -- locked byte-for-byte by StatusBar.test.tsx
            * ("renders the counts in the bundle's exact separator
            * format"), which this task must not touch: that copy was
            * transcribed and signed off in task 8 ("copy is
            * specification"). `rot` needs no supplement -- StatusBar's own
            * "N ROT SUSPECTED" already contains the word "rot" -- but
            * `failing` is the actual database health value (migration
            * 006's enum) and a reader relying on assistive tech should not
            * have to know that this product's display word for it is
            * "DEGRADED". This visually-hidden line gives that one domain
            * word an accessible home without rewriting the bundle-matched
            * visible copy or duplicating "rot" into a second, ambiguous
            * match. */}
          <span className="shell__health-sr">{`${summary.failing} failing`}</span>
          <StatusBar
            sources={summary.sources}
            failing={summary.failing}
            rotSuspected={summary.rotSuspected}
            lastRun={summary.lastRun}
          />
        </>
      )}
    </div>
  );
}
