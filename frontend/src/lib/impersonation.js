const KEY = "enscone_impersonation";

/**
 * Bridges a Platform Admin session across into the company application
 * during "Login as Company User" — kept in sessionStorage (cleared when the
 * tab closes, never shared across tabs) so the platform admin's token can
 * be recovered to end the session and hop back, without ever touching the
 * impersonated user's password.
 */
export function startImpersonationBridge({ platformToken, sessionId, adminName, companyName, userName }) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ platformToken, sessionId, adminName, companyName, userName, startedAt: Date.now() })
  );
}

export function getImpersonationBridge() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearImpersonationBridge() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
