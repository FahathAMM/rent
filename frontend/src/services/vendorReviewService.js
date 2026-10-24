import api from "@/lib/axios";

export const vendorReviewService = {
  getAll: (params) => api.get("/vendor/reviews", { params }),
  reply: (id, reply) => api.post(`/vendor/reviews/${id}/reply`, { reply }),
};
