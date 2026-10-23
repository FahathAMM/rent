"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { usePlatformAuth } from "@/hooks/usePlatformAuth";
import { platformDetailService } from "@/services/platformDetailService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/forms/FormField";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PlatformLoginPage() {
  const router = useRouter();
  const { login } = usePlatformAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const { data: brand = {} } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
  });
  const tagline = brand.tagline || "One Flow. One Business.";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      await login(form);
      router.push("/platform/dashboard");
    } catch (err) {
      setErrors(err.response?.data?.errors ?? {});
      if (!err.response?.data?.errors) {
        toast.error(err.response?.data?.message ?? err.networkError ?? "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-white">{tagline}</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to the SaaS administration console</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-300">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="border-slate-700 bg-slate-950 text-white"
              required
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email[0]}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-slate-300">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              inputClassName="border-slate-700 bg-slate-950 text-white"
              required
              error={errors.password?.[0]}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
