"use client";

import { useAuthStore } from "@/store/authStore";
import { authService } from "@/services/authService";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function useAuth() {
  const { user, token, isAuthenticated, setAuth, logout: storeLogout, isAdmin } = useAuthStore();
  const router = useRouter();

  const login = async (credentials) => {
    const res = await authService.login(credentials);
    const { user, token } = res.data.data;
    setAuth(user, token);
    return user;
  };

  const register = async (data) => {
    const res = await authService.register(data);
    const { user, token } = res.data.data;
    setAuth(user, token);
    return user;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {}
    storeLogout();
    router.push("/login");
    toast.success("Logged out successfully");
  };

  return { user, token, isAuthenticated, login, register, logout, isAdmin };
}
