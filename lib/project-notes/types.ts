export type ProjectNoteType =
  | "general"
  | "measurement"
  | "access"
  | "client_request"
  | "existing_condition"
  | "material_preference"
  | "exclusion"
  | "risk"
  | "calibration_note"
  | "other";

/** Internal note types excluded from AI brief/note analysis and client quotes. */
export const INTERNAL_PROJECT_NOTE_TYPES: ProjectNoteType[] = [
  "calibration_note",
];

export type ProjectNoteSource =
  | "site_walk"
  | "phone_call"
  | "desktop_note"
  | "voice_to_text"
  | "photo_caption"
  | "other";

export type ProjectNoteAnalysisStatus = "pending" | "analysed" | "dismissed";

export const PROJECT_NOTE_TYPE_LABELS: Record<ProjectNoteType, string> = {
  general: "General note",
  measurement: "Measurement",
  access: "Access issue",
  client_request: "Client request",
  existing_condition: "Existing condition",
  material_preference: "Material preference",
  exclusion: "Exclusion / not included",
  risk: "Risk / unknown",
  calibration_note: "Calibration / testing note",
  other: "Other",
};

export const PROJECT_NOTE_SOURCE_LABELS: Record<ProjectNoteSource, string> = {
  site_walk: "Site walk",
  phone_call: "Phone call",
  desktop_note: "Desktop note",
  voice_to_text: "Voice note",
  photo_caption: "Photo note",
  other: "Other",
};

/** Note types shown in the create/edit selector (excludes "other" from primary UI). */
export const PROJECT_NOTE_TYPE_OPTIONS: ProjectNoteType[] = [
  "general",
  "measurement",
  "access",
  "client_request",
  "existing_condition",
  "material_preference",
  "exclusion",
  "risk",
  "calibration_note",
];

export function isInternalProjectNote(noteType: string): boolean {
  return INTERNAL_PROJECT_NOTE_TYPES.includes(noteType as ProjectNoteType);
}

export type ProjectNote = {
  id: string;
  projectId: string;
  content: string;
  noteType: ProjectNoteType;
  noteTypeLabel: string;
  source: ProjectNoteSource;
  sourceLabel: string;
  capturedBy: string | null;
  capturedAt: string;
  updatedAt: string;
  analysisStatus: ProjectNoteAnalysisStatus;
};

export type ProjectNoteInput = {
  projectId: string;
  content: string;
  noteType: ProjectNoteType;
  source?: ProjectNoteSource;
};

export type ProjectNoteActionState =
  | { success: true; note?: ProjectNote }
  | { error: string };

export function getProjectNoteTypeLabel(noteType: string): string {
  return (
    PROJECT_NOTE_TYPE_LABELS[noteType as ProjectNoteType] ??
    PROJECT_NOTE_TYPE_LABELS.other
  );
}

export function getProjectNoteSourceLabel(source: string): string {
  return (
    PROJECT_NOTE_SOURCE_LABELS[source as ProjectNoteSource] ??
    PROJECT_NOTE_SOURCE_LABELS.other
  );
}
