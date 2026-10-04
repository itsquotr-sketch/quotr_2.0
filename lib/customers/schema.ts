import { z } from "zod";

const optionalEmail = z
  .string()
  .trim()
  .max(254, "Email must be 254 characters or less")
  .optional()
  .refine(
    (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Enter a valid email address"
  );

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Customer name is required")
    .max(160, "Customer name must be 160 characters or less"),
  email: optionalEmail,
  phone: z
    .string()
    .trim()
    .max(40, "Phone must be 40 characters or less")
    .optional(),
  notes: z
    .string()
    .trim()
    .max(5000, "Notes must be 5000 characters or less")
    .optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}
