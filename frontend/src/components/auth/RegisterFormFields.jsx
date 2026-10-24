import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  TextInput,
  PasswordInput,
  ValidationError,
} from "@/components/forms/FormField";
import { Loader2 } from "lucide-react";

/**
 * Every account starts as a plain customer — see
 * app-doc/marketplace/01-phase1-architecture.md "Identity & ownership
 * model". Becoming a vehicle owner or shop owner is a separate
 * onboarding flow, not part of sign-up.
 */
export function RegisterFormFields({
  form,
  setForm,
  errors,
  loading,
  onSubmit,
  onSwitchToLogin,
}) {
  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-3">
        <ValidationError errors={errors} />

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="Your name"
            placeholder="Nimal Perera"
            value={form.name}
            onChange={set("name")}
            required
            error={errors.name?.[0]}
            inputClassName="h-9 text-sm"
            className="col-span-2"
          />
          <TextInput
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={set("email")}
            required
            error={errors.email?.[0]}
            inputClassName="h-9 text-sm"
            className="col-span-2"
          />
          <TextInput
            label="Phone"
            type="tel"
            placeholder="07X XXX XXXX"
            value={form.phone}
            onChange={set("phone")}
            error={errors.phone?.[0]}
            inputClassName="h-9 text-sm"
            className="col-span-2"
          />
          <PasswordInput
            label="Password"
            placeholder="••••••••"
            value={form.password}
            onChange={set("password")}
            required
            error={errors.password?.[0]}
            inputClassName="h-9 text-sm"
          />
          <PasswordInput
            label="Confirm password"
            placeholder="••••••••"
            value={form.password_confirmation}
            onChange={set("password_confirmation")}
            required
            inputClassName="h-9 text-sm"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>

      <p className="text-xs text-center text-muted-foreground mt-4">
        Already have an account?{" "}
        {onSwitchToLogin ? (
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-primary font-medium hover:underline"
          >
            Sign in
          </button>
        ) : (
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        )}
      </p>
    </>
  );
}
