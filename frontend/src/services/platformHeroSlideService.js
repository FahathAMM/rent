import platformApi from "@/lib/platformAxios";

const multipart = { headers: { "Content-Type": "multipart/form-data" } };

/** Home page hero slides. create/update take a FormData (image upload). */
export const platformHeroSlideService = {
  getAll: () => platformApi.get("/platform/hero-slides"),
  create: (data) => platformApi.post("/platform/hero-slides", data, multipart),
  update: (id, data) => {
    data.append("_method", "PUT");
    return platformApi.post(`/platform/hero-slides/${id}`, data, multipart);
  },
  reorder: (ids) => platformApi.post("/platform/hero-slides/reorder", { ids }),
  delete: (id) => platformApi.delete(`/platform/hero-slides/${id}`),
};
