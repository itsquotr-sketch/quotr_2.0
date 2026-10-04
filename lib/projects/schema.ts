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
  client_email: z
    .string()
    .trim()
    .max(254, "Email must be 254 characters or less")
    .optional()
    .refine(
      (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Enter a valid email address"
    ),
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

export const createProjectInputSchema = projectDetailsSchema
  .extend({
    customer_mode: z.enum(["none", "existing", "new"]).default("none"),
    customer_id: z.string().uuid().optional(),
    customer_phone: z
      .string()
      .trim()
      .max(40, "Phone must be 40 characters or less")
      .optional(),
    creation_request_id: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.customer_mode === "existing" && !value.customer_id) {
      ctx.addIssue({
        code: "custom",
        path: ["customer_id"],
        message: "Choose a customer",
      });
    }
    if (value.customer_mode === "new") {
      if (!value.client_name?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["client_name"],
          message: "Customer name is required",
        });
      }
      if (!value.creation_request_id) {
        ctx.addIssue({
          code: "custom",
          path: ["creation_request_id"],
          message: "Start the job again",
        });
      }
    }
  });

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export const updateProjectDetailsSchema = projectDetailsSchema.extend({
  customer_id: z.string().uuid().nullable().optional(),
});
