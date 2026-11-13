"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useShopStore } from "@/store/shopStore";
import { authService } from "@/services/authService";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { platformDetailService } from "@/services/platformDetailService";
import { useNavigationMenu } from "@/hooks/useMenus";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { HeaderClock } from "@/components/layout/HeaderClock";
import { DashboardFooter } from "@/components/layout/DashboardFooter";
import { VendorVisitTracker } from "@/components/layout/VendorVisitTracker";
import { PlanBanner } from "./settings/subscription/components/PlanBanner";
import { SubscriptionLock, useIsShopOwner } from "./settings/subscription/components/SubscriptionLock";
import { useSubscription } from "./settings/subscription/components/useSubscription";
import { BadgeCheck, Loader2, MapPin, ShieldOff, Store } from "lucide-react";
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
          You don&apos;t own or staff any shop yet. Register a shop to get started.
        </p>
      </div>
      <Button asChild size="sm">
        <Link href="/vendor/shops/new">Register a shop</Link>
      </Button>
    </div>
  );
}

/** The current shop in the header: logo (or a shop icon), name, verified tick, city and the user's role. */
function ShopCard({ shop }) {
  const name = shop.shop_name ?? `Shop #${shop.shop_id}`;
  const meta = [shop.city, shop.role_label].filter(Boolean);

  const body = (
    <>
      {shop.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shop.logo} alt={name} className="h-9 w-9 shrink-0 rounded-lg bg-white object-cover ring-1 ring-border" />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
          <Store className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          {shop.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-label="Verified shop" />}
        </div>
        {meta.length > 0 && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            {shop.city && <MapPin className="h-3 w-3 shrink-0" />}
            <span className="truncate">{meta.join(" · ")}</span>
          </p>
        )}
      </div>
    </>
  );

  // Same footprint as the header clock it replaced: fixed height, shown from xl up.
  const cardClass = "hidden h-[50px] w-56 shrink-0 items-center gap-2.5 rounded-xl border bg-card px-2.5 shadow-sm xl:flex";

  return shop.slug ? (
    <Link
      href={`/shops/${shop.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      title="View your public shop page"
      className={`${cardClass} transition-colors hover:bg-muted/50`}
    >
      {body}
    </Link>
  ) : (
    <div className={cardClass}>{body}</div>
  );
}

/** Shown to a vendor still signed in when their shop gets suspended — the API refuses everything (ResolveShopContext). */
function SuspendedView({ onLogout }) {
  const { data: brand } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
  });
  const brandName = brand?.name || "LankaLane";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <ShieldOff className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">Your shop has been suspended</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          The vendor workspace is unavailable while your shop is suspended. Please contact the {brandName} admin.
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm"><Link href="/">Go to home page</Link></Button>
        <Button size="sm" onClick={onLogout}>Log out</Button>
      </div>
    </div>
  );
}

// Still reachable while the shop is unpaid and the rest of the workspace is locked.
const OPEN_WHILE_LOCKED = ["/vendor/settings/subscription", "/vendor/profile"];

// Personal account pages every authenticated vendor can reach regardless of
// their menu/permission access — they aren't module nav items.
const ALWAYS_ACCESSIBLE_ROUTES = ["/vendor/profile"];

// Pages outside the menu that only the shop owner can open.
const OWNER_ONLY_ROUTES = ["/vendor/audit-logs"];

// Pages nested under another menu item's route. Access to the parent doesn't
// cover these, so each one states the permission it needs.
const NESTED_ROUTE_PERMISSIONS = [
  [/^\/vendor\/vehicles\/categories(\/|$)/, "vendor-vehicles-categories-view"],
  [/^\/vendor\/vehicles\/new(\/|$)/, "vendor-vehicles-list-create"],
  [/^\/vendor\/vehicles\/[^/]+\/edit(\/|$)/, "vendor-vehicles-list-edit"],
  [/^\/vendor\/sales\/listings\/new(\/|$)/, "vendor-sales-listings-create"],
  [/^\/vendor\/sales\/listings\/[^/]+\/edit(\/|$)/, "vendor-sales-listings-edit"],
];

// Menu pages that need a plan feature (SubscriptionPlan::FEATURES); the menu marks them when the plan lacks it.
const PLAN_FEATURE_ROUTES = {
  "/vendor/calendar": "calendar",
  "/vendor/expenses": "expenses",
  "/vendor/expense-categories": "expenses",
  "/vendor/staff": "staff",
  "/vendor/roles": "staff",
  "/vendor/sales/listings": "sales",
  "/vendor/sales/enquiries": "sales",
  "/vendor/sales/sold": "sales",
  "/vendor/sales/terms": "sales",
  ...Object.fromEntries(["profit-loss", "vehicles", "sales", "bookings", "outstanding", "payments", "deposits", "expenses"].map((r) => [`/vendor/reports/${r}`, "reports"])),
};

// A freshly vendor-registered account has no shop and no nav yet — these
// onboarding routes must still require auth, but skip the shop-count gate
// and the module-tile chrome entirely (there's nothing to show tiles for).
const ONBOARDING_ROUTES = ["/vendor/shops/new"];

const SIDEBAR_COLLAPSED_KEY = "vendor-sidebar-collapsed";

/** True when pathname is this route or a page beneath it — never a sibling that merely shares a prefix. */
function matchesRoute(pathname, route) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

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
      if (item.route_name && matchesRoute(pathname, item.route_name)) {
        if (!best || item.route_name.length > best.route_name.length) best = item;
      }
      if (item.children?.length) walk(item.children);
    });
  };
  walk(menus);
  return best?.name ?? "Dashboard";
}

export default function VendorLayout({ children }) {
  const { isAuthenticated, _hasHydrated, updateUser, can } = useAuthStore();
  const { logout } = useAuth();
  const { shop, setShop } = useShopStore();
  const router = useRouter();
  const pathname = usePathname();
  const { data: navigation, isLoading: navLoading } = useNavigationMenu("vendor");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState(null);
  // Desktop hide/show — remembered per browser.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isOwner = useIsShopOwner();

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {}
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const isAuthRoute = pathname === "/vendor/login" || pathname === "/vendor/register";
  const isOnboardingRoute = ONBOARDING_ROUTES.some((route) => pathname.startsWith(route));

  useEffect(() => {
    if (isAuthRoute || !_hasHydrated) return;
    if (!isAuthenticated) router.replace("/vendor/login");
  }, [isAuthRoute, isAuthenticated, _hasHydrated, router]);

  // Roles/permissions/shop are only ever written to the persisted store at
  // login time, so a browser tab left logged in across a role/shop change
  // (e.g. added as staff elsewhere) would otherwise keep acting on a stale
  // snapshot until the user manually logs out. Re-sync once per mount instead.
  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated) return;
    authService.me().then((res) => {
      updateUser(res.data.data);
      setShop(res.data.data.shop);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, isAuthenticated]);

  // An unverified shop has no vendor workspace yet (the API refuses it —
  // EnsureShopVerified), so its owner is kept on the onboarding page.
  const awaitingVerification = shop?.is_verified === false
    && !isAuthRoute
    && !isOnboardingRoute
    && !pathname.startsWith("/vendor/profile");

  useEffect(() => {
    if (awaitingVerification) router.replace("/vendor/shops/new");
  }, [awaitingVerification, router]);

  // Which module's sub-pages the sidebar shows. Updates whenever the URL
  // matches a module's child route; left alone otherwise (e.g. on
  // /vendor/dashboard) so the sidebar never goes blank — it just keeps
  // showing the last module.
  useEffect(() => {
    if (!navigation) return;
    // Longest route wins: /vendor/vehicles/categories belongs to Vehicle, not to Rental's /vendor/vehicles.
    let matched = null;
    let matchedLength = 0;
    navigation.filter((item) => !item.route_name).forEach((item) => {
      item.children?.forEach((c) => {
        if (c.route_name && matchesRoute(pathname, c.route_name) && c.route_name.length > matchedLength) {
          matched = item;
          matchedLength = c.route_name.length;
        }
      });
    });
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
  // Only ask once the workspace is open to the shop (verified, not suspended); the endpoint itself is never locked.
  const { data: subscription } = useSubscription({ enabled: !!shop && !shop.is_suspended && shop.is_verified !== false && !isAuthRoute && !isOnboardingRoute });
  const locked = !!subscription?.locked && !OPEN_WHILE_LOCKED.some((route) => pathname.startsWith(route));
  const planLockedRoutes = useMemo(() => {
    if (!subscription?.features) return [];
    return Object.keys(PLAN_FEATURE_ROUTES).filter((route) => !subscription.features.includes(PLAN_FEATURE_ROUTES[route]));
  }, [subscription]);

  if (isAuthRoute) return children;

  if (!_hasHydrated || !isAuthenticated || navLoading) return loading;

  if (isOnboardingRoute) {
    return (
      <div className="min-h-screen bg-slate-50">
        <VendorVisitTracker />
        {children}
      </div>
    );
  }

  if (!shop) return <NoShopView />;

  if (shop.is_suspended) return <SuspendedView onLogout={logout} />;

  if (awaitingVerification) return loading;

  const nestedPermission = NESTED_ROUTE_PERMISSIONS.find(([pattern]) => pattern.test(pathname))?.[1];
  const hasPageAccess = ALWAYS_ACCESSIBLE_ROUTES.some((route) => matchesRoute(pathname, route))
    || (isOwner && OWNER_ONLY_ROUTES.some((route) => matchesRoute(pathname, route)))
    || (accessibleRoutes.some((route) => matchesRoute(pathname, route)) && (!nestedPermission || can(nestedPermission)));

  const title = getTitleFromNav(navigation, pathname);
  const activeModule = navigation?.find((item) => item.id === activeModuleId) ?? null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <VendorVisitTracker />
      <Sidebar
        activeModule={activeModule}
        navigation={navigation}
        planLockedRoutes={planLockedRoutes}
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        topSlot={<HeaderClock variant="sidebar" />}
      />
      <div className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-200 ease-out ${sidebarCollapsed ? "lg:ml-0" : "lg:ml-56"}`}>
        <Header
          navigation={navigation}
          activeModuleId={activeModuleId}
          planLockedRoutes={planLockedRoutes}
          onMenuClick={() => setSidebarOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          onShowSidebar={toggleSidebarCollapsed}
          leftSlot={<ShopCard shop={shop} />}
        />
        <PlanBanner />
        <main className="flex-1 overflow-auto bg-muted/10 p-1">
          {locked
            ? <SubscriptionLock shopName={shop.shop_name} isOwner={isOwner} />
            : hasPageAccess ? children : <UnauthorizedView title={title} />}
        </main>
        {/* Below lg the header is docked to the bottom, so leave room for it under the footer. */}
        <div className="pb-20 lg:pb-0">
          <DashboardFooter />
        </div>
      </div>
    </div>
  );
}
