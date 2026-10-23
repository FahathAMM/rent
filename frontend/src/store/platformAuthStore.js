import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Platform Owner / Platform Admin session state — deliberately separate
 * from useAuthStore (company users). Different localStorage keys so the
 * two identities never collide, and impersonation can hold both at once.
 */
export const usePlatformAuthStore = create(
  persist(
    (set) => ({
      admin: null,
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      setAuth: (admin, token) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("platform_token", token);
        }
        set({ admin, token, isAuthenticated: true });
      },

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("platform_token");
        }
        set({ admin: null, token: null, isAuthenticated: false });
      },

      updateAdmin: (admin) => set({ admin }),
    }),
    {
      name: "platform-auth",
      partialize: (state) => ({ admin: state.admin, token: state.token, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
