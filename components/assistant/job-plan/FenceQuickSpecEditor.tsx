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
  classifyFenceSystem,
  FENCE_SYSTEM_LABELS,
  FENCE_SYSTEM_OPTIONS,
  isModularFenceSystem,
  isTimberFenceSystem,
} from "@/lib/estimate/fence-systems";
import { FENCE_GATE_POSITION_OPTIONS } from "@/lib/estimate/fence-geometry";
import { FENCE_RAIL_SECTION_OPTIONS } from "@/lib/estimate/fence-identities";
import type { EstimateFact } from "@/lib/estimate/types";
import type { ReactNode } from "react";

function Group({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
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

export function FenceQuickSpecEditor({
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
  const systemRaw =
    jobPlanString(facts, workAreaId, "fence.system") ??
    jobPlanString(facts, workAreaId, "fence.material") ??
    "";
  const system = classifyFenceSystem(
    systemRaw,
    jobPlanString(facts, workAreaId, "fence.paling_or_panel_type")
  );
  const length = jobPlanNumber(facts, workAreaId, "fence.length_m");
  const height = jobPlanNumber(facts, workAreaId, "fence.height_m");
  const species = jobPlanString(facts, workAreaId, "fence.timber_species") ?? "";
  const thickness = jobPlanString(facts, workAreaId, "fence.board_thickness_mm") ?? "";
  const spacing = jobPlanNumber(facts, workAreaId, "fence.post_spacing_m");
  const embedment = jobPlanNumber(facts, workAreaId, "fence.post_embedment_m");
  const holeMm =
    jobPlanNumber(facts, workAreaId, "fence.hole_diameter_m") != null
      ? Math.round(
          (jobPlanNumber(facts, workAreaId, "fence.hole_diameter_m") as number) *
            1000
        )
      : "";
  const capping = jobPlanString(facts, workAreaId, "fence.top_capping") ?? "";
  const gap = jobPlanNumber(facts, workAreaId, "fence.slat_gap_mm");
  const palingGap = jobPlanNumber(facts, workAreaId, "fence.vertical_paling_gap_mm");
  const sectionWidth = jobPlanNumber(facts, workAreaId, "fence.section_width_m");
  const sectionCount = jobPlanNumber(facts, workAreaId, "fence.section_count");
  const metal = jobPlanString(facts, workAreaId, "fence.metal_material") ?? "";
  const gate = jobPlanBoolean(facts, workAreaId, "fence.gate_included");
  const gateWidth = jobPlanNumber(facts, workAreaId, "fence.gate_width_m");
  const gatePosition = jobPlanString(facts, workAreaId, "fence.gate_position") ?? "";
  const gateCapping = jobPlanString(facts, workAreaId, "fence.gate_capping") ?? "";
  const railCount = jobPlanNumber(facts, workAreaId, "fence.rail_count");
  const railSection = jobPlanString(facts, workAreaId, "fence.rail_section") ?? "";
  const courseCount = jobPlanNumber(facts, workAreaId, "fence.horizontal_course_count");
  const siteAccess = constraintString(constraints, "site_access");
  const carryDistance = constraintString(constraints, "material_carry_distance");

  const systemSelectValue =
    system !== "missing" && system !== "unsupported"
      ? FENCE_SYSTEM_LABELS[system]
      : "";

  return (
    <div className="grid gap-3" data-fence-quick-spec>
      <Group title="Fence">
        <div className="space-y-1">
          <Label htmlFor={`fence-system-${workAreaId}`}>Fence type</Label>
          <select
            id={`fence-system-${workAreaId}`}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
            value={systemSelectValue}
            onChange={(event) =>
              onSpecFact?.({
                workAreaId,
                key: "fence.system",
                label: "Fence type",
                value: event.target.value,
                valueType: "select",
              })
            }
          >
            <option value="">Select type</option>
            {FENCE_SYSTEM_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`fence-length-${workAreaId}`}>Length (m)</Label>
          <Input
            id={`fence-length-${workAreaId}`}
            type="number"
            inputMode="decimal"
            step="0.1"
            defaultValue={length ?? ""}
            onBlur={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next) || !(next > 0)) return;
              onSpecFact?.({
                workAreaId,
                key: "fence.length_m",
                label: "Fence length",
                value: next,
                valueType: "number",
              });
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`fence-height-${workAreaId}`}>Height (m)</Label>
          <Input
            id={`fence-height-${workAreaId}`}
            type="number"
            inputMode="decimal"
            step="0.05"
            defaultValue={height ?? ""}
            onBlur={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next) || !(next > 0)) return;
              onSpecFact?.({
                workAreaId,
                key: "fence.height_m",
                label: "Fence height",
                value: next,
                valueType: "number",
              });
            }}
          />
        </div>
      </Group>

      {isTimberFenceSystem(system) ? (
        <Group title="Timber">
          <div className="space-y-1">
            <Label htmlFor={`fence-species-${workAreaId}`}>Visible timber</Label>
            <select
              id={`fence-species-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={species}
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: "fence.timber_species",
                  label: "Timber species",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">Radiata Pine (assumed)</option>
              <option value="Radiata Pine">Radiata Pine</option>
              <option value="Macrocarpa">Macrocarpa</option>
              <option value="Cedar">Cedar</option>
              <option value="Hardwood">Hardwood</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`fence-thickness-${workAreaId}`}>Board section</Label>
            <select
              id={`fence-thickness-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={thickness}
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: "fence.board_thickness_mm",
                  label: "Board thickness",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">150 × 19mm (assumed)</option>
              <option value="150 × 19mm">150 × 19mm</option>
              <option value="150 × 25mm">150 × 25mm</option>
            </select>
          </div>
          {system === "TIMBER_HORIZONTAL_SLAT" ? (
            <div className="space-y-1">
              <Label htmlFor={`fence-gap-${workAreaId}`}>Slat gap (mm)</Label>
              <Input
                id={`fence-gap-${workAreaId}`}
                type="number"
                inputMode="numeric"
                step="1"
                placeholder="10"
                defaultValue={gap ?? ""}
                onBlur={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next) || next < 0) return;
                  onSpecFact?.({
                    workAreaId,
                    key: "fence.slat_gap_mm",
                    label: "Slat gap",
                    value: next,
                    valueType: "number",
                  });
                }}
              />
            </div>
          ) : null}
          {system === "TIMBER_HORIZONTAL_SLAT" ? (
            <div className="space-y-1">
              <Label htmlFor={`fence-courses-${workAreaId}`}>
                Horizontal slat course count
              </Label>
              <Input
                id={`fence-courses-${workAreaId}`}
                type="number"
                inputMode="numeric"
                step="1"
                placeholder="Fit within height"
                defaultValue={courseCount ?? ""}
                onBlur={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next) || !(next > 0)) return;
                  onSpecFact?.({
                    workAreaId,
                    key: "fence.horizontal_course_count",
                    label: "Horizontal slat course count",
                    value: next,
                    valueType: "number",
                  });
                }}
              />
            </div>
          ) : null}
          {system === "TIMBER_VERTICAL_PALING" ? (
            <div className="space-y-1">
              <Label htmlFor={`fence-paling-gap-${workAreaId}`}>
                Gap between vertical palings (mm)
              </Label>
              <Input
                id={`fence-paling-gap-${workAreaId}`}
                type="number"
                inputMode="numeric"
                step="1"
                placeholder="0"
                defaultValue={palingGap ?? ""}
                onBlur={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next) || next < 0) return;
                  onSpecFact?.({
                    workAreaId,
                    key: "fence.vertical_paling_gap_mm",
                    label: "Gap between vertical palings",
                    value: next,
                    valueType: "number",
                  });
                }}
              />
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor={`fence-capping-${workAreaId}`}>Top capping</Label>
            <select
              id={`fence-capping-${workAreaId}`}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={capping}
              onChange={(event) =>
                onSpecFact?.({
                  workAreaId,
                  key: "fence.top_capping",
                  label: "Top capping",
                  value: event.target.value,
                  valueType: "select",
                })
              }
            >
              <option value="">Not sure if needed</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`fence-spacing-${workAreaId}`}>Max post centres (m)</Label>
            <Input
              id={`fence-spacing-${workAreaId}`}
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="1.8"
              defaultValue={spacing ?? ""}
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next) || !(next > 0)) return;
                onSpecFact?.({
                  workAreaId,
                  key: "fence.post_spacing_m",
                  label: "Post spacing",
                  value: next,
                  valueType: "number",
                });
              }}
            />
          </div>
          {system === "TIMBER_VERTICAL_PALING" ? (
            <>
            <div className="space-y-1">
              <Label htmlFor={`fence-rails-${workAreaId}`}>Rail count override</Label>
              <Input
                id={`fence-rails-${workAreaId}`}
                type="number"
                inputMode="numeric"
                step="1"
                placeholder="Assumed from height"
                defaultValue={railCount ?? ""}
                onBlur={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next) || !(next > 0)) return;
                  onSpecFact?.({
                    workAreaId,
                    key: "fence.rail_count",
                    label: "Rail count",
                    value: next,
                    valueType: "number",
                  });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`fence-rail-section-${workAreaId}`}>Fence rail section</Label>
              <select
                id={`fence-rail-section-${workAreaId}`}
                className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                value={railSection}
                onChange={(event) =>
                  onSpecFact?.({
                    workAreaId,
                    key: "fence.rail_section",
                    label: "Fence rail section",
                    value: event.target.value,
                    valueType: "select",
                  })
                }
              >
                <option value="">75 × 50mm H4 (assumed)</option>
                {FENCE_RAIL_SECTION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            </>
          ) : null}
        </Group>
      ) : null}

      {isModularFenceSystem(system) ? (
        <Group title="Modular sections">
          {system === "METAL_SLAT_MODULAR" ? (
            <div className="space-y-1">
              <Label htmlFor={`fence-metal-${workAreaId}`}>Metal</Label>
              <select
                id={`fence-metal-${workAreaId}`}
                className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                value={metal}
                onChange={(event) =>
                  onSpecFact?.({
                    workAreaId,
                    key: "fence.metal_material",
                    label: "Metal type",
                    value: event.target.value,
                    valueType: "select",
                  })
                }
              >
                <option value="">Aluminium (assumed)</option>
                <option value="Aluminium">Aluminium</option>
                <option value="Steel">Steel</option>
              </select>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor={`fence-section-w-${workAreaId}`}>Section width (m)</Label>
            <Input
              id={`fence-section-w-${workAreaId}`}
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="1.8"
              defaultValue={sectionWidth ?? ""}
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next) || !(next > 0)) return;
                onSpecFact?.({
                  workAreaId,
                  key: "fence.section_width_m",
                  label: "Section width",
                  value: next,
                  valueType: "number",
                });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`fence-section-n-${workAreaId}`}>Section count override</Label>
            <Input
              id={`fence-section-n-${workAreaId}`}
              type="number"
              inputMode="numeric"
              step="1"
              placeholder="Calculated"
              defaultValue={sectionCount ?? ""}
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next) || !(next > 0)) return;
                onSpecFact?.({
                  workAreaId,
                  key: "fence.section_count",
                  label: "Section count",
                  value: next,
                  valueType: "number",
                });
              }}
            />
          </div>
        </Group>
      ) : null}

      <Group title="Posts & holes">
        <div className="space-y-1">
          <Label htmlFor={`fence-embed-${workAreaId}`}>Post embedment (m)</Label>
          <Input
            id={`fence-embed-${workAreaId}`}
            type="number"
            inputMode="decimal"
            step="0.05"
            placeholder="0.6"
            defaultValue={embedment ?? ""}
            onBlur={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next) || !(next > 0)) return;
              onSpecFact?.({
                workAreaId,
                key: "fence.post_embedment_m",
                label: "Post embedment",
                value: next,
                valueType: "number",
              });
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`fence-hole-${workAreaId}`}>Hole diameter (mm)</Label>
          <Input
            id={`fence-hole-${workAreaId}`}
            type="number"
            inputMode="numeric"
            step="10"
            placeholder="300"
            defaultValue={holeMm}
            onBlur={(event) => {
              const mm = Number(event.target.value);
              if (!Number.isFinite(mm) || !(mm > 0)) return;
              onSpecFact?.({
                workAreaId,
                key: "fence.hole_diameter_m",
                label: "Post-hole diameter",
                value: mm / 1000,
                valueType: "number",
              });
            }}
          />
        </div>
      </Group>

      {isTimberFenceSystem(system) ? (
      <Group title="Gate">
        <div className="space-y-1">
          <Label htmlFor={`fence-gate-${workAreaId}`}>Gate included</Label>
          <select
            id={`fence-gate-${workAreaId}`}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
            value={yesNo(gate)}
            onChange={(event) =>
              onSpecFact?.({
                workAreaId,
                key: "fence.gate_included",
                label: "Gate",
                value: event.target.value,
                valueType: "select",
              })
            }
          >
            <option value="">Not confirmed</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        {gate === true ? (
          <>
          <div className="space-y-1">
            <Label htmlFor={`fence-gate-w-${workAreaId}`}>Gate width (m)</Label>
            <Input
              id={`fence-gate-w-${workAreaId}`}
              type="number"
              inputMode="decimal"
              step="0.05"
              placeholder="0.9"
              defaultValue={gateWidth ?? ""}
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next) || !(next > 0)) return;
                  onSpecFact?.({
                    workAreaId,
                    key: "fence.gate_width_m",
                    label: "Gate width",
                    value: next,
                    valueType: "number",
                  });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`fence-gate-pos-${workAreaId}`}>Gate position</Label>
              <select
                id={`fence-gate-pos-${workAreaId}`}
                className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                value={gatePosition}
                onChange={(event) =>
                  onSpecFact?.({
                    workAreaId,
                    key: "fence.gate_position",
                    label: "Gate position",
                    value: event.target.value,
                    valueType: "select",
                  })
                }
              >
                <option value="">Not sure</option>
                {FENCE_GATE_POSITION_OPTIONS.filter((option) => option !== "Not sure").map(
                  (option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  )
                )}
              </select>
            </div>
            {capping === "Yes" ? (
              <div className="space-y-1">
                <Label htmlFor={`fence-gate-cap-${workAreaId}`}>
                  Gate matches fence capping
                </Label>
                <select
                  id={`fence-gate-cap-${workAreaId}`}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                  value={gateCapping}
                  onChange={(event) =>
                    onSpecFact?.({
                      workAreaId,
                      key: "fence.gate_capping",
                      label: "Gate matches fence capping",
                      value: event.target.value,
                      valueType: "select",
                    })
                  }
                >
                  <option value="">Yes (assumed)</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            ) : null}
          </>
        ) : null}
      </Group>
      ) : null}

      <Group title="Access / carry">
        <div className="space-y-1">
          <Label htmlFor={`fence-access-${workAreaId}`}>Site access</Label>
          <select
            id={`fence-access-${workAreaId}`}
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
          <Label htmlFor={`fence-carry-${workAreaId}`}>Material carry</Label>
          <select
            id={`fence-carry-${workAreaId}`}
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
            <option value="Under 10m">Under 10m</option>
            <option value="10–30m">10–30m</option>
            <option value="Over 30m">Over 30m</option>
          </select>
        </div>
      </Group>
    </div>
  );
}
