import platformApi from "@/lib/platformAxios";

export const platformCustomerService = {
  getAll: (params) => platformApi.get("/platform/customers", { params }),
  getOne: (id) => platformApi.get(`/platform/customers/${id}`),
  suspend: (id, reason) => platformApi.post(`/platform/customers/${id}/suspend`, { reason }),
  ban: (id, reason) => platformApi.post(`/platform/customers/${id}/ban`, { reason }),
  activate: (id) => platformApi.post(`/platform/customers/${id}/activate`),
};
