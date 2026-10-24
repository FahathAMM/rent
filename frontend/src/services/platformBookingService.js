import api from "@/lib/axios";

export const platformBookingService = {
  getAll: (params) => api.get("/platform/bookings", { params }),
  getOne: (reference) => api.get(`/platform/bookings/${reference}`),
  cancel: (reference, reason) => api.post(`/platform/bookings/${reference}/cancel`, { reason }),
};
