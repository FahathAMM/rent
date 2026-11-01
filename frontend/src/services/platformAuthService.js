import platformApi from "@/lib/platformAxios";

export const platformAuthService = {
  login: (credentials) => platformApi.post("/platform/login", credentials),
  logout: () => platformApi.post("/platform/logout"),
};
