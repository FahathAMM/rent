import api from "@/lib/customerAxios";

/** The customer's own bookings — no shop context, ownership by customer_id. See BookingController (backend). */
export const bookingService = {
  getAll: (params) => api.get("/bookings", { params }),
  getOne: (reference) => api.get(`/bookings/${reference}`),
  create: (data) => api.post("/bookings", data),
  cancel: (reference, reason) => api.post(`/bookings/${reference}/cancel`, { reason }),
  checkout: (reference) => api.post(`/bookings/${reference}/checkout`),
};
