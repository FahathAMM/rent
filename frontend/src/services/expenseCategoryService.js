import api from "@/lib/axios";

export const expenseCategoryService = {
  getAll: (params) => api.get("/expense-categories", { params }),
  create: (data) => api.post("/expense-categories", data),
  update: (id, data) => api.put(`/expense-categories/${id}`, data),
  delete: (id) => api.delete(`/expense-categories/${id}`),
};
