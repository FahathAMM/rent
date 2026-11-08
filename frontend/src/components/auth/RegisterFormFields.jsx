import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  cancelHref, // optional — shows a Cancel button linking here
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
        <div className="flex items-start gap-2">
          <Checkbox
            id="terms-accepted"
            className="mt-0.5"
            checked={form.terms_accepted}
            onCheckedChange={(v) => setForm((p) => ({ ...p, terms_accepted: !!v }))}
          />
          <Label htmlFor="terms-accepted" className="block cursor-pointer text-xs font-normal leading-relaxed text-muted-foreground">
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="text-primary font-medium hover:underline">Terms &amp; Conditions</Link>
            {" "}and{" "}
            <Link href="/privacy" target="_blank" className="text-primary font-medium hover:underline">Privacy Policy</Link>
          </Label>
        </div>
        <div className="flex gap-2">
          {cancelHref && (
            <Button type="button" variant="outline" className="flex-1" asChild>
              <Link href={cancelHref}>Cancel</Link>
            </Button>
          )}
          <Button type="submit" className="flex-1" disabled={loading || !form.terms_accepted}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create account
          </Button>
        </div>
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
