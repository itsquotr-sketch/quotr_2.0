import type {
  DeckingBoardLmResult,
  DrainageLmResult,
  FlooringAreaResult,
  LinealMetresResult,
  PaintLitresResult,
  SheetCountResult,
} from "@/lib/estimate/material-buildups";
import type { EstimateLineItemInput } from "@/lib/estimate/types";

export type MaterialBuildUpType =
  | "decking_boards_lm"
  | "sheet_material_count"
  | "flooring_area"
  | "backfill_volume"
  | "drainage_lm"
  | "lineal_metres"
  | "paint_litres";

export type MaterialBuildUpEntry = {
  key: string;
  label: string;
  quantity?: number;
  unit?: string;
  wastagePercent?: number;
  basis?: string;
  display: string;
  priced: boolean;
  pricingBasis?: "quantity_x_rate";
  rateUnit?: string;
  buildUpType?: MaterialBuildUpType;
  inputs?: Record<string, number | boolean | string>;
  outputs?: Record<string, number | boolean>;
};

/** @deprecated Use MaterialBuildUpEntry — kept for backward compatibility */
export type MaterialBuildUpMetadata = MaterialBuildUpEntry;

export function withMaterialBuildUp(
  item: EstimateLineItemInput,
  buildUp: MaterialBuildUpEntry | null | undefined
): EstimateLineItemInput {
  if (!buildUp) {
    return item;
  }
  const existing = item.materialBuildUps ?? [];
  return {
    ...item,
    materialBuildUp: buildUp,
    materialBuildUps: [...existing, buildUp],
  };
}

export function isSheetMaterialLining(
  liningType: string | null | undefined
): boolean {
  if (!liningType) {
    return false;
  }
  const lower = liningType.toLowerCase();
  return (
    lower.includes("plasterboard") ||
    lower.includes("plywood") ||
    lower.includes("fibre cement") ||
    lower.includes("sheet")
  );
}

export function sheetMaterialLabel(
  liningType: string | null | undefined
): string {
  if (!liningType) {
    return "sheet material";
  }
  const lower = liningType.toLowerCase();
  if (lower.includes("plasterboard")) {
    return "plasterboard";
  }
  if (lower.includes("plywood")) {
    return "plywood";
  }
  if (lower.includes("fibre cement")) {
    return "fibre cement";
  }
  return liningType.toLowerCase();
}

export function createDeckingBoardBuildUp(params: {
  result: DeckingBoardLmResult;
  areaM2: number;
  boardWidthMm: number;
  wastagePercent: number;
  materialLabel?: string;
}): MaterialBuildUpEntry {
  const material = params.materialLabel ?? "decking";
  const basis = `${params.areaM2}m² deck / ${params.boardWidthMm}mm board width`;

  return {
    key: "decking_boards",
    label: `${material} decking boards`,
    quantity: params.result.totalLm,
    unit: "lm",
    wastagePercent: params.wastagePercent,
    basis,
    display: `Approx. ${params.result.totalLm} lm ${material} decking boards incl. ${params.wastagePercent}% wastage`,
    priced: false,
    buildUpType: "decking_boards_lm",
    inputs: {
      areaM2: params.areaM2,
      boardWidthMm: params.boardWidthMm,
      wastagePercent: params.wastagePercent,
      materialLabel: material,
    },
    outputs: {
      baseLm: params.result.baseLm,
      wastageLm: params.result.wastageLm,
      totalLm: params.result.totalLm,
    },
  };
}

export function createSheetCountBuildUp(params: {
  result: SheetCountResult;
  areaM2: number;
  wastagePercent: number;
  materialLabel: string;
  sheetLengthM?: number;
  sheetWidthM?: number;
}): MaterialBuildUpEntry {
  const sheetLengthM = params.sheetLengthM ?? 2.4;
  const sheetWidthM = params.sheetWidthM ?? 1.2;

  return {
    key: "sheet_count",
    label: `${params.materialLabel} sheets`,
    quantity: params.result.totalSheetCount,
    unit: "each",
    wastagePercent: params.wastagePercent,
    basis: `${params.areaM2}m² lining area`,
    display: `Approx. ${params.result.totalSheetCount} ${params.materialLabel} sheets, ${sheetLengthM}m x ${sheetWidthM}m, incl. ${params.wastagePercent}% wastage`,
    priced: false,
    buildUpType: "sheet_material_count",
    inputs: {
      areaM2: params.areaM2,
      sheetLengthM,
      sheetWidthM,
      wastagePercent: params.wastagePercent,
      materialLabel: params.materialLabel,
    },
    outputs: {
      sheetAreaM2: params.result.sheetAreaM2,
      baseSheetCount: params.result.baseSheetCount,
      totalSheetCount: params.result.totalSheetCount,
    },
  };
}

export function createFlooringAreaBuildUp(params: {
  result: FlooringAreaResult;
  wastagePercent: number;
}): MaterialBuildUpEntry {
  return {
    key: "flooring_area",
    label: "Flooring",
    quantity: params.result.totalAreaM2,
    unit: "m2",
    wastagePercent: params.wastagePercent,
    display: `Approx. ${params.result.totalAreaM2} m² flooring incl. ${params.wastagePercent}% wastage`,
    priced: false,
    buildUpType: "flooring_area",
    inputs: {
      areaM2: params.result.baseAreaM2,
      wastagePercent: params.wastagePercent,
    },
    outputs: {
      baseAreaM2: params.result.baseAreaM2,
      totalAreaM2: params.result.totalAreaM2,
    },
  };
}

export function createBackfillVolumeBuildUp(params: {
  volumeM3: number;
  lengthM: number;
  heightM: number;
  depthM: number;
}): MaterialBuildUpEntry {
  return {
    key: "backfill_volume",
    label: "Backfill",
    quantity: params.volumeM3,
    unit: "m3",
    basis: `${params.lengthM}m × ${params.heightM}m × ${params.depthM}m`,
    display: `Backfill: approx. ${params.volumeM3} m³`,
    priced: false,
    buildUpType: "backfill_volume",
    inputs: {
      lengthM: params.lengthM,
      heightM: params.heightM,
      depthM: params.depthM,
    },
    outputs: {
      volumeM3: params.volumeM3,
    },
  };
}

export function createDrainageBuildUp(params: {
  result: DrainageLmResult;
  wallLengthM: number;
  wastagePercent: number;
}): MaterialBuildUpEntry {
  return {
    key: "drainage_novacoil",
    label: "Novacoil drainage",
    quantity: params.result.novacoilLm,
    unit: "lm",
    wastagePercent: params.wastagePercent,
    basis: `${params.wallLengthM}m wall length`,
    display: `Approx. ${params.result.novacoilLm} m novacoil drainage (sleeve included)`,
    priced: false,
    buildUpType: "drainage_lm",
    inputs: {
      wallLengthM: params.wallLengthM,
      wastagePercent: params.wastagePercent,
    },
    outputs: {
      novacoilLm: params.result.novacoilLm,
      sleeveIncluded: params.result.sleeveIncluded,
    },
  };
}

export function createLinealMetresBuildUp(params: {
  result: LinealMetresResult;
  wastagePercent: number;
  label: string;
}): MaterialBuildUpEntry {
  return {
    key: "lineal_metres",
    label: params.label,
    quantity: params.result.totalLm,
    unit: "lm",
    wastagePercent: params.wastagePercent,
    display: `Approx. ${params.result.totalLm} lm ${params.label} incl. ${params.wastagePercent}% wastage`,
    priced: false,
    buildUpType: "lineal_metres",
    inputs: {
      lengthLm: params.result.baseLm,
      wastagePercent: params.wastagePercent,
      label: params.label,
    },
    outputs: {
      baseLm: params.result.baseLm,
      totalLm: params.result.totalLm,
    },
  };
}

export function createPaintLitresBuildUp(params: {
  result: PaintLitresResult;
  areaM2: number;
  coats: number;
  wastagePercent: number;
}): MaterialBuildUpEntry {
  return {
    key: "paint_litres",
    label: "Paint allowance",
    quantity: params.result.totalLitres,
    unit: "l",
    wastagePercent: params.wastagePercent,
    basis: `${params.areaM2}m² · ${params.coats} coat(s)`,
    display: `Paint: approx. ${params.result.totalLitres}L incl. wastage`,
    priced: false,
    buildUpType: "paint_litres",
    inputs: {
      areaM2: params.areaM2,
      coats: params.coats,
      coverageM2PerLitre: 10,
      wastagePercent: params.wastagePercent,
    },
    outputs: {
      baseLitres: params.result.baseLitres,
      totalLitres: params.result.totalLitres,
    },
  };
}

export function createFenceScopeBuildUp(params: {
  lengthLm: number;
  heightM: number | null;
  materialLabel: string;
}): MaterialBuildUpEntry {
  const heightPhrase = params.heightM ? `${params.heightM} m high` : "";
  return {
    key: "fence_scope",
    label: "Fence scope",
    quantity: params.lengthLm,
    unit: "lm",
    basis: heightPhrase
      ? `${params.lengthLm} lm × ${params.heightM} m`
      : `${params.lengthLm} lm`,
    display: heightPhrase
      ? `Approx. ${params.lengthLm} lm ${params.materialLabel} fence at ${heightPhrase}`
      : `Approx. ${params.lengthLm} lm ${params.materialLabel} fence`,
    priced: false,
    buildUpType: "lineal_metres",
    inputs: {
      lengthLm: params.lengthLm,
      heightM: params.heightM ?? 0,
      materialLabel: params.materialLabel,
    },
    outputs: {
      lengthLm: params.lengthLm,
    },
  };
}

export function createPergolaAreaBuildUp(params: {
  areaM2: number;
  materialLabel: string;
  attached: string | null;
}): MaterialBuildUpEntry {
  const attachment = params.attached?.toLowerCase() ?? "";
  const typePhrase = attachment.includes("free")
    ? "freestanding"
    : attachment.includes("attach")
      ? "attached"
      : "pergola";
  return {
    key: "pergola_area",
    label: "Pergola frame",
    quantity: params.areaM2,
    unit: "m2",
    display: `Approx. ${params.areaM2} m² ${params.materialLabel} ${typePhrase} pergola frame`,
    priced: false,
    buildUpType: "flooring_area",
    inputs: {
      areaM2: params.areaM2,
      materialLabel: params.materialLabel,
      attached: params.attached ?? "",
    },
    outputs: {
      areaM2: params.areaM2,
    },
  };
}
