import customerApi from "@/lib/customerAxios";

// Fire-and-forget traffic logging (public page visits, login visits, link
// clicks) — backend writes storage/logs/public_visit/<date>.log. Never blocks the UI.
// Sent with the customer token (if signed in) so the visit records who it was.
export const visitService = {
  track: (type) =>
    customerApi
      .post("/visits", { type, path: typeof window !== "undefined" ? window.location.pathname : undefined })
      .catch(() => {}),
};
