"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { usePlatformAuthStore } from "@/store/platformAuthStore";
import { PlatformSidebar } from "@/components/platform/PlatformSidebar";
import { Menu, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Wraps every /platform/* route. Deliberately its own layout — never the
 * company app's (Sidebar/Header) — so the Platform area reads as a
 * distinct SaaS admin console. /platform/login renders standalone (no
 * chrome, no auth guard); everything else requires a platform session.
 */
export default function PlatformLayout({ children }) {
  const { isAuthenticated, _hasHydrated } = usePlatformAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginPage = pathname === "/platform/login";

  useEffect(() => {
    if (!isLoginPage && _hasHydrated && !isAuthenticated) {
      router.replace("/platform/login");
    }
  }, [isLoginPage, isAuthenticated, _hasHydrated, router]);

  if (isLoginPage) {
    return children;
  }

  if (!_hasHydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <PlatformSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-white px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-semibold">Platform Admin</span>
        </header>
        <main className="flex-1 overflow-auto p-1">{children}</main>
      </div>
    </div>
  );
}
