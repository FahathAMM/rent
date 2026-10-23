"use client";

import { useLoginForm } from "@/hooks/useLoginForm";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { LoginFormFields } from "@/components/auth/LoginFormFields";
import { DevCredit } from "@/components/auth/DevCredit";

export default function LoginBannerPreviewPage() {
  const { brandName, tagline, logoUrl, form, setForm, errors, loading, demoLoading, handleSubmit, handleDemoLogin } = useLoginForm();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <div className="relative w-full h-52 sm:h-60">
        {/* Clips the gradient + blurred blobs only — kept separate from the
            outer wrapper so the floating logo card below can bleed past the
            banner's bottom edge without being clipped too. */}
        <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700">
          <div className="animate-blob absolute -top-16 -left-10 h-64 w-64 rounded-full bg-white/20 mix-blend-soft-light blur-3xl" />
          <div className="animate-blob animation-delay-2000 absolute -top-10 -right-10 h-64 w-64 rounded-full bg-cyan-300/30 mix-blend-soft-light blur-3xl" />
        </div>

        <div className="relative z-10 h-full flex items-end justify-center">
          <div className="mb-[-2.75rem] animate-in fade-in zoom-in-95 duration-700">
            <div className="rounded-2xl bg-white shadow-xl p-3 ring-1 ring-black/5">
              <BrandLogo
                logoUrl={logoUrl}
                brandName={brandName}
                imgClassName="h-auto w-36"
                fallbackClassName="h-16 w-16 rounded-xl bg-primary"
                iconClassName="h-1/2 w-1/2 text-primary-foreground"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm px-6 pb-10 pt-14 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
          <p className="text-sm text-muted-foreground mt-1">Sign in to {brandName}</p>
          <p className="text-xs font-medium text-primary italic mt-1">{tagline}</p>
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

      <DevCredit className="pb-8" />
    </div>
  );
}
