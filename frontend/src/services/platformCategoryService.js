import platformApi from "@/lib/platformAxios";

export const platformCategoryService = {
  getAll: () => platformApi.get("/platform/categories"),
  create: (data) => platformApi.post("/platform/categories", data),
  update: (id, data) => platformApi.put(`/platform/categories/${id}`, data),
  delete: (id) => platformApi.delete(`/platform/categories/${id}`),
};
