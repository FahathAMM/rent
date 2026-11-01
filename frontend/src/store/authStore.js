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

      // Can the user do this? e.g. can("vendor-vehicles-list-create")
      can: (permission) => {
        const user = get().user;
        if (!user) return false;

        // Shop owner can do everything
        if (user.roles?.includes("shop-owner")) return true;

        // Staff: only what their role allows
        return user.permissions?.includes(permission) ?? false;
      },
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
