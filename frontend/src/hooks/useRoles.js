import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { roleService } from "@/services/roleService";
import { toast } from "sonner";

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => roleService.getRoles().then((r) => r.data.data),
  });
}

// Returns an array of { menu_id, name, slug, icon, permissions: [{id, name}] }
export function usePermissionGroups() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: () => roleService.getPermissions().then((r) => r.data.data),
    staleTime: 30_000,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: roleService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role created");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to create role"),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => roleService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role updated");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to update role"),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: roleService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to delete role"),
  });
}
