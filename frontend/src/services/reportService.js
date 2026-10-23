import api from "@/lib/axios";

export const reportService = {
  get: (type, params) => api.get(`/reports/${type}`, { params }),
  export: (type, format, params) =>
    api.get(`/reports/${type}/export`, { params: { ...params, format }, responseType: "blob" }),
};
