import api from "@/lib/axios";

export const attachmentService = {
  getAll: (attachableType, attachableId) =>
    api.get("/attachments", { params: { attachable_type: attachableType, attachable_id: attachableId } }),
  upload: (attachableType, attachableId, file) => {
    const fd = new FormData();
    fd.append("attachable_type", attachableType);
    fd.append("attachable_id", attachableId);
    fd.append("file", file);
    return api.post("/attachments", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  download: (id) => api.get(`/attachments/${id}/download`, { responseType: "blob" }),
  delete: (id) => api.delete(`/attachments/${id}`),
};
