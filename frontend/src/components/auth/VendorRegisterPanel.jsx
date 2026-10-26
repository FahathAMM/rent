"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { RegisterFormFields } from "@/components/auth/RegisterFormFields";
import { DevCredit } from "@/components/auth/DevCredit";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  password: "",
  password_confirmation: "",
};

/**
 * A genuinely separate vendor sign-up — not an upgrade of an existing
 * customer session (see app-doc "Become a Vendor can no longer be an
 * in-place upgrade"). `?next=shop` lands the new account in the shop
 * onboarding flow instead of the individual-owner one.
 */
export function VendorRegisterPanel({ brandName, logoUrl, onSwitchToLogin }) {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      await register(form);
      const next = searchParams.get("next") === "shop" ? "/vendor/shops/new" : "/vendor/become-owner";
      router.push(next);
    } catch (err) {
      const message = err.networkError ?? err.response?.data?.message ?? "Registration failed";
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
        <h2 className="text-lg font-semibold tracking-tight">Become a vendor</h2>
        <p className="text-muted-foreground text-xs">List your vehicles and start earning on {brandName}</p>
      </div>

      <RegisterFormFields
        form={form}
        setForm={setForm}
        errors={errors}
        loading={loading}
        onSubmit={handleSubmit}
        onSwitchToLogin={onSwitchToLogin}
      />

      <DevCredit className="mt-4 pt-3 border-t" />
    </>
  );
}
