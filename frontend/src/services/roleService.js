import api from "@/lib/axios";

export const roleService = {
  getRoles: () => api.get("/roles"),
  getPermissions: () => api.get("/permissions"),
  create: (data) => api.post("/roles", data),
  update: (id, data) => api.put(`/roles/${id}`, data),
  delete: (id) => api.delete(`/roles/${id}`),
};
