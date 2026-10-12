"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jobPlanNumber, jobPlanString } from "@/lib/assistant/job-plan/facts";
import {
  DECK_HOLE_ASSUMED_DEPTH_MM,
  DECK_HOLE_ASSUMED_DIAMETER_MM,
  DECK_HOLE_CONFIRM_ACTION,
  deckHoleCountError,
  deckHoleMillimetreError,
  planDeckPostConcrete,
} from "@/lib/estimate/deck-hole-excavation";
import type { EstimateFact } from "@/lib/estimate/types";

type HoleFactWrite = (input: {
  workAreaId: string;
  key: string;
  label: string;
  value: string | number;
  valueType: "number" | "select" | "text";
}) => void;

const fieldClass =
  "h-11 min-h-11 w-full rounded-xl border border-border/80 bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:h-9 md:text-sm";

function write(
  onSpecFact: HoleFactWrite | undefined,
  workAreaId: string,
  key: string,
  label: string,
  value: string | number,
  valueType: "number" | "select" | "text"
) {
  onSpecFact?.({ workAreaId, key, label, value, valueType });
}

export function DeckPostHolesSection({
  workAreaId,
  facts,
  onSpecFact,
}: {
  workAreaId: string;
  facts: readonly EstimateFact[];
  onSpecFact?: HoleFactWrite;
}) {
  const reasonRef = useRef<HTMLInputElement>(null);
  const statedPosts = jobPlanNumber(facts, workAreaId, "deck.pile_or_post_count");
  const bearerRows = jobPlanNumber(facts, workAreaId, "deck.bearer_row_count");
  const perBearer = jobPlanNumber(facts, workAreaId, "deck.supports_per_bearer");
  const postCount =
    bearerRows != null && perBearer != null
      ? Math.round(bearerRows * perBearer)
      : statedPosts != null
        ? Math.round(statedPosts)
        : null;
  const savedCount = jobPlanNumber(facts, workAreaId, "deck.hole_count");
  const savedReason = jobPlanString(facts, workAreaId, "deck.hole_count_reason") ?? "";
  const shape = jobPlanString(facts, workAreaId, "deck.hole_shape") ?? "";
  const diameter = jobPlanNumber(facts, workAreaId, "deck.hole_diameter_mm");
  const depth = jobPlanNumber(facts, workAreaId, "deck.hole_depth_mm");
  const length = jobPlanNumber(facts, workAreaId, "deck.hole_length_mm");
  const width = jobPlanNumber(facts, workAreaId, "deck.hole_width_mm");
  const ground = jobPlanString(facts, workAreaId, "deck.hole_ground") ?? "";
  const method = jobPlanString(facts, workAreaId, "deck.hole_method") ?? "";
  const destination = jobPlanString(facts, workAreaId, "deck.spoil_destination") ?? "";
  const legacySpoil = facts.find(
    (fact) => fact.key === "deck.spoil_leaves_site" && fact.work_area_id === workAreaId
  );
  const spoil =
    destination ||
    (legacySpoil?.value === true ? "off_site" : legacySpoil?.value === false ? "on_site" : "");
  const jobHours = jobPlanNumber(facts, workAreaId, "deck.hole_job_hours_per_hole");
  const concreteOn = facts.some(
    (fact) =>
      fact.key === "deck.concrete_to_supports" &&
      fact.work_area_id === workAreaId &&
      fact.value === true
  );
  const fill = jobPlanString(facts, workAreaId, "deck.concrete_fill") ?? "";
  const fillDepth = jobPlanNumber(facts, workAreaId, "deck.concrete_fill_depth_mm");
  const postSection = jobPlanString(facts, workAreaId, "deck.support_section") ?? "";
  const embedment = jobPlanNumber(facts, workAreaId, "deck.post_embedment_mm");
  const yieldOverride = jobPlanNumber(facts, workAreaId, "deck.concrete_bag_yield_m3");
  const companyBags = jobPlanNumber(facts, workAreaId, "deck.concrete_bags_per_hole");
  const rectangular = shape === "rectangular";
  const sizeAssumed = !rectangular && diameter == null && depth == null;
  const [countError, setCountError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const displayCount = savedCount ?? postCount ?? "";

  function saveCount(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setCountError(null);
      return;
    }
    const next = Number(trimmed);
    const error = deckHoleCountError(next);
    setCountError(error);
    if (error) return;
    if (postCount != null && next !== postCount && !savedReason.trim()) {
      setReasonError("Add a short reason when the hole count differs from the post count.");
      reasonRef.current?.focus();
    } else {
      setReasonError(null);
    }
    if (savedCount === next) return;
    write(onSpecFact, workAreaId, "deck.hole_count", "Hole count", next, "number");
  }

  function saveMillimetres(key: string, label: string, raw: string, current: number | null) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const next = Number(trimmed);
    const error = deckHoleMillimetreError(next);
    setSizeError(error);
    if (error || current === next) return;
    write(onSpecFact, workAreaId, key, label, next, "number");
  }

  function confirmAssumedSize() {
    write(onSpecFact, workAreaId, "deck.hole_shape", "Hole shape", "circular", "select");
    write(
      onSpecFact,
      workAreaId,
      "deck.hole_diameter_mm",
      "Hole diameter",
      DECK_HOLE_ASSUMED_DIAMETER_MM,
      "number"
    );
    write(
      onSpecFact,
      workAreaId,
      "deck.hole_depth_mm",
      "Hole depth",
      DECK_HOLE_ASSUMED_DEPTH_MM,
      "number"
    );
  }

  const outsideOrdinary =
    rectangular ||
    ground === "rock" ||
    ground === "groundwater" ||
    ground === "other" ||
    method === "machine" ||
    method === "other" ||
    (diameter != null && (diameter < 250 || diameter > 450)) ||
    (depth != null && (depth < 400 || depth > 900));

  return (
    <section className="space-y-3 rounded-lg border border-border/60 p-3" data-post-holes="true">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Post holes
        </p>
        <p className="text-xs leading-5 text-muted-foreground">
          The post count and the hole count usually match. They can differ when you give a short reason.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor={`deck-hole-count-${workAreaId}`}>
          Number of holes
          {postCount != null ? ` · suggested from ${postCount} posts` : ""}
        </Label>
        <Input
          className="h-11 md:h-9"
          id={`deck-hole-count-${workAreaId}`}
          type="number"
          inputMode="numeric"
          min={1}
          defaultValue={displayCount}
          aria-invalid={countError ? true : undefined}
          onBlur={(event) => saveCount(event.target.value)}
        />
        {countError ? (
          <p className="text-xs text-destructive" data-hole-count-error="">
            {countError}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor={`deck-hole-reason-${workAreaId}`}>
          Reason, if the hole count differs
        </Label>
        <Input
          ref={reasonRef}
          className="h-11 md:h-9"
          id={`deck-hole-reason-${workAreaId}`}
          type="text"
          defaultValue={savedReason}
          aria-invalid={reasonError ? true : undefined}
          onBlur={(event) => {
            const next = event.target.value.trim();
            if (!next) {
              if (reasonError) setReasonError("Add a short reason when the hole count differs from the post count.");
              return;
            }
            setReasonError(null);
            if (next === savedReason) return;
            write(
              onSpecFact,
              workAreaId,
              "deck.hole_count_reason",
              "Hole count reason",
              next,
              "text"
            );
          }}
        />
        {reasonError ? (
          <p className="text-xs text-destructive" data-hole-reason-error="">
            {reasonError}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor={`deck-hole-shape-${workAreaId}`}>
          Shape
        </Label>
        <select
          id={`deck-hole-shape-${workAreaId}`}
          className={fieldClass}
          value={shape || "circular"}
          onChange={(event) =>
            write(
              onSpecFact,
              workAreaId,
              "deck.hole_shape",
              "Hole shape",
              event.target.value,
              "select"
            )
          }
        >
          <option value="circular">Circular</option>
          <option value="rectangular">Rectangular</option>
        </select>
        {!shape ? (
          <p className="text-xs text-muted-foreground">Assumed circular until you choose a shape.</p>
        ) : null}
      </div>

      {rectangular ? (
        <div className="grid gap-3">
          <MillimetreField
            id={`deck-hole-length-${workAreaId}`}
            label="Length (mm)"
            current={length}
            onCommit={(raw) =>
              saveMillimetres("deck.hole_length_mm", "Hole length", raw, length)
            }
          />
          <MillimetreField
            id={`deck-hole-width-${workAreaId}`}
            label="Width (mm)"
            current={width}
            onCommit={(raw) => saveMillimetres("deck.hole_width_mm", "Hole width", raw, width)}
          />
          <MillimetreField
            id={`deck-hole-rect-depth-${workAreaId}`}
            label="Depth (mm)"
            current={depth}
            onCommit={(raw) => saveMillimetres("deck.hole_depth_mm", "Hole depth", raw, depth)}
          />
        </div>
      ) : (
        <div className="grid gap-3">
          <MillimetreField
            id={`deck-hole-diameter-${workAreaId}`}
            label="Diameter (mm)"
            current={diameter}
            assumed={diameter == null ? DECK_HOLE_ASSUMED_DIAMETER_MM : null}
            onCommit={(raw) => {
              if (diameter == null && Number(raw) === DECK_HOLE_ASSUMED_DIAMETER_MM) return;
              saveMillimetres("deck.hole_diameter_mm", "Hole diameter", raw, diameter);
            }}
          />
          <MillimetreField
            id={`deck-hole-depth-${workAreaId}`}
            label="Depth (mm)"
            current={depth}
            assumed={depth == null ? DECK_HOLE_ASSUMED_DEPTH_MM : null}
            onCommit={(raw) => {
              if (depth == null && Number(raw) === DECK_HOLE_ASSUMED_DEPTH_MM) return;
              saveMillimetres("deck.hole_depth_mm", "Hole depth", raw, depth);
            }}
          />
          {sizeAssumed ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground" data-hole-assumed="">
                Assumed {DECK_HOLE_ASSUMED_DIAMETER_MM} mm diameter × {DECK_HOLE_ASSUMED_DEPTH_MM} mm
                deep. Not measured.
              </p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full"
                data-hole-confirm=""
                onClick={confirmAssumedSize}
              >
                {DECK_HOLE_CONFIRM_ACTION}
              </Button>
            </div>
          ) : null}
        </div>
      )}
      {sizeError ? (
        <p className="text-xs text-destructive" data-hole-size-error="">
          {sizeError}
        </p>
      ) : null}

      <Choice
        id={`deck-hole-ground-${workAreaId}`}
        label="Ground"
        value={ground}
        placeholder="Not chosen"
        options={[
          ["ordinary", "Ordinary diggable soil"],
          ["rock", "Rock or hard ground"],
          ["groundwater", "Groundwater"],
          ["other", "Other or unknown"],
        ]}
        onChange={(value) =>
          write(onSpecFact, workAreaId, "deck.hole_ground", "Hole ground", value, "select")
        }
      />
      <Choice
        id={`deck-hole-method-${workAreaId}`}
        label="Excavation method"
        value={method}
        placeholder="Not chosen"
        options={[
          ["hand", "Hand or post-hole auger"],
          ["machine", "Machine"],
          ["other", "Other or unknown"],
        ]}
        onChange={(value) =>
          write(onSpecFact, workAreaId, "deck.hole_method", "Excavation method", value, "select")
        }
      />
      <Choice
        id={`deck-spoil-${workAreaId}`}
        label="Spoil"
        value={spoil}
        placeholder="Not decided"
        options={[
          ["on_site", "Retained or reused on site"],
          ["off_site", "Removed off site"],
          ["undecided", "Not decided"],
        ]}
        onChange={(value) =>
          write(
            onSpecFact,
            workAreaId,
            "deck.spoil_destination",
            "Spoil destination",
            value,
            "select"
          )
        }
      />

      <div className="space-y-3 border-t border-border/60 pt-3" data-post-hole-concrete="true">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Concrete in the holes
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            Bags follow the concrete fill and the 20 kg bag yield of 0.01 m³ per bag.
            {postSection
              ? ` Post size ${postSection}.`
              : " Set the post size before the displacement can be deducted."}
          </p>
        </div>
        <Choice
          id={`deck-concrete-fill-${workAreaId}`}
          label="Concrete fill"
          value={fill}
          placeholder="Not confirmed"
          options={[
            ["full", "Full hole"],
            ["partial", "Part of the hole"],
          ]}
          onChange={(value) =>
            write(onSpecFact, workAreaId, "deck.concrete_fill", "Concrete fill", value, "select")
          }
        />
        {fill === "partial" ? (
          <MillimetreField
            id={`deck-concrete-fill-depth-${workAreaId}`}
            label="Concrete depth"
            current={fillDepth}
            onCommit={(raw) =>
              saveMillimetres(
                "deck.concrete_fill_depth_mm",
                "Concrete fill depth",
                raw,
                fillDepth
              )
            }
          />
        ) : null}
        <MillimetreField
          id={`deck-post-embedment-${workAreaId}`}
          label="Post embedded depth"
          current={embedment}
          onCommit={(raw) =>
            saveMillimetres("deck.post_embedment_mm", "Post embedded depth", raw, embedment)
          }
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor={`deck-concrete-yield-${workAreaId}`}>
              Bag yield m³
            </Label>
            <Input
              className="h-11 md:h-9"
              id={`deck-concrete-yield-${workAreaId}`}
              type="number"
              inputMode="decimal"
              step="0.001"
              min={0.001}
              defaultValue={yieldOverride ?? ""}
              placeholder="0.01"
              onBlur={(event) => {
                const raw = event.target.value.trim();
                if (!raw) return;
                const next = Number(raw);
                if (!Number.isFinite(next) || next <= 0) return;
                write(
                  onSpecFact,
                  workAreaId,
                  "deck.concrete_bag_yield_m3",
                  "Concrete bag yield",
                  next,
                  "number"
                );
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor={`deck-company-bags-${workAreaId}`}>
              Company bags per hole
            </Label>
            <Input
              className="h-11 md:h-9"
              id={`deck-company-bags-${workAreaId}`}
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0.1}
              defaultValue={companyBags ?? ""}
              placeholder="Volume takeoff"
              onBlur={(event) => {
                const raw = event.target.value.trim();
                if (!raw) return;
                const next = Number(raw);
                if (!Number.isFinite(next) || next <= 0) return;
                write(
                  onSpecFact,
                  workAreaId,
                  "deck.concrete_bags_per_hole",
                  "Concrete bags per hole",
                  next,
                  "number"
                );
              }}
            />
          </div>
        </div>
        {concreteOn && (savedCount ?? postCount) != null ? (
          <p className="text-xs leading-5 text-muted-foreground" data-concrete-takeoff="">
            {
              planDeckPostConcrete({
                facts,
                workAreaId,
                holeCount: savedCount ?? postCount ?? 0,
              }).disclosure
            }
          </p>
        ) : (
          <p className="text-xs leading-5 text-muted-foreground">
            Turn on concrete footings to include this quantity. Spoil stays the excavated bank volume.
          </p>
        )}
      </div>

      {outsideOrdinary ? (
        <div className="space-y-1.5" data-hole-productivity-needed="true">
          <Label className="text-xs" htmlFor={`deck-hole-hours-${workAreaId}`}>
            Hours per hole for this job
          </Label>
          <Input
            className="h-11 md:h-9"
            id={`deck-hole-hours-${workAreaId}`}
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0.1}
            defaultValue={jobHours ?? ""}
            placeholder="Needed outside the ordinary hand-dug starter"
            onBlur={(event) => {
              const raw = event.target.value.trim();
              if (!raw) return;
              const next = Number(raw);
              if (!Number.isFinite(next) || next <= 0) {
                setSizeError("Enter the person-hours for one hole.");
                return;
              }
              write(
                onSpecFact,
                workAreaId,
                "deck.hole_job_hours_per_hole",
                "Hole excavation hours",
                next,
                "number"
              );
            }}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            The 0.50 h/hole starter is only for a confirmed ordinary hand-dug hole inside
            250–450 mm by 400–900 mm. Otherwise enter hours here, or add a company rate.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function MillimetreField({
  id,
  label,
  current,
  assumed,
  onCommit,
}: {
  id: string;
  label: string;
  current: number | null;
  assumed?: number | null;
  onCommit: (raw: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs" htmlFor={id}>
        {label}
        {assumed != null ? " · Assumed" : ""}
      </Label>
      <Input
        className="h-11 md:h-9"
        id={id}
        type="number"
        inputMode="numeric"
        min={50}
        max={3000}
        defaultValue={current ?? assumed ?? ""}
        onBlur={(event) => onCommit(event.target.value)}
      />
    </div>
  );
}

function Choice({
  id,
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs" htmlFor={id}>
        {label}
      </Label>
      <select id={id} className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
