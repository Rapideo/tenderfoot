import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  reduced: reducedProp = false,
  children,
}: {
  queueCount?: number;
  reduced?: boolean;
  children: ReactNode;
}) {
  const [sources, setSources] = useState<SourceRow[] | null>(null);
  /* "Show menu" un-collapses the nav for the rest of the session, which is
   * what the bundle's exitTriage does. */
  const [forceNav, setForceNav] = useState(false);
  const reduced = reducedProp && !forceNav;
  const navigate = useNavigate();

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
        {/* THE NAV-COLLAPSED AFFORDANCE. The SVRC's "reduced shell" has a
          * designed expression in the bundle and we had implemented only its
          * EFFECT (hiding the nav), never its affordance -- so nothing told a
          * user the menu was gone or offered it back. Bundle:
          *   pill   flex; gap:10px; padding:5px 8px 5px 14px; --ink; radius 6
          *   label  500 10px Mono ls .14em --inktx2
          *   button --ink3 / --inktx5, 500 11px Sans, 6px 9px, radius 4
          *   key    9.5px Mono --inktx, 1px --ink5, radius 3, 3px 4px       */}
        {reduced && (
          <div className="shell__collapsed">
            <span className="shell__collapsed-label">CLEARING QUEUE · NAV COLLAPSED</span>
            <button
              type="button"
              className="shell__collapsed-btn"
              onClick={() => setForceNav(true)}
            >
              Show menu <span className="shell__collapsed-key">ESC</span>
            </button>
          </div>
        )}

        {/* THE COUNTER IS A BUTTON in the bundle, not a bare number: a mono
          * count beside a stacked IN / QUEUE label at .72 opacity, on --acc
          * when there is work and --ok when the queue is clear. It is also
          * the route back to triage from anywhere. */}
        {queueCount !== undefined && (
          <button
            type="button"
            className={`shell__count${queueCount === 0 ? " shell__count--clear" : ""}`}
            aria-label="Queue count"
            onClick={() => navigate("/")}
          >
            <span className="shell__count-n">{queueCount}</span>
            <span className="shell__count-label">
              IN
              <br />
              QUEUE
            </span>
          </button>
        )}
      </header>

      <main className="shell__main">{children}</main>

      {/* Absent, not zero, until the sources are known: a status bar that
        * renders zeros while the request is in flight says "all clear"
        * before it knows anything. */}
      {summary && (
        <StatusBar
          sources={summary.sources}
          failing={summary.failing}
          rotSuspected={summary.rotSuspected}
          lastRun={summary.lastRun}
        />
      )}
    </div>
  );
}
