import api from "@/lib/axios";

export const vendorService = {
  getAll: (params) => api.get("/vendors", { params }),
  getOne: (id) => api.get(`/vendors/${id}`),
  create: (data) => api.post("/vendors", data),
  update: (id, data) => api.put(`/vendors/${id}`, data),
  delete: (id) => api.delete(`/vendors/${id}`),
};
