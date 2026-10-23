import api from "@/lib/axios";

export const expenseService = {
  getAll: (params) => api.get("/expenses", { params }),
  getOne: (id) => api.get(`/expenses/${id}`),
  create: (data) => api.post("/expenses", data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
};
