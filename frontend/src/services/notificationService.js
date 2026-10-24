import api from "@/lib/axios";

/** Shared by both the account and vendor apps — a notification belongs to the User model itself. */
export const notificationService = {
  getAll: (params) => api.get("/notifications", { params }),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
};
