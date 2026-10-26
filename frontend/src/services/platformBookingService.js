import platformApi from "@/lib/platformAxios";

export const platformBookingService = {
  getAll: (params) => platformApi.get("/platform/bookings", { params }),
  getOne: (reference) => platformApi.get(`/platform/bookings/${reference}`),
  cancel: (reference, reason) => platformApi.post(`/platform/bookings/${reference}/cancel`, { reason }),
};
