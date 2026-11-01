"use client";

import { useState } from "react";
import { Crown, Home, ReceiptText, Settings } from "lucide-react";
import { usePlatformAuthStore } from "@/store/platformAuthStore";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PaymentsTab } from "./components/PaymentsTab";
import { PlansTab } from "./components/PlansTab";
import { SettingsTab } from "./components/SettingsTab";
import { StatsRow, useSubscriptionStats } from "./components/StatsRow";

const TRIGGER = "gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none";

/** Shop subscription plans — app-doc/marketplace/10-monetization.md. */
export default function PlatformSubscriptionsPage() {
  const admin = usePlatformAuthStore((s) => s.admin);
  const isOwner = admin?.admin_role === "platform_owner";
  const [tab, setTab] = useState("payments");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const { data: stats } = useSubscriptionStats();
  const pending = stats?.pending.count ?? 0;

  const breadcrumb = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Subscriptions" },
  ];

  return (
    <PageWrapper breadcrumb={breadcrumb}>
      <PageHeader title="Subscriptions" description="Shop plans, the payments shops send for them, and how trials and renewals work." />

      <div className="space-y-6">
        <StatsRow onShowPending={() => { setPaymentStatus("pending"); setTab("payments"); }} />

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="h-auto gap-1 rounded-xl bg-muted/60 p-1">
            <TabsTrigger value="payments" className={TRIGGER}>
              <ReceiptText className="h-4 w-4" /> Payments
              {pending > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold leading-4 text-white">{pending}</span>}
            </TabsTrigger>
            <TabsTrigger value="plans" className={TRIGGER}><Crown className="h-4 w-4" /> Plans</TabsTrigger>
            <TabsTrigger value="settings" className={TRIGGER}><Settings className="h-4 w-4" /> Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="payments" className="mt-0"><PaymentsTab status={paymentStatus} onStatusChange={setPaymentStatus} /></TabsContent>
          <TabsContent value="plans" className="mt-0"><PlansTab canEdit={isOwner} /></TabsContent>
          <TabsContent value="settings" className="mt-0"><SettingsTab canEdit={isOwner} /></TabsContent>
        </Tabs>
      </div>
    </PageWrapper>
  );
}
