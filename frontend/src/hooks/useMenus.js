"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { menuService } from "@/services/menuService";
import { toast } from "sonner";

export function useMenus(params = {}) {
  return useQuery({
    queryKey: ["menus", params],
    queryFn: () => menuService.getAll(params).then((r) => r.data),
  });
}

export function useMenusFlat() {
  return useQuery({
    queryKey: ["menus", "flat"],
    queryFn: () => menuService.getFlat().then((r) => r.data.data),
    staleTime: 30_000,
  });
}

export function useNavigationMenu() {
  // Only run when a token exists (avoids 401 on login page transition)
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("pos_token");
  return useQuery({
    queryKey: ["menus", "navigation"],
    queryFn: () => menuService.navigation().then((r) => r.data.data),
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    enabled: hasToken,
  });
}

export function useCreateMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: menuService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menus"] });
      qc.invalidateQueries({ queryKey: ["permissions"] });
      toast.success("Menu created — permissions auto-generated");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });
}

export function useUpdateMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => menuService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menus"] });
      toast.success("Menu updated");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });
}

export function useDeleteMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: menuService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menus"] });
      qc.invalidateQueries({ queryKey: ["permissions"] });
      toast.success("Menu deleted — permissions removed");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });
}
