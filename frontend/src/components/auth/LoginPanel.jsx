"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import Link from "next/link";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { LoginFormFields } from "@/components/auth/LoginFormFields";
import { DevCredit } from "@/components/auth/DevCredit";

/** The customer login — see app/vendor/_auth/VendorLoginPanel for the separate vendor/owner/staff login. */
export function LoginPanel({ brandName, logoUrl, onSwitchToRegister }) {
  const { login } = useCustomerAuth();
  const router = useRouter();

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      await login(form);
      router.push("/account/dashboard");
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
        <Link href="/" aria-label={`${brandName} home`} className="rounded-md transition-opacity hover:opacity-80">
          <BrandLogo
            logoUrl={logoUrl}
            brandName={brandName}
            imgClassName="h-auto w-40"
            fallbackClassName="h-12 w-12 rounded-xl bg-primary"
            iconClassName="h-1/2 w-1/2 text-primary-foreground"
          />
        </Link>
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
