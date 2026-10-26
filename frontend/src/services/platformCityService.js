import api from "@/lib/axios";

/** Platform-managed Sri Lanka District/City reference data — see routes/platform.php. */
export const platformCityService = {
  getAll: () => api.get("/platform/cities"),
  create: (data) => api.post("/platform/cities", data),
  delete: (id) => api.delete(`/platform/cities/${id}`),
};
