import api from "@/lib/axios";

export const platformRefundService = {
  getAll: (params) => api.get("/platform/refunds", { params }),
  getOne: (id) => api.get(`/platform/refunds/${id}`),
  create: (data) => api.post("/platform/refunds", data),
  approve: (id) => api.post(`/platform/refunds/${id}/approve`),
  reject: (id, reason) => api.post(`/platform/refunds/${id}/reject`, { reason }),
  complete: (id, data) => api.post(`/platform/refunds/${id}/complete`, data),
};
