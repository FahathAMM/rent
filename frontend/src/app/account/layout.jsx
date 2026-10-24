"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useNavigationMenu } from "@/hooks/useMenus";
import { useAuth } from "@/hooks/useAuth";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { Button } from "@/components/ui/button";
import { Loader2, Menu } from "lucide-react";

/**
 * The customer-facing account app — a sidebar (AccountSidebar) instead
 * of the old flat top-bar nav, carrying the same gradient accent the
 * public marketplace pages use so a renter never feels like they left
 * the site's theme when they log in.
 */
export default function AccountLayout({ children }) {
  const { user, isAuthenticated, isVendor, _hasHydrated } = useAuthStore();
  const { logout } = useAuth();
  const router = useRouter();
  const { data: navigation, isLoading: navLoading } = useNavigationMenu("customer");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, _hasHydrated, router]);

  if (!_hasHydrated || !isAuthenticated || navLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <AccountSidebar
        navigation={navigation ?? []}
        user={user}
        onLogout={logout}
        isVendor={isVendor()}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-h-screen flex-1 flex-col lg:ml-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background px-4 py-3 lg:hidden">
          <Button variant="outline" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
          <NotificationBell />
        </header>

        <div className="sticky top-0 z-20 hidden justify-end border-b bg-background px-6 py-3 lg:flex">
          <NotificationBell />
        </div>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
