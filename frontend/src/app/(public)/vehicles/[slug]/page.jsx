"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { publicService } from "@/services/publicService";
import { favoriteService } from "@/services/favoriteService";
import { reportService } from "@/services/reportService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { BookingRequestWidget } from "@/components/marketplace/BookingRequestWidget";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TextInput, TextareaInput } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { VEHICLE_PLACEHOLDER_IMAGE } from "@/lib/constants";
import {
  Users, Fuel, Gauge, Briefcase, ShieldCheck, MapPin, Loader2, ArrowLeft,
  Heart, MessageCircle, Flag, Star,
} from "lucide-react";
import { toast } from "sonner";

const REPORT_REASONS = [
  { value: "misleading_price", label: "Misleading price" },
  { value: "fake_listing", label: "Fake listing" },
  { value: "unsafe_vehicle", label: "Unsafe vehicle" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "fraud", label: "Fraud" },
  { value: "other", label: "Other" },
];

function ContactOwnerDialog({ open, onOpenChange, vehicle, user }) {
  const [form, setForm] = useState({ name: user?.name ?? "", phone: user?.phone ?? "", email: user?.email ?? "", message: "" });
  const [errors, setErrors] = useState({});

  const send = useMutation({
    mutationFn: () => publicService.sendInquiry({ vehicle_slug: vehicle.slug, ...form }),
    onSuccess: () => {
      toast.success("Your message has been sent to the owner");
      onOpenChange(false);
      setForm({ name: user?.name ?? "", phone: user?.phone ?? "", email: user?.email ?? "", message: "" });
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Contact the owner</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <TextInput label="Your name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name?.[0]} />
          <TextInput label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone?.[0]} />
          <TextInput label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email?.[0]} />
          <TextareaInput label="Message" required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} error={errors.message?.[0]} />
        </div>
        <DialogFooter>
          <Button onClick={() => send.mutate()} disabled={send.isPending}>
            {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportListingDialog({ open, onOpenChange, vehicle }) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const report = useMutation({
    mutationFn: () => reportService.create({ reportable_type: "vehicle", reportable_id: vehicle.id, reason, description }),
    onSuccess: () => {
      toast.success("Report submitted — our team will review it");
      onOpenChange(false);
      setReason("");
      setDescription("");
    },
    onError: (err) => setError(err.response?.data?.message ?? "Failed to submit report"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Report this listing</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <SelectInput label="Reason" required options={REPORT_REASONS} value={reason} onChange={setReason} />
          <TextareaInput label="Details (optional)" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={() => report.mutate()} disabled={!reason || report.isPending}>
            {report.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Spec({ icon: Icon, label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-sm">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-violet-500/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold capitalize">{value}</p>
      </div>
    </div>
  );
}

function Gallery({ images, title }) {
  const [active, setActive] = useState(0);
  const image = images?.[active]?.url ?? VEHICLE_PLACEHOLDER_IMAGE;

  return (
    <div className="space-y-3">
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-3xl border bg-muted shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={title} className="h-full w-full object-cover" />
      </div>
      {images?.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {images.map((img, i) => (
            <button
              key={img.url ?? i}
              type="button"
              onClick={() => setActive(i)}
              className={`shrink-0 overflow-hidden rounded-xl border-2 transition-all ${i === active ? "border-primary shadow-sm" : "border-transparent opacity-80 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-16 w-24 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VehicleDetailPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { format } = useCurrencyFormat();
  // Favorites + the contact prefill belong to the customer account. Reports
  // still go through the vendor (users) API, so that button keeps useAuth.
  const { customer, isAuthenticated: customerSignedIn } = useCustomerAuth();
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [contacting, setContacting] = useState(false);
  const [reporting, setReporting] = useState(false);

  const requireLogin = () => {
    toast.error("Please log in first");
    router.push("/login");
  };

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["public-vehicle", slug],
    queryFn: () => publicService.vehicle(slug).then((r) => r.data.data),
  });

  // Server truth for the heart, so it survives a refresh.
  const { data: favoriteIds } = useQuery({
    queryKey: ["my-favorite-ids"],
    queryFn: () => favoriteService.ids().then((r) => r.data.data),
    enabled: customerSignedIn,
  });
  const saved = !!vehicle && (favoriteIds ?? []).includes(vehicle.id);

  const favorite = useMutation({
    mutationFn: () => (saved ? favoriteService.remove(vehicle.id) : favoriteService.add(vehicle.id)),
    onSuccess: () => {
      toast.success(saved ? "Removed from favorites" : "Saved to favorites");
      qc.invalidateQueries({ queryKey: ["my-favorite-ids"] });
      qc.invalidateQueries({ queryKey: ["my-favorites"] });
    },
    onError: () => toast.error("Could not update favorites"),
  });

  const { data: reviews } = useQuery({
    queryKey: ["public-vehicle-reviews", slug],
    queryFn: () => publicService.vehicleReviews(slug).then((r) => r.data.data),
    enabled: !!vehicle,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold">Vehicle not found</p>
        <Button asChild variant="outline"><Link href="/browse">Back to browse</Link></Button>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b bg-muted/30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <Link href="/browse" className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to browse
          </Link>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="gap-1.5 bg-card" onClick={() => (customerSignedIn ? favorite.mutate() : requireLogin())} disabled={favorite.isPending}>
              <Heart className={`h-4 w-4 ${saved ? "fill-current text-destructive" : ""}`} /> {saved ? "Saved" : "Save"}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 bg-card text-muted-foreground" onClick={() => (isAuthenticated ? setReporting(true) : requireLogin())}>
              <Flag className="h-4 w-4" /> Report
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-7">
          <Gallery images={vehicle.images} title={vehicle.title} />

          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{vehicle.title}</h1>
              {vehicle.rating_count > 0 && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-700">
                  <Star className="h-3.5 w-3.5 fill-current" /> {Number(vehicle.rating_avg).toFixed(1)}
                  <span className="text-amber-700/70">({vehicle.rating_count})</span>
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                Offered by <span className="font-medium text-foreground">{vehicle.shop?.name}</span>
              </span>
              {vehicle.shop?.is_verified && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified
                </span>
              )}
              {vehicle.shop?.city && (
                <span className="flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs">
                  <MapPin className="h-3.5 w-3.5" />{vehicle.shop.city}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Spec icon={Users} label="Seats" value={vehicle.seating_capacity} />
            <Spec icon={Fuel} label="Fuel" value={vehicle.fuel_type} />
            <Spec icon={Gauge} label="Transmission" value={vehicle.transmission} />
            <Spec icon={Briefcase} label="Luggage" value={vehicle.luggage_capacity} />
          </div>

          {vehicle.description && (
            <div>
              <h2 className="mb-2 text-lg font-semibold">About this vehicle</h2>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{vehicle.description}</p>
            </div>
          )}

          {vehicle.features?.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-semibold">Features</h2>
              <div className="flex flex-wrap gap-2">
                {vehicle.features.map((feat) => (
                  <span key={feat} className="rounded-full border bg-gradient-to-br from-orange-500/5 via-pink-500/5 to-violet-500/5 px-3 py-1 text-xs font-medium">{feat}</span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-3 text-lg font-semibold">Reviews {vehicle.rating_count > 0 && `(${vehicle.rating_count})`}</h2>
            {reviews?.length ? (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <Card key={r.id} className="shadow-sm">
                    <CardContent className="flex gap-3 p-4">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-sm font-semibold text-white">
                        {(r.reviewer_name ?? "V")[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{r.reviewer_name ?? "Verified renter"}</p>
                          <p className="flex items-center gap-1 text-sm font-medium"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {r.rating}/5</p>
                        </div>
                        {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            )}
          </div>
        </div>

        <div>
          <Card className="sticky top-20 overflow-hidden shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500" />
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 bg-clip-text text-3xl font-bold text-transparent">
                  {format(vehicle.pricing?.daily_rate)}<span className="text-sm font-normal text-muted-foreground">/day</span>
                </p>
                {vehicle.pricing?.weekly_rate && (
                  <p className="text-sm text-muted-foreground">{format(vehicle.pricing.weekly_rate)}/week</p>
                )}
              </div>
              {vehicle.pricing?.security_deposit > 0 && (
                <p className="rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                  Security deposit: {format(vehicle.pricing.security_deposit)} ({vehicle.pricing.deposit_method === "cash_on_pickup" ? "collected at pickup" : "prepaid"})
                </p>
              )}
              <BookingRequestWidget vehicle={vehicle} />
              <Button variant="outline" className="w-full gap-1.5" onClick={() => setContacting(true)}>
                <MessageCircle className="h-4 w-4" /> Contact the owner
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ContactOwnerDialog open={contacting} onOpenChange={setContacting} vehicle={vehicle} user={customerSignedIn ? customer : null} />
      <ReportListingDialog open={reporting} onOpenChange={setReporting} vehicle={vehicle} />
    </div>
  );
}
