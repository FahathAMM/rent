"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { platformDetailService } from "@/services/platformDetailService";

const DEMO_CREDENTIALS = { email: "demo@chickenshop.com", password: "password" };

/**
 * Shared brand data + form state/handlers for every login-page layout
 * variant under (auth)/login-preview/* — keeps the auth logic in one place
 * while each variant page only differs in markup/styling.
 */
export function useLoginForm({ initialBrand } = {}) {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const { data } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
    // Server-fetched on the login page itself so the logo/name/tagline are
    // already in the initial HTML — this query then just keeps them fresh
    // instead of being the thing that first paints them. May be null (server
    // fetch failed) rather than undefined, so `brand = data ?? {}` here
    // instead of a destructuring default, which only catches undefined.
    initialData: initialBrand,
  });
  const brand = data ?? {};
  const brandName = brand.name || "MyBiz2Flow";
  const tagline   = brand.tagline || "One Flow. One Business.";
  const logoUrl   = brand.login_logo || brand.logo || null;

  const signIn = async (credentials) => {
    setErrors({});
    try {
      await login(credentials);
      router.push("/dashboard");
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

  return {
    brandName, tagline, logoUrl,
    form, setForm, errors, loading, demoLoading,
    handleSubmit, handleDemoLogin,
  };
}
