/**
 * Frozen expectations for the complete-assembly proof.
 * These numbers were written from the stated inputs before any hosted run.
 */
import { planCarpetTilePurchase } from "../lib/estimate/flooring-carpet-tile";
import {
  laminateAncillaryPurchase,
  laminateFinishPurchase,
} from "../lib/estimate/flooring-laminate";

const laminateNet = 20;
const laminateWaste = 10;
const laminateSupply = laminateFinishPurchase({
  netM2: laminateNet,
  wastePercent: laminateWaste,
  packCoverageM2: null,
});
const underlay = laminateAncillaryPurchase({
  netM2: laminateNet,
  coverageM2: null,
  kind: "underlay",
});
const moisture = laminateAncillaryPurchase({
  netM2: laminateNet,
  coverageM2: null,
  kind: "moisture",
});
const laminateHours = laminateNet * 0.2;
const laminate = {
  supply: laminateSupply,
  underlay,
  moisture,
  hours: laminateHours,
  cost:
    laminateSupply.quantity * 40 +
    underlay.quantity * 8 +
    moisture.quantity * 3 +
    laminateHours * 75,
};
laminate.sell = laminate.cost * 1.25;

const carpet48 = planCarpetTilePurchase({
  netM2: 12,
  wastePercent: 0,
  tileWidthMm: 500,
  tileLengthMm: 500,
  roomLengthM: 4,
  roomWidthM: 3,
  boxCoverageM2: null,
  tilesPerBox: null,
});
const carpet56 = planCarpetTilePurchase({
  netM2: 14,
  wastePercent: 0,
  tileWidthMm: 500,
  tileLengthMm: 500,
  roomLengthM: 4,
  roomWidthM: 3.5,
  boxCoverageM2: null,
  tilesPerBox: null,
});

const tileRate = 8;
const adhesiveRate = 2.5;
const hoursPerM2 = 0.15;
const carpenter = 75;
const margin = 1.25;

function money(tiles: number, netM2: number) {
  const adhesiveCost = netM2 * adhesiveRate;
  const installHours = netM2 * hoursPerM2;
  const installCost = installHours * carpenter;
  const supplyCost = tiles * tileRate;
  const cost = supplyCost + adhesiveCost + installCost;
  return {
    tiles,
    netM2,
    adhesiveM2: netM2,
    hours: installHours,
    supplyCost,
    adhesiveCost,
    installCost,
    cost,
    sell: cost * margin,
  };
}

const carpet = {
  beforeRate: {
    tiles: carpet48?.quantity,
    unit: carpet48?.unit,
    adhesiveCost: 12 * adhesiveRate,
    installCost: 1.8 * carpenter,
  },
  afterRate: money(48, 12),
  quantityChange: money(56, 14),
};

const expected = {
  laminate: {
    supplyQty: 22,
    supplyUnit: "m2",
    underlayQty: 20,
    moistureQty: 20,
    hours: 4,
    cost: 1400,
    sell: 1750,
  },
  carpet: {
    quantity: 48,
    changedQuantity: 56,
    unit: "tile",
    cost: 549,
    sell: 686.25,
  },
};

const ok =
  laminateSupply.quantity === expected.laminate.supplyQty &&
  laminateSupply.unit === expected.laminate.supplyUnit &&
  underlay.quantity === expected.laminate.underlayQty &&
  moisture.quantity === expected.laminate.moistureQty &&
  laminateHours === expected.laminate.hours &&
  laminate.cost === expected.laminate.cost &&
  laminate.sell === expected.laminate.sell &&
  carpet48?.quantity === expected.carpet.quantity &&
  carpet48?.unit === expected.carpet.unit &&
  carpet56?.quantity === expected.carpet.changedQuantity &&
  carpet.afterRate.cost === expected.carpet.cost &&
  carpet.afterRate.sell === expected.carpet.sell;

console.log(JSON.stringify({ ok, laminate, carpet }, null, 2));
if (!ok) process.exit(1);
