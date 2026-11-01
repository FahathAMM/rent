import api from "@/lib/axios";

/** The active shop's branches / pickup points. */
export const locationService = {
  create: (data) => api.post("/locations", data),
  update: (id, data) => api.put(`/locations/${id}`, data),
  delete: (id) => api.delete(`/locations/${id}`),
};
