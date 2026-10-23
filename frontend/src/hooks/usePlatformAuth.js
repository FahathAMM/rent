"use client";

import { usePlatformAuthStore } from "@/store/platformAuthStore";
import { platformAuthService } from "@/services/platformAuthService";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function usePlatformAuth() {
  const { admin, token, isAuthenticated, setAuth, logout: storeLogout } = usePlatformAuthStore();
  const router = useRouter();

  const login = async (credentials) => {
    const res = await platformAuthService.login(credentials);
    const { admin, token } = res.data.data;
    setAuth(admin, token);
    return admin;
  };

  const logout = async () => {
    try {
      await platformAuthService.logout();
    } catch {}
    storeLogout();
    router.push("/platform/login");
    toast.success("Logged out successfully");
  };

  return { admin, token, isAuthenticated, login, logout };
}
