"use client";

import { useQuery } from "@tanstack/react-query";
import { menuService } from "@/services/menuService";

export function useNavigationMenu(audience = "vendor") {
  // Only run when a token exists (avoids 401 on login page transition)
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("pos_token");
  return useQuery({
    queryKey: ["menus", "navigation", audience],
    queryFn: () => menuService.navigation(audience).then((r) => r.data.data),
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    enabled: hasToken,
  });
}
