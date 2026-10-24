import api from "@/lib/axios";

export const platformReconciliationService = {
  summary: (params) => api.get("/platform/reconciliation", { params }),
  export: (params) => api.get("/platform/reconciliation/export", { params, responseType: "blob" }),
};
