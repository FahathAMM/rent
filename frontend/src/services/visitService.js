import api from "@/lib/axios";

// Fire-and-forget traffic logging (site visits, pricing preview) — backend
// writes it to a log file, not the database. Never blocks the UI.
export const visitService = {
  track: (type) =>
    api
      .post("/visits", { type, path: typeof window !== "undefined" ? window.location.pathname : undefined })
      .catch(() => {}),
};
