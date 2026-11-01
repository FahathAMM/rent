"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformService } from "@/services/platformService";
import { usePlatformAuthStore } from "@/store/platformAuthStore";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { ShopCover } from "@/components/marketplace/ShopCover";
import { ShopSubscriptionCard } from "../components/ShopSubscriptionCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Home, Loader2, MapPin, Phone, Mail, Globe, MessageCircle, FileText, Download, Eye, CarFront,
  CalendarCheck, Star, Users, Building2, ShieldCheck, ShieldAlert, Clock, BadgeCheck,
  ExternalLink, Trash2, Ban, RotateCcw, XCircle, CheckCircle2, Store, Quote, ImageOff, FileBarChart,
} from "lucide-react";
import { cn, formatDateTime, downloadBlob, openBlob } from "@/lib/utils";
import { toast } from "sonner";

const DAYS = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];

function whatsappHref(number) {
  const digits = String(number ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("0") ? `94${digits.slice(1)}` : digits}`;
}

function websiteHref(url) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default function PlatformShopDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const isOwner = usePlatformAuthStore((s) => s.admin?.admin_role === "platform_owner");
  const [reasonAction, setReasonAction] = useState(null); // 'reject' | 'suspend' | 'delete'

  const { data: shop, isLoading } = useQuery({
    queryKey: ["platform-shop", id],
    queryFn: () => platformService.shops.getOne(id).then((r) => r.data.data),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["platform-shop", id] });
    qc.invalidateQueries({ queryKey: ["platform-shops"] });
  };
  const onError = (fallback) => (err) =>
    toast.error(err.response?.data?.errors?.shop?.[0] ?? err.response?.data?.message ?? fallback);

  const verify = useMutation({
    mutationFn: () => platformService.shops.verify(id),
    onSuccess: () => { refresh(); toast.success("Shop verified and published"); },
    onError: onError("Failed to verify"),
  });
  const reject = useMutation({
    mutationFn: (reason) => platformService.shops.reject(id, reason),
    onSuccess: () => { refresh(); setReasonAction(null); toast.success("Shop rejected"); },
    onError: onError("Failed to reject"),
  });
  const suspend = useMutation({
    mutationFn: (reason) => platformService.shops.suspend(id, reason),
    onSuccess: () => { refresh(); setReasonAction(null); toast.success("Shop suspended"); },
    onError: onError("Failed to suspend"),
  });
  const activate = useMutation({
    mutationFn: () => platformService.shops.activate(id),
    onSuccess: () => { refresh(); toast.success("Shop reactivated"); },
    onError: onError("Failed to activate"),
  });
  const remove = useMutation({
    mutationFn: (reason) => platformService.shops.delete(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-shops"] });
      toast.success("Shop deleted");
      router.push("/platform/shops");
    },
    onError: onError("Failed to delete"),
  });

  const handleView = async (verificationId) => {
    const tab = window.open("", "_blank");
    try {
      const res = await platformService.shops.downloadDocument(verificationId);
      openBlob(res.data, tab);
    } catch {
      tab?.close();
      toast.error("Failed to open file");
    }
  };

  const handleDownload = async (verificationId, filename) => {
    try {
      const res = await platformService.shops.downloadDocument(verificationId);
      downloadBlob(res.data, filename);
    } catch {
      toast.error("Failed to download file");
    }
  };

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Shop Verification", href: "/platform/shops" },
    { label: shop?.name ?? "Shop" },
  ];

  if (isLoading || !shop) {
    return (
      <PageWrapper breadcrumb={breadcrumbItems}>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </PageWrapper>
    );
  }

  const canVerify = ["unverified", "pending"].includes(shop.verification_status);
  const canSuspend = shop.status === "active";
  const canActivate = shop.status === "suspended" && shop.verification_status === "verified";
  const place = [shop.city, shop.district].filter(Boolean).join(", ");
  const documents = shop.verifications ?? [];

  const stats = [
    { icon: CarFront, label: "Vehicles", value: shop.vehicles_count ?? 0, sub: `${shop.published_vehicles_count ?? 0} published` },
    { icon: CalendarCheck, label: "Bookings", value: shop.bookings_count ?? 0, sub: `${shop.open_bookings_count ?? 0} open` },
    { icon: CheckCircle2, label: "Completed trips", value: shop.completed_bookings_count ?? 0, sub: "all time" },
    { icon: Star, label: "Rating", value: Number(shop.rating_avg ?? 0).toFixed(1), sub: `${shop.rating_count ?? 0} reviews` },
  ];

  const timeline = [
    { icon: Store, label: "Registered", at: shop.created_at, done: true },
    { icon: FileText, label: "Documents submitted", at: null, done: shop.verification_status !== "unverified" },
    { icon: BadgeCheck, label: "Verified", at: shop.verified_at, done: shop.verification_status === "verified" },
    { icon: Globe, label: "Published", at: shop.published_at, done: !!shop.is_published },
  ];

  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <Card className="overflow-hidden rounded-3xl shadow-sm">
          <div className="relative h-36 sm:h-44">
            <ShopCover shop={shop} variant="compact" />
          </div>
          <div className="relative px-5 pb-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 items-end gap-4">
                <div className="-mt-10 shrink-0">
                  {shop.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shop.logo_url} alt={shop.name} className="size-20 rounded-2xl border-4 border-card bg-card object-cover shadow-md" />
                  ) : (
                    <div className="flex size-20 items-center justify-center rounded-2xl border-4 border-card bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-2xl font-bold text-white shadow-md">
                      {shop.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 pb-1">
                  <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{shop.name}</h1>
                  {shop.tagline && <p className="truncate text-sm text-muted-foreground">{shop.tagline}</p>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {shop.is_published && shop.slug && (
                  <Button asChild variant="outline" size="sm" className="gap-1.5">
                    <Link href={`/shops/${shop.slug}`} target="_blank"><ExternalLink className="h-3.5 w-3.5" /> Public page</Link>
                  </Button>
                )}
                {canVerify && (
                  <>
                    <Button variant="outline" size="sm" className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setReasonAction("reject")}>
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => verify.mutate()} disabled={verify.isPending}>
                      {verify.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Verify & Publish
                    </Button>
                  </>
                )}
                {canSuspend && (
                  <Button variant="outline" size="sm" className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setReasonAction("suspend")}>
                    <Ban className="h-3.5 w-3.5" /> Suspend
                  </Button>
                )}
                {canActivate && (
                  <Button size="sm" className="gap-1.5" onClick={() => activate.mutate()} disabled={activate.isPending}>
                    {activate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Reactivate
                  </Button>
                )}
                {isOwner && (
                  <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setReasonAction("delete")}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <StatusBadge status={shop.status} />
              <StatusBadge status={shop.verification_status} />
              <Chip icon={shop.is_published ? Globe : ShieldAlert}>{shop.is_published ? "Published" : "Not published"}</Chip>
              {place && <Chip icon={MapPin}>{place}</Chip>}
              <Chip icon={Clock}>Registered {formatDateTime(shop.created_at)}</Chip>
              <Chip icon={Store}>ID #{shop.id}</Chip>
            </div>
          </div>
        </Card>

        {shop.suspended_reason && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">{shop.status === "suspended" ? "Suspended" : "Rejected"}</p>
              <p className="text-sm text-muted-foreground">{shop.suspended_reason}</p>
            </div>
          </div>
        )}

        {/* ── Stats ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map(({ icon: Icon, label, value, sub }) => (
            <Card key={label} className="rounded-2xl shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="text-xl font-semibold leading-tight">{value}</p>
                  <p className="truncate text-xs text-muted-foreground">{label} · {sub}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border bg-card p-1 sm:w-auto">
            <TabsTrigger value="overview" className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"><Store className="h-4 w-4" /> Overview</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
              <FileText className="h-4 w-4" /> Documents <TabCount n={documents.length} />
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
              <CarFront className="h-4 w-4" /> Vehicles <TabCount n={shop.vehicles_count ?? 0} />
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
              <Users className="h-4 w-4" /> Team & locations <TabCount n={(shop.members?.length ?? 0) + (shop.locations?.length ?? 0)} />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-5">
            {shop.description && (
              <Card className="relative overflow-hidden rounded-2xl shadow-sm">
                <Quote aria-hidden="true" className="pointer-events-none absolute -right-2 -top-2 h-24 w-24 rotate-12 text-primary/[0.06]" />
                <CardHeader className="pb-2"><CardTitle className="text-base">About</CardTitle></CardHeader>
                <CardContent><p className="whitespace-pre-line text-sm leading-7 text-foreground/90">{shop.description}</p></CardContent>
              </Card>
            )}

            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base">Business details</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <DetailGroup title="Contact" icon={Phone} items={[
                  { icon: Mail, label: "Email", value: shop.email, href: shop.email && `mailto:${shop.email}` },
                  { icon: Phone, label: "Phone", value: shop.phone, href: shop.phone && `tel:${shop.phone}` },
                  { icon: MessageCircle, label: "WhatsApp", value: shop.whatsapp, href: whatsappHref(shop.whatsapp), external: true },
                  { icon: Globe, label: "Website", value: shop.website, href: websiteHref(shop.website), external: true },
                ]} />
                <DetailGroup title="Location" icon={MapPin} items={[
                  { icon: MapPin, label: "Address", value: [shop.address_line_1, shop.address_line_2].filter(Boolean).join(", ") },
                  { icon: Building2, label: "City", value: shop.city },
                  { icon: MapPin, label: "District", value: shop.district },
                  { icon: Mail, label: "Postal code", value: shop.postal_code },
                ]} />
                <DetailGroup title="Registration" icon={FileBarChart} className="md:col-span-2" cols items={[
                  { icon: FileText, label: "Registration No.", value: shop.business_registration_no, mono: true },
                  { icon: FileText, label: "Tax ID", value: shop.tax_id, mono: true },
                  { icon: Clock, label: "Response rate", value: shop.response_rate != null ? `${shop.response_rate}%` : null },
                ]} />
              </CardContent>
            </Card>
              </div>
              <aside className="space-y-5">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-sm">Owner</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-sm font-semibold text-white">
                    {shop.owner?.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{shop.owner?.name ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{shop.owner?.email}</p>
                  </div>
                </div>
                {shop.owner?.phone && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5" />{shop.owner.phone}</p>}
                {shop.owner?.created_at && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />Account since {formatDateTime(shop.owner.created_at)}</p>}
              </CardContent>
            </Card>

            {shop.verification_status === "verified" && <ShopSubscriptionCard shopId={shop.id} />}

            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-sm">Progress</CardTitle></CardHeader>
              <CardContent>
                <ol className="relative space-y-4 border-l pl-5">
                  {timeline.map(({ icon: Icon, label, at, done }) => (
                    <li key={label} className="relative">
                      <span className={cn(
                        "absolute -left-[31px] flex size-5 items-center justify-center rounded-full ring-4 ring-card",
                        done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                      )}>
                        {done ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                      </span>
                      <p className={cn("text-sm font-medium", !done && "text-muted-foreground")}>{label}</p>
                      {at && <p className="text-xs text-muted-foreground">{formatDateTime(at)}</p>}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {shop.operating_hours && (
              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4" /> Opening hours</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  {DAYS.map(([key, label]) => {
                    const d = shop.operating_hours[key];
                    return (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className={cn(d?.closed && "text-muted-foreground")}>{!d || d.closed ? "Closed" : `${d.open} – ${d.close}`}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-0">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Verification documents</CardTitle>
                <CardDescription>Every view or download is recorded in the audit log.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {documents.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize">{v.document_type.replace(/_/g, " ")}</p>
                        <p className="truncate text-xs text-muted-foreground">{v.attachment?.file_name} · uploaded {formatDateTime(v.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={v.status} />
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleView(v.id)}><Eye className="h-3.5 w-3.5" /> View</Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleDownload(v.id, v.attachment?.file_name)}><Download className="h-3.5 w-3.5" /> Download</Button>
                    </div>
                  </div>
                ))}
                {!documents.length && (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
                    <FileText className="h-6 w-6" /> No documents uploaded yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vehicles" className="mt-0">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent vehicles</CardTitle>
                <CardDescription>The latest {shop.recent_vehicles?.length ?? 0} of {shop.vehicles_count ?? 0} listings.</CardDescription>
              </CardHeader>
              <CardContent>
                {shop.recent_vehicles?.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {shop.recent_vehicles.map((v) => (
                      <div key={v.id} className="overflow-hidden rounded-xl border">
                        <div className="flex h-28 items-center justify-center bg-muted">
                          {v.image
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={v.image} alt={v.title} className="h-full w-full object-cover" loading="lazy" />
                            : <ImageOff className="h-6 w-6 text-muted-foreground" />}
                        </div>
                        <div className="space-y-1.5 p-3">
                          <p className="truncate text-sm font-medium">{v.title}</p>
                          <div className="flex items-center justify-between gap-2">
                            <StatusBadge status={v.status} />
                            {v.daily_rate != null && <span className="text-xs font-semibold">{format(v.daily_rate)}<span className="font-normal text-muted-foreground">/day</span></span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
                    <CarFront className="h-6 w-6" /> No vehicles listed yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="mt-0">
            <div className="grid gap-5 md:grid-cols-2">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4" /> Team ({shop.members?.length ?? 0})</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                {(shop.members ?? []).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{m.shop_role_label ?? "Member"}</span>
                  </div>
                ))}
                {!shop.members?.length && <p className="text-sm text-muted-foreground">No members.</p>}
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4" /> Locations ({shop.locations?.length ?? 0})</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                {(shop.locations ?? []).map((l) => (
                  <div key={l.id} className="rounded-lg bg-muted/40 p-2.5">
                    <p className="flex items-center justify-between gap-2 text-sm font-medium">
                      <span className="truncate">{l.name}</span>
                      {!l.is_active && <span className="text-[11px] font-normal text-muted-foreground">inactive</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{[l.address, l.city, l.district].filter(Boolean).join(", ") || "—"}</p>
                  </div>
                ))}
                {!shop.locations?.length && <p className="text-sm text-muted-foreground">No locations.</p>}
              </CardContent>
            </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ReasonDialog
        open={reasonAction === "reject"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Reject Shop"
        description="This will be shown to the shop owner."
        confirmText="Reject"
        loading={reject.isPending}
        onConfirm={(reason) => reject.mutate(reason)}
      />
      <ReasonDialog
        open={reasonAction === "suspend"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Suspend Shop"
        description="The shop will be unpublished immediately and its owner and staff can no longer log in."
        confirmText="Suspend"
        loading={suspend.isPending}
        onConfirm={(reason) => suspend.mutate(reason)}
      />
      <ReasonDialog
        open={reasonAction === "delete"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title={`Delete ${shop.name}?`}
        description="The shop and its vehicles disappear from the marketplace, and its owner and staff lose vendor access. Past bookings are kept. Not allowed while it has open bookings."
        confirmText="Delete shop"
        loading={remove.isPending}
        onConfirm={(reason) => remove.mutate(reason)}
      />
    </PageWrapper>
  );
}

function TabCount({ n }) {
  return <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{n}</span>;
}

function Chip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-muted-foreground">
      <Icon className="h-3 w-3 text-primary" />{children}
    </span>
  );
}

function DetailGroup({ title, icon: GroupIcon, items, className, cols }) {
  return (
    <div className={cn("rounded-xl border p-4", className)}>
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary"><GroupIcon className="h-3.5 w-3.5" /></span>
        {title}
      </p>
      <dl className={cn("grid gap-3", cols && "sm:grid-cols-2 lg:grid-cols-3")}>
        {items.map(({ icon: Icon, label, value, href, external, mono }) => (
          <div key={label} className="flex min-w-0 items-start gap-2.5">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className={cn("truncate text-sm", mono && "font-mono", !value && "italic text-muted-foreground/60")}>
                {value && href ? (
                  <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="text-primary hover:underline">{value}</a>
                ) : (value || "Not provided")}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
