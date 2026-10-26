"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuthStore } from "@/store/customerAuthStore";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { Button } from "@/components/ui/button";
import { Loader2, Menu } from "lucide-react";

// A plain customer account has no permission variation — every customer
// sees exactly these items (mirrors MenuSeeder's customerModules), so
// there's no need to fetch this from /menus/navigation, which still only
// resolves the old vendor/owner/staff guard (AuthUser::user()) and would
// reject a customer-guard token outright.
const CUSTOMER_NAV_ITEMS = [
  { id: "dashboard", name: "Dashboard", route_name: "/account/dashboard", icon: "LayoutDashboard" },
  { id: "bookings", name: "My Bookings", route_name: "/account/bookings", icon: "CalendarCheck" },
  { id: "favorites", name: "Favorites", route_name: "/account/favorites", icon: "Heart" },
  { id: "reviews", name: "My Reviews", route_name: "/account/reviews", icon: "Star" },
  { id: "disputes", name: "Disputes", route_name: "/account/disputes", icon: "AlertTriangle" },
  { id: "profile", name: "Profile", route_name: "/account/profile", icon: "User" },
];

/**
 * The customer-facing account app — a sidebar (AccountSidebar) instead
 * of the old flat top-bar nav, carrying the same gradient accent the
 * public marketplace pages use so a renter never feels like they left
 * the site's theme when they log in.
 */
export default function AccountLayout({ children }) {
  const { customer, isAuthenticated, _hasHydrated } = useCustomerAuthStore();
  const { logout } = useCustomerAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, _hasHydrated, router]);

  if (!_hasHydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <AccountSidebar
        navigation={CUSTOMER_NAV_ITEMS}
        user={customer}
        onLogout={logout}
        isVendor={false}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-h-screen flex-1 flex-col lg:ml-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background px-4 py-3 lg:hidden">
          <Button variant="outline" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
