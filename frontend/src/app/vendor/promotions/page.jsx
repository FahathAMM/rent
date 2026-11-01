"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CalendarClock, FileText, Home, Loader2, Megaphone, Sparkles, Star } from "lucide-react";
import { vendorService } from "@/services/vendorService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime, openBlob } from "@/lib/utils";
import { PromoteDialog } from "./components/PromoteDialog";
import { toast } from "sonner";

const STATE = {
  pending: { label: "Waiting for platform", cls: "bg-amber-500/10 text-amber-800 dark:text-amber-300" },
  scheduled: { label: "Scheduled", cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  live: { label: "Live", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  ended: { label: "Ended", cls: "bg-muted text-muted-foreground" },
  rejected: { label: "Rejected", cls: "bg-red-500/10 text-red-700 dark:text-red-300" },
};

function Offer({ Icon, tone, title, text, points, from, onClick, disabled }) {
  return (
    <Card className="flex flex-col overflow-hidden rounded-2xl shadow-sm">
      <div className={cn("px-5 pb-4 pt-5", tone)}>
        <p className="flex items-center gap-2 text-base font-semibold"><Icon className="h-5 w-5" /> {title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      </div>
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <ul className="space-y-1.5 text-sm">
          {points.map((p) => <li key={p} className="flex items-start gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {p}</li>)}
        </ul>
        <div className="mt-auto flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{from}</span>
          <Button onClick={onClick} disabled={disabled}>{title}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Buy visibility for the shop — featured vehicles (vehicle search) and shop sponsorship (Shops page). */
export default function VendorPromotionsPage() {
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const [promoting, setPromoting] = useState(null); // "featured" | "sponsored"

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-promotions"],
    queryFn: () => vendorService.promotions.get().then((r) => r.data.data),
  });

  const viewProof = async (id) => {
    const tab = window.open("", "_blank");
    try {
      const res = await vendorService.promotions.proof(id);
      openBlob(res.data, tab);
    } catch {
      tab?.close();
      toast.error("Could not open the receipt");
    }
  };

  const breadcrumb = [
    { label: "Dashboard", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Promotions" },
  ];

  if (isLoading || !data) {
    return <PageWrapper breadcrumb={breadcrumb}><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></PageWrapper>;
  }

  const cheapest = (type) => {
    const list = data.packages.filter((p) => p.type === type);
    return list.length ? `From ${format(Math.min(...list.map((p) => Number(p.price))))} · ${list.map((p) => `${p.days} days`).join(" / ")}` : "No packages yet";
  };
  const live = data.promotions.filter((p) => p.state === "live");

  return (
    <PageWrapper breadcrumb={breadcrumb}>
      <PageHeader title="Promotions" description="Get seen first — a featured vehicle tops vehicle search, a sponsored shop tops the Shops page. Pay by bank transfer; it goes live once the platform confirms your payment." />

      <div className="space-y-6">
        {live.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {live.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-800 dark:text-emerald-300">
                {p.type === "featured" ? <Star className="h-3.5 w-3.5" /> : <Megaphone className="h-3.5 w-3.5" />}
                {p.type === "featured" ? "Featured" : "Sponsored"}: <b>{p.target}</b> · until {formatDateTime(p.ends_at)}
              </span>
            ))}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Offer
            Icon={Sparkles}
            tone="bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent"
            title="Feature a vehicle"
            text="Put one vehicle in front of every customer who searches for vehicles."
            points={["First in vehicle search — in every sort", "Shown whenever it matches the customer's filters", "On the home page, with a Featured badge"]}
            from={cheapest("featured")}
            onClick={() => setPromoting("featured")}
            disabled={!data.vehicles.length}
          />
          <Offer
            Icon={Megaphone}
            tone="bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-transparent"
            title="Sponsor your shop"
            text={data.city ? `Put your shop at the top of the Shops page — including searches for ${data.city}.` : "Put your shop at the top of the Shops page."}
            points={["First on the Shops page — in every sort", "Also first when customers filter by your city", `A Sponsored label · only ${data.slots.sponsored} shops per city at a time`]}
            from={cheapest("sponsored")}
            onClick={() => setPromoting("sponsored")}
            disabled={!data.vehicles.length || !data.city}
          />
        </div>
        {data.vehicles.length > 0 && !data.city && <p className="text-sm text-muted-foreground">Add your city in Settings → Shop Profile to sponsor your shop.</p>}
        {!data.vehicles.length && <p className="text-sm text-muted-foreground">Publish a vehicle first — promotions need at least one live listing.</p>}

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Your promotions</CardTitle></CardHeader>
          <CardContent>
            {!data.promotions.length ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                <CalendarClock className="h-6 w-6" />
                Nothing yet — feature a vehicle or sponsor your shop above.
              </div>
            ) : (
              <div className="divide-y overflow-hidden rounded-xl border">
                {data.promotions.map((p) => {
                  const st = STATE[p.state] ?? STATE.ended;
                  return (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", p.type === "featured" ? "bg-amber-500/15 text-amber-600" : "bg-indigo-500/15 text-indigo-600")}>
                          {p.type === "featured" ? <Star className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium">
                            {p.type === "featured" ? "Featured" : "Sponsored"} · {p.target}
                            <span className="ml-2 font-mono text-[11px] text-muted-foreground">{p.reference_no}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.days} days
                            {p.starts_at ? ` · ${formatDateTime(p.starts_at)} → ${formatDateTime(p.ends_at)}` : ` · sent ${formatDateTime(p.created_at)}`}
                            {p.kind === "granted" ? " · given by the platform" : ""}
                          </p>
                          {p.reject_reason && <p className="text-xs text-destructive">Rejected: {p.reject_reason}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.amount > 0 && <span className="tabular-nums font-semibold">{format(p.amount)}</span>}
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", st.cls)}>{st.label}</span>
                        {p.has_proof && (
                          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => viewProof(p.id)}><FileText className="h-3.5 w-3.5" /> Receipt</Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PromoteDialog
        type={promoting}
        data={data}
        open={!!promoting}
        onOpenChange={(v) => !v && setPromoting(null)}
        onPaid={() => qc.invalidateQueries({ queryKey: ["vendor-promotions"] })}
      />
    </PageWrapper>
  );
}
