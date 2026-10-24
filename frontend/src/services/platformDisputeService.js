import api from "@/lib/axios";

export const platformDisputeService = {
  getAll: (params) => api.get("/platform/disputes", { params }),
  getOne: (reference) => api.get(`/platform/disputes/${reference}`),
  assign: (id, assignedTo) => api.post(`/platform/disputes/${id}/assign`, assignedTo ? { assigned_to: assignedTo } : {}),
  resolve: (id, data) => api.post(`/platform/disputes/${id}/resolve`, data),
  addMessage: (id, message, isInternal) => api.post(`/platform/disputes/${id}/messages`, { message, is_internal: isInternal }),
};
