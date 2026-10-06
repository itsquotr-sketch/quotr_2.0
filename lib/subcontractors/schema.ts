import { z } from "zod";
import { isServiceRegionCode } from "@/lib/subcontractors/regions";
import {
  GST_REGISTRATIONS,
  PREFERRED_CONTACT_METHODS,
  SUBCONTRACTOR_COUNTRY_CODES,
  SUBCONTRACTOR_PRICING_METHODS,
} from "@/lib/subcontractors/types";
import { isSubcontractorWorkAreaType } from "@/lib/subcontractors/work-areas";

const optionalEmail = z
  .string()
  .trim()
  .max(254, "Email must be 254 characters or less")
  .optional()
  .refine(
    (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Enter a valid email address"
  );

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional();

export const subcontractorContactSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Contact name is required")
    .max(160, "Contact name must be 160 characters or less"),
  role: optionalText(80, "Role must be 80 characters or less"),
  email: optionalEmail,
  phone: optionalText(40, "Phone must be 40 characters or less"),
  is_primary: z.boolean(),
  preferred_contact: z.enum(PREFERRED_CONTACT_METHODS).optional(),
});

export const subcontractorSchema = z
  .object({
    id: z.string().uuid().optional(),
    trading_name: z
      .string()
      .trim()
      .min(1, "Trading name is required")
      .max(160, "Trading name must be 160 characters or less"),
    legal_name: optionalText(160, "Legal name must be 160 characters or less"),
    website: optionalText(300, "Website must be 300 characters or less"),
    country_code: z.enum(SUBCONTRACTOR_COUNTRY_CODES).optional(),
    address_line_1: optionalText(200, "Street address must be 200 characters or less"),
    address_line_2: optionalText(200, "Address line 2 must be 200 characters or less"),
    address_city: optionalText(80, "City must be 80 characters or less"),
    address_region: optionalText(80, "Region must be 80 characters or less"),
    address_postcode: optionalText(12, "Postcode must be 12 characters or less"),
    service_regions: z
      .array(z.string().trim().min(1).max(80))
      .max(20, "Add up to 20 service regions"),
    service_region_other_labels: z
      .array(
        z
          .string()
          .trim()
          .min(1, "Other area cannot be blank")
          .max(80, "Each other area must be 80 characters or less")
      )
      .max(20, "Add up to 20 other areas")
      .default([]),
    work_area_types: z
      .array(z.string().trim().min(1))
      .max(30, "Choose up to 30 work areas"),
    specialties: optionalText(500, "Services offered must be 500 characters or less"),
    internal_notes: optionalText(5000, "Notes must be 5000 characters or less"),
    preferred_pricing_method: z.enum(SUBCONTRACTOR_PRICING_METHODS).optional(),
    currency: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || /^[A-Za-z]{3}$/.test(value),
        "Currency must be a 3-letter code"
      ),
    abn: optionalText(20, "ABN must be 20 characters or less"),
    nzbn: optionalText(20, "NZBN must be 20 characters or less"),
    gst_registration: z.enum(GST_REGISTRATIONS).optional(),
    gst_number: optionalText(20, "GST number must be 20 characters or less"),
    minimum_charge_notes: optionalText(
      2000,
      "Minimum charge notes must be 2000 characters or less"
    ),
    travel_notes: optionalText(2000, "Travel notes must be 2000 characters or less"),
    contacts: z.array(subcontractorContactSchema).max(30, "Add up to 30 contacts"),
  })
  .superRefine((value, ctx) => {
    const seenAreas = new Set<string>();
    value.work_area_types.forEach((type, index) => {
      if (!isSubcontractorWorkAreaType(type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["work_area_types", index],
          message: "Choose a work area from the list",
        });
      }
      if (seenAreas.has(type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["work_area_types", index],
          message: "Each work area can be selected once",
        });
      }
      seenAreas.add(type);
    });

    const seenRegions = new Set<string>();
    value.service_regions.forEach((region, index) => {
      if (!isServiceRegionCode(region)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["service_regions", index],
          message: "Choose a service region from the list",
        });
      }
      if (seenRegions.has(region)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["service_regions", index],
          message: "Each service region can be selected once",
        });
      }
      seenRegions.add(region);
    });

    const hasOtherLabel = value.service_region_other_labels.length > 0;
    if (hasOtherLabel && !value.service_regions.includes("other")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["service_region_other_labels"],
        message: "Choose Other before adding a custom area",
      });
    }

    const primaries = value.contacts.filter((contact) => contact.is_primary);
    if (primaries.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contacts"],
        message: "Choose one primary contact",
      });
    }

    const contactIds = value.contacts.flatMap((contact) =>
      contact.id ? [contact.id] : []
    );
    if (new Set(contactIds).size !== contactIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contacts"],
        message: "Each contact can only be saved once",
      });
    }
  });

export type SubcontractorInput = z.infer<typeof subcontractorSchema>;

export function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}
