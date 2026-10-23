import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("pos_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // Network error or CORS — attach a readable message so catch blocks can display it
      error.networkError = `Cannot reach API at ${(process.env.NEXT_PUBLIC_API_URL || "/api")}. Is the backend running?`;
    }
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("pos_token");
      localStorage.removeItem("pos_user");
      window.location.href = "/login";
    }
    // Company still `initiate` (self-registered, not yet activated by a
    // Platform Admin) — EnsureCompanyActivated blocks everything except the
    // account-pending page's own reads. Redirect there instead of leaving
    // whatever form/list was mid-request looking silently broken.
    if (error.response?.data?.company_pending && typeof window !== "undefined") {
      window.location.href = "/account-pending";
    }
    return Promise.reject(error);
  }
);

export default api;
