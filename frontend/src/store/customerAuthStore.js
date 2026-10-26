import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Customer session state — deliberately separate from useAuthStore
 * (vendor/owner/staff). Different localStorage keys so the two
 * identities never collide, same pattern as usePlatformAuthStore.
 */
export const useCustomerAuthStore = create(
  persist(
    (set) => ({
      customer: null,
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      setAuth: (customer, token) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("customer_token", token);
        }
        set({ customer, token, isAuthenticated: true });
      },

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("customer_token");
        }
        set({ customer: null, token: null, isAuthenticated: false });
      },

      updateCustomer: (customer) => set({ customer }),
    }),
    {
      name: "customer-auth",
      partialize: (state) => ({ customer: state.customer, token: state.token, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
