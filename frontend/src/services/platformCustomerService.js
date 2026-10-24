import api from "@/lib/axios";

export const platformCustomerService = {
  getAll: (params) => api.get("/platform/customers", { params }),
  getOne: (id) => api.get(`/platform/customers/${id}`),
  suspend: (id, reason) => api.post(`/platform/customers/${id}/suspend`, { reason }),
  ban: (id, reason) => api.post(`/platform/customers/${id}/ban`, { reason }),
  activate: (id) => api.post(`/platform/customers/${id}/activate`),
};
