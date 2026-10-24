import api from "@/lib/axios";

/** The shop's booking inbox — requires an active shop context (X-Shop-Id). See Vendor\BookingController (backend). */
export const vendorBookingService = {
  getAll: (params) => api.get("/vendor/bookings", { params }),
  getOne: (reference) => api.get(`/vendor/bookings/${reference}`),
  accept: (reference) => api.post(`/vendor/bookings/${reference}/accept`),
  reject: (reference, reason) => api.post(`/vendor/bookings/${reference}/reject`, { reason }),
  cancel: (reference, reason) => api.post(`/vendor/bookings/${reference}/cancel`, { reason }),
};
