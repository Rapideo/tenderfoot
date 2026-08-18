/* The admin secret, held for the tab's lifetime.
 *
 * THIS IS NOT AUTHENTICATION, and the design spec says so plainly (§7): it
 * is a shared bearer secret typed into a browser tab. It is here because the
 * alternative is worse -- an open endpoint that triggers outbound traffic
 * and writes to production -- and because the auth slice upgrades it later
 * without anything here needing to be unwound.
 *
 * sessionStorage, not localStorage: it should not outlive the tab. */
const KEY = "tenderfoot.adminSecret";

export function getAdminSecret(
  prompter: () => string | null = () => window.prompt("Admin secret"),
): string | null {
  const held = sessionStorage.getItem(KEY);
  if (held) return held;
  const entered = prompter();
  if (!entered) return null;
  sessionStorage.setItem(KEY, entered);
  return entered;
}

/** Call on a 401 -- a wrong secret must not silently break every later click. */
export function clearAdminSecret(): void {
  sessionStorage.removeItem(KEY);
}

export function adminHeaders(secret: string): Record<string, string> {
  return { "X-Admin-Secret": secret };
}
