"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { customerService } from "@/services/customerService";
import { safeNextPath } from "@/lib/utils";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { RegisterFormFields } from "@/components/auth/RegisterFormFields";
import { DevCredit } from "@/components/auth/DevCredit";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  otp: "",
  password: "",
  password_confirmation: "",
  terms_accepted: false,
};

export function RegisterPanel({ brandName, logoUrl, onSwitchToLogin }) {
  const { register } = useCustomerAuth();
  const router = useRouter();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  // Registering with a mobile number: text a code to it first.
  const handleSendOtp = async () => {
    setErrors({});
    setSendingOtp(true);
    try {
      await customerService.sendOtp(form.phone);
      setOtpSent(true);
      toast.success("Code sent to your mobile");
    } catch (err) {
      const message = err.networkError ?? err.response?.data?.message ?? "Could not send the code";
      setErrors(err.response?.data?.errors ?? { phone: [message] });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      await register(form);
      // Back to where they were (e.g. a booking they started) — else the dashboard.
      router.push(safeNextPath("/account/dashboard"));
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
        <p className="text-muted-foreground text-xs">Rent or buy a vehicle, anywhere in Sri Lanka</p>
      </div>

      <RegisterFormFields
        form={form}
        setForm={setForm}
        errors={errors}
        loading={loading}
        onSubmit={handleSubmit}
        onSwitchToLogin={onSwitchToLogin}
        onSendOtp={handleSendOtp}
        otpSent={otpSent}
        sendingOtp={sendingOtp}
      />

      <DevCredit className="mt-4 pt-3 border-t" />
    </>
  );
}
