import axios from "axios";
import { useAuthStore } from "@/store/authStore";

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

    // The active shop for vendor-side requests — see
    // ResolveShopContext/VendorContext on the backend and
    // app-doc/marketplace/03-permissions-model.md "Layer 2". Only ever
    // read here; nothing else should attach this header directly.
    const shopId = localStorage.getItem("active_shop_id");
    if (shopId) {
      config.headers["X-Shop-Id"] = shopId;
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
      // This client is the vendor/owner/staff identity (pos_token) — a stale
      // or expired token belongs on the vendor sign-in, not the customer
      // /login. Reset the persisted session too, so the vendor layout stops
      // treating the visitor as logged in.
      useAuthStore.getState().logout();
      const onVendorAuthPage = ["/vendor/login", "/vendor/register"].includes(window.location.pathname);
      if (!onVendorAuthPage) window.location.href = "/vendor/login";
    }
    return Promise.reject(error);
  }
);

export default api;
