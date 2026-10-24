"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { publicService } from "@/services/publicService";
import { favoriteService } from "@/services/favoriteService";
import { reportService } from "@/services/reportService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { useAuth } from "@/hooks/useAuth";
import { BookingRequestWidget } from "@/components/marketplace/BookingRequestWidget";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TextInput, TextareaInput } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import {
  Car, Users, Fuel, Gauge, Briefcase, ShieldCheck, MapPin, Loader2, ArrowLeft,
  Heart, MessageCircle, Flag,
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
    <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium capitalize">{value}</p>
      </div>
    </div>
  );
}

export default function VehicleDetailPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { format } = useCurrencyFormat();
  const { user, isAuthenticated } = useAuth();
  const [contacting, setContacting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [saved, setSaved] = useState(false);

  const requireLogin = () => {
    toast.error("Please log in first");
    router.push("/login");
  };

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["public-vehicle", slug],
    queryFn: () => publicService.vehicle(slug).then((r) => r.data.data),
  });

  const favorite = useMutation({
    mutationFn: () => favoriteService.add(vehicle.id),
    onSuccess: () => { setSaved(true); toast.success("Saved to favorites"); },
    onError: () => toast.error("Please log in to save favorites"),
  });

  const { data: reviews } = useQuery({
    queryKey: ["public-vehicle-reviews", slug],
    queryFn: () => publicService.vehicleReviews(slug).then((r) => r.data.data),
    enabled: !!vehicle,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold">Vehicle not found</p>
        <Button asChild variant="outline"><Link href="/search">Back to search</Link></Button>
      </div>
    );
  }

  const image = vehicle.images?.find((i) => i.is_primary)?.url ?? vehicle.images?.[0]?.url;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <Link href="/search" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to search
          </Link>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => (isAuthenticated ? favorite.mutate() : requireLogin())} disabled={favorite.isPending || saved}>
              <Heart className={`h-4 w-4 ${saved ? "fill-current text-destructive" : ""}`} /> {saved ? "Saved" : "Save"}
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => (isAuthenticated ? setReporting(true) : requireLogin())}>
              <Flag className="h-4 w-4" /> Report
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border bg-muted">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={vehicle.title} className="h-full w-full object-cover" />
            ) : (
              <Car className="h-16 w-16 text-muted-foreground/30" />
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold">{vehicle.title}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              Offered by <span className="font-medium text-foreground">{vehicle.shop?.name}</span>
              {vehicle.shop?.is_verified && <ShieldCheck className="h-4 w-4 text-emerald-600" />}
              {vehicle.shop?.city && <><MapPin className="ml-1 h-3.5 w-3.5" />{vehicle.shop.city}</>}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Spec icon={Users} label="Seats" value={vehicle.seating_capacity} />
            <Spec icon={Fuel} label="Fuel" value={vehicle.fuel_type} />
            <Spec icon={Gauge} label="Transmission" value={vehicle.transmission} />
            <Spec icon={Briefcase} label="Luggage" value={vehicle.luggage_capacity} />
          </div>

          {vehicle.description && (
            <div>
              <h2 className="mb-2 font-semibold">About this vehicle</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{vehicle.description}</p>
            </div>
          )}

          {vehicle.features?.length > 0 && (
            <div>
              <h2 className="mb-2 font-semibold">Features</h2>
              <div className="flex flex-wrap gap-2">
                {vehicle.features.map((feat) => (
                  <span key={feat} className="rounded-full border bg-muted px-3 py-1 text-xs">{feat}</span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-2 font-semibold">Reviews {vehicle.rating_count > 0 && `(${vehicle.rating_count})`}</h2>
            {reviews?.length ? (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{r.reviewer_name ?? "Verified renter"}</p>
                        <p className="text-sm">★ {r.rating}/5</p>
                      </div>
                      {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
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
          <Card className="sticky top-6">
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-2xl font-bold">{format(vehicle.pricing?.daily_rate)}<span className="text-sm font-normal text-muted-foreground">/day</span></p>
                {vehicle.pricing?.weekly_rate && (
                  <p className="text-sm text-muted-foreground">{format(vehicle.pricing.weekly_rate)}/week</p>
                )}
              </div>
              {vehicle.pricing?.security_deposit > 0 && (
                <p className="text-xs text-muted-foreground">
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

      <ContactOwnerDialog open={contacting} onOpenChange={setContacting} vehicle={vehicle} user={isAuthenticated ? user : null} />
      <ReportListingDialog open={reporting} onOpenChange={setReporting} vehicle={vehicle} />
    </div>
  );
}
