import "./ShortcutCard.css";

/* Ruling 11 (SP2 T6 review): a real second Card-shaped role the bundle
 * evidences (goRadars/goReports, V1.2 index ~570279) but `Card`'s
 * children-only interface cannot express, because the bundle element is
 * semantically a <button>, not a container -- see ShortcutCard.css for the
 * declaration this was matched against, verified directly against the
 * bundle rather than taken on a second-hand reading.
 *
 * A native <button> rather than a div with an onClick: keyboard focus and
 * the accessible name both come from that for free (the visible title +
 * description text is the accessible name; no separate aria-label needed). */
export function ShortcutCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="shortcut-card" onClick={onClick}>
      <div className="shortcut-card__title">{title}</div>
      <div className="shortcut-card__description">{description}</div>
    </button>
  );
}
