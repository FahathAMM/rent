import api from "@/lib/axios";

export const platformCategoryService = {
  getAll: () => api.get("/platform/categories"),
  create: (data) => api.post("/platform/categories", data),
  update: (id, data) => api.put(`/platform/categories/${id}`, data),
  delete: (id) => api.delete(`/platform/categories/${id}`),
};
