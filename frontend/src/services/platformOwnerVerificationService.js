import platformApi from "@/lib/platformAxios";

export const platformOwnerVerificationService = {
  getAll: (params) => platformApi.get("/platform/owner-applications", { params }),
  getOne: (id) => platformApi.get(`/platform/owner-applications/${id}`),
  approve: (id) => platformApi.post(`/platform/owner-applications/${id}/approve`),
  reject: (id, reason) => platformApi.post(`/platform/owner-applications/${id}/reject`, { reason }),
  requestInfo: (id, reason) => platformApi.post(`/platform/owner-applications/${id}/request-info`, { reason }),
  suspend: (id, reason) => platformApi.post(`/platform/owner-applications/${id}/suspend`, { reason }),
  downloadDocument: (verificationId) =>
    platformApi.get(`/platform/owner-applications/documents/${verificationId}/download`, { responseType: "blob" }),
};
