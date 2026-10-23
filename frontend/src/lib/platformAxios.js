import axios from "axios";
import { toast } from "sonner";

/**
 * Dedicated axios instance for the Platform (SaaS Admin) area — reads the
 * `platform_token` bearer token, never `pos_token`, and redirects to
 * /platform/login (never /login) on 401. Kept fully separate from
 * lib/axios.js so the two auth identities can never bleed into each other.
 */
const platformApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

platformApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("platform_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

platformApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      error.networkError = `Cannot reach API at ${(process.env.NEXT_PUBLIC_API_URL || "/api")}. Is the backend running?`;
    }
    if (error.response?.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/platform/login")) {
      localStorage.removeItem("platform_token");
      toast.error("Your platform session has expired. Please sign in again.");
      window.location.href = "/platform/login";
    }
    return Promise.reject(error);
  }
);

export default platformApi;
