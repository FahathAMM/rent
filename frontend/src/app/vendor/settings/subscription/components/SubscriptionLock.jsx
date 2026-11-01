"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";

/**
 * Shown instead of any vendor page while the shop is unpaid (no plan running).
 * The API refuses those pages anyway (EnsureSubscriptionActive); only the
 * Subscription page and the personal profile stay open.
 */
export function SubscriptionLock({ shopName, isOwner }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 px-4 py-20 text-center">
      <div className="rounded-full bg-amber-500/10 p-5"><Lock className="h-9 w-9 text-amber-600" /></div>
      <div className="max-w-md space-y-2">
        <h2 className="text-2xl font-semibold">Renew to continue</h2>
        <p className="text-sm text-muted-foreground">
          {shopName ? `${shopName}'s` : "Your shop's"} subscription has ended. Your listings are still live for customers,
          but the vendor workspace is closed until a plan is paid for.
        </p>
        {!isOwner && <p className="text-sm font-medium">Please ask the shop owner to renew the subscription.</p>}
      </div>
      {isOwner && <Button asChild><Link href="/vendor/settings/subscription">Choose a plan</Link></Button>}
    </div>
  );
}

/** Whether the signed-in vendor user owns the shop (only the owner can pay). */
export function useIsShopOwner() {
  const user = useAuthStore((s) => s.user);
  return !!user?.roles?.includes("shop-owner");
}
