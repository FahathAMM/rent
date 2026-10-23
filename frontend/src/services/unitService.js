import api from "@/lib/axios";

export const unitService = {
  getAll: (params) => api.get("/units", { params }),
  create: (data) => api.post("/units", data),
  update: (id, data) => api.put(`/units/${id}`, data),
  delete: (id) => api.delete(`/units/${id}`),
};
