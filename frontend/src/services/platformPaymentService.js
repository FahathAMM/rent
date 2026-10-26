import platformApi from "@/lib/platformAxios";

export const platformPaymentService = {
  getAll: (params) => platformApi.get("/platform/payments", { params }),
  getOne: (id) => platformApi.get(`/platform/payments/${id}`),
};
