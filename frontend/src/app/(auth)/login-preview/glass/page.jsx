"use client";

import { useLoginForm } from "@/hooks/useLoginForm";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { LoginFormFields } from "@/components/auth/LoginFormFields";
import { DevCredit } from "@/components/auth/DevCredit";

export default function LoginGlassPreviewPage() {
  const { brandName, tagline, logoUrl, form, setForm, errors, loading, demoLoading, handleSubmit, handleDemoLogin } = useLoginForm();

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 flex items-center justify-center p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-blob absolute -top-24 -left-20 h-96 w-96 rounded-full bg-white/20 mix-blend-soft-light blur-3xl" />
        <div className="animate-blob animation-delay-2000 absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-cyan-300/30 mix-blend-soft-light blur-3xl" />
        <div className="animate-blob animation-delay-4000 absolute -bottom-24 left-1/4 h-96 w-96 rounded-full bg-violet-300/30 mix-blend-soft-light blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/40 bg-white/85 backdrop-blur-xl shadow-2xl p-8 sm:p-10 animate-in fade-in zoom-in-95 duration-700">
        <div className="flex justify-center mb-6">
          <BrandLogo
            logoUrl={logoUrl}
            brandName={brandName}
            imgClassName="h-auto w-44"
            fallbackClassName="h-20 w-20 rounded-2xl bg-primary"
            iconClassName="h-1/2 w-1/2 text-primary-foreground"
          />
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-center">Welcome back</h2>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-6">Sign in to your {brandName} account</p>
        <p className="text-xs font-medium text-primary italic text-center mb-6">{tagline}</p>

        <LoginFormFields
          form={form}
          setForm={setForm}
          errors={errors}
          loading={loading}
          demoLoading={demoLoading}
          onSubmit={handleSubmit}
          onDemoLogin={handleDemoLogin}
          dividerBg="bg-white"
        />

        <DevCredit className="mt-8" />
      </div>
    </div>
  );
}
