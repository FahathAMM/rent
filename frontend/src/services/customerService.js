import customerApi from "@/lib/customerAxios";

/**
 * Every customer-identity API call (customer_token, see lib/customerAxios.js):
 * auth/profile at the top level, then one group per feature. Bookings are
 * the customer's own — no shop context, ownership by customer_id (see
 * BookingController on the backend).
 */
export const customerService = {
  login: (credentials) => customerApi.post("/customer/login", credentials),
  register: (data) => customerApi.post("/customer/register", data),
  logout: () => customerApi.post("/customer/logout"),
  me: () => customerApi.get("/customer/me"),
  updateProfile: (data) => {
    data.append("_method", "PUT");
    return customerApi.post("/customer/profile", data, { headers: { "Content-Type": "multipart/form-data" } });
  },
  changePassword: (data) => customerApi.put("/customer/change-password", data),

  favorites: {
    getAll: (params) => customerApi.get("/favorites", { params }),
    ids: () => customerApi.get("/favorites/ids"),
    add: (vehicleId) => customerApi.post(`/favorites/${vehicleId}`),
    remove: (vehicleId) => customerApi.delete(`/favorites/${vehicleId}`),
  },

  bookings: {
    getAll: (params) => customerApi.get("/bookings", { params }),
    getOne: (reference) => customerApi.get(`/bookings/${reference}`),
    summary: () => customerApi.get("/bookings/summary"),
    /** The rental agreement PDF — the shop's terms, signed at handover. */
    agreement: (reference, download = false) => customerApi.get(`/bookings/${reference}/agreement`, { params: download ? { download: 1 } : {}, responseType: "blob" }),
    /** The booking voucher PDF to show the shop at pickup — fetched as a blob since it needs the customer's token. */
    voucher: (reference, download = false) => customerApi.get(`/bookings/${reference}/voucher`, { params: download ? { download: 1 } : {}, responseType: "blob" }),
    create: (data) => customerApi.post("/bookings", data),
    cancel: (reference, reason) => customerApi.post(`/bookings/${reference}/cancel`, { reason }),
    /** FormData: amount, transfer_reference (optional), proof (PDF / image). */
    submitTransfer: (reference, data) => customerApi.post(`/bookings/${reference}/transfers`, data, { headers: { "Content-Type": "multipart/form-data" } }),
    /** The receipt sits on a private disk behind auth, so it's fetched as a blob, not linked. */
    transferProof: (reference, paymentId) => customerApi.get(`/bookings/${reference}/transfers/${paymentId}/proof`, { responseType: "blob" }),
  },

  reviews: {
    getAll: (params) => customerApi.get("/reviews", { params }),
    create: (data) => customerApi.post("/reviews", data),
  },
};
