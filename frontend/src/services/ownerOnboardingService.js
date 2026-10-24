import api from "@/lib/axios";

export const ownerOnboardingService = {
  show: () => api.get("/onboarding/owner"),
  saveDraft: (data) => api.post("/onboarding/owner", data),
  submit: () => api.post("/onboarding/owner/submit"),
  uploadDocument: (documentType, file) => {
    const fd = new FormData();
    fd.append("document_type", documentType);
    fd.append("file", file);
    return api.post("/onboarding/owner/documents", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  downloadDocument: (verificationId) =>
    api.get(`/onboarding/owner/documents/${verificationId}/download`, { responseType: "blob" }),
};
