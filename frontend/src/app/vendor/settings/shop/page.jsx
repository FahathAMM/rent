"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorShopProfileService } from "@/services/vendorShopProfileService";
import { useAuthStore } from "@/store/authStore";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TextInput,
  TextareaInput,
  ValidationError,
} from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { publicService } from "@/services/publicService";
import { cn } from "@/lib/utils";
import { ShopCover } from "@/components/marketplace/ShopCover";
import {
  Loader2,
  Home,
  Building2,
  ImageIcon,
  Info,
  Phone,
  MapPin,
  Clock,
  ScrollText,
  Upload,
  Trash2,
  Camera,
  ExternalLink,
  ShieldCheck,
  Plus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

const DEFAULT_DAY = { open: "08:00", close: "18:00", closed: false };

/** Sidebar sections — `fields` maps validation errors back to the section that owns them. */
const SECTIONS = [
  {
    id: "branding",
    label: "Logo & Banner",
    icon: ImageIcon,
    description:
      "Your profile image and the cover banner on your public shop page.",
    fields: [],
  },
  {
    id: "basic",
    label: "Basic Info",
    icon: Info,
    description: "Shop name, tagline and a short description of your business.",
    fields: ["name", "tagline", "description"],
  },
  {
    id: "contact",
    label: "Contact",
    icon: Phone,
    description:
      "How customers reach you. Phone and WhatsApp show on your shop page.",
    fields: ["email", "phone", "whatsapp", "website"],
  },
  {
    id: "location",
    label: "Address",
    icon: MapPin,
    description:
      "Where your shop is. City and district are used in marketplace search.",
    fields: [
      "address_line_1",
      "address_line_2",
      "city",
      "district",
      "postal_code",
    ],
  },
  {
    id: "hours",
    label: "Opening Hours",
    icon: Clock,
    description:
      "Customers see whether you're open right now on the shops directory.",
    fields: ["operating_hours"],
  },
  {
    id: "policies",
    label: "Policies",
    icon: ScrollText,
    description:
      "Add your own policy sections — each one shows on your public shop page in this order.",
    fields: ["policies"],
  },
];

const FORM_FIELDS = SECTIONS.flatMap((s) => s.fields);

function pickForm(shop) {
  const form = Object.fromEntries(
    FORM_FIELDS.map((f) => [
      f,
      shop[f] ?? (f === "operating_hours" ? null : ""),
    ]),
  );
  form.operating_hours = Object.fromEntries(
    DAYS.map(({ key }) => [
      key,
      { ...DEFAULT_DAY, ...(shop.operating_hours?.[key] ?? {}) },
    ]),
  );
  form.policies = (shop.policies ?? []).map((p) => ({
    title: p.title ?? "",
    body: p.body ?? "",
  }));
  return form;
}

function PoliciesEditor({ policies, setPolicies, canEdit, errors }) {
  const update = (i, patch) =>
    setPolicies(policies.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const remove = (i) => setPolicies(policies.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const next = [...policies];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setPolicies(next);
  };

  return (
    <div className="space-y-3">
      {policies.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
          <ScrollText className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-medium">No policies yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Add sections like pickup instructions, fuel policy, deposit or
            cancellation rules — whatever your customers need to know.
          </p>
        </div>
      )}

      {policies.map((p, i) => (
        <div key={i} className="rounded-lg border bg-muted/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Policy {i + 1}
            </span>
            {canEdit && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={i === policies.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => remove(i)}
                  aria-label="Remove policy"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="grid gap-3">
            <TextInput
              label="Title"
              value={p.title}
              onChange={(e) => update(i, { title: e.target.value })}
              required
              disabled={!canEdit}
              error={errors[`policies.${i}.title`]?.[0]}
              placeholder="e.g. Fuel policy"
            />
            <TextareaInput
              label="Details"
              rows={4}
              value={p.body}
              onChange={(e) => update(i, { body: e.target.value })}
              required
              disabled={!canEdit}
              error={errors[`policies.${i}.body`]?.[0]}
            />
          </div>
        </div>
      ))}

      {canEdit && policies.length < 20 && (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-1.5 border-dashed"
          onClick={() => setPolicies([...policies, { title: "", body: "" }])}
        >
          <Plus className="h-4 w-4" /> Add policy
        </Button>
      )}
    </div>
  );
}

function ImageUploadButton({
  label,
  onFile,
  disabled,
  busy,
  variant = "outline",
  className,
}) {
  const ref = useRef(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <Button
        type="button"
        size="sm"
        variant={variant}
        className={cn("gap-1.5", className)}
        disabled={disabled || busy}
        onClick={() => ref.current?.click()}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {label}
      </Button>
    </>
  );
}

function BrandingSection({ shop, canEdit }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(null);

  const upload = useMutation({
    mutationFn: (fd) => vendorShopProfileService.updateBranding(fd),
    onSuccess: (res) => {
      qc.setQueryData(["vendor-shop-profile"], res.data.data);
      toast.success("Branding updated");
    },
    onError: (err) => {
      const errors = err.response?.data?.errors;
      toast.error(errors ? Object.values(errors).flat()[0] : "Upload failed");
    },
    onSettled: () => setBusy(null),
  });

  const send = (field, file) => {
    const fd = new FormData();
    if (file) fd.append(field, file);
    else fd.append(`remove_${field}`, "1");
    setBusy(field);
    upload.mutate(fd);
  };

  const pickFile = (field, maxMb) => (file) => {
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`Image must be under ${maxMb} MB`);
      return;
    }
    send(field, file);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Cover banner</p>
            <p className="text-xs text-muted-foreground">
              Wide image, at least 1600 × 500 px. JPG, PNG or WebP up to 5 MB.
            </p>
          </div>
        </div>
        <div className="group relative aspect-[16/5] overflow-hidden rounded-xl border bg-muted">
          <ShopCover shop={shop} variant="compact" alt="Cover banner" />
          {!shop.cover_image_url && (
            <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              Default brand banner — upload your own to replace it
            </span>
          )}
          {busy === "cover_image" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <ImageUploadButton
              label={shop.cover_image_url ? "Change banner" : "Upload banner"}
              onFile={pickFile("cover_image", 5)}
              busy={busy === "cover_image"}
              disabled={!!busy}
            />
            {shop.cover_image_url && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1.5 text-destructive hover:text-destructive"
                disabled={!!busy}
                onClick={() => send("cover_image", null)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Logo */}
      <div className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center">
        <div className="relative h-24 w-24 shrink-0">
          {shop.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shop.logo_url}
              alt="Shop logo"
              className="h-24 w-24 rounded-2xl border object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-3xl font-bold text-white shadow-sm">
              {shop.name?.charAt(0)?.toUpperCase()}
            </div>
          )}
          {busy === "logo" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/60">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Profile image / logo</p>
            <p className="text-xs text-muted-foreground">
              Square image, at least 400 × 400 px. JPG, PNG or WebP up to 2 MB.
              Shown on your shop card, vehicle listings and shop page.
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <ImageUploadButton
                label={shop.logo_url ? "Change logo" : "Upload logo"}
                onFile={pickFile("logo", 2)}
                busy={busy === "logo"}
                disabled={!!busy}
              />
              {shop.logo_url && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  disabled={!!busy}
                  onClick={() => send("logo", null)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HoursSection({ hours, setHours, canEdit }) {
  const update = (day, patch) =>
    setHours({ ...hours, [day]: { ...hours[day], ...patch } });
  const copyToAll = (day) =>
    setHours(
      Object.fromEntries(DAYS.map(({ key }) => [key, { ...hours[day] }])),
    );

  return (
    <div className="divide-y rounded-lg border">
      {DAYS.map(({ key, label }) => {
        const day = hours[key];
        return (
          <div
            key={key}
            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <p className="w-28 shrink-0 text-sm font-medium">{label}</p>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={!day.closed}
                onCheckedChange={(v) => update(key, { closed: !v })}
                disabled={!canEdit}
              />
              {day.closed ? "Closed" : "Open"}
            </label>
            {!day.closed && (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={day.open ?? ""}
                  onChange={(e) => update(key, { open: e.target.value })}
                  disabled={!canEdit}
                  className="h-9 w-32"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={day.close ?? ""}
                  onChange={(e) => update(key, { close: e.target.value })}
                  disabled={!canEdit}
                  className="h-9 w-32"
                />
              </div>
            )}
            {canEdit && key === "mon" && (
              <button
                type="button"
                onClick={() => copyToAll("mon")}
                className="text-xs font-medium text-primary hover:underline sm:ml-auto"
              >
                Copy to all days
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ShopProfileSettingsPage() {
  const qc = useQueryClient();
  const { can } = useAuthStore();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [active, setActive] = useState("branding");

  const { data: shop, isLoading } = useQuery({
    queryKey: ["vendor-shop-profile"],
    queryFn: () => vendorShopProfileService.show().then((r) => r.data.data),
  });

  const { data: districts } = useQuery({
    queryKey: ["public-districts"],
    queryFn: () => publicService.districts().then((r) => r.data.data),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (shop && !form) setForm(pickForm(shop));
  }, [shop, form]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (SECTIONS.some((s) => s.id === hash)) setActive(hash);
  }, []);

  const goTo = (id) => {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  const save = useMutation({
    mutationFn: (payload) => vendorShopProfileService.update(payload),
    onSuccess: (res) => {
      qc.setQueryData(["vendor-shop-profile"], res.data.data);
      setForm(pickForm(res.data.data));
      toast.success("Shop profile updated");
    },
    onError: (err) => {
      const errs = err.response?.data?.errors ?? {};
      setErrors(errs);
      const first = SECTIONS.find((s) =>
        s.fields.some((f) =>
          Object.keys(errs).some((k) => k === f || k.startsWith(`${f}.`)),
        ),
      );
      if (first) goTo(first.id);
      toast.error(err.response?.data?.message ?? "Could not save changes");
    },
  });

  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    // Drop rows left completely blank rather than failing validation on them.
    save.mutate({
      ...form,
      policies: form.policies.filter((p) => p.title.trim() || p.body.trim()),
    });
  };

  const breadcrumbItems = [
    {
      label: "Home",
      href: "/vendor/dashboard",
      icon: <Home className="size-4" />,
    },
    { label: "Shop Profile" },
  ];

  if (isLoading || !form) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canEdit = can("vendor-settings-shop-edit");
  const districtOptions = (districts ?? []).map((d) => ({
    value: d.name,
    label: d.name,
  }));
  const cityOptions =
    (districts ?? [])
      .find((d) => d.name === form.district)
      ?.cities.map((c) => ({ value: c.name, label: c.name })) ?? [];
  // Keep a saved value selectable even if it predates the district/city list (free-text era).
  const withCurrent = (options, value) =>
    value && !options.some((o) => o.value === value)
      ? [{ value, label: value }, ...options]
      : options;
  const isDirty = JSON.stringify(form) !== JSON.stringify(pickForm(shop));
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];
  const sectionHasError = (s) =>
    s.fields.some((f) =>
      Object.keys(errors).some((k) => k === f || k.startsWith(`${f}.`)),
    );
  const err = (k) => errors[k]?.[0];

  return (
    <HomePageWrapper
      breadcrumb={breadcrumbItems}
      className="space-y-6 p-4 sm:p-6 lg:p-8"
    >
      {/* ── Profile header (live preview of banner + logo) ───────────── */}
      <Card className="overflow-hidden">
        <div className="relative h-28 sm:h-36">
          <ShopCover shop={shop} variant="compact" />
          {canEdit && (
            <button
              type="button"
              onClick={() => goTo("branding")}
              className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/60"
            >
              <Camera className="h-3.5 w-3.5" /> Edit banner
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3 px-5 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            {/* relative z-10: the banner above is positioned, so without its own stacking layer the overlapping logo paints underneath it. */}
            <button
              type="button"
              onClick={() => goTo("branding")}
              className="relative z-10 -mt-10 shrink-0 rounded-2xl"
              aria-label="Edit logo"
            >
              {shop.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shop.logo_url}
                  alt={shop.name}
                  className="h-20 w-20 rounded-2xl border-4 border-card bg-card object-cover shadow-md"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-card bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-2xl font-bold text-white shadow-md">
                  {shop.name?.charAt(0)?.toUpperCase() ?? (
                    <Building2 className="h-6 w-6" />
                  )}
                </div>
              )}
            </button>
            <div className="min-w-0 pt-2.5">
              <p className="flex items-center gap-1.5 truncate text-lg font-semibold">
                {shop.name}
                {shop.verification_status === "verified" && (
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                )}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {shop.tagline || "Add a tagline under Basic Info"}
              </p>
            </div>
          </div>
          {shop.slug && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5 self-start sm:self-auto"
            >
              <Link href={`/shops/${shop.slug}`} target="_blank">
                View public page <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </Card>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
        {/* ── Section sidebar ─────────────────────────────────────────── */}
        <nav
          className="lg:sticky lg:top-4 lg:w-64 lg:shrink-0"
          aria-label="Shop profile sections"
        >
          <div className="rounded-xl border bg-card p-2 shadow-sm lg:p-3">
            <p className="hidden px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:block">
              Shop settings
            </p>
            <div className="flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const isActive = s.id === active;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goTo(s.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative flex shrink-0 items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {isActive && (
                      <span
                        className="absolute inset-y-2 left-0 hidden w-1 rounded-r-full bg-primary lg:block"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
                        isActive ? "bg-primary/15" : "bg-muted/60",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 whitespace-nowrap">{s.label}</span>
                    {sectionHasError(s) && (
                      <span
                        className="h-2 w-2 rounded-full bg-destructive"
                        aria-label="Has errors"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* ── Active section ──────────────────────────────────────────── */}
        <Card className="min-w-0 flex-1">
          <CardHeader className="flex-row items-center gap-3 space-y-0 border-b px-5 py-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <section.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold leading-tight">
                {section.label}
              </CardTitle>
              <CardDescription className="mt-0.5 truncate text-xs">
                {section.description}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {section.id === "branding" ? (
              <BrandingSection shop={shop} canEdit={canEdit} />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <ValidationError errors={errors} />

                {section.id === "basic" && (
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextInput
                        label="Shop Name"
                        value={form.name}
                        onChange={fi("name")}
                        required
                        disabled={!canEdit}
                        error={err("name")}
                      />
                      <TextInput
                        label="Tagline"
                        value={form.tagline}
                        onChange={fi("tagline")}
                        disabled={!canEdit}
                        error={err("tagline")}
                        placeholder="e.g. Reliable rentals, fair prices"
                      />
                    </div>
                    <TextareaInput
                      label="Description"
                      rows={6}
                      value={form.description}
                      onChange={fi("description")}
                      disabled={!canEdit}
                      error={err("description")}
                      placeholder="Tell customers about your shop, fleet and service..."
                    />
                    <p className="text-right text-xs text-muted-foreground">
                      {form.description?.length ?? 0} / 5000
                    </p>
                  </div>
                )}

                {section.id === "contact" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextInput
                      label="Email"
                      type="email"
                      value={form.email}
                      onChange={fi("email")}
                      disabled={!canEdit}
                      error={err("email")}
                    />
                    <TextInput
                      label="Phone"
                      type="tel"
                      value={form.phone}
                      onChange={fi("phone")}
                      disabled={!canEdit}
                      error={err("phone")}
                      placeholder="07X XXX XXXX"
                    />
                    <TextInput
                      label="WhatsApp"
                      type="tel"
                      value={form.whatsapp}
                      onChange={fi("whatsapp")}
                      disabled={!canEdit}
                      error={err("whatsapp")}
                      placeholder="07X XXX XXXX"
                    />
                    <TextInput
                      label="Website"
                      value={form.website}
                      onChange={fi("website")}
                      disabled={!canEdit}
                      error={err("website")}
                      placeholder="https://"
                    />
                  </div>
                )}

                {section.id === "location" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextInput
                      label="Address Line 1"
                      value={form.address_line_1}
                      onChange={fi("address_line_1")}
                      disabled={!canEdit}
                      error={err("address_line_1")}
                    />
                    <TextInput
                      label="Address Line 2"
                      value={form.address_line_2}
                      onChange={fi("address_line_2")}
                      disabled={!canEdit}
                      error={err("address_line_2")}
                    />
                    <SelectInput
                      label="District"
                      placeholder="Select district"
                      options={withCurrent(districtOptions, form.district)}
                      value={form.district}
                      onChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          district: v,
                          city: v === p.district ? p.city : "",
                        }))
                      }
                      disabled={!canEdit}
                      error={err("district")}
                    />
                    <SelectInput
                      label="City"
                      placeholder={
                        form.district
                          ? "Select city"
                          : "Select a district first"
                      }
                      options={withCurrent(cityOptions, form.city)}
                      value={form.city}
                      onChange={(v) => setForm((p) => ({ ...p, city: v }))}
                      disabled={!canEdit || !form.district}
                      error={err("city")}
                    />
                    <TextInput
                      label="Postal Code"
                      value={form.postal_code}
                      onChange={fi("postal_code")}
                      disabled={!canEdit}
                      error={err("postal_code")}
                    />
                  </div>
                )}

                {section.id === "hours" && (
                  <HoursSection
                    hours={form.operating_hours}
                    setHours={(h) =>
                      setForm((p) => ({ ...p, operating_hours: h }))
                    }
                    canEdit={canEdit}
                  />
                )}

                {section.id === "policies" && (
                  <PoliciesEditor
                    policies={form.policies}
                    setPolicies={(list) =>
                      setForm((p) => ({ ...p, policies: list }))
                    }
                    canEdit={canEdit}
                    errors={errors}
                  />
                )}

                {canEdit && (
                  <div className="flex items-center justify-end gap-3 border-t pt-4">
                    {isDirty && (
                      <span className="text-xs text-amber-600">
                        Unsaved changes
                      </span>
                    )}
                    {isDirty && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setForm(pickForm(shop));
                          setErrors({});
                        }}
                      >
                        Discard
                      </Button>
                    )}
                    <Button type="submit" disabled={save.isPending || !isDirty}>
                      {save.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </HomePageWrapper>
  );
}
