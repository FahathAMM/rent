import api from "@/lib/axios";

// Fire-and-forget traffic logging (public page visits, login visits, link
// clicks) — backend writes storage/logs/public_visit/<date>.log. Never blocks the UI.
export const visitService = {
  track: (type) =>
    api
      .post("/visits", { type, path: typeof window !== "undefined" ? window.location.pathname : undefined })
      .catch(() => {}),
};
