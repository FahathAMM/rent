import api from "@/lib/axios";

/** Customer's own reviews. */
export const reviewService = {
  getAll: (params) => api.get("/reviews", { params }),
  create: (data) => api.post("/reviews", data),
};
