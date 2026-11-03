import api from "@/lib/axios";

const multipart = { headers: { "Content-Type": "multipart/form-data" } };

/**
 * Every vendor (shop) API, grouped by area — e.g. `vendorService.bookings.accept(reference)`.
 * All calls act for the signed-in vendor's own shop.
 */
export const vendorService = {
  dashboard: {
    getSummary: () => api.get("/dashboard"),
  },

  /** The shop's booking inbox. See Vendor\BookingController (backend). */
  bookings: {
    getOne: (reference) => api.get(`/vendor/bookings/${reference}`),
    accept: (reference) => api.post(`/vendor/bookings/${reference}/accept`),
    reject: (reference, reason) => api.post(`/vendor/bookings/${reference}/reject`, { reason }),
    cancel: (reference, reason) => api.post(`/vendor/bookings/${reference}/cancel`, { reason }),
    handover: (reference, inspection) => api.post(`/vendor/bookings/${reference}/handover`, inspection),
    returnVehicle: (reference, inspection) => api.post(`/vendor/bookings/${reference}/return`, inspection),
    /** FormData: method (cash | bank_transfer), amount, paid_at?, reference?, note?, proof? — money the shop received outside the app. */
    recordPayment: (reference, data) => api.post(`/vendor/bookings/${reference}/payments`, data, multipart),
    /** The booking voucher PDF (same one the customer gets) — a blob, since it needs the staff token. */
    voucher: (reference, download = false) => api.get(`/vendor/bookings/${reference}/voucher`, { params: download ? { download: 1 } : {}, responseType: "blob" }),
    /** The rental agreement PDF — the shop's terms with the customer's handover signature. */
    agreement: (reference, download = false) => api.get(`/vendor/bookings/${reference}/agreement`, { params: download ? { download: 1 } : {}, responseType: "blob" }),
    /** { pickup_at, return_at } as ISO strings — what changing the dates would cost; nothing is saved. */
    previewReschedule: (reference, data) => api.post(`/vendor/bookings/${reference}/reschedule/preview`, data),
    /** { pickup_at, return_at, reason? } — moves the booking's dates (confirmed bookings, before handover). */
    reschedule: (reference, data) => api.post(`/vendor/bookings/${reference}/reschedule`, data),
    verifyTransfer: (reference, paymentId) => api.post(`/vendor/bookings/${reference}/transfers/${paymentId}/verify`),
    rejectTransfer: (reference, paymentId, reason) => api.post(`/vendor/bookings/${reference}/transfers/${paymentId}/reject`, { reason }),
    /** Private receipt behind auth — fetched as a blob, not linked. */
    transferProof: (reference, paymentId) => api.get(`/vendor/bookings/${reference}/transfers/${paymentId}/proof`, { responseType: "blob" }),
  },

  /** The all-vehicle availability calendar. */
  availability: {
    getAll: (params) => api.get("/vehicles-availability", { params }),
    block: (vehicleId, data) => api.post(`/vehicles/${vehicleId}/availability/block`, data),
    unblock: (vehicleId, data) => api.post(`/vehicles/${vehicleId}/availability/unblock`, data),
  },

  earnings: {
    summary: (params) => api.get("/vendor/earnings", { params }),
  },

  bankDetails: {
    create: (data) => api.post("/vendor/bank-details", data),
    update: (id, data) => api.put(`/vendor/bank-details/${id}`, data),
    makePrimary: (id) => api.post(`/vendor/bank-details/${id}/primary`),
    delete: (id) => api.delete(`/vendor/bank-details/${id}`),
  },

  inquiries: {
    reply: (inquiryId, replyMessage) => api.post(`/vendor/inquiries/${inquiryId}/reply`, { reply_message: replyMessage }),
  },

  reviews: {
    reply: (id, reply) => api.post(`/vendor/reviews/${id}/reply`, { reply }),
  },

  shopProfile: {
    show: () => api.get("/vendor/shop-profile"),
    update: (data) => api.put("/vendor/shop-profile", data),
    /** FormData with logo / cover_image files, or remove_logo / remove_cover_image = 1. */
    updateBranding: (data) => api.post("/vendor/shop-profile/branding", data, multipart),
  },

  staff: {
    roles: () => api.get("/vendor/staff/roles"),
    invite: (data) => api.post("/vendor/staff", data),
    update: (id, data) => api.put(`/vendor/staff/${id}`, data),
    remove: (id) => api.delete(`/vendor/staff/${id}`),
  },

  /** The shop's own terms & conditions — the customer signs them at handover. */
  terms: {
    get: () => api.get("/vendor/terms"),
    update: (terms) => api.put("/vendor/terms", { terms }),
  },

  /** Paid visibility — featured vehicles and category / city sponsorship. Shop owner only. */
  promotions: {
    get: () => api.get("/vendor/promotions"),
    /** { package_id, vehicle_id? | target_type + category_id? } → when it would start if approved now. */
    availability: (params) => api.get("/vendor/promotions/availability", { params }),
    /** FormData: package_id, vehicle_id? | target_type + category_id?, bank_reference?, proof. */
    pay: (data) => api.post("/vendor/promotions/payments", data, multipart),
    proof: (id) => api.get(`/vendor/promotions/${id}/proof`, { responseType: "blob" }),
  },

  /** The shop's plan. summary = for everyone in the shop; the rest is owner-only. */
  subscription: {
    summary: () => api.get("/vendor/subscription/summary"),
    get: () => api.get("/vendor/subscription"),
    /** FormData: plan_id, periods, bank_reference?, proof (image / PDF). */
    pay: (data) => api.post("/vendor/subscription/payments", data, multipart),
    proof: (paymentId) => api.get(`/vendor/subscription/payments/${paymentId}/proof`, { responseType: "blob" }),
  },

  /** The shop's own roles — shop owner only. See Vendor\ShopRoleController (backend). */
  roles: {
    getAll: () => api.get("/vendor/roles"),
    permissions: () => api.get("/vendor/roles/permissions"),
    create: (data) => api.post("/vendor/roles", data),
    update: (id, data) => api.put(`/vendor/roles/${id}`, data),
    remove: (id) => api.delete(`/vendor/roles/${id}`),
  },
};
