import api from "@/lib/axios";

export const vehicleService = {
  getAll: (params) => api.get("/vehicles", { params }),
  getOne: (id) => api.get(`/vehicles/${id}`),
  create: (data) => api.post("/vehicles", data),
  update: (id, data) => api.put(`/vehicles/${id}`, data),
  delete: (id) => api.delete(`/vehicles/${id}`),
  publish: (id) => api.post(`/vehicles/${id}/publish`),
  unpublish: (id) => api.post(`/vehicles/${id}/unpublish`),
  archive: (id) => api.post(`/vehicles/${id}/archive`),
  updatePricing: (id, data) => api.put(`/vehicles/${id}/pricing`, data),

  getImages: (id) => api.get(`/vehicles/${id}/images`),
  uploadImage: (id, file, altText) => {
    const fd = new FormData();
    fd.append("file", file);
    if (altText) fd.append("alt_text", altText);
    return api.post(`/vehicles/${id}/images`, fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  deleteImage: (imageId) => api.delete(`/vehicle-images/${imageId}`),
  setPrimaryImage: (imageId) => api.post(`/vehicle-images/${imageId}/primary`),
  reorderImages: (id, imageIds) => api.post(`/vehicles/${id}/images/reorder`, { image_ids: imageIds }),
};
