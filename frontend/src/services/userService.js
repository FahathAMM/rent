import api from "@/lib/axios";

export const userService = {
  getAll: (params) => api.get("/users", { params }),
  getOne: (id) => api.get(`/users/${id}`),
  create: (data) => api.post("/users", data, { headers: { "Content-Type": "multipart/form-data" } }),
  update: (id, data) => {
    data.append("_method", "PUT");
    return api.post(`/users/${id}`, data, { headers: { "Content-Type": "multipart/form-data" } });
  },
  delete: (id) => api.delete(`/users/${id}`),
};
