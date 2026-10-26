import axios from "axios";
import { toast } from "sonner";

/**
 * Dedicated axios instance for the customer identity — reads the
 * `customer_token` bearer token, never `pos_token`, and redirects to
 * /login (never /vendor/login) on 401. Kept fully separate from
 * lib/axios.js so the two auth identities can never bleed into each
 * other — same pattern as lib/platformAxios.js.
 */
const customerApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

customerApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("customer_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

customerApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      error.networkError = `Cannot reach API at ${(process.env.NEXT_PUBLIC_API_URL || "/api")}. Is the backend running?`;
    }
    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login") &&
      !window.location.pathname.startsWith("/register")
    ) {
      localStorage.removeItem("customer_token");
      toast.error("Your session has expired. Please sign in again.");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default customerApi;
