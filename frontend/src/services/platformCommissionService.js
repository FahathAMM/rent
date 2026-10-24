import api from "@/lib/axios";

export const platformCommissionService = {
  getAll: (params) => api.get("/platform/commissions", { params }),
  create: (data) => api.post("/platform/commissions", data),
  update: (id, data) => api.put(`/platform/commissions/${id}`, data),
  delete: (id) => api.delete(`/platform/commissions/${id}`),
};
