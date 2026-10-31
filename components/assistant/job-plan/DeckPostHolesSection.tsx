"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jobPlanNumber, jobPlanString } from "@/lib/assistant/job-plan/facts";
import {
  deckCountWriteKey,
  deckDetailGaps,
  deckDetailQueuePrompt,
  deckPostsInScope,
  deckSpoilDestination,
} from "@/lib/estimate/deck-detail-completeness";
import { deckPostHoleControlId } from "@/lib/estimate/deck-detail-completeness";
import {
  DECK_HOLE_ASSUMED_DEPTH_MM,
  DECK_HOLE_ASSUMED_DIAMETER_MM,
  typicalPostHoleSetupFacts,
  typicalPostHoleSetupSummary,
  DECK_SPOIL_HAULAGE_ALLOWANCE_EX_GST,
  DECK_SPOIL_HAULAGE_SCOPE,
  DECK_SPOIL_HAULAGE_SHORT,
  DECK_SPOIL_SMALL_BANK_MAX_M3,
  DECK_SPOIL_TIP_ALLOWANCE_EX_GST,
  DECK_SPOIL_TIP_SCOPE,
  DECK_SPOIL_TIP_SHORT,
  deckHoleCountError,
  deckHoleMillimetreError,
  planDeckHoleExcavation,
} from "@/lib/estimate/deck-hole-excavation";
import {
  DECK_COMPANY_BAG_WARNING,
  deckConcreteCalculationLines,
} from "@/lib/estimate/deck-post-hole-result";
import type { EstimateFact } from "@/lib/estimate/types";

type FactWrite = {
  key: string;
  label: string;
  value: string | number;
  valueType: "number" | "select" | "text";
};

type HoleFactWrite = (
  input: FactWrite & { workAreaId: string }
) => Promise<{ error?: string } | void> | void;

const TYPICAL_POST = "125x125";
const fieldClass =
  "h-11 min-h-11 w-full min-w-0 scroll-mb-40 rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:scroll-mb-24 md:text-sm";

function prettySection(section: string): string {
  return section.replace(/\s*[x×]\s*/i, " × ");
}

function millimetreLabel(value: number | null): string {
  return value == null ? "Not set" : `${value} mm`;
}

export function DeckPostHolesSection({
  workAreaId,
  facts,
  onSpecFact,
  onSpecFacts,
  accessSuitable = true,
  focusGapId = null,
  focusNonce = 0,
  savingKeys = [],
  forceOpen = false,
}: {
  workAreaId: string;
  facts: readonly EstimateFact[];
  onSpecFact?: HoleFactWrite;
  onSpecFacts?: (input: {
    workAreaId: string;
    facts: readonly FactWrite[];
  }) => Promise<{ error?: string } | void> | void;
  onBooleanFact?: (input: {
    workAreaId: string;
    key: string;
    label: string;
    value: boolean;
  }) => void;
  accessSuitable?: boolean;
  focusGapId?: string | null;
  focusNonce?: number;
  savingKeys?: readonly string[];
  forceOpen?: boolean;
}) {
  const reasonRef = useRef<HTMLInputElement>(null);
  const setupErrorRef = useRef<HTMLParagraphElement>(null);
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
  const destination = deckSpoilDestination(facts, workAreaId);
  const legacySpoil = facts.find(
    (fact) => fact.key === "deck.spoil_leaves_site" && fact.work_area_id === workAreaId
  );
  const spoil =
    destination ||
    (legacySpoil?.value === true ? "off_site" : legacySpoil?.value === false ? "on_site" : "");
  const jobHours = jobPlanNumber(facts, workAreaId, "deck.hole_job_hours_per_hole");
  const hoursStatus = jobPlanString(facts, workAreaId, "deck.hole_hours_status") ?? "";
  const concreteOn = facts.some(
    (fact) =>
      fact.key === "deck.concrete_to_supports" &&
      fact.work_area_id === workAreaId &&
      fact.value === true
  );
  const concreteExcluded = facts.some(
    (fact) =>
      fact.key === "deck.concrete_to_supports" &&
      fact.work_area_id === workAreaId &&
      fact.value === false
  );
  const fill = jobPlanString(facts, workAreaId, "deck.concrete_fill") ?? "";
  const fillDepth = jobPlanNumber(facts, workAreaId, "deck.concrete_fill_depth_mm");
  const postSection = jobPlanString(facts, workAreaId, "deck.support_section") ?? "";
  const embedment = jobPlanNumber(facts, workAreaId, "deck.post_embedment_mm");
  const embedmentLink = jobPlanString(facts, workAreaId, "deck.post_embedment_linked") ?? "";
  const yieldOverride = jobPlanNumber(facts, workAreaId, "deck.concrete_bag_yield_m3");
  const companyBags = jobPlanNumber(facts, workAreaId, "deck.concrete_bags_per_hole");
  const haulageChoice = jobPlanString(facts, workAreaId, "deck.spoil_haulage_choice") ?? "";
  const tipChoice = jobPlanString(facts, workAreaId, "deck.spoil_tip_choice") ?? "";
  const haulageCost = jobPlanNumber(facts, workAreaId, "deck.spoil_haulage_job_cost");
  const tipCost = jobPlanNumber(facts, workAreaId, "deck.spoil_tip_job_cost");
  const loadFit = jobPlanString(facts, workAreaId, "deck.spoil_load_fit") ?? "";
  const rectangular = shape === "rectangular";
  const usingProposal =
    !shape &&
    diameter == null &&
    depth == null &&
    length == null &&
    width == null &&
    !postSection &&
    !fill &&
    embedment == null;
  const displayCount = savedCount ?? postCount;
  const holeCountForPlan = savedCount ?? postCount ?? 0;
  const holePlan =
    holeCountForPlan > 0
      ? planDeckHoleExcavation({ facts, workAreaId, holeCount: holeCountForPlan })
      : null;
  const detailGaps = deckDetailGaps(facts, workAreaId);
  const unanswered = detailGaps.length;
  const queuePrompt = deckDetailQueuePrompt(detailGaps);
  const countKey = deckCountWriteKey(facts, workAreaId);
  const countLabel =
    countKey === "deck.pile_or_post_count" ? "Number of posts" : "Number of post holes";
  const [countError, setCountError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [savingSetup, setSavingSetup] = useState(false);
  const [manualEditing, setEditing] = useState(false);
  const editing =
    manualEditing ||
    focusGapId === "post" ||
    focusGapId === "embedment" ||
    focusGapId === "fill";
  const [keptSetup, setKeptSetup] = useState(false);
  useEffect(() => {
    if (!focusGapId) return;
    let cancelled = false;
    const focusControl = () => {
      if (cancelled) return;
      const target = document.getElementById(deckPostHoleControlId(workAreaId, focusGapId));
      if (!(target instanceof HTMLElement)) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    const frame = window.requestAnimationFrame(() => {
      focusControl();
      window.requestAnimationFrame(focusControl);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [focusGapId, focusNonce, workAreaId]);

  useEffect(() => {
    if (!setupError) return;
    setupErrorRef.current?.focus();
  }, [setupError]);

  function write(fact: FactWrite) {
    return onSpecFact?.({ workAreaId, ...fact });
  }

  function saveCount(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setCountError(null);
      return;
    }
    const next = Number(trimmed);
    const writingPosts = countKey === "deck.pile_or_post_count";
    const error = deckHoleCountError(next, writingPosts ? "posts" : "holes");
    setCountError(error);
    if (error) return;
    if (writingPosts) {
      setReasonError(null);
      if (statedPosts === next) return;
      write({
        key: "deck.pile_or_post_count",
        label: "Number of posts",
        value: next,
        valueType: "number",
      });
      return;
    }
    if (postCount != null && next !== postCount && !savedReason.trim()) {
      setReasonError("Add a short reason when the hole count differs from the post count.");
      reasonRef.current?.focus();
    } else {
      setReasonError(null);
    }
    if (savedCount === next) return;
    write({ key: "deck.hole_count", label: "Hole count", value: next, valueType: "number" });
  }

  function saveReason(raw: string) {
    const next = raw.trim();
    if (!next) {
      setReasonError("Add a short reason when the hole count differs from the post count.");
      reasonRef.current?.focus();
      return;
    }
    setReasonError(null);
    if (next === savedReason) return;
    write({ key: "deck.hole_count_reason", label: "Hole count reason", value: next, valueType: "text" });
  }

  function saveMillimetres(key: string, label: string, raw: string, current: number | null) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const next = Number(trimmed);
    const error = deckHoleMillimetreError(next);
    setSizeError(error);
    if (error || current === next) return;
    write({ key, label, value: next, valueType: "number" });
    return next;
  }

  function saveDepth(raw: string) {
    const next = saveMillimetres("deck.hole_depth_mm", "Hole depth", raw, depth);
    if (next == null) return;
    if (embedmentLink === "yes" && embedment !== next) {
      write({
        key: "deck.post_embedment_mm",
        label: "Post embedded depth",
        value: next,
        valueType: "number",
      });
    }
  }

  const typicalFacts: FactWrite[] = typicalPostHoleSetupFacts({
    concreteExcluded,
  });

  async function applyTypicalSetup() {
    setSetupError(null);
    setSavingSetup(true);
    try {
      if (onSpecFacts) {
        const result = await onSpecFacts({ workAreaId, facts: typicalFacts });
        if (result && "error" in result && result.error) {
          setSetupError(result.error);
          return;
        }
      } else {
        for (const fact of typicalFacts) write(fact);
      }
      setEditing(false);
      setKeptSetup(false);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "The setup was not saved.");
    } finally {
      setSavingSetup(false);
    }
  }

  const setupChanges = usingProposal
    ? []
    : typicalSetupChanges({
        shape,
        diameter,
        depth,
        length,
        width,
        postSection,
        fill,
        fillDepth,
        embedment,
        embedmentLink,
        concreteExcluded,
      });
  const typicalStored = !usingProposal && setupChanges.length === 0;
  const outsideOrdinary =
    rectangular ||
    ground === "rock" ||
    ground === "groundwater" ||
    ground === "other" ||
    ground === "not_sure" ||
    method === "machine" ||
    method === "other" ||
    method === "not_sure" ||
    (diameter != null && (diameter < 250 || diameter > 450)) ||
    (depth != null && (depth < 400 || depth > 900));
  const showHours = Boolean(ground && method && outsideOrdinary);
  const bank = holePlan?.geometry?.bankVolumeM3 ?? null;
  const smallLoad =
    bank != null &&
    bank > 0 &&
    bank <= DECK_SPOIL_SMALL_BANK_MAX_M3 &&
    loadFit !== "other" &&
    loadFit !== "unknown" &&
    accessSuitable;
  const showEditor = editing || !typicalStored;
  const answerSaving = savingKeys.length > 0 || savingSetup;
  const showSummary =
    unanswered === 0 && !manualEditing && !focusGapId && !forceOpen && !setupError;

  if (!deckPostsInScope(facts, workAreaId)) return null;

  if (showSummary) {
    return (
      <section
        className="min-w-0 space-y-2 overflow-x-hidden text-foreground"
        data-post-holes="true"
        data-post-holes-summary={answerSaving ? "finishing" : "recorded"}
        aria-label="Post holes, no unanswered questions"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {answerSaving ? "Finishing details" : "Post holes"}
        </p>
        <p className="break-words text-sm text-foreground">{recordedPostHoleSummary({
          count: displayCount,
          ground,
          method,
          spoil,
        })}</p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 border-foreground/30 bg-background text-foreground"
          data-post-holes-edit=""
          onClick={() => setEditing(true)}
        >
          Edit
        </Button>
      </section>
    );
  }

  return (
    <section
      className="min-w-0 space-y-3 overflow-x-hidden scroll-mb-40 text-foreground md:scroll-mb-24"
      data-post-holes="true"
      data-post-holes-focus={focusGapId ?? undefined}
      aria-label={
        unanswered === 0 ? "Post holes, no unanswered questions" : queuePrompt
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Post holes</p>
          {unanswered > 0 ? (
            <p className="text-sm text-foreground" data-post-hole-queue="">
              {queuePrompt}
            </p>
          ) : null}
        </div>
        {unanswered === 0 ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-foreground/30 bg-background text-foreground"
            data-post-holes-close=""
            onClick={() => setEditing(false)}
          >
            Close
          </Button>
        ) : null}
      </div>
      <NumberField
        id={`deck-hole-count-${workAreaId}`}
        label={countLabel}
        value={countKey === "deck.pile_or_post_count" ? (statedPosts ?? "") : (displayCount ?? "")}
        min={1}
        error={countError}
        errorAttr="data-hole-count-error"
        saving={savingKeys.includes(countKey)}
        onCommit={saveCount}
      />
      {countKey === "deck.pile_or_post_count" && savedCount != null ? (
        <p className="text-sm text-foreground" data-saved-hole-count="">
          A hole count of {savedCount} is saved separately. Enter the number of posts.
        </p>
      ) : null}
      {postCount != null ? (
        <p className="text-sm text-foreground">Suggested from {postCount} confirmed posts.</p>
      ) : null}
      {postCount != null && savedCount != null && savedCount !== postCount ? (
        <div className="space-y-1.5">
          <Label className="text-sm text-foreground" htmlFor={`deck-hole-reason-${workAreaId}`}>
            Reason the hole count differs
          </Label>
          <div className="flex min-w-0 flex-col gap-2">
            <Input
              ref={reasonRef}
              className={fieldClass}
              id={`deck-hole-reason-${workAreaId}`}
              type="text"
              defaultValue={savedReason}
              aria-invalid={reasonError ? true : undefined}
              onBlur={(event) => saveReason(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-foreground/30 bg-background text-foreground"
              aria-busy={savingKeys.includes("deck.hole_count_reason") || undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => saveReason(reasonRef.current?.value ?? "")}
            >
              {savingKeys.includes("deck.hole_count_reason") ? "Saving…" : "Save"}
            </Button>
          </div>
          {reasonError ? (
            <p className="text-sm text-destructive" role="alert" data-hole-reason-error="">
              {reasonError}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Excavation</p>
      <div className="space-y-2" data-typical-setup="">
        {usingProposal ? (
          <>
            <p className="text-sm text-foreground" data-hole-assumed="">
              {typicalPostHoleSetupSummary(displayCount, concreteExcluded)}
            </p>
            <Button
              type="button"
              className="min-h-11 w-full scroll-mb-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:scroll-mb-24"
              id={`deck-hole-confirm-${workAreaId}`}
              data-hole-confirm=""
              disabled={savingSetup}
              onClick={() => void applyTypicalSetup()}
            >
              {savingSetup ? "Saving…" : "Use typical setup"}
            </Button>
          </>
        ) : typicalStored && !showEditor ? (
          <div className="space-y-2">
            <p className="text-sm text-foreground" data-setup-applied="">
              {typicalPostHoleSetupSummary(displayCount, concreteExcluded)}
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-foreground/30 bg-background text-foreground"
              onClick={() => setEditing(true)}
            >
              Edit dimensions
            </Button>
          </div>
        ) : keptSetup ? (
          <p className="text-sm text-foreground" data-setup-kept="">
            Saved answers kept.
          </p>
        ) : setupChanges.length > 0 ? (
          <div className="space-y-2" data-setup-replace-offer="">
            <p className="text-sm font-medium text-foreground">The typical setup would change saved answers.</p>
            <ul className="space-y-1 text-sm text-foreground">
              {setupChanges.map((row) => (
                <li key={row.label}>
                  {row.label}: {row.before} → {row.after}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="min-h-11 flex-1"
                id={`deck-hole-confirm-${workAreaId}`}
                data-setup-replace=""
                disabled={savingSetup}
                onClick={() => void applyTypicalSetup()}
              >
                {savingSetup ? "Saving…" : "Replace"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1 border-foreground/30 bg-background text-foreground"
                data-setup-keep=""
                onClick={() => setKeptSetup(true)}
              >
                Keep
              </Button>
            </div>
          </div>
        ) : null}
        {setupError ? (
          <p ref={setupErrorRef} tabIndex={-1} className="text-sm text-destructive outline-none" role="alert">
            {setupError}
          </p>
        ) : null}
      </div>

      {showEditor && !usingProposal ? (
        <div className="grid gap-3">
          <Choice
            id={`deck-hole-shape-${workAreaId}`}
            label="Hole shape"
            value={shape}
            placeholder="Choose a shape"
            options={[
              ["circular", "Circular"],
              ["rectangular", "Rectangular"],
            ]}
            onChange={(value) => write({ key: "deck.hole_shape", label: "Hole shape", value, valueType: "select" })}
            saving={savingKeys.includes("deck.hole_shape")}
          />
          {rectangular ? (
            <>
              <NumberField
                id={`deck-hole-length-${workAreaId}`}
                label="Hole length"
                unit="mm"
                value={length ?? ""}
                min={50}
                max={3000}
                onCommit={(raw) => saveMillimetres("deck.hole_length_mm", "Hole length", raw, length)}
                saving={savingKeys.includes("deck.hole_length_mm")}
              />
              <NumberField
                id={`deck-hole-width-${workAreaId}`}
                label="Hole width"
                unit="mm"
                value={width ?? ""}
                min={50}
                max={3000}
                onCommit={(raw) => saveMillimetres("deck.hole_width_mm", "Hole width", raw, width)}
                saving={savingKeys.includes("deck.hole_width_mm")}
              />
            </>
          ) : (
            <NumberField
              id={`deck-hole-diameter-${workAreaId}`}
              label="Hole diameter"
              unit="mm"
              value={diameter ?? ""}
              min={50}
              max={3000}
              onCommit={(raw) => saveMillimetres("deck.hole_diameter_mm", "Hole diameter", raw, diameter)}
              saving={savingKeys.includes("deck.hole_diameter_mm")}
            />
          )}
          <NumberField
            id={`deck-hole-depth-${workAreaId}`}
            label="Hole depth"
            unit="mm"
            value={depth ?? ""}
            min={50}
            max={3000}
            onCommit={saveDepth}
            saving={savingKeys.includes("deck.hole_depth_mm") || savingKeys.includes("deck.post_embedment_mm")}
          />
          {sizeError ? (
            <p className="text-sm text-destructive" data-hole-size-error="" role="alert">
              {sizeError}
            </p>
          ) : null}
          <Choice
            id={`deck-concrete-post-${workAreaId}`}
            label="Post size (mm)"
            value={postSection}
            placeholder="Choose post size"
            options={[
              ["125x125", "125×125 H5 house pile"],
              ["100x100", "100×100 H5 timber post"],
            ]}
            onChange={(value) =>
              write({ key: "deck.support_section", label: "Pile/post section", value, valueType: "select" })
            }
            saving={savingKeys.includes("deck.support_section")}
          />
        </div>
      ) : null}

      <Choice
        id={`deck-hole-ground-${workAreaId}`}
        label="Ground"
        value={ground}
        placeholder="Choose ground"
        options={[
          ["ordinary", "Ordinary soil"],
          ["rock", "Rock or hard ground"],
          ["groundwater", "Groundwater or other"],
        ]}
        onChange={(value) => {
          write({
            key: "deck.hole_ground",
            label: "Hole ground",
            value: value === "groundwater" ? "groundwater" : value,
            valueType: "select",
          });
        }}
        saving={savingKeys.includes("deck.hole_ground")}
      />
      <Choice
        id={`deck-hole-method-${workAreaId}`}
        label="Excavation method"
        value={method}
        placeholder="Choose excavation method"
        options={[
          ["hand", "Hand digging"],
          ["machine", "Machine"],
        ]}
        onChange={(value) =>
          write({ key: "deck.hole_method", label: "Excavation method", value, valueType: "select" })
        }
        saving={savingKeys.includes("deck.hole_method")}
      />
      {showHours ? (
        <div className="space-y-2">
          <NumberField
            id={`deck-hole-hours-${workAreaId}`}
            label="Expected person-hours per hole for this ground"
            unit="person-hours/hole"
            value={jobHours ?? ""}
            step="0.1"
            min={0.1}
            error={hoursError}
            onCommit={(raw) => {
              const next = Number(raw);
              if (!raw.trim() || !Number.isFinite(next) || next <= 0) {
                setHoursError("Enter the person-hours for one hole, or mark the hours unknown.");
                return;
              }
              setHoursError(null);
              write({
                key: "deck.hole_job_hours_per_hole",
                label: "Hole excavation hours",
                value: next,
                valueType: "number",
              });
              if (hoursStatus === "unknown") {
                write({
                  key: "deck.hole_hours_status",
                  label: "Hole hours status",
                  value: "entered",
                  valueType: "select",
                });
              }
            }}
            saving={savingKeys.includes("deck.hole_job_hours_per_hole")}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-foreground/30 bg-background text-foreground"
            onClick={() =>
              write({
                key: "deck.hole_hours_status",
                label: "Hole hours status",
                value: "unknown",
                valueType: "select",
              })
            }
          >
            {hoursStatus === "unknown" ? "Hours unknown — price required" : "Not sure — request a price"}
          </Button>
        </div>
      ) : null}

      <Choice
        id={`deck-spoil-${workAreaId}`}
        label="Spoil destination"
        value={spoil}
        placeholder="Choose spoil destination"
        options={[
          ["on_site", "Remain on site"],
          ["off_site", "Leave site"],
          ["not_sure", "Not sure"],
        ]}
        onChange={(value) => {
          const related: FactWrite[] = [
            { key: "deck.spoil_destination", label: "Spoil destination", value, valueType: "select" },
          ];
          if (value !== "off_site") {
            related.push(
              {
                key: "deck.spoil_haulage_choice",
                label: "Spoil haulage choice",
                value: "invalid",
                valueType: "select",
              },
              {
                key: "deck.spoil_tip_choice",
                label: "Spoil tip choice",
                value: "invalid",
                valueType: "select",
              }
            );
          }
          if (related.length > 1 && onSpecFacts) {
            void onSpecFacts({ workAreaId, facts: related });
            return;
          }
          void write(related[0]);
        }}
        saving={
          savingKeys.includes("deck.spoil_destination") ||
          savingKeys.includes("deck.spoil_haulage_choice") ||
          savingKeys.includes("deck.spoil_tip_choice")
        }
      />
      {spoil === "on_site" ? (
        <p className="text-sm text-foreground">Spoil stays on site. No loading or tip charge.</p>
      ) : null}
      {spoil === "off_site" && bank != null ? (
        <div className="space-y-3">
          <p className="text-sm text-foreground">Bank excavation {bank.toFixed(3)} bank m³.</p>
          {!smallLoad ? (
            <p className="text-sm text-foreground">This load needs a job price.</p>
          ) : null}
          <Allowance
            id={`deck-spoil-haulage-${workAreaId}`}
            title="Loading and local haulage"
            amount={DECK_SPOIL_HAULAGE_ALLOWANCE_EX_GST}
            scope={DECK_SPOIL_HAULAGE_SHORT}
            detail={DECK_SPOIL_HAULAGE_SCOPE}
            choice={haulageChoice}
            jobCost={haulageCost}
            offerAllowance={smallLoad}
            onChoice={(value) =>
              write({
                key: "deck.spoil_haulage_choice",
                label: "Spoil haulage choice",
                value,
                valueType: "select",
              })
            }
            onCost={(value) =>
              write({
                key: "deck.spoil_haulage_job_cost",
                label: "Spoil haulage price",
                value,
                valueType: "number",
              })
            }
          />
          <Allowance
            id={`deck-spoil-tip-${workAreaId}`}
            title="Tip fee"
            amount={DECK_SPOIL_TIP_ALLOWANCE_EX_GST}
            scope={DECK_SPOIL_TIP_SHORT}
            detail={DECK_SPOIL_TIP_SCOPE}
            choice={tipChoice}
            jobCost={tipCost}
            offerAllowance={smallLoad}
            onChoice={(value) =>
              write({ key: "deck.spoil_tip_choice", label: "Spoil tip choice", value, valueType: "select" })
            }
            onCost={(value) =>
              write({ key: "deck.spoil_tip_job_cost", label: "Spoil tip price", value, valueType: "number" })
            }
          />
        </div>
      ) : null}

      {concreteOn ? (
        <div className="space-y-3" data-concrete-questions="">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Concrete</p>
          <Choice
            id={`deck-concrete-fill-${workAreaId}`}
            label="Concrete fill"
            value={fill}
            placeholder="Choose full or partial fill"
            options={[
              ["full", "Full concrete fill"],
              ["partial", "Partial concrete fill"],
            ]}
            onChange={(value) =>
              write({ key: "deck.concrete_fill", label: "Concrete fill", value, valueType: "select" })
            }
            saving={savingKeys.includes("deck.concrete_fill")}
          />
          {fill === "partial" ? (
            <NumberField
              id={`deck-concrete-fill-depth-${workAreaId}`}
              label="Concrete depth"
              unit="mm"
              value={fillDepth ?? ""}
              min={1}
              max={3000}
              onCommit={(raw) =>
                saveMillimetres("deck.concrete_fill_depth_mm", "Concrete fill depth", raw, fillDepth)
              }
              saving={savingKeys.includes("deck.concrete_fill_depth_mm")}
            />
          ) : null}
          <NumberField
            id={`deck-post-embedment-${workAreaId}`}
            label="Post embedded depth"
            unit="mm"
            value={embedment ?? ""}
            min={1}
            max={3000}
            onCommit={(raw) => {
              const next = saveMillimetres("deck.post_embedment_mm", "Post embedded depth", raw, embedment);
              if (next == null) return;
              write({
                key: "deck.post_embedment_linked",
                label: "Post embedment link",
                value: "no",
                valueType: "select",
              });
            }}
            saving={savingKeys.includes("deck.post_embedment_mm")}
          />
        </div>
      ) : null}

      {holePlan?.geometry && holePlan.concrete ? (
        <details data-concrete-calculation="">
          <summary className="min-h-11 cursor-pointer text-sm text-foreground">
            How quantities were calculated
          </summary>
          <ul className="space-y-1 text-sm text-foreground">
            {deckConcreteCalculationLines({
              holeCount: holeCountForPlan,
              geometry: holePlan.geometry,
              concrete: holePlan.concrete,
            }).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <details className="pt-2" data-company-bags-override="">
            <summary className="min-h-11 cursor-pointer text-sm text-foreground">Company quantity override</summary>
            <p className="text-sm text-foreground">{DECK_COMPANY_BAG_WARNING}</p>
            <NumberField
              id={`deck-company-bags-${workAreaId}`}
              label="Company quantity"
              unit="bags per hole"
              value={companyBags ?? ""}
              step="0.1"
              min={0.1}
              onCommit={(raw) => {
                const next = Number(raw);
                if (!raw.trim() || !Number.isFinite(next) || next <= 0) return;
                write({
                  key: "deck.concrete_bags_per_hole",
                  label: "Concrete bags per hole",
                  value: next,
                  valueType: "number",
                });
              }}
            />
            <NumberField
              id={`deck-concrete-yield-${workAreaId}`}
              label="Bag yield"
              unit="m³ per 20 kg bag"
              value={yieldOverride ?? ""}
              step="0.001"
              min={0.001}
              onCommit={(raw) => {
                const next = Number(raw);
                if (!raw.trim() || !Number.isFinite(next) || next <= 0) return;
                write({
                  key: "deck.concrete_bag_yield_m3",
                  label: "Concrete bag yield",
                  value: next,
                  valueType: "number",
                });
              }}
            />
          </details>
        </details>
      ) : null}
    </section>
  );
}

function recordedPostHoleSummary(input: {
  count: number | null;
  ground: string;
  method: string;
  spoil: string;
}): string {
  const groundLabel =
    input.ground === "ordinary"
      ? "ordinary soil"
      : input.ground === "rock"
        ? "rock or hard ground"
        : input.ground
          ? "groundwater or other"
          : null;
  const methodLabel =
    input.method === "hand" ? "hand digging" : input.method === "machine" ? "machine" : null;
  const spoilLabel =
    input.spoil === "on_site"
      ? "spoil remains on site"
      : input.spoil === "off_site"
        ? "spoil leaves site"
        : input.spoil === "not_sure"
          ? "spoil not sure"
          : null;
  return [
    input.count != null ? `${input.count} post holes` : null,
    groundLabel,
    methodLabel,
    spoilLabel,
  ]
    .filter(Boolean)
    .join(" · ");
}

function typicalSetupChanges(input: {
  shape: string;
  diameter: number | null;
  depth: number | null;
  length: number | null;
  width: number | null;
  postSection: string;
  fill: string;
  fillDepth: number | null;
  embedment: number | null;
  embedmentLink: string;
  concreteExcluded: boolean;
}): { label: string; before: string; after: string }[] {
  const changes: { label: string; before: string; after: string }[] = [];
  const shapeBefore =
    input.shape === "rectangular" ? "Rectangular" : input.shape === "circular" ? "Circular" : "Not set";
  if (shapeBefore !== "Circular") changes.push({ label: "Hole shape", before: shapeBefore, after: "Circular" });
  if (input.diameter !== DECK_HOLE_ASSUMED_DIAMETER_MM) {
    changes.push({
      label: "Hole diameter",
      before: millimetreLabel(input.diameter),
      after: `${DECK_HOLE_ASSUMED_DIAMETER_MM} mm`,
    });
  }
  if (input.depth !== DECK_HOLE_ASSUMED_DEPTH_MM) {
    changes.push({
      label: "Hole depth",
      before: millimetreLabel(input.depth),
      after: `${DECK_HOLE_ASSUMED_DEPTH_MM} mm`,
    });
  }
  if (input.length != null || input.width != null) {
    changes.push({ label: "Rectangular size", before: "Saved", after: "Not used" });
  }
  if (input.postSection && input.postSection !== TYPICAL_POST) {
    changes.push({
      label: "Post size",
      before: `${prettySection(input.postSection)} mm`,
      after: "125 × 125 mm",
    });
  }
  if (!input.concreteExcluded && input.fill && input.fill !== "full") {
    changes.push({
      label: "Concrete fill",
      before: input.fill === "partial" ? `Partial${input.fillDepth != null ? `, ${input.fillDepth} mm` : ""}` : input.fill,
      after: "Full",
    });
  }
  if (input.embedment != null && (input.embedment !== DECK_HOLE_ASSUMED_DEPTH_MM || input.embedmentLink === "no")) {
    changes.push({
      label: "Embedded depth",
      before: `${input.embedment} mm`,
      after: `${DECK_HOLE_ASSUMED_DEPTH_MM} mm, linked to hole depth`,
    });
  }
  return changes;
}

function Allowance({
  id,
  title,
  amount,
  scope,
  detail,
  choice,
  jobCost,
  offerAllowance,
  onChoice,
  onCost,
}: {
  id: string;
  title: string;
  amount: number;
  scope: string;
  detail: string;
  choice: string;
  jobCost: number | null;
  offerAllowance: boolean;
  onChoice: (value: string) => Promise<{ error?: string } | void> | void;
  onCost: (value: number) => Promise<{ error?: string } | void> | void;
}) {
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(jobCost != null ? String(jobCost) : "");
  const completed =
    choice === "allowance" ||
    choice === "rfq" ||
    (choice === "job" && jobCost != null && jobCost > 0);
  const summary =
    choice === "allowance"
      ? `${title} · Quotr provisional allowance · $${amount} cost ex GST`
      : choice === "job" && jobCost != null
        ? `${title} · This job · $${jobCost} cost ex GST`
        : choice === "rfq"
          ? `${title} · Price requested`
          : title;

  useEffect(() => {
    if (!error) return;
    errorRef.current?.focus();
  }, [error]);

  async function choose(value: string) {
    setError(null);
    const result = await onChoice(value);
    if (result && "error" in result && result.error) {
      setError(result.error);
      setOpen(true);
      return;
    }
    if (value !== "job") setOpen(false);
  }

  if (completed && !open && !error) {
    return (
      <div id={id} className="flex min-w-0 flex-wrap items-center justify-between gap-2" tabIndex={-1}>
        <p className="text-sm text-foreground">{summary}</p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 border-foreground/30 bg-background text-foreground"
          onClick={() => setOpen(true)}
        >
          Change
        </Button>
      </div>
    );
  }

  return (
    <div id={id} className="space-y-2 rounded-lg border border-border p-3" tabIndex={-1}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-sm text-foreground">{scope}</p>
      <details>
        <summary className="min-h-11 cursor-pointer text-sm text-foreground">About this allowance</summary>
        <p className="text-sm text-foreground">{detail}</p>
      </details>
      <div className="flex flex-col gap-2">
        {offerAllowance ? (
          <Button type="button" className="min-h-11" onClick={() => void choose("allowance")}>
            Provisional Quotr allowance ${amount} cost ex GST
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="min-h-11 border-foreground/30" onClick={() => void choose("job")}>
          Enter this job’s cost
        </Button>
        <Button type="button" variant="outline" className="min-h-11 border-foreground/30" onClick={() => void choose("rfq")}>
          Request a price
        </Button>
      </div>
      {choice === "job" ? (
        <NumberField
          id={`${id}-cost`}
          label="This job's cost"
          unit="$ ex GST"
          value={draft}
          min={1}
          onCommit={(raw) => {
            setDraft(raw);
            const next = Number(raw);
            if (!raw.trim() || !Number.isFinite(next) || next <= 0) {
              setError("Enter this job’s cost.");
              return;
            }
            void Promise.resolve(onCost(next)).then((result) => {
              if (result && "error" in result && result.error) {
                setError(result.error);
                setOpen(true);
                return;
              }
              setError(null);
              setOpen(false);
            });
          }}
        />
      ) : null}
      {error ? (
        <p ref={errorRef} tabIndex={-1} className="text-sm text-destructive outline-none" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function NumberField({
  id,
  label,
  unit,
  helper,
  value,
  min,
  max,
  step,
  error,
  errorAttr,
  saving = false,
  onCommit,
}: {
  id: string;
  label: string;
  unit?: string;
  helper?: string;
  value: string | number;
  min?: number;
  max?: number;
  step?: string;
  error?: string | null;
  errorAttr?: string;
  saving?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onCommit: (raw: string) => void;
}) {
  const fieldRef = useRef<HTMLInputElement>(null);
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-sm text-foreground" htmlFor={id}>
        {label}
        {unit ? <span> ({unit})</span> : null}
      </Label>
      {helper ? <p className="text-sm text-foreground">{helper}</p> : null}
      <Input
        ref={fieldRef}
        className={fieldClass}
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-busy={saving || undefined}
        onBlur={(event) => onCommit(event.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full border-foreground/30 bg-background text-foreground sm:w-auto"
        aria-busy={saving || undefined}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onCommit(fieldRef.current?.value ?? "")}
      >
        {saving ? "Saving…" : "Save"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert" {...(errorAttr ? { [errorAttr]: "" } : {})}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Choice({
  id,
  label,
  value,
  placeholder,
  options,
  saving = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: readonly (readonly [string, string])[];
  saving?: boolean;
  onChange: (value: string) => void;
}) {
  const selected = options.find(([optionValue]) => optionValue === value)?.[1] ?? "";
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-sm text-foreground" htmlFor={id}>
        {label}
      </Label>
      <select
        id={id}
        className={fieldClass}
        value={value}
        aria-busy={saving || undefined}
        data-choice-selected={selected || undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      {saving ? (
        <p className="text-sm text-foreground" role="status" data-choice-saving={id}>
          Saving…
        </p>
      ) : null}
    </div>
  );
}
