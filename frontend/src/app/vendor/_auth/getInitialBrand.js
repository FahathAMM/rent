const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8001";

/**
 * Fetches platform branding server-side so the logo/name/tagline are already
 * in the initial HTML — the client query (see VendorLoginPageClient) then
 * just keeps it fresh instead of being the thing that first renders it.
 * Never throws: a slow/unreachable backend should still render the page
 * with fallbacks. Deliberately its own copy rather than importing from
 * app/(auth) — vendor auth is a fully separate identity/guard from the
 * customer one, and this keeps the two folders from reaching into each
 * other.
 *
 * Returns undefined (not null) on any failure — passed straight through as
 * React Query's `initialData`, where undefined means "none provided" (so
 * the client still fetches normally) while null would count as real data
 * and block a retry for the full staleTime.
 */
export async function getInitialBrand() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/platform-details`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return undefined;
    const json = await res.json();
    return json.data ?? undefined;
  } catch {
    return undefined;
  }
}
