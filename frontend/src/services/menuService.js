import api from "@/lib/axios";

export const menuService = {
  getAll:      (params) => api.get("/menus", { params }),
  getFlat:     ()       => api.get("/menus/flat"),
  navigation:  ()       => api.get("/menus/navigation"),
  create:      (data)   => api.post("/menus", data),
  update:      (id, data) => api.put(`/menus/${id}`, data),
  delete:      (id)     => api.delete(`/menus/${id}`),
};
