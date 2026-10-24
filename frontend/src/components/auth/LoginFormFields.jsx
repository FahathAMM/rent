import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  TextInput,
  PasswordInput,
  ValidationError,
} from "@/components/forms/FormField";
import { Loader2 } from "lucide-react";

/** Email/password/submit + register-link — shared across every login layout variant. */
export function LoginFormFields({
  form,
  setForm,
  errors,
  loading,
  onSubmit,
  onSwitchToRegister,
}) {
  return (
    <>
      <form onSubmit={onSubmit} className="space-y-3">
        <ValidationError errors={errors} />
        <TextInput
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          required
          error={errors.email?.[0]}
          inputClassName="h-9 text-sm"
        />
        <PasswordInput
          label="Password"
          placeholder="••••••••"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          required
          error={errors.password?.[0]}
          inputClassName="h-9 text-sm"
        />
        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </form>

      <p className="text-xs text-center text-muted-foreground mt-4">
        New here?{" "}
        {onSwitchToRegister ? (
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-primary font-medium hover:underline"
          >
            Create your account
          </button>
        ) : (
          <Link
            href="/register"
            className="text-primary font-medium hover:underline"
          >
            Create your account
          </Link>
        )}
      </p>
    </>
  );
}
