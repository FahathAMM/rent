"use client";

import { useCustomerAuthStore } from "@/store/customerAuthStore";
import { customerAuthService } from "@/services/customerAuthService";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function useCustomerAuth() {
  const { customer, token, isAuthenticated, setAuth, updateCustomer, logout: storeLogout } = useCustomerAuthStore();
  const router = useRouter();

  const refreshCustomer = async () => {
    const res = await customerAuthService.me();
    const fresh = res.data.data;
    updateCustomer(fresh);
    return fresh;
  };

  const login = async (credentials) => {
    const res = await customerAuthService.login(credentials);
    const { customer, token } = res.data.data;
    setAuth(customer, token);
    return customer;
  };

  const register = async (data) => {
    const res = await customerAuthService.register(data);
    const { customer, token } = res.data.data;
    setAuth(customer, token);
    return customer;
  };

  const logout = async () => {
    try {
      await customerAuthService.logout();
    } catch {}
    storeLogout();
    router.push("/login");
    toast.success("Logged out successfully");
  };

  return { customer, token, isAuthenticated, login, register, logout, refreshCustomer };
}
