import api from "@/lib/axios";

/** Abuse / fraud reporting against a vehicle, review, shop or user. */
export const reportService = {
  create: (data) => api.post("/reports", data),
};
