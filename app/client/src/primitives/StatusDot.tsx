import "./StatusDot.css";

export type StatusDotState = "ok" | "failing" | "rot" | "off";

/* Accessible names reuse the bundle's own Source Registry vocabulary
 * verbatim (health: "Healthy" | "Failing" | "Rot suspected" | "Not
 * ingested") rather than inventing new copy -- see StatusDot.css for the
 * state-to-bundle-value mapping this was matched against. */
const STATE_LABEL: Record<StatusDotState, string> = {
  ok: "Healthy",
  failing: "Failing",
  rot: "Rot suspected",
  off: "Not ingested",
};

/* Four states, and colour is never the only signal that tells them apart:
 * tokens.css records 90 near-indistinguishable colour pairs in this
 * palette, so every state also carries an accessible name (role="img" +
 * aria-label), a title (hover tooltip), and a data-state attribute a test
 * can assert without touching colour at all. */
export function StatusDot({ state }: { state: StatusDotState }) {
  const label = STATE_LABEL[state];
  return (
    <span
      className={`status-dot status-dot--${state}`}
      role="img"
      aria-label={label}
      title={label}
      data-state={state}
    />
  );
}
