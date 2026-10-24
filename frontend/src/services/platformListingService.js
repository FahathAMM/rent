import platformApi from "@/lib/platformAxios";

export const platformListingService = {
  getAll: (params) => platformApi.get("/platform/listings", { params }),
  getOne: (id) => platformApi.get(`/platform/listings/${id}`),
  approve: (id) => platformApi.post(`/platform/listings/${id}/approve`),
  reject: (id, reason) => platformApi.post(`/platform/listings/${id}/reject`, { reason }),
  flag: (id, reason) => platformApi.post(`/platform/listings/${id}/flag`, { reason }),
  unpublish: (id, reason) => platformApi.post(`/platform/listings/${id}/unpublish`, { reason }),
  feature: (id) => platformApi.post(`/platform/listings/${id}/feature`),
  unfeature: (id) => platformApi.post(`/platform/listings/${id}/unfeature`),
};
