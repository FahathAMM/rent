"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { LoginFormFields } from "@/components/auth/LoginFormFields";
import { DevCredit } from "@/components/auth/DevCredit";

/**
 * A vehicle-owner/shop-owner/shop-staff lands on the vendor dashboard;
 * every other account (plain customer) lands on their account overview —
 * see app-doc/marketplace/01-phase1-architecture.md "Identity & ownership
 * model" for why a single login can mean either.
 */
export function LoginPanel({ brandName, logoUrl, onSwitchToRegister, onSuccess }) {
  const { login } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const user = await login(form);
      if (onSuccess) {
        onSuccess(user);
      } else {
        const isVendor = (user.roles ?? []).some((r) => ["vehicle-owner", "shop-owner", "shop-staff"].includes(r));
        router.push(isVendor ? "/vendor/dashboard" : "/account");
      }
    } catch (err) {
      const message = err.networkError ?? err.response?.data?.message ?? "Login failed";
      setErrors(err.response?.data?.errors ?? { email: [message] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex justify-center mb-3">
        <BrandLogo
          logoUrl={logoUrl}
          brandName={brandName}
          imgClassName="h-auto w-40"
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
        onSubmit={handleSubmit}
        onSwitchToRegister={onSwitchToRegister}
      />

      <DevCredit className="mt-4 pt-3 border-t" />
    </>
  );
}
