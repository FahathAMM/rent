import api from "@/lib/axios";

export const vendorDashboardService = {
  getSummary: () => api.get("/dashboard"),
};
