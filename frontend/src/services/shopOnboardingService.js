import api from "@/lib/axios";

export const shopOnboardingService = {
  index: () => api.get("/onboarding/shops"),
  register: (data) => api.post("/onboarding/shops", data),
  submit: (shopId) => api.post(`/onboarding/shops/${shopId}/submit`),
  uploadDocument: (shopId, documentType, file) => {
    const fd = new FormData();
    fd.append("document_type", documentType);
    fd.append("file", file);
    return api.post(`/onboarding/shops/${shopId}/documents`, fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  downloadDocument: (verificationId) =>
    api.get(`/onboarding/shops/documents/${verificationId}/download`, { responseType: "blob" }),
};
