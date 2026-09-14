import { round2 } from "@/lib/estimate/facts";

function isPositive(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

function roundLm(value: number): number {
  return round2(value);
}

function roundArea(value: number): number {
  return round2(value);
}

function roundVolume(value: number): number {
  return round2(value);
}

function roundLitres(value: number): number {
  return round2(value);
}

export type DeckingBoardLmResult = {
  baseLm: number;
  wastageLm: number;
  totalLm: number;
};

export function calculateDeckingBoardLm(input: {
  areaM2?: number | null;
  boardWidthMm?: number | null;
  wastagePercent?: number | null;
}): DeckingBoardLmResult | null {
  if (!isPositive(input.areaM2) || !isPositive(input.boardWidthMm)) {
    return null;
  }

  const wastagePercent = Math.max(0, input.wastagePercent ?? 0);
  const boardWidthM = input.boardWidthMm / 1000;
  const baseLm = roundLm(input.areaM2 / boardWidthM);
  const wastageLm = roundLm(baseLm * (wastagePercent / 100));
  const totalLm = roundLm(baseLm + wastageLm);

  return { baseLm, wastageLm, totalLm };
}

export type SheetCountResult = {
  sheetAreaM2: number;
  baseSheetCount: number;
  totalSheetCount: number;
};

/**
 * Area-based installed/purchase sheet (or tile) count.
 *
 * Requires explicit sheet dimensions — no hidden 2400×1200 / 3000×1200.
 * Installed = ceil(area / sheetArea − epsilon).
 * Purchase = ceil(installedPerLayer × (1 + waste) − epsilon) × layers.
 * Waste is applied once per layer, then multiplied by layer count.
 *
 * Distinct from calculateSheetCount, which rounds the area ratio and
 * defaults missing sheet size to 2.4 × 1.2 (legacy fitout package helper).
 */
export const AREA_SHEET_COUNT_EPSILON = 1e-12;

export type CoveredAreaSheetCount = {
  readonly sheetAreaM2: number;
  readonly installedSheetsPerLayer: number;
  readonly purchaseSheetsPerLayer: number;
  readonly installedSheets: number;
  readonly purchaseSheets: number;
  readonly wasteFactor: number;
  readonly layerCount: number;
};

export function countCoveredAreaSheets(input: {
  areaM2: number;
  sheetLengthM: number;
  sheetWidthM: number;
  wastagePercent: number;
  layerCount?: number;
  epsilon?: number;
}): CoveredAreaSheetCount | null {
  if (!isPositive(input.areaM2)) return null;
  if (!isPositive(input.sheetLengthM) || !isPositive(input.sheetWidthM)) {
    return null;
  }
  if (!Number.isFinite(input.wastagePercent) || input.wastagePercent < 0) {
    return null;
  }
  const layerCount = input.layerCount ?? 1;
  if (!Number.isFinite(layerCount) || layerCount < 1) return null;
  const epsilon = input.epsilon ?? AREA_SHEET_COUNT_EPSILON;
  const sheetAreaM2 = input.sheetLengthM * input.sheetWidthM;
  const installedSheetsPerLayer = Math.ceil(input.areaM2 / sheetAreaM2 - epsilon);
  if (installedSheetsPerLayer < 1) return null;
  const wasteFactor = input.wastagePercent / 100;
  const purchaseSheetsPerLayer = Math.ceil(
    installedSheetsPerLayer * (1 + wasteFactor) - epsilon
  );
  return {
    sheetAreaM2,
    installedSheetsPerLayer,
    purchaseSheetsPerLayer,
    installedSheets: installedSheetsPerLayer * layerCount,
    purchaseSheets: purchaseSheetsPerLayer * layerCount,
    wasteFactor,
    layerCount,
  };
}

export function calculateSheetCount(input: {
  areaM2?: number | null;
  sheetLengthM?: number;
  sheetWidthM?: number;
  wastagePercent?: number | null;
}): SheetCountResult | null {
  if (!isPositive(input.areaM2)) {
    return null;
  }

  const sheetLengthM = input.sheetLengthM ?? 2.4;
  const sheetWidthM = input.sheetWidthM ?? 1.2;
  if (!isPositive(sheetLengthM) || !isPositive(sheetWidthM)) {
    return null;
  }

  const wastagePercent = Math.max(0, input.wastagePercent ?? 0);
  const sheetAreaM2 = roundArea(sheetLengthM * sheetWidthM);
  const baseSheetCount = round2(input.areaM2 / sheetAreaM2);
  const totalSheetCount = Math.ceil(baseSheetCount * (1 + wastagePercent / 100));

  return { sheetAreaM2, baseSheetCount, totalSheetCount };
}

export type FlooringAreaResult = {
  baseAreaM2: number;
  totalAreaM2: number;
};

export function calculateFlooringAreaWithWastage(input: {
  areaM2?: number | null;
  wastagePercent?: number | null;
}): FlooringAreaResult | null {
  if (!isPositive(input.areaM2)) {
    return null;
  }

  const wastagePercent = Math.max(0, input.wastagePercent ?? 0);
  const baseAreaM2 = roundArea(input.areaM2);
  const totalAreaM2 = roundArea(baseAreaM2 * (1 + wastagePercent / 100));

  return { baseAreaM2, totalAreaM2 };
}

export function calculateBackfillVolume(input: {
  lengthM?: number | null;
  heightM?: number | null;
  averageHeightM?: number | null;
  depthM?: number | null;
}): number | null {
  if (!isPositive(input.lengthM) || !isPositive(input.depthM)) {
    return null;
  }

  const height = input.heightM ?? input.averageHeightM;
  if (!isPositive(height)) {
    return null;
  }

  return roundVolume(input.lengthM * height * input.depthM);
}

export type DrainageLmResult = {
  novacoilLm: number;
  sleeveIncluded: true;
};

export function calculateDrainageLm(input: {
  wallLengthM?: number | null;
  wastagePercent?: number | null;
}): DrainageLmResult | null {
  if (!isPositive(input.wallLengthM)) {
    return null;
  }

  const wastagePercent = Math.max(0, input.wastagePercent ?? 0);
  const novacoilLm = roundLm(input.wallLengthM * (1 + wastagePercent / 100));

  return { novacoilLm, sleeveIncluded: true };
}

export type LinealMetresResult = {
  baseLm: number;
  totalLm: number;
};

export function calculateLinealMetresWithWastage(input: {
  lengthLm?: number | null;
  wastagePercent?: number | null;
}): LinealMetresResult | null {
  if (!isPositive(input.lengthLm)) {
    return null;
  }

  const wastagePercent = Math.max(0, input.wastagePercent ?? 0);
  const baseLm = roundLm(input.lengthLm);
  const totalLm = roundLm(baseLm * (1 + wastagePercent / 100));

  return { baseLm, totalLm };
}

export type PaintLitresResult = {
  baseLitres: number;
  totalLitres: number;
};

export function calculatePaintLitres(input: {
  areaM2?: number | null;
  coats?: number | null;
  coverageM2PerLitre?: number;
  wastagePercent?: number | null;
}): PaintLitresResult | null {
  if (!isPositive(input.areaM2) || !isPositive(input.coats)) {
    return null;
  }

  const coverage = input.coverageM2PerLitre ?? 10;
  if (!isPositive(coverage)) {
    return null;
  }

  const wastagePercent = Math.max(0, input.wastagePercent ?? 0);
  const baseLitres = roundLitres((input.areaM2 * input.coats) / coverage);
  const totalLitres = roundLitres(baseLitres * (1 + wastagePercent / 100));

  return { baseLitres, totalLitres };
}
