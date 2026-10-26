import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      setAuth: (user, token) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("pos_token", token);
        }
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("pos_token");
          localStorage.removeItem("pos_user");
        }
        set({ user: null, token: null, isAuthenticated: false });
      },

      updateUser: (user) => set({ user }),

      // Every account is at minimum a customer; shop-owner/shop-staff are
      // additive on top — see app-doc/marketplace/03-
      // permissions-model.md "Layer 1". There is no bypass-everything role
      // on this guard (that's exclusively SystemAdmin on the platform
      // guard, a completely different login).
      isVendor: () => {
        const roles = get().user?.roles ?? [];
        return ["shop-owner", "shop-staff"].some((r) => roles.includes(r));
      },

      // Check a Spatie permission string, e.g. "vendor-vehicles-list-view".
      can: (permission) => (get().user?.permissions ?? []).includes(permission),

      hasRole: (role) => (get().user?.roles ?? []).includes(role),
    }),
    {
      name: "pos-auth",
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
