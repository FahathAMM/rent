import api from "@/lib/axios";

export const saleService = {
  getAll: (params) => api.get("/sales", { params }),
  getOne: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post("/sales", data),
  update: (id, data) => api.put(`/sales/${id}`, data),
  delete: (id) => api.delete(`/sales/${id}`),
  recordPayment: (id, data) => api.post(`/sales/${id}/record-payment`, data),
  downloadPdf: (id) => api.get(`/sales/${id}/pdf`, { responseType: "blob" }),
};
