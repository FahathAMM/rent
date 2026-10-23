import api from "@/lib/axios";

export const platformDetailService = {
  get: () => api.get("/platform-details"),
};
