import platformApi from "@/lib/platformAxios";

export const platformRefundService = {
  getAll: (params) => platformApi.get("/platform/refunds", { params }),
  getOne: (id) => platformApi.get(`/platform/refunds/${id}`),
  create: (data) => platformApi.post("/platform/refunds", data),
  approve: (id) => platformApi.post(`/platform/refunds/${id}/approve`),
  reject: (id, reason) => platformApi.post(`/platform/refunds/${id}/reject`, { reason }),
  complete: (id, data) => platformApi.post(`/platform/refunds/${id}/complete`, data),
};
