/* Who is deciding, held for the tab's lifetime.
 *
 * Spec §5.3: "decided_by is set once per session and stored on every row.
 * Two people scoring cannot be merged into one ground truth without knowing
 * whose is whose."
 *
 * Same shape as adminSecret.ts's getAdminSecret(): prompt once, hold in
 * sessionStorage -- not localStorage, it should not outlive the tab -- and
 * take an injectable prompter so a test can seed the value without touching
 * window.prompt. */
const KEY = "tenderfoot.decidedBy";

export function getDecidedBy(
  prompter: () => string | null = () =>
    window.prompt("Your name or initials (recorded on every decision this session)"),
): string | null {
  const held = sessionStorage.getItem(KEY);
  if (held) return held;
  const entered = prompter();
  if (!entered) return null;
  sessionStorage.setItem(KEY, entered);
  return entered;
}
