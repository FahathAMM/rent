"use client";

import { useLoginForm } from "@/hooks/useLoginForm";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { LoginFormFields } from "@/components/auth/LoginFormFields";
import { DevCredit } from "@/components/auth/DevCredit";

export default function LoginMinimalPreviewPage() {
  const { brandName, tagline, logoUrl, form, setForm, errors, loading, demoLoading, handleSubmit, handleDemoLogin } = useLoginForm();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex justify-center mb-8">
          <BrandLogo
            logoUrl={logoUrl}
            brandName={brandName}
            imgClassName="h-auto w-40"
            fallbackClassName="h-20 w-20 rounded-2xl bg-primary"
            iconClassName="h-1/2 w-1/2 text-primary-foreground"
          />
        </div>

        <div className="text-center mb-8">
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
  );
}
