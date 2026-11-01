import platformApi from "@/lib/platformAxios";

const multipart = { headers: { "Content-Type": "multipart/form-data" } };

/**
 * Every platform-admin API (lists themselves load through ServerDataTable by URL), grouped by area — e.g. `platformService.bookings.cancel(reference, reason)`.
 * Admin login lives in platformAuthService; the public site details in platformDetailService.
 */
export const platformService = {
  dashboard: {
    getSummary: () => platformApi.get("/platform/dashboard"),
  },

  bookings: {
    getOne: (reference) => platformApi.get(`/platform/bookings/${reference}`),
    cancel: (reference, reason) => platformApi.post(`/platform/bookings/${reference}/cancel`, { reason }),
  },

  customers: {
    suspend: (id, reason) => platformApi.post(`/platform/customers/${id}/suspend`, { reason }),
    ban: (id, reason) => platformApi.post(`/platform/customers/${id}/ban`, { reason }),
    activate: (id) => platformApi.post(`/platform/customers/${id}/activate`),
  },

  shops: {
    getAll: (params) => platformApi.get("/platform/shops", { params }),
    getOne: (id) => platformApi.get(`/platform/shops/${id}`),
    verify: (id) => platformApi.post(`/platform/shops/${id}/verify`),
    reject: (id, reason) => platformApi.post(`/platform/shops/${id}/reject`, { reason }),
    suspend: (id, reason) => platformApi.post(`/platform/shops/${id}/suspend`, { reason }),
    activate: (id) => platformApi.post(`/platform/shops/${id}/activate`),
    delete: (id, reason) => platformApi.delete(`/platform/shops/${id}`, { data: { reason } }),
    downloadDocument: (verificationId) =>
      platformApi.get(`/platform/shops/documents/${verificationId}/download`, { responseType: "blob" }),
  },

  listings: {
    getOne: (id) => platformApi.get(`/platform/listings/${id}`),
    approve: (id) => platformApi.post(`/platform/listings/${id}/approve`),
    reject: (id, reason) => platformApi.post(`/platform/listings/${id}/reject`, { reason }),
    flag: (id, reason) => platformApi.post(`/platform/listings/${id}/flag`, { reason }),
    unpublish: (id, reason) => platformApi.post(`/platform/listings/${id}/unpublish`, { reason }),
    republish: (id) => platformApi.post(`/platform/listings/${id}/republish`),
    feature: (id) => platformApi.post(`/platform/listings/${id}/feature`),
    unfeature: (id) => platformApi.post(`/platform/listings/${id}/unfeature`),
  },

  reviews: {
    publish: (id) => platformApi.post(`/platform/reviews/${id}/publish`),
    reject: (id, reason) => platformApi.post(`/platform/reviews/${id}/reject`, { reason }),
    hide: (id, reason) => platformApi.post(`/platform/reviews/${id}/hide`, { reason }),
  },

  disputes: {
    getOne: (reference) => platformApi.get(`/platform/disputes/${reference}`),
    assign: (id, assignedTo) => platformApi.post(`/platform/disputes/${id}/assign`, assignedTo ? { assigned_to: assignedTo } : {}),
    resolve: (id, data) => platformApi.post(`/platform/disputes/${id}/resolve`, data),
    addMessage: (id, message, isInternal) => platformApi.post(`/platform/disputes/${id}/messages`, { message, is_internal: isInternal }),
  },

  /** Abuse reports. */
  reports: {
    action: (id, data) => platformApi.post(`/platform/abuse-reports/${id}/action`, data),
  },

  /** Shop subscription plans — plans & settings are Platform Owner only to change. Payments list loads via ServerDataTable. */
  subscriptions: {
    stats: () => platformApi.get("/platform/subscription-stats"),
    plans: () => platformApi.get("/platform/subscription-plans"),
    createPlan: (data) => platformApi.post("/platform/subscription-plans", data),
    updatePlan: (id, data) => platformApi.put(`/platform/subscription-plans/${id}`, data),
    settings: () => platformApi.get("/platform/subscription-settings"),
    updateSettings: (data) => platformApi.put("/platform/subscription-settings", data),
    approve: (id) => platformApi.post(`/platform/subscription-payments/${id}/approve`),
    reject: (id, reason) => platformApi.post(`/platform/subscription-payments/${id}/reject`, { reason }),
    proof: (id) => platformApi.get(`/platform/subscription-payments/${id}/proof`, { responseType: "blob" }),
    shop: (shopId) => platformApi.get(`/platform/shops/${shopId}/subscription`),
    grant: (shopId, data) => platformApi.post(`/platform/shops/${shopId}/subscription`, data),
  },

  /** Paid visibility. Packages & slot settings are Platform Owner only to change. The list loads via ServerDataTable. */
  promotions: {
    stats: () => platformApi.get("/platform/promotions/stats"),
    packages: () => platformApi.get("/platform/promotions/packages"),
    createPackage: (data) => platformApi.post("/platform/promotions/packages", data),
    updatePackage: (id, data) => platformApi.put(`/platform/promotions/packages/${id}`, data),
    updateSettings: (data) => platformApi.put("/platform/promotions/settings", data),
    approve: (id) => platformApi.post(`/platform/promotions/${id}/approve`),
    reject: (id, reason) => platformApi.post(`/platform/promotions/${id}/reject`, { reason }),
    end: (id, reason) => platformApi.post(`/platform/promotions/${id}/end`, { reason }),
    proof: (id) => platformApi.get(`/platform/promotions/${id}/proof`, { responseType: "blob" }),
    grant: (shopId, data) => platformApi.post(`/platform/shops/${shopId}/promotions`, data),
  },

  // ── Catalogue ───────────────────────────────────────────────────────────
  /** Vehicle brands. create/update take a FormData (optional logo upload). */
  brands: {
    getAll: () => platformApi.get("/platform/brands"),
    create: (data) => platformApi.post("/platform/brands", data, multipart),
    update: (id, data) => {
      data.append("_method", "PUT");
      return platformApi.post(`/platform/brands/${id}`, data, multipart);
    },
    delete: (id) => platformApi.delete(`/platform/brands/${id}`),
  },

  /** The vehicle hierarchy under brands: models (per brand), variants (per model) and colours. */
  vehicleModels: {
    create: (data) => platformApi.post("/platform/vehicle-models", data),
    update: (id, data) => platformApi.put(`/platform/vehicle-models/${id}`, data),
    delete: (id) => platformApi.delete(`/platform/vehicle-models/${id}`),
  },

  vehicleVariants: {
    getAll: (modelId) => platformApi.get("/platform/vehicle-variants", { params: { model_id: modelId } }),
    create: (data) => platformApi.post("/platform/vehicle-variants", data),
    update: (id, data) => platformApi.put(`/platform/vehicle-variants/${id}`, data),
    delete: (id) => platformApi.delete(`/platform/vehicle-variants/${id}`),
  },

  vehicleColours: {
    create: (data) => platformApi.post("/platform/vehicle-colours", data),
    update: (id, data) => platformApi.put(`/platform/vehicle-colours/${id}`, data),
    delete: (id) => platformApi.delete(`/platform/vehicle-colours/${id}`),
  },

  categories: {
    create: (data) => platformApi.post("/platform/categories", data),
    update: (id, data) => platformApi.put(`/platform/categories/${id}`, data),
    delete: (id) => platformApi.delete(`/platform/categories/${id}`),
  },

  /** Platform-managed Sri Lanka District/City reference data — see routes/platform.php. */
  cities: {
    getAll: () => platformApi.get("/platform/cities"),
    create: (data) => platformApi.post("/platform/cities", data),
    delete: (id) => platformApi.delete(`/platform/cities/${id}`),
  },

  /** Home page hero slides. create/update take a FormData (image upload). */
  heroSlides: {
    getAll: () => platformApi.get("/platform/hero-slides"),
    create: (data) => platformApi.post("/platform/hero-slides", data, multipart),
    update: (id, data) => {
      data.append("_method", "PUT");
      return platformApi.post(`/platform/hero-slides/${id}`, data, multipart);
    },
    reorder: (ids) => platformApi.post("/platform/hero-slides/reorder", { ids }),
    delete: (id) => platformApi.delete(`/platform/hero-slides/${id}`),
  },

  // ── Administration ──────────────────────────────────────────────────────
  /** Platform admin users. */
  users: {
    create: (data) => platformApi.post("/platform/users", data),
    update: (id, data) => platformApi.put(`/platform/users/${id}`, data),
    delete: (id) => platformApi.delete(`/platform/users/${id}`),
  },

  /** Roles & Permissions — any platform admin can view; only the Platform Owner can save. */
  roles: {
    getAll: () => platformApi.get("/platform/roles"),
    permissions: () => platformApi.get("/platform/permissions"),
    update: (id, data) => platformApi.put(`/platform/roles/${id}`, data),
  },

  /** Platform settings (name, logo, …) as edited by the admin. */
  details: {
    get: () => platformApi.get("/platform/details"),
    update: (data) => {
      data.append("_method", "PUT");
      return platformApi.post("/platform/details", data, multipart);
    },
  },

  automations: {
    getAll: () => platformApi.get("/platform/automations"),
    create: (data) => platformApi.post("/platform/automations", data),
    update: (id, data) => platformApi.put(`/platform/automations/${id}`, data),
    delete: (id) => platformApi.delete(`/platform/automations/${id}`),
  },

  backups: {
    getAll: () => platformApi.get("/platform/backups"),
    create: () => platformApi.post("/platform/backups"),
    download: (path) => platformApi.get("/platform/backups/download", { params: { path }, responseType: "blob" }),
    email: (data) => platformApi.post("/platform/backups/email", data),
    delete: (path) => platformApi.delete("/platform/backups", { params: { path } }),
  },

  logs: {
    getFiles: () => platformApi.get("/platform/logs"),
    download: (file) => platformApi.get("/platform/logs/download", { params: { file }, responseType: "blob" }),
    clear: (file) => platformApi.delete("/platform/logs", { params: { file } }),
  },

  /** Public site visits — the list itself loads through ServerDataTable (/platform/visits). */
  visits: {
    summary: () => platformApi.get("/platform/visits/summary"),
  },
};
