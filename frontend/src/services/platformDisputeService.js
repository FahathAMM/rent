import platformApi from "@/lib/platformAxios";

export const platformDisputeService = {
  getAll: (params) => platformApi.get("/platform/disputes", { params }),
  getOne: (reference) => platformApi.get(`/platform/disputes/${reference}`),
  assign: (id, assignedTo) => platformApi.post(`/platform/disputes/${id}/assign`, assignedTo ? { assigned_to: assignedTo } : {}),
  resolve: (id, data) => platformApi.post(`/platform/disputes/${id}/resolve`, data),
  addMessage: (id, message, isInternal) => platformApi.post(`/platform/disputes/${id}/messages`, { message, is_internal: isInternal }),
};
