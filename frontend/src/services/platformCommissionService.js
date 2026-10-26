import platformApi from "@/lib/platformAxios";

export const platformCommissionService = {
  getAll: (params) => platformApi.get("/platform/commissions", { params }),
  create: (data) => platformApi.post("/platform/commissions", data),
  update: (id, data) => platformApi.put(`/platform/commissions/${id}`, data),
  delete: (id) => platformApi.delete(`/platform/commissions/${id}`),
};
