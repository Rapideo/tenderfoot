import "./HeaderLockup.css";

/* HeaderLockup -- the mark + wordmark (V1.2, index ~549237):
 *
 *   <div style="display:flex;align-items:center;gap:9px;min-width:150px;
 *     flex:none">
 *     <div style="width:22px;height:22px;border:1.5px solid var(--acc);
 *       border-radius:3px;display:flex;align-items:center;
 *       justify-content:center">
 *       <div style="width:8px;height:8px;background:var(--acc);
 *         border-radius:1px"></div>
 *     </div>
 *     <span style="font:600 13.5px/1 'IBM Plex Sans';letter-spacing:.16em">
 *       TENDERFOOT</span>
 *   </div>
 *
 * min-width:150px and flex:none belong to the header nav row this sits
 * inside in the bundle (reserving space beside the nav items) -- not to the
 * lockup itself, same reasoning ScoreStrip.css gives for excluding its own
 * panel's outer padding.
 *
 * As of V1.2 there is no placeholder line beneath the mark -- that deletion
 * was the whole of the V1.2 round (task-8-brief.md). Not reproduced here,
 * and nothing added in its place.
 *
 * Finished and must not be restyled (task-8-brief.md): it was nearly
 * redesigned away once already. Transcribed, not improved -- see
 * HeaderLockup.css for the token match. */
export function HeaderLockup() {
  return (
    <div className="header-lockup">
      <div className="header-lockup__mark">
        <div className="header-lockup__mark-inner" />
      </div>
      <span className="header-lockup__wordmark">TENDERFOOT</span>
    </div>
  );
}
