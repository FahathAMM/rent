import api from "@/lib/axios";

export const vendorStaffService = {
  getAll: () => api.get("/vendor/staff"),
  abilities: () => api.get("/vendor/staff/abilities"),
  invite: (data) => api.post("/vendor/staff", data),
  update: (id, data) => api.put(`/vendor/staff/${id}`, data),
  remove: (id) => api.delete(`/vendor/staff/${id}`),
};
