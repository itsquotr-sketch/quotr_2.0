"use client";

import { useEffect } from "react";

/** Move the first validation message into the form scrollport and focus its field. */
export function useFocusOnboardingError(signature: string) {
  useEffect(() => {
    if (!signature) return;
    const fieldError = document.querySelector<HTMLElement>(
      "[data-onboarding-field-error]"
    );
    const alert = document.querySelector<HTMLElement>(
      "[data-onboarding-form] [role='alert']"
    );
    const controlId = fieldError?.getAttribute("data-onboarding-field-error");
    const control = controlId ? document.getElementById(controlId) : null;
    const target = control ?? fieldError ?? alert;
    if (!target) return;
    target.scrollIntoView({ block: "nearest" });
    if (control instanceof HTMLElement) {
      control.focus({ preventScroll: true });
    }
  }, [signature]);
}

export function OnboardingFieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) return null;
  return (
    <p data-onboarding-field-error={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}
