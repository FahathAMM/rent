"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { vehicleService } from "@/services/vehicleService";
import { publicService } from "@/services/publicService";
import { Button } from "@/components/ui/button";
import {
  TextInput,
  TextareaInput,
  ValidationError,
  CheckboxInput,
} from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { VehicleImageGallery } from "@/components/vendor/VehicleImageManager";
import { cn } from "@/lib/utils";
import {
  Loader2,
  ImagePlus,
  Star,
  Trash2,
  ClipboardList,
  Gauge,
  FileText,
  DollarSign,
  Images,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

const TRANSMISSIONS = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
  { value: "semi_automatic", label: "Semi-automatic" },
  { value: "cvt", label: "CVT" },
];

const FUEL_TYPES = [
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybrid" },
  { value: "electric", label: "Electric" },
  { value: "lpg", label: "LPG" },
];

const defaultForm = {
  category_id: "",
  brand_id: "",
  title: "",
  model_id: "",
  year: new Date().getFullYear(),
  variant_id: "",
  colour_id: "",
  registration_number: "",
  transmission: "automatic",
  fuel_type: "petrol",
  engine_capacity_cc: "",
  seating_capacity: 5,
  luggage_capacity: "",
  doors: "",
  air_conditioned: true,
  description: "",
  condition_notes: "",
};

const toForm = (vehicle) => ({
  category_id: vehicle.category_id ? String(vehicle.category_id) : "",
  brand_id: vehicle.brand_id ? String(vehicle.brand_id) : "",
  title: vehicle.title ?? "",
  model_id: vehicle.model_id ? String(vehicle.model_id) : "",
  year: vehicle.year ?? new Date().getFullYear(),
  variant_id: vehicle.variant_id ? String(vehicle.variant_id) : "",
  colour_id: vehicle.colour_id ? String(vehicle.colour_id) : "",
  registration_number: vehicle.registration_number ?? "",
  transmission: vehicle.transmission ?? "automatic",
  fuel_type: vehicle.fuel_type ?? "petrol",
  engine_capacity_cc: vehicle.engine_capacity_cc ?? "",
  seating_capacity: vehicle.seating_capacity ?? 5,
  luggage_capacity: vehicle.luggage_capacity ?? "",
  doors: vehicle.doors ?? "",
  air_conditioned: !!vehicle.air_conditioned,
  description: vehicle.description ?? "",
  condition_notes: vehicle.condition_notes ?? "",
});

const DEPOSIT_METHODS = [
  { value: "cash_on_pickup", label: "Cash on pickup" },
  { value: "prepaid", label: "Prepaid" },
  { value: "waived", label: "Waived" },
];

const toPricing = (p = {}) => ({
  daily_rate: p.daily_rate ?? "",
  weekly_rate: p.weekly_rate ?? "",
  monthly_rate: p.monthly_rate ?? "",
  security_deposit: p.security_deposit ?? "",
  deposit_method: p.deposit_method ?? "cash_on_pickup",
  mileage_allowance_per_day_km: p.mileage_allowance_per_day_km ?? "",
  driver_rate_per_day: p.driver_rate_per_day ?? "",
  delivery_available: !!p.delivery_available,
  min_rental_days: p.min_rental_days ?? 1,
});

const MAX_PHOTO_MB = 5;

// `fields` maps validation errors back to the tab that owns them.
const TABS = [
  {
    id: "details",
    label: "Details",
    icon: ClipboardList,
    fields: [
      "category_id",
      "title",
      "brand_id",
      "model_id",
      "year",
      "variant_id",
      "colour_id",
      "registration_number",
    ],
  },
  {
    id: "specs",
    label: "Specifications",
    icon: Gauge,
    fields: [
      "transmission",
      "fuel_type",
      "engine_capacity_cc",
      "seating_capacity",
      "luggage_capacity",
      "doors",
      "air_conditioned",
    ],
  },
  {
    id: "description",
    label: "Description",
    icon: FileText,
    fields: ["description", "condition_notes"],
  },
  {
    id: "pricing",
    label: "Pricing",
    icon: DollarSign,
    fields: [],
    optional: true,
  },
  { id: "photos", label: "Photos", icon: Images, fields: [], optional: true },
];

/**
 * Photos chosen before the vehicle exists — previewed locally and uploaded
 * in order right after it's created (the first upload becomes the cover,
 * see VehicleImageController::store).
 */
function PendingPhotos({ files, setFiles, disabled }) {
  const inputRef = useRef(null);
  const previews = useMemo(
    () => files.map((f) => URL.createObjectURL(f)),
    [files],
  );
  useEffect(
    () => () => previews.forEach((u) => URL.revokeObjectURL(u)),
    [previews],
  );

  const add = (e) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    const tooBig = picked.filter((f) => f.size > MAX_PHOTO_MB * 1024 * 1024);
    if (tooBig.length)
      toast.error(
        `${tooBig.length} photo(s) over ${MAX_PHOTO_MB} MB were skipped`,
      );
    setFiles([
      ...files,
      ...picked.filter((f) => f.size <= MAX_PHOTO_MB * 1024 * 1024),
    ]);
  };
  const remove = (i) => setFiles(files.filter((_, idx) => idx !== i));
  const makeCover = (i) =>
    setFiles([files[i], ...files.filter((_, idx) => idx !== i)]);

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        multiple
        className="hidden"
        onChange={add}
      />
      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${file.lastModified}-${i}`}
              className={cn(
                "group relative overflow-hidden rounded-lg border",
                i === 0 && "ring-2 ring-primary",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previews[i]}
                alt={file.name}
                className="aspect-video w-full object-cover"
              />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  <Star className="h-2.5 w-2.5 fill-current" /> Cover
                </span>
              )}
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                {i !== 0 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="!h-7 !w-7"
                    onClick={() => makeCover(i)}
                    aria-label="Make cover photo"
                  >
                    <Star className="!h-3.5 !w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="!h-7 !w-7"
                  onClick={() => remove(i)}
                  aria-label="Remove photo"
                >
                  <Trash2 className="!h-3.5 !w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex w-full flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
      >
        <ImagePlus className="h-6 w-6" />
        <span className="font-medium">
          {files.length ? "Add more photos" : "Add photos"}
        </span>
        <span className="text-xs">
          JPG, PNG or WebP, up to {MAX_PHOTO_MB} MB each. The first photo is the
          cover.
        </span>
      </button>
    </div>
  );
}

/**
 * Add / edit vehicle form - the body of /vendor/vehicles/new and
 * /vendor/vehicles/[id]/edit. Pass `vehicle` to edit; omit it to create.
 *
 * Pricing and photos are optional sections. On create they're saved right
 * after the vehicle itself (they need its id); on edit, pricing saves with
 * the details and photos are managed live via VehicleImageGallery.
 * `onSaved(vehicle, { complete })` - complete is false when the vehicle
 * saved but its pricing or a photo didn't, so the caller can land the user
 * somewhere they can fix it. `onCancel` runs on Cancel.
 */
export function VehicleForm({ vehicle, onSaved, onCancel }) {
  const qc = useQueryClient();
  const editing = !!vehicle;
  const [form, setForm] = useState(() =>
    vehicle ? toForm(vehicle) : defaultForm,
  );
  const [errors, setErrors] = useState({});
  const [pricing, setPricing] = useState(() =>
    toPricing(vehicle?.pricing ?? {}),
  );
  const [pricingErrors, setPricingErrors] = useState({});
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [tab, setTab] = useState("details");
  const hadPricing = !!vehicle?.pricing;

  const { data: categories } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () => publicService.categories().then((r) => r.data.data),
  });

  const { data: brands } = useQuery({
    queryKey: ["public-brands"],
    queryFn: () => publicService.brands().then((r) => r.data.data),
  });

  // Brand -> Model -> Variant cascade: each list loads once its parent is picked.
  const { data: models } = useQuery({
    queryKey: ["public-models", form.brand_id],
    queryFn: () => publicService.models(form.brand_id).then((r) => r.data.data),
    enabled: !!form.brand_id,
  });

  const { data: variants } = useQuery({
    queryKey: ["public-variants", form.model_id],
    queryFn: () =>
      publicService.variants(form.model_id).then((r) => r.data.data),
    enabled: !!form.model_id,
  });

  const { data: savedImages } = useQuery({
    queryKey: ["vehicle-images", vehicle?.id],
    queryFn: () =>
      vehicleService.getImages(vehicle.id).then((r) => r.data.data),
    enabled: editing,
  });

  const { data: colours } = useQuery({
    queryKey: ["public-colours"],
    queryFn: () => publicService.colours().then((r) => r.data.data),
  });

  const pf = (k) => (val) => setPricing((p) => ({ ...p, [k]: val }));
  const pfi = (k) => (e) => setPricing((p) => ({ ...p, [k]: e.target.value }));
  // Pricing is optional on create; once a vehicle has pricing, it's always re-saved (and daily rate stays required).
  const wantsPricing = String(pricing.daily_rate).trim() !== "" || hadPricing;

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const f = (k) => (val) => setForm((p) => ({ ...p, [k]: val }));
  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  // Changing a parent clears its children - a model belongs to one brand, a variant to one model.
  const selectBrand = (val) =>
    setForm((p) => ({ ...p, brand_id: val, model_id: "", variant_id: "" }));
  const selectModel = (val) =>
    setForm((p) => ({ ...p, model_id: val, variant_id: "" }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setPricingErrors({});
    setSaving(true);

    const payload = {
      ...form,
      engine_capacity_cc: form.engine_capacity_cc || null,
      luggage_capacity: form.luggage_capacity || null,
      doors: form.doors || null,
      variant_id: form.variant_id || null,
      colour_id: form.colour_id || null,
    };

    // 1. The vehicle itself - nothing else can save without it.
    let saved;
    try {
      setProgress(editing ? "Saving details..." : "Creating vehicle...");
      const res = editing
        ? await vehicleService.update(vehicle.id, payload)
        : await vehicleService.create(payload);
      saved = res.data?.data ?? vehicle;
    } catch (err) {
      const errs = err.response?.data?.errors ?? {};
      setErrors(errs);
      const firstTab = TABS.find((t) => t.fields.some((k) => errs[k]));
      if (firstTab) setTab(firstTab.id);
      if (err.response?.status !== 422)
        toast.error(err.response?.data?.message ?? "Could not save vehicle");
      setSaving(false);
      setProgress("");
      scrollTop();
      return;
    }

    let complete = true;

    // 2. Pricing (optional).
    if (wantsPricing) {
      try {
        setProgress("Saving pricing...");
        await vehicleService.updatePricing(saved.id, pricing);
      } catch (err) {
        complete = false;
        setPricingErrors(err.response?.data?.errors ?? {});
        setTab("pricing");
        toast.error(
          err.response?.data?.message ??
            "Vehicle saved, but pricing could not be saved",
        );
      }
    }

    // 3. Photos picked before the vehicle existed (create only), in order.
    if (!editing && photos.length) {
      let failed = 0;
      for (let i = 0; i < photos.length; i++) {
        setProgress(`Uploading photo ${i + 1} of ${photos.length}...`);
        try {
          await vehicleService.uploadImage(saved.id, photos[i]);
        } catch {
          failed++;
        }
      }
      if (failed) {
        complete = false;
        toast.error(
          `${failed} photo(s) could not be uploaded — add them again from the edit page`,
        );
      }
    }

    qc.invalidateQueries({ queryKey: ["vendor-vehicle"] });
    qc.invalidateQueries({ queryKey: ["vehicle-images", saved.id] });
    setSaving(false);
    setProgress("");

    if (complete) {
      toast.success(
        editing
          ? "Vehicle updated"
          : "Vehicle created — it will appear once approved and published",
      );
    } else if (editing) {
      // Stay on the page so the pricing errors are visible.
      return;
    }
    onSaved?.(saved, { complete });
  };

  const categoryOptions = (categories ?? []).map((c) => ({
    value: String(c.id),
    label: c.name,
  }));
  const brandOptions = (brands ?? []).map((b) => ({
    value: String(b.id),
    label: b.name,
  }));
  const modelOptions = (models ?? []).map((m) => ({
    value: String(m.id),
    label: m.name,
  }));
  const variantOptions = [
    { value: "", label: "None" },
    ...(variants ?? []).map((v) => ({ value: String(v.id), label: v.name })),
  ];
  const colourOptions = [
    { value: "", label: "Not specified" },
    ...(colours ?? []).map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const tabHasError = (t) =>
    t.id === "pricing"
      ? Object.keys(pricingErrors).length > 0
      : t.fields.some((k) => errors[k]);
  // Edit mode: photos are live (VehicleImageGallery) - read the same cached query for the count.
  const photoCount = editing ? (savedImages?.length ?? 0) : photos.length;

  const filled = (v) =>
    v !== null && v !== undefined && String(v).trim() !== "";
  const TAB_STATUS = {
    details: () =>
      [
        "category_id",
        "title",
        "brand_id",
        "model_id",
        "year",
        "registration_number",
      ].every((k) => filled(form[k])),
    specs: () =>
      ["transmission", "fuel_type", "seating_capacity"].every((k) =>
        filled(form[k]),
      ),
    description: () => filled(form.description),
    pricing: () => filled(pricing.daily_rate),
    photos: () => photoCount > 0,
  };
  const isComplete = (t) => TAB_STATUS[t.id]();
  const completeCount = TABS.filter(isComplete).length;
  const tabHint = (t) => {
    if (tabHasError(t)) return "Needs attention";
    if (t.id === "photos")
      return photoCount
        ? `${photoCount} photo${photoCount === 1 ? "" : "s"}`
        : "Optional";
    if (t.id === "pricing")
      return filled(pricing.daily_rate)
        ? `LKR ${Number(pricing.daily_rate).toLocaleString()}/day`
        : "Optional";
    if (isComplete(t)) return "Complete";
    return t.id === "description" ? "Recommended" : "Required";
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ValidationError errors={{ ...errors, ...pricingErrors }} />

      {/* Step tabs */}
      <div className="rounded-2xl border bg-card px-2 pb-3 pt-4 shadow-sm sm:px-4">
        {/* Classic stepper: circle on top, full label + status centred underneath. Scrolls sideways on narrow screens rather than truncating. */}
        <div className="overflow-x-auto [scrollbar-width:none]">
          <div
            role="tablist"
            aria-label="Vehicle form sections"
            className="grid min-w-[560px] grid-cols-5"
          >
            {TABS.map((t, i) => {
              const active = t.id === tab;
              const error = tabHasError(t);
              const done = !error && isComplete(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className="group relative flex flex-col items-center gap-1.5 px-1 pb-2 text-center focus-visible:outline-none"
                >
                  {/* connector to the next step, running behind the circles */}
                  {i < TABS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute left-1/2 top-[18px] h-0.5 w-full",
                        done ? "bg-emerald-400" : "bg-border",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-4 ring-card transition-all group-focus-visible:ring-primary/40",
                      error
                        ? "bg-destructive text-white"
                        : done
                          ? "bg-emerald-500 text-white"
                          : active
                            ? "bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white shadow-md shadow-pink-500/30"
                            : "border-2 border-muted-foreground/25 bg-card text-muted-foreground group-hover:border-primary/40 group-hover:text-foreground",
                      active && (error || done) && "scale-110 shadow-md",
                    )}
                  >
                    {error ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : done ? (
                      <Check className="h-4 w-4" strokeWidth={3} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold leading-tight",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    <t.icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        active ? "text-primary" : "opacity-70",
                      )}
                    />
                    {t.label}
                  </span>
                  <span
                    className={cn(
                      "whitespace-nowrap text-[11px] leading-tight",
                      error
                        ? "font-medium text-destructive"
                        : done
                          ? "text-emerald-600"
                          : "text-muted-foreground",
                    )}
                  >
                    {tabHint(t)}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 transition-opacity",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* overall progress */}
        <div className="mt-3 flex items-center gap-3 border-t px-1 pt-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 transition-all duration-500"
              style={{ width: `${(completeCount / TABS.length) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
            {completeCount} of {TABS.length} complete
          </span>
        </div>
      </div>

      {/* Active tab */}
      <div
        role="tabpanel"
        className="min-h-[340px] rounded-xl border bg-card p-4 sm:p-5"
      >
        {tab === "details" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectInput
              label="Category"
              value={form.category_id}
              onChange={f("category_id")}
              options={categoryOptions}
              required
              error={errors.category_id?.[0]}
            />
            <TextInput
              label="Listing Title"
              value={form.title}
              onChange={fi("title")}
              placeholder="e.g. Toyota Aqua - Colombo"
              required
              error={errors.title?.[0]}
            />
            <SelectInput
              label="Brand"
              placeholder="Select brand"
              value={form.brand_id}
              onChange={selectBrand}
              options={brandOptions}
              required
              error={errors.brand_id?.[0]}
            />
            <SelectInput
              label="Model"
              placeholder={
                form.brand_id ? "Select model" : "Select a brand first"
              }
              value={form.model_id}
              onChange={selectModel}
              options={modelOptions}
              disabled={!form.brand_id}
              required
              error={errors.model_id?.[0]}
            />
            <TextInput
              label="Year"
              type="number"
              value={form.year}
              onChange={fi("year")}
              required
              error={errors.year?.[0]}
            />
            <SelectInput
              label="Variant"
              placeholder={
                form.model_id
                  ? variants?.length
                    ? "Select variant"
                    : "No variants for this model"
                  : "Select a model first"
              }
              value={form.variant_id}
              onChange={f("variant_id")}
              options={variantOptions}
              disabled={!form.model_id || !variants?.length}
              error={errors.variant_id?.[0]}
            />
            <SelectInput
              label="Colour"
              placeholder="Select colour"
              value={form.colour_id}
              onChange={f("colour_id")}
              options={colourOptions}
              error={errors.colour_id?.[0]}
            />
            <TextInput
              label="Registration Number"
              value={form.registration_number}
              onChange={fi("registration_number")}
              required
              error={errors.registration_number?.[0]}
            />
          </div>
        )}

        {tab === "specs" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SelectInput
              label="Transmission"
              value={form.transmission}
              onChange={f("transmission")}
              options={TRANSMISSIONS}
              required
              error={errors.transmission?.[0]}
            />
            <SelectInput
              label="Fuel Type"
              value={form.fuel_type}
              onChange={f("fuel_type")}
              options={FUEL_TYPES}
              required
              error={errors.fuel_type?.[0]}
            />
            <TextInput
              label="Engine Capacity (cc)"
              type="number"
              value={form.engine_capacity_cc}
              onChange={fi("engine_capacity_cc")}
              error={errors.engine_capacity_cc?.[0]}
            />
            <TextInput
              label="Seating Capacity"
              type="number"
              value={form.seating_capacity}
              onChange={fi("seating_capacity")}
              required
              error={errors.seating_capacity?.[0]}
            />
            <TextInput
              label="Luggage Capacity"
              type="number"
              value={form.luggage_capacity}
              onChange={fi("luggage_capacity")}
              error={errors.luggage_capacity?.[0]}
            />
            <TextInput
              label="Doors"
              type="number"
              value={form.doors}
              onChange={fi("doors")}
              error={errors.doors?.[0]}
            />
            <CheckboxInput
              label="Air Conditioned"
              checked={form.air_conditioned}
              onChange={(v) => f("air_conditioned")(v)}
            />
          </div>
        )}

        {tab === "description" && (
          <div className="grid gap-3">
            <TextareaInput
              label="Description"
              rows={5}
              value={form.description}
              onChange={fi("description")}
              error={errors.description?.[0]}
              placeholder="What makes this vehicle a great rental — condition, features, ideal trips..."
            />
            <TextareaInput
              label="Condition Notes (internal)"
              rows={3}
              value={form.condition_notes}
              onChange={fi("condition_notes")}
              error={errors.condition_notes?.[0]}
              placeholder="Only your team sees this"
            />
          </div>
        )}

        {tab === "pricing" && (
          <div>
            <p className="mb-3 text-xs text-muted-foreground">
              {hadPricing
                ? "Daily rate is required."
                : "Leave the daily rate empty to set pricing later. A vehicle needs a daily rate before it can be booked."}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <TextInput
                label="Daily Rate"
                type="number"
                step="0.01"
                min="0"
                value={pricing.daily_rate}
                onChange={pfi("daily_rate")}
                required={hadPricing}
                error={pricingErrors.daily_rate?.[0]}
              />
              <TextInput
                label="Weekly Rate"
                type="number"
                step="0.01"
                min="0"
                value={pricing.weekly_rate}
                onChange={pfi("weekly_rate")}
                disabled={!wantsPricing}
                error={pricingErrors.weekly_rate?.[0]}
              />
              <TextInput
                label="Monthly Rate"
                type="number"
                step="0.01"
                min="0"
                value={pricing.monthly_rate}
                onChange={pfi("monthly_rate")}
                disabled={!wantsPricing}
                error={pricingErrors.monthly_rate?.[0]}
              />
              <TextInput
                label="Security Deposit"
                type="number"
                step="0.01"
                min="0"
                value={pricing.security_deposit}
                onChange={pfi("security_deposit")}
                disabled={!wantsPricing}
                error={pricingErrors.security_deposit?.[0]}
              />
              <SelectInput
                label="Deposit Method"
                value={pricing.deposit_method}
                onChange={pf("deposit_method")}
                options={DEPOSIT_METHODS}
                disabled={!wantsPricing}
                error={pricingErrors.deposit_method?.[0]}
              />
              <TextInput
                label="Mileage Allowance (km/day)"
                type="number"
                min="0"
                value={pricing.mileage_allowance_per_day_km}
                onChange={pfi("mileage_allowance_per_day_km")}
                disabled={!wantsPricing}
                error={pricingErrors.mileage_allowance_per_day_km?.[0]}
              />
              <TextInput
                label="Driver Rate (per day)"
                type="number"
                step="0.01"
                min="0"
                value={pricing.driver_rate_per_day}
                onChange={pfi("driver_rate_per_day")}
                disabled={!wantsPricing}
                error={pricingErrors.driver_rate_per_day?.[0]}
              />
              <TextInput
                label="Min Rental Days"
                type="number"
                min="1"
                value={pricing.min_rental_days}
                onChange={pfi("min_rental_days")}
                disabled={!wantsPricing}
                error={pricingErrors.min_rental_days?.[0]}
              />
              <CheckboxInput
                label="Delivery Available"
                checked={pricing.delivery_available}
                onChange={(v) => pf("delivery_available")(!!v)}
              />
            </div>
          </div>
        )}

        {tab === "photos" && (
          <div>
            {editing ? (
              <VehicleImageGallery vehicle={vehicle} />
            ) : (
              <PendingPhotos
                files={photos}
                setFiles={setPhotos}
                disabled={saving}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        {progress && (
          <span className="mr-auto text-xs text-muted-foreground">
            {progress}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving || tabIndex === 0}
          onClick={() => setTab(TABS[tabIndex - 1].id)}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {tabIndex < TABS.length - 1 && (
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => setTab(TABS[tabIndex + 1].id)}
            className="gap-1"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editing ? "Save Changes" : "Add Vehicle"}
        </Button>
      </div>
    </form>
  );
}
