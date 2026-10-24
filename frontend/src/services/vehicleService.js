import api from "@/lib/axios";

export const vehicleService = {
  getAll: (params) => api.get("/vehicles", { params }),
  getOne: (id) => api.get(`/vehicles/${id}`),
  create: (data) => api.post("/vehicles", data),
  update: (id, data) => api.put(`/vehicles/${id}`, data),
  delete: (id) => api.delete(`/vehicles/${id}`),
  publish: (id) => api.post(`/vehicles/${id}/publish`),
  unpublish: (id) => api.post(`/vehicles/${id}/unpublish`),
  archive: (id) => api.post(`/vehicles/${id}/archive`),
  updatePricing: (id, data) => api.put(`/vehicles/${id}/pricing`, data),
};
