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

      isAdmin: () => (get().user?.roles ?? []).includes("admin"),

      // Check a Spatie permission string e.g. "create products". Mirrors
      // App\Models\Administration\User::can() on the backend — super-admin
      // bypasses the check entirely rather than relying on the permissions
      // array actually listing every permission.
      can: (permission) => {
        if (get().hasRole("super-admin")) return true;

        const perms = get().user?.permissions ?? [];
        return perms.includes(permission);
      },

      // Check a Spatie role name. Mirrors the backend's User::hasRole() —
      // super-admin passes as any role, not just its own name.
      hasRole: (role) => {
        const roles = get().user?.roles ?? [];
        return roles.includes("super-admin") || roles.includes(role);
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
