import platformApi from "@/lib/platformAxios";

export const platformReconciliationService = {
  summary: (params) => platformApi.get("/platform/reconciliation", { params }),
  export: (params) => platformApi.get("/platform/reconciliation/export", { params, responseType: "blob" }),
};
