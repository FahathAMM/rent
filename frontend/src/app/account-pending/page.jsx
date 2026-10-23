"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Clock3, LogOut, Mail, Building2, MapPin, Phone, Hash, Globe,
  CheckCircle2, Sparkles,
} from "lucide-react";

const CONTACT_EMAIL = "support@mybiz2flow.com";

const STEPS = [
  { title: "Sign-up received", description: "Your company and owner account were created successfully.", done: true },
  { title: "Our team reviews your account", description: "A quick check before your workspace goes live — usually within one business day.", done: false },
  { title: "Account activated", description: "You'll be able to sign in and start using MyBiz2Flow right away.", done: false },
];

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function Card({ icon: Icon, iconBg, iconColor, title, description, children }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-muted-foreground text-xs mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function AccountPendingPage() {
  const router = useRouter();
  const { user, _hasHydrated } = useAuthStore();
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!user) router.replace("/login");
    else if (user.company?.status !== "initiate") router.replace("/dashboard");
  }, [_hasHydrated, user, router]);

  if (!_hasHydrated || !user || user.company?.status !== "initiate") return null;

  const company = user.company ?? {};
  const address = [company.address_line_1, company.city, company.emirate, company.country].filter(Boolean).join(", ");

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  return (
    <div className="bg-muted/20 min-h-svh">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
              <Building2 className="size-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">MyBiz2Flow</span>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleLogout} disabled={loggingOut}>
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col items-start gap-4 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="bg-primary/10 text-primary flex size-14 shrink-0 items-center justify-center rounded-full">
            <Clock3 className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Your account is being set up</h1>
            <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">
              Thanks for signing up — <span className="text-foreground font-medium">{company.name}</span> is almost ready.
              Our team will activate your account shortly, and you&apos;ll be able to sign in as normal.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card icon={Sparkles} iconBg="bg-amber-100" iconColor="text-amber-600" title="What happens next">
            <ol className="space-y-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex items-start gap-3">
                  {step.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <span className="border-muted-foreground/30 text-muted-foreground mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold">
                      {i}
                    </span>
                  )}
                  <div>
                    <p className={`text-sm font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}>{step.title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card icon={Building2} iconBg="bg-blue-100" iconColor="text-blue-600" title="Company details">
            <div className="divide-y">
              <InfoRow icon={Building2} label="Company" value={company.name} />
              <InfoRow icon={Mail} label="Email" value={company.email || user.email} />
              <InfoRow icon={Phone} label="Phone" value={company.phone} />
              <InfoRow icon={MapPin} label="Address" value={address} />
              <InfoRow icon={Hash} label="TRN" value={company.trn} />
              <InfoRow icon={Globe} label="Currency" value={company.currency} />
            </div>
          </Card>
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Need this sooner, or have a question?</p>
              <p className="text-muted-foreground text-xs mt-0.5">Our team usually replies within a few hours.</p>
            </div>
          </div>
          <Button asChild variant="outline" className="gap-1.5 shrink-0">
            <a href={`mailto:${CONTACT_EMAIL}`}>
              <Mail className="h-4 w-4" />
              {CONTACT_EMAIL}
            </a>
          </Button>
        </div>
      </main>
    </div>
  );
}
