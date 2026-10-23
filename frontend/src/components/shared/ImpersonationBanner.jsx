"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, LogOut } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { usePlatformAuthStore } from "@/store/platformAuthStore";
import { getImpersonationBridge, clearImpersonationBridge } from "@/lib/impersonation";
import { platformImpersonationService } from "@/services/platformService";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Shown across the top of the company application only while a Platform
 * Admin is impersonating a company user (see /platform/companies/[id]).
 * "Exit Impersonation" ends the session server-side (using the admin's own
 * saved token, never the impersonated user's) and hops back to the
 * Platform — the impersonated user's session is never left dangling.
 */
export function ImpersonationBanner() {
  const [bridge, setBridge] = useState(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setBridge(getImpersonationBridge());
  }, []);

  if (!bridge) return null;

  const handleExit = async () => {
    setExiting(true);
    try {
      await platformImpersonationService.stop(bridge.sessionId, bridge.platformToken);
    } catch {
      // Even if the API call fails, still restore the platform session
      // locally — the session will simply expire server-side on its own.
    }

    usePlatformAuthStore.getState().setAuth(usePlatformAuthStore.getState().admin, bridge.platformToken);
    useAuthStore.getState().logout();
    clearImpersonationBridge();
    toast.success("Impersonation ended");
    window.location.href = "/platform/dashboard";
  };

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        You are currently impersonating <strong>{bridge.userName}</strong> from <strong>{bridge.companyName}</strong>.
      </span>
      <Button size="sm" variant="outline" className="h-7 border-amber-950/30 bg-amber-50 text-xs text-amber-950 hover:bg-amber-100" onClick={handleExit} disabled={exiting}>
        {exiting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
        Exit Impersonation
      </Button>
    </div>
  );
}
