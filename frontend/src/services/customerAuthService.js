import customerApi from "@/lib/customerAxios";

export const customerAuthService = {
  login: (credentials) => customerApi.post("/customer/login", credentials),
  register: (data) => customerApi.post("/customer/register", data),
  logout: () => customerApi.post("/customer/logout"),
  me: () => customerApi.get("/customer/me"),
  updateProfile: (data) => {
    data.append("_method", "PUT");
    return customerApi.post("/customer/profile", data, { headers: { "Content-Type": "multipart/form-data" } });
  },
  changePassword: (data) => customerApi.put("/customer/change-password", data),
};
