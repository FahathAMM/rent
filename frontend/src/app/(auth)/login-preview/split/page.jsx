"use client";

import { useLoginForm } from "@/hooks/useLoginForm";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { LoginFormFields } from "@/components/auth/LoginFormFields";
import { DevCredit } from "@/components/auth/DevCredit";
import { Users, FileText, Wallet } from "lucide-react";

const HIGHLIGHTS = [
  { icon: Users, text: "Manage leads & customers in one place" },
  { icon: FileText, text: "Create quotations & invoices in seconds" },
  { icon: Wallet, text: "Track payments and expenses effortlessly" },
];

export default function LoginSplitPreviewPage() {
  const { brandName, tagline, logoUrl, form, setForm, errors, loading, demoLoading, handleSubmit, handleDemoLogin } = useLoginForm();

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Narrow: sign-in form ────────────────────────────────────────── */}
      <div className="flex w-full lg:w-[38%] flex-col items-center justify-center p-6 sm:p-10 z-10">
        <div className="flex justify-center mb-6">
          <BrandLogo
            logoUrl={logoUrl}
            brandName={brandName}
            imgClassName="h-auto w-36"
            fallbackClassName="h-16 w-16 rounded-2xl bg-primary"
            iconClassName="h-1/2 w-1/2 text-primary-foreground"
          />
        </div>

        <div className="w-full max-w-xs animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account to continue</p>
          </div>

          <LoginFormFields
            form={form}
            setForm={setForm}
            errors={errors}
            loading={loading}
            demoLoading={demoLoading}
            onSubmit={handleSubmit}
            onDemoLogin={handleDemoLogin}
          />
        </div>

        <DevCredit className="mt-10" />
      </div>

      {/* ── Wide: diagonal-edged brand panel ───────────────────────────── */}
      <div
        className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700"
        style={{ clipPath: "polygon(6% 0, 100% 0, 100% 100%, 0% 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="animate-blob absolute -top-24 -left-20 h-96 w-96 rounded-full bg-white/20 mix-blend-soft-light blur-3xl" />
          <div className="animate-blob animation-delay-2000 absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-cyan-300/30 mix-blend-soft-light blur-3xl" />
          <div className="animate-blob animation-delay-4000 absolute -bottom-24 left-1/4 h-96 w-96 rounded-full bg-violet-300/30 mix-blend-soft-light blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-center h-full w-full p-12 pl-20 xl:p-16 xl:pl-28">
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white">{brandName}</h1>
            <p className="mt-3 text-lg text-white/85 italic font-medium">{tagline}</p>
            <p className="mt-4 max-w-md text-sm text-white/70 leading-relaxed">
              The all-in-one CRM &amp; invoicing platform built to help growing businesses sell smarter and get paid faster.
            </p>

            <ul className="mt-8 space-y-3">
              {HIGHLIGHTS.map((h, i) => (
                <li
                  key={h.text}
                  className="flex items-center gap-3 text-sm text-white/90 animate-in fade-in slide-in-from-left-4"
                  style={{ animationDelay: `${300 + i * 120}ms`, animationDuration: "600ms", animationFillMode: "both" }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                    <h.icon className="h-4 w-4" />
                  </span>
                  {h.text}
                </li>
              ))}
            </ul>
          </div>

          <p className="absolute bottom-12 left-20 xl:bottom-16 xl:left-28 text-xs text-white/50">© {new Date().getFullYear()} {brandName}. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
