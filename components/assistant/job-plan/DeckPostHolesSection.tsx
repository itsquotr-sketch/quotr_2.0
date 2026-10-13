"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jobPlanNumber, jobPlanString } from "@/lib/assistant/job-plan/facts";
import {
  DECK_HOLE_ASSUMED_DEPTH_MM,
  DECK_HOLE_ASSUMED_DIAMETER_MM,
  deckHoleCountError,
  deckHoleMillimetreError,
  planDeckHoleExcavation,
} from "@/lib/estimate/deck-hole-excavation";
import {
  DECK_COMPANY_BAG_WARNING,
  DECK_POST_HOLE_FINISH,
  deckConcreteCalculationLines,
  deckPostHoleFinishItems,
  type DeckPostHoleFinishId,
} from "@/lib/estimate/deck-post-hole-result";
import { deckPostHoleControlId } from "@/lib/estimate/deck-detail-completeness";
import type { EstimateFact } from "@/lib/estimate/types";

type HoleFactWrite = (input: {
  workAreaId: string;
  key: string;
  label: string;
  value: string | number;
  valueType: "number" | "select" | "text";
}) => void;

const TYPICAL_POST = "125x125";
const TYPICAL_SIGNATURE = "assumed:circular|350|600|125x125|full|600";
const fieldClass =
  "h-11 min-h-11 w-full min-w-0 scroll-mb-40 rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:h-9 md:scroll-mb-24 md:text-sm";

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

function overlayFacts(
  facts: readonly EstimateFact[],
  workAreaId: string,
  values: Record<string, string | number | boolean>
): EstimateFact[] {
  const keys = new Set(Object.keys(values));
  const kept = facts.filter(
    (fact) => !(fact.work_area_id === workAreaId && keys.has(fact.key))
  );
  return [
    ...kept,
    ...Object.entries(values).map(([key, value]) => ({
      key,
      work_area_id: workAreaId,
      value,
      source: "user",
    })),
  ];
}

function prettySection(section: string): string {
  return section.replace(/\s*[x×]\s*/i, " × ");
}

function millimetreLabel(value: number | null): string {
  return value == null ? "Not set" : `${value} mm`;
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
  concreteKnownOff: boolean;
}): { label: string; before: string; after: string }[] {
  const changes: { label: string; before: string; after: string }[] = [];
  const shapeBefore =
    input.shape === "rectangular" ? "Rectangular" : input.shape === "circular" ? "Circular" : "Not set";
  if (shapeBefore !== "Circular") {
    changes.push({ label: "Hole shape", before: shapeBefore, after: "Circular" });
  }
  if (input.shape === "rectangular" || input.length != null) {
    changes.push({ label: "Hole length", before: millimetreLabel(input.length), after: "Not used" });
  }
  if (input.shape === "rectangular" || input.width != null) {
    changes.push({ label: "Hole width", before: millimetreLabel(input.width), after: "Not used" });
  }
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
  if (input.postSection !== TYPICAL_POST) {
    changes.push({
      label: "Post size",
      before: input.postSection ? `${prettySection(input.postSection)} mm` : "Not set",
      after: "125 × 125 mm",
    });
  }
  const fillBefore =
    input.fill === "partial"
      ? `Partial${input.fillDepth != null ? `, ${input.fillDepth} mm concrete depth` : ""}`
      : input.fill === "full"
        ? "Full"
        : "Not set";
  if (fillBefore !== "Full") {
    changes.push({ label: "Concrete fill", before: fillBefore, after: "Full" });
  }
  if (input.embedment !== DECK_HOLE_ASSUMED_DEPTH_MM || input.embedmentLink === "no") {
    changes.push({
      label: "Embedded depth",
      before:
        input.embedment == null
          ? "Not set"
          : `${input.embedment} mm${input.embedmentLink === "no" ? ", entered manually" : ""}`,
      after: `${DECK_HOLE_ASSUMED_DEPTH_MM} mm, linked to hole depth`,
    });
  }
  if (input.concreteKnownOff) {
    changes.push({ label: "Concrete footings", before: "No", after: "Yes" });
  }
  return changes;
}

export function DeckPostHolesSection({
  workAreaId,
  facts,
  onSpecFact,
  onBooleanFact,
  focusGapId = null,
}: {
  workAreaId: string;
  facts: readonly EstimateFact[];
  onSpecFact?: HoleFactWrite;
  onBooleanFact?: (input: {
    workAreaId: string;
    key: string;
    label: string;
    value: boolean;
  }) => void;
  focusGapId?: string | null;
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
  const concreteKnownOff = facts.some(
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
  const signature = jobPlanString(facts, workAreaId, "deck.hole_setup_signature") ?? "";
  const yieldOverride = jobPlanNumber(facts, workAreaId, "deck.concrete_bag_yield_m3");
  const companyBags = jobPlanNumber(facts, workAreaId, "deck.concrete_bags_per_hole");
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
  const assumedPackage = usingProposal;
  const displayCount = savedCount ?? postCount;
  const holeCountForPlan = savedCount ?? postCount ?? 0;
  const shownDiameter = diameter ?? DECK_HOLE_ASSUMED_DIAMETER_MM;
  const shownDepth = depth ?? DECK_HOLE_ASSUMED_DEPTH_MM;
  const shownPost = postSection || TYPICAL_POST;
  const shownFill = fill || "full";
  const shownEmbedment =
    embedmentLink === "no"
      ? embedment
      : embedment != null && embedmentLink !== "yes" && !usingProposal
        ? embedment
        : embedmentLink === "yes"
          ? (depth ?? embedment ?? shownDepth)
          : (embedment ?? shownDepth);
  const previewFacts = usingProposal
    ? overlayFacts(facts, workAreaId, {
        "deck.hole_shape": "circular",
        "deck.hole_diameter_mm": DECK_HOLE_ASSUMED_DIAMETER_MM,
        "deck.hole_depth_mm": DECK_HOLE_ASSUMED_DEPTH_MM,
        "deck.support_section": TYPICAL_POST,
        "deck.concrete_fill": "full",
        "deck.post_embedment_mm": DECK_HOLE_ASSUMED_DEPTH_MM,
        "deck.concrete_to_supports": true,
      })
    : facts;
  const holePlan =
    holeCountForPlan > 0
      ? planDeckHoleExcavation({
          facts: previewFacts,
          workAreaId,
          holeCount: holeCountForPlan,
        })
      : null;
  const concretePlan = holePlan?.concrete ?? null;
  const geometry = holePlan?.geometry ?? null;
  const finishItems = deckPostHoleFinishItems({
    sizeConfirmed: usingProposal
      ? false
      : (planDeckHoleExcavation({
          facts,
          workAreaId,
          holeCount: Math.max(holeCountForPlan, 1),
        }).draftStamp?.sizeConfirmed ?? false),
    ground,
    method,
    spoil,
    concreteOn,
    fill,
    fillDepthMm: fillDepth,
    postSection,
    embedmentMm: embedment,
  });
  const [countError, setCountError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [userDetailsOpen, setUserDetailsOpen] = useState(false);
  const [keptSetup, setKeptSetup] = useState(false);
  const detailsOpen =
    userDetailsOpen ||
    focusGapId === "post" ||
    focusGapId === "embedment" ||
    focusGapId === "fill";

  useEffect(() => {
    if (!focusGapId) return;
    let cancelled = false;
    const focusControl = () => {
      if (cancelled) return;
      const primary = document.getElementById(deckPostHoleControlId(workAreaId, focusGapId));
      const target = primary;
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
  }, [focusGapId, workAreaId]);

  function focusFinish(id: DeckPostHoleFinishId) {
    if (id === "post" || id === "embedment" || id === "fill") setUserDetailsOpen(true);
    const target = document.getElementById(deckPostHoleControlId(workAreaId, id));
    target?.scrollIntoView({ block: "nearest" });
    if (target instanceof HTMLElement) target.focus();
  }

  function markEdited() {
    if (signature.startsWith("assumed:")) {
      write(
        onSpecFact,
        workAreaId,
        "deck.hole_setup_signature",
        "Post hole setup",
        "edited",
        "text"
      );
    }
  }

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
    markEdited();
    write(onSpecFact, workAreaId, key, label, next, "number");
    return next;
  }

  function saveDepth(raw: string) {
    const next = saveMillimetres("deck.hole_depth_mm", "Hole depth", raw, depth);
    if (next == null) return;
    const linked = embedmentLink === "yes" || embedment == null;
    if (linked && embedment !== next) {
      write(onSpecFact, workAreaId, "deck.post_embedment_mm", "Post embedded depth", next, "number");
      if (embedmentLink !== "yes") {
        write(onSpecFact, workAreaId, "deck.post_embedment_linked", "Post embedment link", "yes", "select");
      }
    }
  }

  function applyTypicalSetup(turnConcreteOn: boolean) {
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
    write(onSpecFact, workAreaId, "deck.support_section", "Pile/post section", TYPICAL_POST, "select");
    write(onSpecFact, workAreaId, "deck.concrete_fill", "Concrete fill", "full", "select");
    write(
      onSpecFact,
      workAreaId,
      "deck.post_embedment_mm",
      "Post embedded depth",
      DECK_HOLE_ASSUMED_DEPTH_MM,
      "number"
    );
    write(onSpecFact, workAreaId, "deck.post_embedment_linked", "Post embedment link", "yes", "select");
    write(
      onSpecFact,
      workAreaId,
      "deck.hole_setup_signature",
      "Post hole setup",
      TYPICAL_SIGNATURE,
      "text"
    );
    if (turnConcreteOn && !concreteOn) {
      onBooleanFact?.({
        workAreaId,
        key: "deck.concrete_to_supports",
        label: "Concrete post footings",
        value: true,
      });
    }
  }

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
  const countLabel = displayCount != null ? String(displayCount) : "Post";
  const fillClause =
    shownFill === "partial"
      ? `partial concrete fill${fillDepth != null ? `, ${fillDepth} mm concrete depth` : ""}`
      : "full concrete fill";
  const sizeLine = rectangular
    ? `${length ?? "—"} mm × ${width ?? "—"} mm × ${depth ?? "—"} mm · ${prettySection(shownPost)} mm posts · ${fillClause}`
    : `${shownDiameter} mm diameter × ${shownDepth} mm deep · ${prettySection(shownPost)} mm posts · ${shownEmbedment ?? shownDepth} mm embedment · ${fillClause}`;
  const bank = geometry?.bankVolumeM3;
  const net = concretePlan?.netM3;
  const bags = concretePlan?.bags;
  const setupChanges = usingProposal ? [] : typicalSetupChanges({
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
    concreteKnownOff,
  });
  const typicalStored = !usingProposal && setupChanges.length === 0;
  const groundCanAdopt = ground === "" || ground === "ordinary";
  const methodCanAdopt = method === "" || method === "hand";
  const showOrdinaryHand =
    groundCanAdopt && methodCanAdopt && !(ground === "ordinary" && method === "hand");

  return (
    <section
      className="min-w-0 space-y-3 overflow-x-hidden scroll-mb-40 rounded-lg border border-border bg-card p-3 text-foreground md:scroll-mb-24"
      data-post-holes="true"
      data-post-holes-focus={focusGapId ?? undefined}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Post holes</h3>
        <p className="text-sm leading-5 text-foreground/80">
          Hole count usually matches the posts. A different count needs a short reason.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-card p-3" data-typical-setup="">
        <p className="text-sm font-semibold text-foreground">
          {countLabel} post holes
          {usingProposal ? " · Typical setup proposed" : ""}
        </p>
        <p className="text-sm leading-5 text-foreground">{sizeLine}</p>
        {assumedPackage ? (
          <p className="text-sm text-foreground" data-hole-assumed="">
            Assumed for estimating. This is not a measured size and not a structural requirement.
          </p>
        ) : null}
        <p className="text-sm text-foreground" data-excavation-volume="">
          {bank == null
            ? "Add the hole count to see bank spoil."
            : `Bank spoil ${bank.toFixed(3)} m³`}
          {concreteOn || usingProposal
            ? net != null
              ? ` · Net concrete ${net.toFixed(3)} m³ · ${bags ?? 0} × 20 kg bags`
              : " · Concrete quantity still needs a complete hole."
            : " · Concrete footings are off."}
        </p>
        <details className="text-sm text-foreground/80">
          <summary className="min-h-11 cursor-pointer py-2">Bank spoil and concrete fill</summary>
          <p className="pb-1 leading-5">
            Bank spoil is the soil dug out. Concrete fill is what goes back around the post.
          </p>
        </details>
        {usingProposal ? (
          <Button
            type="button"
            className="min-h-11 w-full scroll-mb-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:scroll-mb-24"
            id={`deck-hole-confirm-${workAreaId}`}
            data-hole-confirm=""
            onClick={() => applyTypicalSetup(!concreteOn)}
          >
            Use this setup
          </Button>
        ) : typicalStored ? (
          <p className="text-sm text-foreground" data-setup-applied="">
            This setup is saved: 350 mm diameter × 600 mm deep, 125 × 125 mm posts, full fill, 600 mm embedment.
          </p>
        ) : keptSetup ? (
          <p className="text-sm text-foreground" data-setup-kept="">
            Saved answers kept.
          </p>
        ) : (
          <div className="space-y-2" data-setup-replace-offer="">
            <p className="text-sm font-medium text-foreground">
              The typical setup would change saved answers.
            </p>
            <ul className="space-y-1 text-sm text-foreground">
              {setupChanges.map((row) => (
                <li key={row.label}>
                  {row.label}: {row.before} → {row.after}
                </li>
              ))}
            </ul>
            <p className="text-sm text-foreground/80">
              Company quantity, bag yield, ground, excavation method, and spoil stay as saved.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="min-h-11 flex-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-setup-replace=""
                onClick={() => {
                  applyTypicalSetup(concreteKnownOff || !concreteOn);
                  setKeptSetup(false);
                }}
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1 border-foreground/30 bg-background text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-setup-keep=""
                onClick={() => setKeptSetup(true)}
              >
                Keep
              </Button>
            </div>
          </div>
        )}
      </div>

      <NumberField
        id={`deck-hole-count-${workAreaId}`}
        label="Number of post holes"
        helper="Count"
        value={displayCount ?? ""}
        min={1}
        error={countError}
        errorAttr="data-hole-count-error"
        onCommit={saveCount}
      />
      {postCount != null && savedCount != null && savedCount !== postCount ? (
        <div className="space-y-1.5">
          <Label className="text-sm text-foreground" htmlFor={`deck-hole-reason-${workAreaId}`}>
            Reason the hole count differs from the posts
          </Label>
          <Input
            ref={reasonRef}
            className={fieldClass}
            id={`deck-hole-reason-${workAreaId}`}
            type="text"
            defaultValue={savedReason}
            aria-invalid={reasonError ? true : undefined}
            onBlur={(event) => {
              const next = event.target.value.trim();
              if (!next) {
                setReasonError("Add a short reason when the hole count differs from the post count.");
                return;
              }
              setReasonError(null);
              if (next === savedReason) return;
              write(onSpecFact, workAreaId, "deck.hole_count_reason", "Hole count reason", next, "text");
            }}
          />
          {reasonError ? (
            <p className="text-sm text-destructive" role="alert" data-hole-reason-error="">
              {reasonError}
            </p>
          ) : null}
        </div>
      ) : null}

      {showOrdinaryHand ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm text-foreground">
            Suggested ground and method: ordinary soil, dug by hand. Spoil stays a separate choice.
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full border-foreground/30 bg-background text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => {
              if (!ground) {
                write(onSpecFact, workAreaId, "deck.hole_ground", "Hole ground", "ordinary", "select");
              }
              if (!method) {
                write(onSpecFact, workAreaId, "deck.hole_method", "Excavation method", "hand", "select");
              }
            }}
          >
            Use ordinary soil and hand digging
          </Button>
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
          ["groundwater", "Groundwater"],
          ["not_sure", "Not sure"],
          ["other", "Other"],
        ]}
        onChange={(value) =>
          write(onSpecFact, workAreaId, "deck.hole_ground", "Hole ground", value, "select")
        }
      />
      <Choice
        id={`deck-hole-method-${workAreaId}`}
        label="Excavation method"
        value={method}
        placeholder="Choose excavation method"
        options={[
          ["hand", "Hand digging"],
          ["machine", "Machine"],
          ["not_sure", "Not sure"],
          ["other", "Other"],
        ]}
        onChange={(value) =>
          write(onSpecFact, workAreaId, "deck.hole_method", "Excavation method", value, "select")
        }
      />
      <Choice
        id={`deck-spoil-${workAreaId}`}
        label="Spoil destination"
        value={spoil}
        placeholder="Choose spoil destination"
        options={[
          ["on_site", "Keep spoil on site"],
          ["off_site", "Take spoil off site"],
          ["not_sure", "Not sure"],
        ]}
        onChange={(value) =>
          write(onSpecFact, workAreaId, "deck.spoil_destination", "Spoil destination", value, "select")
        }
      />
      {spoil === "off_site" ? (
        <p className="text-sm leading-5 text-foreground" data-spoil-off-site="">
          Off-site spoil uses the bank volume. A missing haul or tip price stays Pricing Required.
        </p>
      ) : null}
      {spoil === "not_sure" || ground === "not_sure" || method === "not_sure" ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Not sure leaves that part Pricing Required. It is not priced as ordinary soil, hand digging, or on-site spoil.
        </p>
      ) : null}

      {onBooleanFact ? (
        <Choice
          id={`deck-concrete-included-${workAreaId}`}
          label="Concrete footings"
          value={concreteOn ? "yes" : concreteKnownOff ? "no" : ""}
          placeholder="Choose whether concrete is included"
          options={[
            ["yes", "Concrete included"],
            ["no", "No concrete"],
          ]}
          onChange={(value) =>
            onBooleanFact({
              workAreaId,
              key: "deck.concrete_to_supports",
              label: "Concrete post footings",
              value: value === "yes",
            })
          }
        />
      ) : null}

      {finishItems.length > 0 ? (
        <div className="space-y-1" data-post-hole-todo="">
          <p className="text-sm font-medium text-foreground">Still to answer</p>
          <ul className="space-y-1">
            {finishItems.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="min-h-11 w-full scroll-mb-40 rounded-md px-2 text-left text-sm text-foreground underline-offset-2 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring md:scroll-mb-24"
                  onClick={() => focusFinish(id)}
                >
                  {DECK_POST_HOLE_FINISH[id]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {outsideOrdinary && jobHours == null ? (
        <p className="text-sm text-foreground">
          Outside the ordinary hand-dug starter. Enter person-hours per hole, or excavation stays Pricing Required.
        </p>
      ) : null}

      <details
        id={`deck-hole-details-${workAreaId}`}
        className="rounded-lg border border-border p-3"
        data-hole-details=""
        open={detailsOpen}
        onToggle={(event) => setUserDetailsOpen(event.currentTarget.open)}
      >
        <summary className="min-h-11 cursor-pointer text-sm font-medium text-foreground">
          Change hole and concrete details
        </summary>
        <div className="mt-3 grid gap-3">
          <Choice
            id={`deck-hole-shape-${workAreaId}`}
            label="Hole shape"
            value={shape}
            placeholder="Choose a shape"
            options={[
              ["circular", "Circular"],
              ["rectangular", "Rectangular"],
            ]}
            onChange={(value) => {
              markEdited();
              write(onSpecFact, workAreaId, "deck.hole_shape", "Hole shape", value, "select");
            }}
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
              />
              <NumberField
                id={`deck-hole-width-${workAreaId}`}
                label="Hole width"
                unit="mm"
                value={width ?? ""}
                min={50}
                max={3000}
                onCommit={(raw) => saveMillimetres("deck.hole_width_mm", "Hole width", raw, width)}
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
              onCommit={(raw) =>
                saveMillimetres("deck.hole_diameter_mm", "Hole diameter", raw, diameter)
              }
            />
          )}
          <NumberField
            id={rectangular ? `deck-hole-rect-depth-${workAreaId}` : `deck-hole-depth-${workAreaId}`}
            label="Hole depth"
            unit="mm"
            value={depth ?? ""}
            min={50}
            max={3000}
            onCommit={saveDepth}
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
            onChange={(value) => {
              markEdited();
              write(onSpecFact, workAreaId, "deck.support_section", "Pile/post section", value, "select");
            }}
          />
          <p className="text-sm text-foreground/80">
            Used for the pile and for the concrete displaced by the post.
          </p>
          <NumberField
            id={`deck-post-embedment-${workAreaId}`}
            label="Post embedded depth"
            unit="mm"
            value={embedment ?? ""}
            min={1}
            max={3000}
            onCommit={(raw) => {
              const next = saveMillimetres(
                "deck.post_embedment_mm",
                "Post embedded depth",
                raw,
                embedment
              );
              if (next == null) return;
              write(
                onSpecFact,
                workAreaId,
                "deck.post_embedment_linked",
                "Post embedment link",
                "no",
                "select"
              );
            }}
          />
          <p className="text-sm text-foreground/80">
            Matches the hole depth while linked. A depth you type stays as entered.
          </p>
          {concreteOn || usingProposal ? (
            <Choice
              id={`deck-concrete-fill-${workAreaId}`}
              label="Concrete fill"
              value={fill}
              placeholder="Choose full or partial fill"
              options={[
                ["full", "Full concrete fill"],
                ["partial", "Partial concrete fill"],
              ]}
              onChange={(value) => {
                markEdited();
                write(onSpecFact, workAreaId, "deck.concrete_fill", "Concrete fill", value, "select");
              }}
            />
          ) : null}
          {fill === "partial" ? (
            <NumberField
              id={`deck-concrete-fill-depth-${workAreaId}`}
              label="Concrete depth"
              unit="mm"
              value={fillDepth ?? ""}
              min={1}
              max={3000}
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
              write(onSpecFact, workAreaId, "deck.concrete_bag_yield_m3", "Concrete bag yield", next, "number");
            }}
          />
          <details data-company-bags-override="">
            <summary className="min-h-11 cursor-pointer text-sm text-foreground">
              Company quantity override
            </summary>
            <div className="grid gap-3 pt-2">
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
          </details>
          <NumberField
            id={`deck-hole-hours-${workAreaId}`}
            label="Job productivity"
            unit="person-hours per hole"
            value={jobHours ?? ""}
            step="0.1"
            min={0.1}
            onCommit={(raw) => {
              const next = Number(raw);
              if (!raw.trim() || !Number.isFinite(next) || next <= 0) {
                setSizeError("Enter the person-hours for one hole.");
                return;
              }
              setSizeError(null);
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
          {geometry && concretePlan ? (
            <details data-concrete-calculation="">
              <summary className="min-h-11 cursor-pointer text-sm text-foreground">
                How the quantities were calculated
              </summary>
              <ul className="space-y-1 text-sm text-foreground/80">
                {deckConcreteCalculationLines({
                  holeCount: holeCountForPlan,
                  geometry,
                  concrete: concretePlan,
                }).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </details>
    </section>
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
  text = false,
  inputRef,
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
  text?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onCommit: (raw: string) => void;
}) {
  const unitId = `${id}-unit`;
  const helperId = `${id}-helper`;
  const describedBy = [unit ? unitId : null, helper ? helperId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-sm text-foreground" htmlFor={id}>
        {label}
        {unit ? <span id={unitId}> ({unit})</span> : null}
      </Label>
      {helper ? (
        <p id={helperId} className="text-sm text-foreground/80">
          {helper}
        </p>
      ) : null}
      <Input
        ref={inputRef}
        className={fieldClass}
        id={id}
        type={text ? "text" : "number"}
        inputMode={text ? "text" : "decimal"}
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        onBlur={(event) => onCommit(event.target.value)}
      />
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
    <div className="min-w-0 space-y-1.5">
      <Label className="text-sm text-foreground" htmlFor={id}>
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
