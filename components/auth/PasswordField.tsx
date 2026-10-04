"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

type PasswordFieldProps = {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  disabled?: boolean;
};

export function PasswordField({
  id,
  name,
  autoComplete,
  required,
  minLength,
  placeholder,
  disabled,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="quotr-auth-password relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        disabled={disabled}
        className="h-11"
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        disabled={disabled}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
