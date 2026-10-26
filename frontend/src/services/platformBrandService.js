import platformApi from "@/lib/platformAxios";

const multipart = { headers: { "Content-Type": "multipart/form-data" } };

/** Vehicle brands. create/update take a FormData (optional logo upload). */
export const platformBrandService = {
  getAll: () => platformApi.get("/platform/brands"),
  create: (data) => platformApi.post("/platform/brands", data, multipart),
  update: (id, data) => {
    data.append("_method", "PUT");
    return platformApi.post(`/platform/brands/${id}`, data, multipart);
  },
  delete: (id) => platformApi.delete(`/platform/brands/${id}`),
};
