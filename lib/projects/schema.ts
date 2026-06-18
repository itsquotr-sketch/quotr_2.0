import { z } from "zod";

export const projectDetailsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Project title is required")
    .max(120, "Title must be 120 characters or less"),
  client_name: z
    .string()
    .trim()
    .max(160, "Client name must be 160 characters or less")
    .optional(),
  site_address: z
    .string()
    .trim()
    .max(300, "Site address must be 300 characters or less")
    .optional(),
  brief_text: z
    .string()
    .trim()
    .max(5000, "Brief must be 5000 characters or less")
    .optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  due_date: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Due date must be a valid date"
    ),
  notes: z
    .string()
    .trim()
    .max(5000, "Notes must be 5000 characters or less")
    .optional(),
});

export type ProjectDetailsInput = z.infer<typeof projectDetailsSchema>;
