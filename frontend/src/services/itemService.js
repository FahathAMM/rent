import api from "@/lib/axios";

export const itemService = {
  getAll: (params) => api.get("/items", { params }),
  getOne: (id) => api.get(`/items/${id}`),
  create: (data) => api.post("/items", data),
  update: (id, data) => api.put(`/items/${id}`, data),
  delete: (id) => api.delete(`/items/${id}`),
};
