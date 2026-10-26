import api from "@/lib/axios";

export const vendorEarningsService = {
  summary: (params) => api.get("/vendor/earnings", { params }),
};
