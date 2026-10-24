import api from "@/lib/axios";

export const platformPaymentService = {
  getAll: (params) => api.get("/platform/payments", { params }),
  getOne: (id) => api.get(`/platform/payments/${id}`),
};
