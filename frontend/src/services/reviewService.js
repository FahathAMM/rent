import api from "@/lib/customerAxios";

/** Customer's own reviews. */
export const reviewService = {
  getAll: (params) => api.get("/reviews", { params }),
  create: (data) => api.post("/reviews", data),
};
