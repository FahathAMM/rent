import platformApi from "@/lib/platformAxios";

export const platformPayoutService = {
  getAll: (params) => platformApi.get("/platform/payouts", { params }),
  getOne: (id) => platformApi.get(`/platform/payouts/${id}`),
  build: () => platformApi.post("/platform/payouts/build"),
  approve: (id) => platformApi.post(`/platform/payouts/${id}/approve`),
  markProcessing: (id) => platformApi.post(`/platform/payouts/${id}/processing`),
  markPaid: (id, evidence) => platformApi.post(`/platform/payouts/${id}/paid`, evidence),
  markFailed: (id, reason) => platformApi.post(`/platform/payouts/${id}/failed`, { reason }),
};
