/**
 * Supplier drafts are included only from these categories.
 * A commercial key is not a supplier category. Free text in an allowed
 * category is still held back when it matches this project's private
 * records or contains contact details, a price, or a margin.
 */
export const DRAFT_SOURCE_CATEGORIES = [
  "project_description",
  "work_area_details",
  "work_area_description",
  "captured_specification",
  "measured_quantity",
  "work_area_fact",
  "measurement_note",
  "site_note",
] as const;

export type DraftSourceCategory = (typeof DRAFT_SOURCE_CATEGORIES)[number];

export type PrivateProjectRecords = {
  clientNames: string[];
  emails: string[];
  internalNotes: string[];
};

const COMMERCIAL_LABEL = /\b(cost|sell|margin|markup|profit|price|gst|client|email|phone)\b/i;

export function isSupplierFactLabel(key: string, label: string): boolean {
  return !COMMERCIAL_LABEL.test(`${key} ${label}`);
}

export function withholdReason(text: string, records: PrivateProjectRecords): string | null {
  const haystack = text.toLowerCase();
  for (const name of records.clientNames) {
    const trimmed = name.trim();
    if (trimmed.length >= 3 && haystack.includes(trimmed.toLowerCase())) {
      return "It matches the client name on this project.";
    }
  }
  for (const email of records.emails) {
    const trimmed = email.trim().toLowerCase();
    if (trimmed.includes("@") && haystack.includes(trimmed)) {
      return "It matches the client email on this project.";
    }
  }
  for (const note of records.internalNotes) {
    const trimmed = note.trim().replace(/\s+/g, " ");
    if (trimmed.length >= 12 && haystack.includes(trimmed.toLowerCase())) {
      return "It matches an internal project note.";
    }
  }
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return "It contains an email address.";
  if (hasPhone(text)) return "It contains a phone number.";
  if (/\$\s?\d|\b(?:nzd|aud)\s?\d/i.test(text)) return "It contains a price.";
  if (/\b(?:margin|markup)\b/i.test(text) && /\d/.test(text)) return "It contains a margin.";
  return null;
}

function hasPhone(text: string): boolean {
  const matches = text.match(/(?:\+\d{8,15}|\b0\d[\d\s()-]{6,}\d)/g) ?? [];
  return matches.some((match) => match.replace(/\D/g, "").length >= 8);
}

export type AnswerPrivacy = {
  names: string[];
  emails: string[];
  phones: string[];
  question: string;
};

/** A shared answer is stored exactly as written. Private question details block it. */
export function sharedAnswerLeak(body: string, privacy: AnswerPrivacy): string | null {
  const haystack = body.toLowerCase();
  for (const name of privacy.names) {
    const trimmed = name.trim();
    if (trimmed.length >= 3 && haystack.includes(trimmed.toLowerCase())) {
      return "Remove the asking business or contact from the message every recipient will see.";
    }
  }
  const emails = new Set<string>(privacy.emails.map((email) => email.trim().toLowerCase()).filter((email) => email.includes("@")));
  for (const match of privacy.question.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []) emails.add(match.toLowerCase());
  for (const email of emails) {
    if (haystack.includes(email)) return "Remove the email address from the message every recipient will see.";
  }
  const phones = new Set<string>();
  for (const phone of privacy.phones) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 8) phones.add(digits);
  }
  for (const match of privacy.question.match(/(?:\+\d{8,15}|\b0\d[\d\s()-]{6,}\d)/g) ?? []) {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 8) phones.add(digits);
  }
  const bodyDigits = body.replace(/\D/g, "");
  for (const phone of phones) {
    if (bodyDigits.includes(phone)) return "Remove the phone number from the message every recipient will see.";
  }
  for (const match of privacy.question.match(/\$\s?\d[\d,]*(?:\.\d+)?/g) ?? []) {
    if (body.includes(match.replace(/\s/g, "")) || body.includes(match)) {
      return "Remove the price from the question before sending this message to every recipient.";
    }
  }
  return null;
}
