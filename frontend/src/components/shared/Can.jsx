import { useAuthStore } from "@/store/authStore";

/**
 * Renders children only when the current user has the required permission or role.
 * <Can permission="create products"> ... </Can>
 * <Can role="admin"> ... </Can>
 */
export function Can({ permission, role, children, fallback = null }) {
  const { can, hasRole } = useAuthStore();
  if (role && !hasRole(role)) return fallback;
  if (permission && !can(permission)) return fallback;
  return children;
}
