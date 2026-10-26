import api from "@/lib/customerAxios";

/** Customer's own favorites. */
export const favoriteService = {
  getAll: (params) => api.get("/favorites", { params }),
  ids: () => api.get("/favorites/ids"),
  add: (vehicleId) => api.post(`/favorites/${vehicleId}`),
  remove: (vehicleId) => api.delete(`/favorites/${vehicleId}`),
};
