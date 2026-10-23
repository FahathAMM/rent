"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { LoginFormFields } from "@/components/auth/LoginFormFields";
import { DevCredit } from "@/components/auth/DevCredit";

const DEMO_CREDENTIALS = { email: "demo@chickenshop.com", password: "password" };

export function LoginPanel({ brandName, logoUrl, onSwitchToRegister }) {
  const { login } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const signIn = async (credentials) => {
    setErrors({});
    try {
      const user = await login(credentials);
      router.push(user.company?.status === "initiate" ? "/account-pending" : "/dashboard");
    } catch (err) {
      const message = err.networkError ?? err.response?.data?.message ?? "Login failed";
      setErrors(err.response?.data?.errors ?? { email: [message] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await signIn(form);
    setLoading(false);
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    await signIn(DEMO_CREDENTIALS);
    setDemoLoading(false);
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
        demoLoading={demoLoading}
        onSubmit={handleSubmit}
        onDemoLogin={handleDemoLogin}
        onSwitchToRegister={onSwitchToRegister}
        dividerBg="bg-card"
      />

      <DevCredit className="mt-4 pt-3 border-t" />
    </>
  );
}
