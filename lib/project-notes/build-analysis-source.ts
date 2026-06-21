import { getProjectNoteTypeLabel } from "@/lib/project-notes/types";

export type NoteForAnalysis = {
  content: string;
  note_type: string;
  captured_at: string;
};

const ANALYSIS_INSTRUCTIONS = `Instructions:
Use both the project brief and site notes to identify work areas, quantities, materials, access constraints, existing conditions, exclusions and missing information.`;

/**
 * Builds structured source text for initial AI extraction from brief + raw notes.
 */
export function buildInitialAnalysisInput(params: {
  briefText: string;
  notes: NoteForAnalysis[];
}): string {
  const { briefText, notes } = params;
  const trimmedBrief = briefText.trim();

  const lines: string[] = [
    "Project brief:",
    trimmedBrief || "No separate project brief provided.",
  ];

  if (notes.length > 0) {
    lines.push("", "Site notes:");
    const ordered = [...notes].sort(
      (a, b) =>
        new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
    );
    ordered.forEach((note, index) => {
      const label = getProjectNoteTypeLabel(note.note_type);
      lines.push(`${index + 1}. [${label}] ${note.content.trim()}`);
    });
  }

  lines.push("", ANALYSIS_INSTRUCTIONS);
  return lines.join("\n");
}

/** @deprecated Use buildInitialAnalysisInput */
export function buildProjectAnalysisSource(
  briefText: string,
  notes: NoteForAnalysis[]
): string {
  return buildInitialAnalysisInput({ briefText, notes });
}
