import axios from "axios";
import { toast } from "sonner";
import { useCustomerAuthStore } from "@/store/customerAuthStore";
import { withLocaleHeader } from "@/i18n/requestLocale";

/**
 * Dedicated axios instance for the customer identity — reads the
 * `customer_token` bearer token, never `pos_token`. On 401 it clears the
 * customer session and, inside /account only, redirects to /login
 * (never /vendor/login). Kept fully separate from
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

// Validation and error messages come back in the visitor's language.
customerApi.interceptors.request.use(withLocaleHeader);

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
    if (error.response?.status === 401 && typeof window !== "undefined") {
      // Clear the whole persisted session, not just the token — otherwise
      // the store still says isAuthenticated and every page that gates a
      // customer-only query on it (e.g. favorites on a vehicle page) fires
      // it again tokenless, 401s again, and loops.
      useCustomerAuthStore.getState().logout();

      // Only the signed-in area needs a login. Public pages (vehicles,
      // shops, browse) stay viewable as a guest.
      if (window.location.pathname.startsWith("/account")) {
        toast.error("Your session has expired. Please sign in again.");
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      }
    }
    return Promise.reject(error);
  }
);

export default customerApi;
