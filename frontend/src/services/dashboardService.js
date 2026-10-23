import api from "@/lib/axios";

export const dashboardService = {
  getSummary: () => api.get("/dashboard"),
};
