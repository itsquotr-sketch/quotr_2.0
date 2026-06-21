import {
  getProjectNoteSourceLabel,
  getProjectNoteTypeLabel,
  type ProjectNote,
  type ProjectNoteAnalysisStatus,
  type ProjectNoteSource,
  type ProjectNoteType,
} from "@/lib/project-notes/types";

type DbProjectNote = {
  id: string;
  project_id: string;
  content: string;
  note_type: string;
  source: string;
  captured_by: string | null;
  captured_at: string;
  updated_at: string;
  analysis_status: string;
};

export function mapProjectNote(row: DbProjectNote): ProjectNote {
  return {
    id: row.id,
    projectId: row.project_id,
    content: row.content,
    noteType: row.note_type as ProjectNoteType,
    noteTypeLabel: getProjectNoteTypeLabel(row.note_type),
    source: row.source as ProjectNoteSource,
    sourceLabel: getProjectNoteSourceLabel(row.source),
    capturedBy: row.captured_by,
    capturedAt: row.captured_at,
    updatedAt: row.updated_at,
    analysisStatus: row.analysis_status as ProjectNoteAnalysisStatus,
  };
}
