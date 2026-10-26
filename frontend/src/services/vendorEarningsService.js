import api from "@/lib/axios";

export const vendorEarningsService = {
  summary: (params) => api.get("/vendor/earnings", { params }),
  bookings: (params) => api.get("/vendor/earnings/bookings", { params }),
};
