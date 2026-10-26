import platformApi from "@/lib/platformAxios";

export const platformReportService = {
  getAll: (params) => platformApi.get("/platform/abuse-reports", { params }),
  action: (id, data) => platformApi.post(`/platform/abuse-reports/${id}/action`, data),
};
