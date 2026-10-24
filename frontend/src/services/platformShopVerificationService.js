import platformApi from "@/lib/platformAxios";

export const platformShopVerificationService = {
  getAll: (params) => platformApi.get("/platform/shops", { params }),
  getOne: (id) => platformApi.get(`/platform/shops/${id}`),
  verify: (id) => platformApi.post(`/platform/shops/${id}/verify`),
  reject: (id, reason) => platformApi.post(`/platform/shops/${id}/reject`, { reason }),
  suspend: (id, reason) => platformApi.post(`/platform/shops/${id}/suspend`, { reason }),
  activate: (id) => platformApi.post(`/platform/shops/${id}/activate`),
  downloadDocument: (verificationId) =>
    platformApi.get(`/platform/shops/documents/${verificationId}/download`, { responseType: "blob" }),
};
