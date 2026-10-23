import api from "@/lib/axios";

export const companyService = {
  get: () => api.get("/company"),
  update: (data) => {
    data.append("_method", "PUT");
    return api.post("/company", data, { headers: { "Content-Type": "multipart/form-data" } });
  },
};

export const companySettingService = {
  get: () => api.get("/company-settings"),
  update: (data) => api.put("/company-settings", data),
};
