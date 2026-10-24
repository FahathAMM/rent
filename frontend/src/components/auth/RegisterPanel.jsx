"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export function RegisterPanel({ brandName, logoUrl, onSwitchToLogin }) {
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
      router.push("/account");
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
        <h2 className="text-lg font-semibold tracking-tight">Create your account</h2>
        <p className="text-muted-foreground text-xs">Rent any vehicle, anywhere in Sri Lanka</p>
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
