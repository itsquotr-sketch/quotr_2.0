import type { enrichExtractionFromBrief } from "@/lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "@/lib/ai/schema";

export type BriefExtractionResult = {
  output: AIExtractionOutput;
  qualityLevel: ReturnType<typeof enrichExtractionFromBrief>["qualityLevel"];
  constraints: ReturnType<typeof enrichExtractionFromBrief>["constraints"];
};
