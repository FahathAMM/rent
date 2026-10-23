import api from "@/lib/axios";

export const authService = {
  login: (credentials) => api.post("/auth/login", credentials),
  register: (data) => api.post("/auth/register", data),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
  updateProfile: (data) => {
    data.append("_method", "PUT");
    return api.post("/auth/profile", data, { headers: { "Content-Type": "multipart/form-data" } });
  },
  changePassword: (data) => api.put("/auth/change-password", data),
};
