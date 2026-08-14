import "./FactTile.css";
import { MicroLabel } from "./MicroLabel";

/* The deadline/value/posted trio -- see FactTile.css for the bundle
 * declaration this was matched against. `label` reuses MicroLabel rather
 * than reimplementing it -- its declaration is byte-identical to
 * MicroLabel's own.
 *
 * `emphasis` -- across all 5 mock opportunity records, DEADLINE's value
 * colour (`cur.deadlineColor`) only ever takes two values: var(--text)
 * (default) or var(--warn). EST. VALUE and POSTED never colour their value
 * at all (falling back to the same default). A boolean, not a colour prop,
 * because the bundle only ever distinguishes two states here, not a graded
 * scale -- see FactTile.css. */
export function FactTile({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
}) {
  const valueClass = emphasis ? "fact-tile__value fact-tile__value--emphasis" : "fact-tile__value";
  return (
    <div className="fact-tile">
      <div className="fact-tile__label">
        <MicroLabel>{label}</MicroLabel>
      </div>
      <div className={valueClass}>{value}</div>
      {sub && <div className="fact-tile__sub">{sub}</div>}
    </div>
  );
}
