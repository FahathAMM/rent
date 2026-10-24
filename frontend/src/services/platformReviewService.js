import platformApi from "@/lib/platformAxios";

export const platformReviewService = {
  getAll: (params) => platformApi.get("/platform/reviews", { params }),
  publish: (id) => platformApi.post(`/platform/reviews/${id}/publish`),
  reject: (id, reason) => platformApi.post(`/platform/reviews/${id}/reject`, { reason }),
  hide: (id, reason) => platformApi.post(`/platform/reviews/${id}/hide`, { reason }),
};
