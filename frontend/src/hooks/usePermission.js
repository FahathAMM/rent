import { useAuthStore } from "@/store/authStore";

export function usePermission() {
  const { can, hasRole } = useAuthStore();
  return { can, hasRole };
}
