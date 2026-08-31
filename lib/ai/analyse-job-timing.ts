import { shouldLogAnalyseJobTiming } from "@/lib/ai/analyse-job-contract";

export type AnalyseJobTimingMarks = Record<string, number>;

export function startAnalyseJobTiming(): {
  mark: (name: string) => void;
  marks: AnalyseJobTimingMarks;
  elapsed: () => number;
} {
  const t0 = Date.now();
  const marks: AnalyseJobTimingMarks = { T0: 0 };

  return {
    marks,
    mark(name: string) {
      marks[name] = Date.now() - t0;
    },
    elapsed() {
      return Date.now() - t0;
    },
  };
}

export function logAnalyseJobTiming(input: {
  marks: AnalyseJobTimingMarks;
  errorClass?: string | null;
  success: boolean;
}): void {
  if (!shouldLogAnalyseJobTiming()) return;
  console.info("[analyse-job-timing]", {
    success: input.success,
    errorClass: input.errorClass ?? null,
    marks: input.marks,
    totalMs: input.marks.T13 ?? input.marks.T12 ?? null,
  });
}
