"use client";

import { useAuthStore } from "@/store/authStore";
import { useShopStore } from "@/store/shopStore";
import { authService } from "@/services/authService";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function useAuth() {
  const { user, token, isAuthenticated, setAuth, updateUser, logout: storeLogout, isVendor } = useAuthStore();
  const { setShops, clear: clearShops } = useShopStore();
  const router = useRouter();

  // Re-fetches the current user's roles/permissions/shops — needed after an
  // action elsewhere (e.g. a platform admin approving an owner application)
  // changes them server-side; the stored user otherwise stays stale until
  // the next login.
  const refreshUser = async () => {
    const res = await authService.me();
    const freshUser = res.data.data;
    updateUser(freshUser);
    setShops(freshUser.shops ?? []);
    return freshUser;
  };

  const login = async (credentials) => {
    const res = await authService.login(credentials);
    const { user, token } = res.data.data;
    setAuth(user, token);
    setShops(user.shops ?? []);
    return user;
  };

  const register = async (data) => {
    const res = await authService.register(data);
    const { user, token } = res.data.data;
    setAuth(user, token);
    setShops(user.shops ?? []);
    return user;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {}
    storeLogout();
    clearShops();
    router.push("/vendor/login");
    toast.success("Logged out successfully");
  };

  return { user, token, isAuthenticated, login, register, logout, isVendor, refreshUser };
}
