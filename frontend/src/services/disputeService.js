import api from "@/lib/axios";

/** Disputes reachable by either side of a booking — every account holds the customer role. */
export const disputeService = {
  getAll: (params) => api.get("/disputes", { params }),
  getOne: (reference) => api.get(`/disputes/${reference}`),
  create: (data) => api.post("/disputes", data),
  addMessage: (reference, message) => api.post(`/disputes/${reference}/messages`, { message }),
};
