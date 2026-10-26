import api from "@/lib/customerAxios";

/** Customer's own favorites. */
export const favoriteService = {
  getAll: (params) => api.get("/favorites", { params }),
  add: (vehicleId) => api.post(`/favorites/${vehicleId}`),
  remove: (vehicleId) => api.delete(`/favorites/${vehicleId}`),
};
