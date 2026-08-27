"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { QuickSpecFactWrite } from "@/components/assistant/job-plan/DeckQuickSpecEditor";
import {
  jobPlanBoolean,
  jobPlanNumber,
  jobPlanString,
} from "@/lib/assistant/job-plan/facts";
import {
  RW_DIGGER_ACCESS_FACT,
  RW_DRAINAGE_SOCK_FACT,
  RW_PILE_MATERIAL_FACT,
  RW_PILE_MATERIAL_H5_SED,
  RW_PILE_MATERIAL_HOUSE_PILE_125,
} from "@/lib/estimate/retaining-wall-family-coverage";
import { classifyRetainingWallSystem } from "@/lib/estimate/retaining-wall-systems";
import type { EstimateFact } from "@/lib/estimate/types";

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function yesNo(value: boolean | null): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "";
}

function constraintString(
  constraints: readonly { key: string; value: unknown }[] | undefined,
  key: string
): string {
  const row = constraints?.find((item) => item.key === key);
  if (row == null || row.value == null || row.value === "") return "";
  return String(row.value);
}

export function RetainingWallQuickSpecEditor({
  workAreaId,
  facts,
  onSpecFact,
  constraints,
  onConstraint,
}: {
  workAreaId: string;
  facts: readonly EstimateFact[];
  onSpecFact?: QuickSpecFactWrite;
  constraints?: readonly { key: string; value: unknown }[];
  onConstraint?: (input: {
    key: string;
    label: string;
    value: string;
    inputType?: "select" | "boolean";
  }) => void;
}) {
  const material = jobPlanString(facts, workAreaId, "retaining_wall.material") ?? "";
  const system = classifyRetainingWallSystem(material);
  const length = jobPlanNumber(facts, workAreaId, "retaining_wall.length_m");
  const height = jobPlanNumber(facts, workAreaId, "retaining_wall.height_m");
  const high = jobPlanNumber(facts, workAreaId, "retaining_wall.height_high_m");
  const low = jobPlanNumber(facts, workAreaId, "retaining_wall.height_low_m");
  const raking = Boolean(high != null && low != null && high !== low);
  const faceBoard =
    jobPlanString(facts, workAreaId, "retaining_wall.face_board_section") ?? "";
  const spacing = jobPlanNumber(facts, workAreaId, "retaining_wall.post_spacing_m");
  const embedment = jobPlanNumber(facts, workAreaId, "retaining_wall.pile_embedment_m");
  const sleeperLength = jobPlanNumber(
    facts,
    workAreaId,
    "retaining_wall.sleeper_length_m"
  );
  const sleeperFace = jobPlanNumber(
    facts,
    workAreaId,
    "retaining_wall.sleeper_face_height_m"
  );
  const sleeperSpacing = jobPlanNumber(
    facts,
    workAreaId,
    "retaining_wall.sleeper_post_spacing_m"
  );
  const sleeperEmbedment = jobPlanNumber(
    facts,
    workAreaId,
    "retaining_wall.sleeper_post_embedment_m"
  );
  const drainage = jobPlanBoolean(facts, workAreaId, "retaining_wall.drainage_required");
  const drainageSock =
    jobPlanString(facts, workAreaId, RW_DRAINAGE_SOCK_FACT) ?? "";
  const pileMaterial =
    jobPlanString(facts, workAreaId, RW_PILE_MATERIAL_FACT) ?? "";
  const diggerAccess =
    jobPlanString(facts, workAreaId, RW_DIGGER_ACCESS_FACT) ?? "";
  const backfill = jobPlanBoolean(facts, workAreaId, "retaining_wall.backfill_included");
  const excavation = jobPlanBoolean(
    facts,
    workAreaId,
    "retaining_wall.excavation_required"
  );
  const excavationVolume = jobPlanNumber(
    facts,
    workAreaId,
    "retaining_wall.excavation_volume_m3"
  );
  const spoilRemoval = jobPlanBoolean(
    facts,
    workAreaId,
    "retaining_wall.disposal_included"
  );
  const spoilPortion =
    jobPlanString(facts, workAreaId, "retaining_wall.spoil_removal_portion") ?? "";
  const spoilVolume = jobPlanNumber(
    facts,
    workAreaId,
    "retaining_wall.spoil_removal_volume_m3"
  );
  const siteAccess = constraintString(constraints, "site_access");
  const carryDistance = constraintString(constraints, "material_carry_distance");

  return (
    <div className="grid gap-3" data-rw-quick-spec>
      <Group title="Wall">
        <div className="space-y-1">
          <Label htmlFor={`rw-material-${workAreaId}`}>Wall type</Label>
          <select
            id={`rw-material-${workAreaId}`}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
            value={material}
            onChange={(event) =>
              onSpecFact?.({
                workAreaId,
                key: "retaining_wall.material",
                label: "Wall type",
                value: event.target.value,
                valueType: "select",
              })
            }
          >
            <option value="">Not set</option>
            <option value="Timber">Timber</option>
            <option value="Concrete sleeper">Concrete sleeper</option>
            <option value="Masonry">Masonry</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`rw-length-${workAreaId}`}>Length (m)</Label>
          <Input
            id={`rw-length-${workAreaId}`}
            type="number"
            inputMode="decimal"
            step="0.01"
            defaultValue={length ?? ""}
            onBlur={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) return;
              onSpecFact?.({
                workAreaId,
                key: "retaining_wall.length_m",
                label: "Wall length",
                value: next,
                valueType: "number",
              });
            }}
          />
        </div>
        {raking ? (
          <>
            <div className="space-y-1">
              <Label htmlFor={`rw-high-${workAreaId}`}>High-end height (m)</Label>
              <Input
                id={`rw-high-${workAreaId}`}
                type="number"
                inputMode="decimal"
                step="0.01"
                defaultValue={high ?? ""}
                onBlur={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next)) return;
                  onSpecFact?.({
                    workAreaId,
                    key: "retaining_wall.height_high_m",
                    label: "High-end height",
                    value: next,
                    valueType: "number",
                  });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`rw-low-${workAreaId}`}>Low-end height (m)</Label>
              <Input
                id={`rw-low-${workAreaId}`}
                type="number"
                inputMode="decimal"
                step="0.01"
                defaultValue={low ?? ""}
                onBlur={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next)) return;
                  onSpecFact?.({
                    workAreaId,
                    key: "retaining_wall.height_low_m",
                    label: "Low-end height",
                    value: next,
                    valueType: "number",
                  });
                }}
              />
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <Label htmlFor={`rw-height-${workAreaId}`}>Height (m)</Label>
            <Input
              id={`rw-height-${workAreaId}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              defaultValue={height ?? high ?? ""}
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                onSpecFact?.({
                  workAreaId,
                  key: "retaining_wall.height_m",
                  label: "Wall height",
                  value: next,
                  valueType: "number",
                });
              }}
            />
          </div>
        )}
      </Group>

      {system === "TIMBER_RETAINING_WALL" ? (
        <Group title="Timber">
          <div className="space-y-1">
            <Label htmlFor={`rw-boards-${workAreaId}`}>Face boards</Label>
            <select
              id={`rw-boards-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={faceBoard}
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: "retaining_wall.face_board_section",
                  label: "Face boards",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">150×50 H4 (estimating default)</option>
              <option value="150×50 H4">150×50 H4</option>
              <option value="200×50 H4">200×50 H4</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`rw-pile-material-${workAreaId}`}>Post / pile material</Label>
            <select
              id={`rw-pile-material-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={pileMaterial || RW_PILE_MATERIAL_H5_SED}
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: RW_PILE_MATERIAL_FACT,
                  label: "Post / pile material",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value={RW_PILE_MATERIAL_H5_SED}>H5 SED retaining pole</option>
              <option value={RW_PILE_MATERIAL_HOUSE_PILE_125}>
                125×125 H5 house pile
              </option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Physical post count and length stay the same — only procurement identity
            and rate change. House pile uses stock-length $/lm; SED uses stock EA.
          </p>
        </Group>
      ) : null}

      {system === "CONCRETE_SLEEPER_WALL" ? (
        <Group title="Concrete sleeper">
          <div className="space-y-1">
            <Label htmlFor={`rw-sleeper-length-${workAreaId}`}>
              Sleeper length (m)
            </Label>
            <Input
              id={`rw-sleeper-length-${workAreaId}`}
              type="number"
              inputMode="decimal"
              step="0.05"
              placeholder="2.0 estimating default"
              defaultValue={sleeperLength ?? ""}
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next) || !(next > 0)) return;
                onSpecFact?.({
                  workAreaId,
                  key: "retaining_wall.sleeper_length_m",
                  label: "Sleeper length",
                  value: next,
                  valueType: "number",
                });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`rw-sleeper-face-${workAreaId}`}>
              Sleeper face height (m)
            </Label>
            <Input
              id={`rw-sleeper-face-${workAreaId}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.20 estimating default"
              defaultValue={sleeperFace ?? ""}
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next) || !(next > 0)) return;
                onSpecFact?.({
                  workAreaId,
                  key: "retaining_wall.sleeper_face_height_m",
                  label: "Sleeper face height",
                  value: next,
                  valueType: "number",
                });
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Defaults are 2000×200 mm class. Changing length recalculates bays and
            posts. Identities are estimating selections, not a manufacturer or
            engineering certificate.
          </p>
        </Group>
      ) : null}

      {system === "CONCRETE_MASONRY_WALL" ? (
        <Group title="Concrete masonry / Besser">
          <div className="space-y-1">
            <Label htmlFor={`rw-block-series-${workAreaId}`}>Block type</Label>
            <select
              id={`rw-block-series-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={
                jobPlanString(facts, workAreaId, "retaining_wall.block_series") ??
                ""
              }
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: "retaining_wall.block_series",
                  label: "Block type",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">200 mm concrete masonry (default)</option>
              <option value="200-series">200 mm concrete masonry</option>
              <option value="150-series">150 mm concrete masonry</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`rw-block-method-${workAreaId}`}>
              Blockwork delivery
            </Label>
            <select
              id={`rw-block-method-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={
                jobPlanString(
                  facts,
                  workAreaId,
                  "retaining_wall.block_laying_method"
                ) ?? ""
              }
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: "retaining_wall.block_laying_method",
                  label: "Blockwork delivery",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">Self-perform (company default)</option>
              <option value="Self-perform">Self-perform</option>
              <option value="Subcontract">Subcontract</option>
            </select>
          </div>
          {jobPlanString(
            facts,
            workAreaId,
            "retaining_wall.block_laying_method"
          )
            ?.toLowerCase()
            .includes("subcontract") ? (
            <div className="space-y-1">
              <Label htmlFor={`rw-block-sub-scope-${workAreaId}`}>
                Subcontractor provides
              </Label>
              <select
                id={`rw-block-sub-scope-${workAreaId}`}
                className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                value={
                  jobPlanString(
                    facts,
                    workAreaId,
                    "retaining_wall.masonry.subcontract_scope"
                  ) ?? ""
                }
                onChange={(event) =>
                  onSpecFact?.({
                    workAreaId,
                    key: "retaining_wall.masonry.subcontract_scope",
                    label: "Subcontractor provides",
                    value: event.target.value,
                    valueType: "select",
                  })
                }
              >
                <option value="">Labour only (default)</option>
                <option value="Labour only">Labour only</option>
                <option value="Labour + blocks & laying materials">
                  Labour + blocks & laying materials
                </option>
              </select>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor={`rw-footing-w-${workAreaId}`}>
              Footing width (m)
            </Label>
            <Input
              id={`rw-footing-w-${workAreaId}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.40 estimating default"
              defaultValue={
                jobPlanNumber(facts, workAreaId, "retaining_wall.footing_width_m") ??
                ""
              }
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next) || !(next > 0)) return;
                onSpecFact?.({
                  workAreaId,
                  key: "retaining_wall.footing_width_m",
                  label: "Footing width",
                  value: next,
                  valueType: "number",
                });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`rw-footing-d-${workAreaId}`}>
              Footing depth (m)
            </Label>
            <Input
              id={`rw-footing-d-${workAreaId}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.25 estimating default"
              defaultValue={
                jobPlanNumber(facts, workAreaId, "retaining_wall.footing_depth_m") ??
                ""
              }
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next) || !(next > 0)) return;
                onSpecFact?.({
                  workAreaId,
                  key: "retaining_wall.footing_depth_m",
                  label: "Footing depth",
                  value: next,
                  valueType: "number",
                });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`rw-wp-req-${workAreaId}`}>
              Retaining-side waterproofing
            </Label>
            <select
              id={`rw-wp-req-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={yesNo(
                jobPlanBoolean(
                  facts,
                  workAreaId,
                  "retaining_wall.waterproofing_required"
                )
              )}
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: "retaining_wall.waterproofing_required",
                  label: "Retaining-side waterproofing",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">Not set</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`rw-wp-method-${workAreaId}`}>
              Waterproofing method
            </Label>
            <select
              id={`rw-wp-method-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={
                jobPlanString(
                  facts,
                  workAreaId,
                  "retaining_wall.waterproofing_method"
                ) ?? ""
              }
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: "retaining_wall.waterproofing_method",
                  label: "Waterproofing method",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">Self-perform (company default)</option>
              <option value="Self-perform">Self-perform</option>
              <option value="Subcontract">Subcontract</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Footing 400×250 mm and 100 mm sub-base are estimating assumptions,
            subject to engineering/design. Reinforcement is design-dependent —
            not a fabricated bar schedule.
          </p>
        </Group>
      ) : null}

      <Group title="Drainage / excavation">
        <div className="space-y-1">
          <Label htmlFor={`rw-drainage-${workAreaId}`}>Drainage / novacoil</Label>
          <select
            id={`rw-drainage-${workAreaId}`}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
            value={yesNo(drainage)}
            onChange={(event) =>
              onSpecFact?.({
                workAreaId,
                key: "retaining_wall.drainage_required",
                label: "Drainage / novacoil",
                value: event.target.value,
                valueType: "select",
              })
            }
          >
            <option value="">Standard on timber/sleeper</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        {drainage === true ? (
          <div className="space-y-1">
            <Label htmlFor={`rw-drainage-sock-${workAreaId}`}>
              Drain coil sock required?
            </Label>
            <select
              id={`rw-drainage-sock-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={drainageSock}
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: RW_DRAINAGE_SOCK_FACT,
                  label: "Drain coil sock",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">Not set</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
              <option value="Not sure">Not sure</option>
            </select>
          </div>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor={`rw-backfill-${workAreaId}`}>Backfill</Label>
          <select
            id={`rw-backfill-${workAreaId}`}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
            value={yesNo(backfill)}
            onChange={(event) =>
              onSpecFact?.({
                workAreaId,
                key: "retaining_wall.backfill_included",
                label: "Backfill",
                value: event.target.value,
                valueType: "select",
              })
            }
          >
            <option value="">Standard drainage aggregate</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`rw-excavation-${workAreaId}`}>Excavation</Label>
          <select
            id={`rw-excavation-${workAreaId}`}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
            value={yesNo(excavation)}
            onChange={(event) =>
              onSpecFact?.({
                workAreaId,
                key: "retaining_wall.excavation_required",
                label: "Excavation",
                value: event.target.value,
                valueType: "select",
              })
            }
          >
            <option value="">Not set</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        {excavation === true ? (
          <div className="space-y-1">
            <Label htmlFor={`rw-digger-access-${workAreaId}`}>
              Can a mini excavator / digger access the work area?
            </Label>
            <select
              id={`rw-digger-access-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={diggerAccess}
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: RW_DIGGER_ACCESS_FACT,
                  label: "Digger access",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">Not set</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
              <option value="Not sure">Not sure</option>
            </select>
          </div>
        ) : null}
        {excavation === true ? (
          <div className="space-y-1">
            <Label htmlFor={`rw-spoil-${workAreaId}`}>
              Will excavated spoil need to be removed from site?
            </Label>
            <select
              id={`rw-spoil-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={
                spoilRemoval === true
                  ? "Yes"
                  : spoilRemoval === false
                    ? "No"
                    : ""
              }
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: "retaining_wall.disposal_included",
                  label: "Spoil removal",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">Not sure</option>
              <option value="No">No — spoil will remain or be reused on site</option>
              <option value="Yes">Yes — some or all will be removed</option>
            </select>
          </div>
        ) : null}
        {excavation === true && spoilRemoval === true && excavationVolume != null ? (
          <div className="space-y-1">
            <Label htmlFor={`rw-spoil-portion-${workAreaId}`}>
              How much of the excavated material needs to leave site?
            </Label>
            <select
              id={`rw-spoil-portion-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={
                /^all/i.test(spoilPortion)
                  ? "All"
                  : /^some/i.test(spoilPortion)
                    ? "Some"
                    : /^none/i.test(spoilPortion)
                      ? "None"
                      : ""
              }
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: "retaining_wall.spoil_removal_portion",
                  label: "Spoil leaving site",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">Not set</option>
              <option value="All">All — {excavationVolume.toFixed(1)}m³</option>
              <option value="Some">Some — enter quantity</option>
              <option value="None">None</option>
            </select>
          </div>
        ) : null}
        {excavation === true &&
        spoilRemoval === true &&
        (excavationVolume == null || /^some/i.test(spoilPortion)) ? (
          <div className="space-y-1">
            <Label htmlFor={`rw-spoil-volume-${workAreaId}`}>
              Estimated spoil removal volume (m³)
            </Label>
            <Input
              id={`rw-spoil-volume-${workAreaId}`}
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0}
              placeholder="Not sure"
              defaultValue={spoilVolume ?? ""}
              onBlur={(event) => {
                const raw = event.target.value.trim();
                if (raw === "") {
                  onSpecFact?.({
                    workAreaId,
                    key: "retaining_wall.spoil_removal_volume_m3",
                    label: "Spoil removal volume",
                    value: "Not sure",
                    valueType: "select",
                  });
                  return;
                }
                const next = Number(raw);
                if (!Number.isFinite(next) || next < 0) return;
                onSpecFact?.({
                  workAreaId,
                  key: "retaining_wall.spoil_removal_volume_m3",
                  label: "Spoil removal volume",
                  value: next,
                  valueType: "number",
                });
              }}
            />
          </div>
        ) : null}
      </Group>

      <Group title="Site conditions">
        <div className="space-y-1">
          <Label htmlFor={`rw-access-${workAreaId}`}>Access</Label>
          <select
            id={`rw-access-${workAreaId}`}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
            value={siteAccess}
            onChange={(event) =>
              onConstraint?.({
                key: "site_access",
                label: "Site access",
                value: event.target.value,
                inputType: "select",
              })
            }
          >
            <option value="">Not set</option>
            <option value="Easy">Easy</option>
            <option value="Moderate">Moderate</option>
            <option value="Difficult">Difficult</option>
            <option value="Very poor">Very poor</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`rw-carry-${workAreaId}`}>Carry distance</Label>
          <select
            id={`rw-carry-${workAreaId}`}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
            value={carryDistance}
            onChange={(event) =>
              onConstraint?.({
                key: "material_carry_distance",
                label: "Material carry distance",
                value: event.target.value,
                inputType: "select",
              })
            }
          >
            <option value="">Not set</option>
            <option value="< 10m">&lt; 10m</option>
            <option value="10–30m">10–30m</option>
            <option value="> 30m">&gt; 30m</option>
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          These are the same Project Conditions values — not a retaining-wall
          copy of access or carry.
        </p>
      </Group>

      <details className="rounded-lg border border-border/60 p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Refinement
        </summary>
        <div className="mt-3 grid gap-3">
          {system === "TIMBER_RETAINING_WALL" ? (
            <>
              <div className="space-y-1">
                <Label htmlFor={`rw-spacing-${workAreaId}`}>
                  Target pile spacing (m)
                </Label>
                <Input
                  id={`rw-spacing-${workAreaId}`}
                  type="number"
                  inputMode="decimal"
                  step="0.05"
                  placeholder="1.2 estimating default"
                  defaultValue={spacing ?? ""}
                  onBlur={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next) || !(next > 0)) return;
                    onSpecFact?.({
                      workAreaId,
                      key: "retaining_wall.post_spacing_m",
                      label: "Pile centres",
                      value: next,
                      valueType: "number",
                    });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`rw-embedment-${workAreaId}`}>
                  Pile embedment (m)
                </Label>
                <Input
                  id={`rw-embedment-${workAreaId}`}
                  type="number"
                  inputMode="decimal"
                  step="0.05"
                  placeholder="50% of H(x) if blank"
                  defaultValue={embedment ?? ""}
                  onBlur={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next)) return;
                    onSpecFact?.({
                      workAreaId,
                      key: "retaining_wall.pile_embedment_m",
                      label: "Pile embedment",
                      value: next,
                      valueType: "number",
                    });
                  }}
                />
              </div>
            </>
          ) : null}
          {system === "CONCRETE_SLEEPER_WALL" ? (
            <>
              <div className="space-y-1">
                <Label htmlFor={`rw-sleeper-spacing-${workAreaId}`}>
                  Target post spacing (m)
                </Label>
                <Input
                  id={`rw-sleeper-spacing-${workAreaId}`}
                  type="number"
                  inputMode="decimal"
                  step="0.05"
                  placeholder="Sleeper length if blank"
                  defaultValue={sleeperSpacing ?? ""}
                  onBlur={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next) || !(next > 0)) return;
                    onSpecFact?.({
                      workAreaId,
                      key: "retaining_wall.sleeper_post_spacing_m",
                      label: "Sleeper post spacing",
                      value: next,
                      valueType: "number",
                    });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`rw-sleeper-embedment-${workAreaId}`}>
                  Post embedment (m)
                </Label>
                <Input
                  id={`rw-sleeper-embedment-${workAreaId}`}
                  type="number"
                  inputMode="decimal"
                  step="0.05"
                  placeholder="70% of H(x) if blank"
                  defaultValue={sleeperEmbedment ?? ""}
                  onBlur={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next)) return;
                    onSpecFact?.({
                      workAreaId,
                      key: "retaining_wall.sleeper_post_embedment_m",
                      label: "Post embedment",
                      value: next,
                      valueType: "number",
                    });
                  }}
                />
              </div>
            </>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor={`rw-excavation-volume-${workAreaId}`}>
              Bulk excavation volume (m³)
            </Label>
            <Input
              id={`rw-excavation-volume-${workAreaId}`}
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="Only if known — not taken from backfill"
              defaultValue={excavationVolume ?? ""}
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next) || !(next > 0)) return;
                onSpecFact?.({
                  workAreaId,
                  key: "retaining_wall.excavation_volume_m3",
                  label: "Bulk excavation volume",
                  value: next,
                  valueType: "number",
                });
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Site access and carry distance live in Project Conditions — the same
            canonical values, not a second retaining-wall copy.
          </p>
        </div>
      </details>
    </div>
  );
}
