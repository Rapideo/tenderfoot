import "./StatusBar.css";

/* StatusBar -- the bundle's persistent footer chrome (V1.2, index ~617384):
 *
 *   <footer style="flex:none;height:30px;display:flex;align-items:center;
 *     gap:18px;padding:0 20px;background:var(--ink);color:var(--inktx);
 *     white-space:nowrap;overflow:hidden">
 *     <button sc-camel-on-click="{{ goAdmin }}" style="display:flex;
 *       align-items:center;gap:8px;border:none;background:none;padding:0;
 *       color:var(--inktx);flex:none" style-hover="color:var(--inktx4)">
 *       <span style="width:7px;height:7px;border-radius:50%;
 *         background:var(--yellow);flex:none"></span>
 *       <span style="font:400 10.5px/1 'IBM Plex Mono';letter-spacing:.06em;
 *         flex:none">4 SOURCES · 1 DEGRADED · 1 ROT SUSPECTED</span>
 *     </button>
 *     <span style="width:1px;height:12px;background:var(--ink3);
 *       flex:none"></span>
 *     <span style="font:400 10.5px/1 'IBM Plex Mono';letter-spacing:.06em;
 *       flex:none">LAST RUN 2026-08-10 06:04 EDT</span>
 *     <span style="flex:1"></span>
 *     <button sc-camel-on-click="{{ toggleTheme }}" ...>{{ themeLabel }}</button>
 *     <button sc-camel-on-click="{{ startTour }}" ...>▷ GUIDED TOUR</button>
 *     <span style="...;color:var(--inktx3);flex:none">TENDERFOOT 0.1.2 · MOCKUP</span>
 *   </footer>
 *
 * Confirmed 2026-08-13: rot suspicion belongs in this persistent chrome, not
 * a settings screen, because V1's entire failure mode is a source quietly
 * returning less than it used to (task-8-brief.md).
 *
 * DROPPED: toggleTheme/themeLabel and startTour/"GUIDED TOUR". Both are
 * genuinely live controls -- a theme toggle reading real app state, a tour
 * that starts one -- not static copy, and this task's four-prop interface
 * carries neither the state nor the behaviour to back either one. Same
 * reasoning GatedDrawer.tsx gives for dropping the panel it discloses: no
 * data, must not be wired anyway.
 *
 * KEPT: the version stamp. "TENDERFOOT 0.1.2 · MOCKUP" is static copy with
 * no interactivity to fake, so nothing about "must not become wired"
 * applies to it -- transcribed character-for-character (task-8-brief.md:
 * "copy is specification"), including the flex:1 spacer that pushes it to
 * the far edge in the bundle. "MOCKUP" is reproduced as written; whether a
 * real build says something else is Matt's call, not a rewrite made here.
 *
 * The counts control is a real, unwired <button> (the bundle's own
 * sc-camel-on-click="{{ goAdmin }}") -- same pattern GatedDrawer.tsx
 * establishes for a bundle control this task must not wire: a real button,
 * no onClick prop exists to pass one, ready for a later slice. No
 * cursor:pointer and no :hover treatment, for GatedDrawer's own reason --
 * painting an affordance this control does not have would misrepresent it,
 * not faithfully copy it. (--on-ink-secondary, the bundle's hover colour on
 * this exact button, was verified at its style-hover attribute and is
 * deliberately left unconsumed here -- see task-8-report.md.)
 *
 * The dot is a static literal in the bundle -- background:var(--yellow),
 * never a template binding, the ONLY footer instance in all of V1.2. It is
 * not recomputed from failing/rotSuspected here either: inventing a
 * health-conditional colour (green when both are 0, say) would be a
 * mechanism the bundle never shows, the same discipline Ruling 12 applied
 * to --signal-neg's claimed third job. Flagged for the gate: a shipped
 * product may well want this dot to react to the counts beside it: V1.2
 * gives no evidence either way, so nothing is built here beyond what is
 * shown. Not reused from StatusDot: that primitive couples colour to a
 * `state` prop, and its state named "failing" means something else
 * entirely (StatusDot's failing = "Failing" = --signal-neg/red; this dot
 * is always --yellow) -- reusing it here would either mislabel the
 * accessible name or silently repurpose an enum this task does not own. */
const VERSION_STAMP = "TENDERFOOT 0.1.2 · MOCKUP";

export function StatusBar({
  sources,
  failing,
  rotSuspected,
  lastRun,
}: {
  sources: number;
  failing: number;
  rotSuspected: number;
  lastRun: string;
}) {
  return (
    <footer className="status-bar">
      <button type="button" className="status-bar__counts">
        <span className="status-bar__dot" />
        <span className="status-bar__label">
          {`${sources} SOURCES · ${failing} DEGRADED · ${rotSuspected} ROT SUSPECTED`}
        </span>
      </button>
      <span className="status-bar__divider" />
      <span className="status-bar__label">{`LAST RUN ${lastRun}`}</span>
      <span className="status-bar__spacer" />
      <span className="status-bar__label status-bar__version">{VERSION_STAMP}</span>
    </footer>
  );
}
