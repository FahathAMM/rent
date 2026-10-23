import api from "@/lib/axios";

export const purchaseService = {
  getAll: (params) => api.get("/purchases", { params }),
  getOne: (id) => api.get(`/purchases/${id}`),
  create: (data) => api.post("/purchases", data),
  update: (id, data) => api.put(`/purchases/${id}`, data),
  delete: (id) => api.delete(`/purchases/${id}`),
  recordPayment: (id, data) => api.post(`/purchases/${id}/record-payment`, data),
};
