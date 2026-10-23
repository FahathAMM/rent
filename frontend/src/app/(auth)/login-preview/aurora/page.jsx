"use client";

import { useLoginForm } from "@/hooks/useLoginForm";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { LoginFormFields } from "@/components/auth/LoginFormFields";
import { DevCredit } from "@/components/auth/DevCredit";

export default function LoginAuroraPreviewPage() {
  const { brandName, tagline, logoUrl, form, setForm, errors, loading, demoLoading, handleSubmit, handleDemoLogin } = useLoginForm();

  return (
    <div className="bg-background relative isolate h-svh w-full overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
        <div className="aurora-blob aurora-blob-4" />
        <div className="aurora-grain" />
      </div>

      <div className="relative flex h-full flex-col px-5 py-4 sm:px-12 sm:py-6 lg:px-14 lg:py-8">
        <header className="flex items-center gap-2.5 shrink-0 animate-in fade-in slide-in-from-top-4 duration-700">
          <BrandLogo
            logoUrl={logoUrl}
            brandName={brandName}
            imgClassName="h-8 w-auto object-contain"
            fallbackClassName="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
            iconClassName="size-4"
          />
          <span className="text-sm font-semibold tracking-tight">{brandName}</span>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 [align-items:safe_center] py-2">
          <div className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-20">
            {/* ── Hero copy — hidden below lg so mobile shows only the card ── */}
            <div className="hidden lg:flex max-w-xl flex-col gap-5 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="border-border/60 bg-background/80 text-foreground/70 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium tracking-tight backdrop-blur-sm">
                <span className="bg-primary size-1.5 rounded-full" aria-hidden="true" />
                <span>Built for growing sales &amp; finance teams</span>
              </div>
              <h1 className="text-foreground text-5xl leading-[1.05] font-semibold tracking-[-0.02em] text-balance xl:text-6xl">
                One flow to run your <span className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">business</span>.
              </h1>
              <p className="text-muted-foreground max-w-xl text-lg leading-relaxed text-pretty">
                {tagline} — CRM, quotations, invoicing and expenses in one place. Sign in to pick up right where you left off.
              </p>
            </div>

            {/* ── Sign-in card ─────────────────────────────────────────── */}
            <div className="relative mx-auto w-full max-w-[400px] rounded-2xl border bg-card shadow-sm p-5 sm:p-6 animate-login-card">
              <div className="flex justify-center mb-3">
                <BrandLogo
                  logoUrl={logoUrl}
                  brandName={brandName}
                  imgClassName="h-auto w-28"
                  fallbackClassName="h-12 w-12 rounded-xl bg-primary"
                  iconClassName="h-1/2 w-1/2 text-primary-foreground"
                />
              </div>

              <div className="mb-4 space-y-1 text-center lg:text-left">
                <h2 className="text-lg font-semibold tracking-tight">Welcome back</h2>
                <p className="text-muted-foreground text-xs">Sign in to your {brandName} account</p>
              </div>

              <LoginFormFields
                form={form}
                setForm={setForm}
                errors={errors}
                loading={loading}
                demoLoading={demoLoading}
                onSubmit={handleSubmit}
                onDemoLogin={handleDemoLogin}
                dividerBg="bg-card"
              />

              <DevCredit className="mt-4 pt-3 border-t" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
