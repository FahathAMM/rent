import api from "@/lib/axios";

export const locationService = {
  getAll: (params) => api.get("/locations", { params }),
  getOne: (id) => api.get(`/locations/${id}`),
  create: (data) => api.post("/locations", data),
  update: (id, data) => api.put(`/locations/${id}`, data),
  delete: (id) => api.delete(`/locations/${id}`),
};
