import api from "@/lib/axios";

export const vendorBankDetailService = {
  getAll: () => api.get("/vendor/bank-details"),
  create: (data) => api.post("/vendor/bank-details", data),
  makePrimary: (id) => api.post(`/vendor/bank-details/${id}/primary`),
  delete: (id) => api.delete(`/vendor/bank-details/${id}`),
};
