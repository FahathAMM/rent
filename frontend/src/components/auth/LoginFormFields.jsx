import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  TextInput,
  PasswordInput,
  ValidationError,
} from "@/components/forms/FormField";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Email/password/submit + demo-login + register-link — shared across every login layout variant. */
export function LoginFormFields({
  form,
  setForm,
  errors,
  loading,
  demoLoading,
  onSubmit,
  onDemoLogin,
  onSwitchToRegister,
  dividerBg = "bg-background",
}) {
  return (
    <>
      <form onSubmit={onSubmit} className="space-y-3">
        <ValidationError errors={errors} />
        <TextInput
          label="Email"
          type="email"
          placeholder="you@company.com"
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
          disabled={loading || demoLoading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </form>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className={cn("px-2 text-muted-foreground", dividerBg)}>
            Or
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={onDemoLogin}
        disabled={loading || demoLoading}
      >
        {demoLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        Try Demo Account
      </Button>

      <p className="text-xs text-center text-muted-foreground mt-4">
        New business?{" "}
        {onSwitchToRegister ? (
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-primary font-medium hover:underline"
          >
            Create your company
          </button>
        ) : (
          <Link
            href="/register"
            className="text-primary font-medium hover:underline"
          >
            Create your company
          </Link>
        )}
      </p>
    </>
  );
}
