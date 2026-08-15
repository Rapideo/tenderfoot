import type { ReactNode } from "react";
import "./Section.css";

/* The section-level wrapper the primitives are composed INTO, rather than
 * one more thing composed alongside them -- see Section.css for the two
 * bundle declarations this was matched against, and for why it is not
 * called RecessedSection.
 *
 * Both modifiers default off, so <Section> on its own is the plain padded
 * section. That default is the honest one: the padding is the only thing
 * both bundle instances actually share, and a caller that wants neither
 * treatment is asking for exactly what the evidence supports.
 *
 * Deliberately NOT covering D6's third instance (HeaderLockup's nav-row
 * `min-width:150px;flex:none`). The audit groups all three under "outer
 * chrome", but that one is a flex-item sizing constraint on a lockup
 * inside a nav row -- it belongs to whatever header/nav container gets
 * built, not to a section wrapper, and the audit itself notes the gap is
 * moot until such a row exists. Folding it in here would produce a
 * primitive with two unrelated jobs. */
export function Section({
  recessed = false,
  divider = false,
  children,
}: {
  recessed?: boolean;
  divider?: boolean;
  children: ReactNode;
}) {
  const recessedClass = recessed ? " section--recessed" : "";
  const dividerClass = divider ? " section--divider" : "";
  return <div className={`section${recessedClass}${dividerClass}`}>{children}</div>;
}
