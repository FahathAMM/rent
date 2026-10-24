import api from "@/lib/axios";

export const platformReportService = {
  getAll: (params) => api.get("/platform/abuse-reports", { params }),
  action: (id, data) => api.post(`/platform/abuse-reports/${id}/action`, data),
};
