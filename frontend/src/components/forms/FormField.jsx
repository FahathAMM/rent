"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function FormField({ label, error, required, className, children, ...props }) {
  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <Label className={required ? "after:content-['*'] after:ml-0.5 after:text-destructive" : ""}>
          {label}
        </Label>
      )}
      {children}
      {error && (
        <p className="animate-in fade-in-0 duration-300 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

export function TextInput({ label, error, required, className, inputClassName, ...props }) {
  return (
    <FormField label={label} error={error} required={required} className={className}>
      <Input className={cn(error && "border-destructive", inputClassName)} {...props} />
    </FormField>
  );
}

export function PasswordInput({ label, error, required, className, inputClassName, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <FormField label={label} error={error} required={required} className={className}>
      <div className="relative">
        <Input type={visible ? "text" : "password"} className={cn("pr-9", error && "border-destructive", inputClassName)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-0 top-0 flex h-full w-9 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </FormField>
  );
}

export function NumberInput({ label, error, required, className, ...props }) {
  return (
    <FormField label={label} error={error} required={required} className={className}>
      <Input type="number" className={cn(error && "border-destructive")} {...props} />
    </FormField>
  );
}

export function TextareaInput({ label, error, required, className, ...props }) {
  return (
    <FormField label={label} error={error} required={required} className={className}>
      <Textarea className={cn(error && "border-destructive")} {...props} />
    </FormField>
  );
}

export function CheckboxInput({ label, error, checked, onChange, className, id }) {
  const inputId = id ?? label?.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className={cn("flex items-center gap-2 pt-5", className)}>
      <Checkbox id={inputId} checked={checked} onCheckedChange={onChange} />
      {label && (
        <Label htmlFor={inputId} className="text-sm font-normal cursor-pointer">
          {label}
        </Label>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ValidationError({ errors }) {
  if (!errors || Object.keys(errors).length === 0) return null;
  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 space-y-0.5">
      {Object.entries(errors).map(([field, messages]) =>
        (Array.isArray(messages) ? messages : [messages]).map((msg, i) => (
          <p key={`${field}-${i}`} className="text-xs text-destructive">• {msg}</p>
        ))
      )}
    </div>
  );
}
