import platformApi from "@/lib/platformAxios";

export const platformDashboardService = {
  getSummary: () => platformApi.get("/platform/dashboard"),
};

export const platformCompanyService = {
  getAll: (params) => platformApi.get("/platform/companies", { params }),
  create: (data) => platformApi.post("/platform/companies", data),
  getOne: (id) => platformApi.get(`/platform/companies/${id}`),
  getUsers: (id) => platformApi.get(`/platform/companies/${id}/users`),
  suspend: (id) => platformApi.post(`/platform/companies/${id}/suspend`),
  activate: (id) => platformApi.post(`/platform/companies/${id}/activate`),
};

export const platformSubscriptionService = {
  getAll: (params) => platformApi.get("/platform/subscriptions", { params }),
};

export const platformPlanService = {
  getAll: () => platformApi.get("/platform/plans"),
  create: (data) => platformApi.post("/platform/plans", data),
  update: (id, data) => platformApi.put(`/platform/plans/${id}`, data),
  delete: (id) => platformApi.delete(`/platform/plans/${id}`),
};

export const platformSystemAdminService = {
  getAll: () => platformApi.get("/platform/users"),
  create: (data) => platformApi.post("/platform/users", data),
  update: (id, data) => platformApi.put(`/platform/users/${id}`, data),
  delete: (id) => platformApi.delete(`/platform/users/${id}`),
};

export const platformAutomationService = {
  getAll: () => platformApi.get("/platform/automations"),
  create: (data) => platformApi.post("/platform/automations", data),
  update: (id, data) => platformApi.put(`/platform/automations/${id}`, data),
  delete: (id) => platformApi.delete(`/platform/automations/${id}`),
};

export const platformBackupService = {
  getAll: () => platformApi.get("/platform/backups"),
  create: () => platformApi.post("/platform/backups"),
  download: (path) => platformApi.get("/platform/backups/download", { params: { path }, responseType: "blob" }),
  email: (data) => platformApi.post("/platform/backups/email", data),
  delete: (path) => platformApi.delete("/platform/backups", { params: { path } }),
};

export const platformLogService = {
  getFiles: () => platformApi.get("/platform/logs"),
  download: (file) => platformApi.get("/platform/logs/download", { params: { file }, responseType: "blob" }),
  clear: (file) => platformApi.delete("/platform/logs", { params: { file } }),
};

export const platformDetailService = {
  get: () => platformApi.get("/platform/details"),
  update: (data) => {
    data.append("_method", "PUT");
    return platformApi.post("/platform/details", data, { headers: { "Content-Type": "multipart/form-data" } });
  },
};

export const platformImpersonationService = {
  start: (userId) => platformApi.post("/platform/impersonation/start", { user_id: userId }),
  stop: (sessionId, token) =>
    platformApi.post(
      "/platform/impersonation/stop",
      { session_id: sessionId },
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    ),
};
