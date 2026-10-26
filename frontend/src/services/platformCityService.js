import platformApi from "@/lib/platformAxios";

/** Platform-managed Sri Lanka District/City reference data — see routes/platform.php. */
export const platformCityService = {
  getAll: () => platformApi.get("/platform/cities"),
  create: (data) => platformApi.post("/platform/cities", data),
  delete: (id) => platformApi.delete(`/platform/cities/${id}`),
};
