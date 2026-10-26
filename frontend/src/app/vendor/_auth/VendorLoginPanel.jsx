"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { LoginFormFields } from "@/components/auth/LoginFormFields";

/**
 * The vendor/owner/staff login — a separate account/guard from the
 * customer LoginPanel, same split as /platform/login. No BrandLogo here:
 * the shell (VendorLoginPageClient) already shows it, in the dark side
 * panel on desktop and the top bar on mobile.
 */
export function VendorLoginPanel({ onSwitchToRegister }) {
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
      await login(form);
      router.push("/vendor/dashboard");
    } catch (err) {
      const message = err.networkError ?? err.response?.data?.message ?? "Login failed";
      setErrors(err.response?.data?.errors ?? { email: [message] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-6 space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
        <p className="text-muted-foreground text-sm">Sign in to manage your vehicles and bookings</p>
      </div>

      <LoginFormFields
        form={form}
        setForm={setForm}
        errors={errors}
        loading={loading}
        onSubmit={handleSubmit}
        onSwitchToRegister={onSwitchToRegister}
      />
    </>
  );
}
