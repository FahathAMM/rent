"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useShopStore } from "@/store/shopStore";
import { authService } from "@/services/authService";
import { useNavigationMenu } from "@/hooks/useMenus";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ShopSwitcher } from "@/components/layout/ShopSwitcher";
import { ImpersonationBanner } from "@/components/shared/ImpersonationBanner";
import { Loader2, ShieldOff, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function UnauthorizedView({ title }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 gap-4 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <ShieldOff className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You don&apos;t have permission to view{title ? ` ${title}` : " this page"}.
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href="/vendor/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}

function NoShopView() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 gap-4 text-center px-4">
      <div className="rounded-full bg-muted p-4">
        <Store className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">No shop yet</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          You don&apos;t own or staff any rental shop yet. Apply to become a vehicle owner
          or register a rental shop to get started.
        </p>
      </div>
      <Button asChild size="sm">
        <Link href="/vendor/become-owner">Become an owner</Link>
      </Button>
    </div>
  );
}

// Personal account pages every authenticated vendor can reach regardless of
// their menu/permission access — they aren't module nav items.
const ALWAYS_ACCESSIBLE_ROUTES = ["/vendor/profile", "/vendor/audit-logs"];

// A freshly vendor-registered account has no shop and no nav yet — these
// onboarding routes must still require auth, but skip the shop-count gate
// and the module-tile chrome entirely (there's nothing to show tiles for).
const ONBOARDING_ROUTES = ["/vendor/become-owner", "/vendor/shops/new"];

/** Flatten a nested menu tree into a flat array of route_name strings. */
function flattenRoutes(menus) {
  const routes = [];
  const walk = (items) => {
    items?.forEach((item) => {
      if (item.route_name) routes.push(item.route_name);
      if (item.children?.length) walk(item.children);
    });
  };
  walk(menus);
  return routes;
}

/** Derive the page title from the deepest matching menu in the navigation tree. */
function getTitleFromNav(menus, pathname) {
  let best = null;
  const walk = (items) => {
    items?.forEach((item) => {
      if (item.route_name && pathname.startsWith(item.route_name)) {
        if (!best || item.route_name.length > best.route_name.length) best = item;
      }
      if (item.children?.length) walk(item.children);
    });
  };
  walk(menus);
  return best?.name ?? "Dashboard";
}

export default function VendorLayout({ children }) {
  const { user, isAuthenticated, _hasHydrated, updateUser } = useAuthStore();
  const { shops, activeShopId, setShops } = useShopStore();
  const router = useRouter();
  const pathname = usePathname();
  const { data: navigation, isLoading: navLoading } = useNavigationMenu("vendor");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState(null);

  const isAuthRoute = pathname === "/vendor/login" || pathname === "/vendor/register";
  const isOnboardingRoute = ONBOARDING_ROUTES.some((route) => pathname.startsWith(route));

  useEffect(() => {
    if (isAuthRoute || !_hasHydrated) return;
    if (!isAuthenticated) router.replace("/vendor/login");
  }, [isAuthRoute, isAuthenticated, _hasHydrated, router]);

  // Roles/permissions/shop memberships are only ever written to the
  // persisted store at login time, so a browser tab left logged in across
  // a role/membership change (e.g. accepted a staff invite elsewhere)
  // would otherwise keep acting on a stale snapshot until the user
  // manually logs out. Re-sync once per mount instead.
  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated) return;
    authService.me().then((res) => {
      updateUser(res.data.data);
      setShops(res.data.data.shops ?? []);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, isAuthenticated]);

  // Which module's sub-pages the sidebar shows. Updates whenever the URL
  // matches a module's child route; left alone otherwise (e.g. on
  // /vendor/dashboard) so the sidebar never goes blank — it just keeps
  // showing the last module.
  useEffect(() => {
    if (!navigation) return;
    const matched = navigation.find(
      (item) => !item.route_name && item.children?.some((c) => c.route_name && pathname.startsWith(c.route_name))
    );
    if (matched) {
      setActiveModuleId(matched.id);
      return;
    }
    setActiveModuleId((prev) => prev ?? navigation.find((item) => !item.route_name && item.children?.length)?.id ?? null);
  }, [navigation, pathname]);

  // Close the mobile drawer whenever the route changes, and never leave the
  // page scroll-locked behind it.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  const loading = (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const accessibleRoutes = useMemo(() => flattenRoutes(navigation ?? []), [navigation]);

  if (isAuthRoute) return children;

  if (!_hasHydrated || !isAuthenticated || navLoading) return loading;

  if (isOnboardingRoute) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  if (!shops?.length) return <NoShopView />;

  const hasPageAccess = !accessibleRoutes.length
    ? true
    : ALWAYS_ACCESSIBLE_ROUTES.some((route) => pathname.startsWith(route))
      || accessibleRoutes.some((route) => pathname.startsWith(route));

  const title = getTitleFromNav(navigation, pathname);
  const activeModule = navigation?.find((item) => item.id === activeModuleId) ?? null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        activeModule={activeModule}
        navigation={navigation}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        topSlot={<div className="px-3 pt-3 pb-1"><ShopSwitcher /></div>}
      />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <ImpersonationBanner />
        <Header
          navigation={navigation}
          activeModuleId={activeModuleId}
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-auto bg-muted/10 p-1 pb-20 lg:pb-1">
          {hasPageAccess ? children : <UnauthorizedView title={title} />}
        </main>
      </div>
    </div>
  );
}
