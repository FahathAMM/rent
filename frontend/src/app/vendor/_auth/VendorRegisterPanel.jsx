"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { RegisterFormFields } from "@/components/auth/RegisterFormFields";

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
 * in-place upgrade"). The new account always lands in rental-shop
 * onboarding. No BrandLogo here: the shell (VendorLoginPageClient)
 * already shows it.
 */
export function VendorRegisterPanel({ brandName, onSwitchToLogin }) {
  const { register } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      await register(form);
      router.push("/vendor/shops/new");
    } catch (err) {
      const message = err.networkError ?? err.response?.data?.message ?? "Registration failed";
      setErrors(err.response?.data?.errors ?? { email: [message] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-6 space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Become a vendor</h2>
        <p className="text-muted-foreground text-sm">List your vehicles and start earning on {brandName}</p>
      </div>

      <RegisterFormFields
        form={form}
        setForm={setForm}
        errors={errors}
        loading={loading}
        onSubmit={handleSubmit}
        onSwitchToLogin={onSwitchToLogin}
      />
    </>
  );
}
