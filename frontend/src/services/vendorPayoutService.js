import api from "@/lib/axios";

/** Read-only — the shop's own payout history. */
export const vendorPayoutService = {
  getAll: (params) => api.get("/vendor/payouts", { params }),
  getOne: (id) => api.get(`/vendor/payouts/${id}`),
};
