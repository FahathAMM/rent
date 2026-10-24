"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { platformDetailService } from "@/services/platformDetailService";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { RegisterPanel } from "@/components/auth/RegisterPanel";

/**
 * The same sign-in/create-account cards the full /login and /register
 * pages use (LoginPanel/RegisterPanel), in a popup instead of a page
 * navigation — for the public marketplace pages (home, search, vehicle
 * detail), where leaving to a separate page loses whatever the visitor
 * was doing (browsing, a half-filled booking widget). /login and
 * /register still exist as real routes for direct links/bookmarks; this
 * is just a faster path from a page's own header.
 *
 * On success this closes the popup and leaves the visitor exactly where
 * they were — LoginPanel/RegisterPanel only redirect on their own when no
 * onSuccess is passed (see their docblocks), which is the behaviour the
 * full pages still want.
 */
export function AuthDialog({ open, onOpenChange, initialView = "login", onAuthenticated }) {
  const [view, setView] = useState(initialView);

  useEffect(() => {
    if (open) {
      setView(initialView);
    }
  }, [open, initialView]);

  const { data: brand } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
  });

  const brandName = brand?.name || "RentLanka";
  const logoUrl = brand?.login_logo || brand?.logo || null;

  const handleSuccess = (user) => {
    onOpenChange(false);
    onAuthenticated?.(user);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] p-5 sm:p-6">
        {view === "login" ? (
          <LoginPanel
            brandName={brandName}
            logoUrl={logoUrl}
            onSwitchToRegister={() => setView("register")}
            onSuccess={handleSuccess}
          />
        ) : (
          <RegisterPanel
            brandName={brandName}
            logoUrl={logoUrl}
            onSwitchToLogin={() => setView("login")}
            onSuccess={handleSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
