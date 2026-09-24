"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DNA_CALIBRATE,
  DNA_RECALIBRATE,
  DNA_RESET_CTA,
  DNA_SOURCE_QUOTR_BENCHMARK,
  DNA_SOURCE_YOUR_CALIBRATION,
  formatDnaCompactHoursPerUnit,
  formatDnaOptionalRemaining,
  formatDnaRwSystemLine,
} from "@/lib/company-dna/copy";
import { resetCompanyDnaCalibration } from "@/lib/company-dna/actions";
import {
  nextCompanyDnaV2Task,
  v2HubHref,
} from "@/lib/company-dna/v2-ui";
import {
  listRwSystemProgress,
  rwSystemOfTask,
} from "@/lib/company-dna/rw-v2";
import {
  formatProductivityHours,
  formatRateUnit,
} from "@/lib/rates/catalogue";
import { upsertRate } from "@/lib/rates/actions";
import {
  buildProductivityRegistry,
  filterProductivityGroups,
  productivityEffectiveSourceLabel,
  productivityLegacyLabel,
  type ProductivityRegistryItem,
  type ProductivityStatusFilter,
  type ProductivityWorkAreaGroup,
} from "@/lib/rates/productivity-registry";
import { summarizeProductivityWorkAreas } from "@/lib/rates/productivity-work-area-summary";
import type { RatesPageRate } from "@/lib/rates/types";
import { cn } from "@/lib/utils";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import {
  RateEditDialog,
  parseOptionalNumber,
  type RateEditValues,
} from "./RateEditDialog";

type ProductivityByWorkAreaProps = {
  rates: RatesPageRate[];
  preferredWorkAreaTypes?: string[];
  canCalibrate?: boolean;
  readOnly?: boolean;
  companyGrossMarginPercent?: number;
  onRatesChange: (rates: RatesPageRate[]) => void;
  onChanged?: () => void;
};

const STATUS_OPTIONS: { value: ProductivityStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "customised", label: "Customised" },
  { value: "benchmark", label: "Quotr benchmark" },
  { value: "pricing_required", label: "Pricing required" },
];

const RW_GROUPS = [
  ["shared", "Shared"],
  ["timber", "Timber"],
  ["sleeper", "Sleeper"],
  ["masonry", "Masonry"],
] as const;

function headerSummary(group: ProductivityWorkAreaGroup): string {
  const parts = [
    `${group.operationCount} operation${group.operationCount === 1 ? "" : "s"}`,
    `${group.customisedCount} customised`,
    `${group.benchmarkCount} Quotr benchmark${group.benchmarkCount === 1 ? "" : "s"}`,
  ];
  if (group.pricingRequiredCount > 0) {
    parts.push(`${group.pricingRequiredCount} pricing required`);
  }
  return parts.join(" · ");
}

export function ProductivityByWorkArea({
  rates,
  preferredWorkAreaTypes = [],
  canCalibrate = false,
  readOnly = false,
  companyGrossMarginPercent = DEFAULT_MARGIN_PERCENT,
  onRatesChange,
  onChanged,
}: ProductivityByWorkAreaProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProductivityStatusFilter>("all");
  const [openAreas, setOpenAreas] = useState<Record<string, boolean>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState(false);
  const [dnaTasksOpen, setDnaTasksOpen] = useState<Record<string, boolean>>({});

  const { groups: allGroups, items: allItems } = useMemo(
    () =>
      buildProductivityRegistry({
        rates,
        editable: !readOnly,
        preferredWorkAreaTypes,
      }),
    [rates, readOnly, preferredWorkAreaTypes]
  );

  const dnaSummaries = useMemo(
    () => summarizeProductivityWorkAreas(rates, preferredWorkAreaTypes),
    [rates, preferredWorkAreaTypes]
  );

  const filteredGroups = useMemo(
    () =>
      filterProductivityGroups({
        groups: allGroups,
        query,
        status,
      }),
    [allGroups, query, status]
  );

  const rateMap = useMemo(
    () => new Map(rates.map((rate) => [rate.item_key, rate])),
    [rates]
  );

  const editingItem =
    allItems.find((item) => item.productivityKey === editingKey) ?? null;

  function setAllExpanded(expanded: boolean) {
    const next: Record<string, boolean> = {};
    for (const group of filteredGroups) {
      next[group.workAreaType] = expanded;
    }
    setOpenAreas(next);
  }

  async function handleSave(values: RateEditValues): Promise<boolean> {
    if (!editingItem) return false;
    setSaving(true);
    setNotice(null);
    const existing = rateMap.get(editingItem.productivityKey);
    const cost = parseOptionalNumber(values.cost_rate);
    const sell =
      values.sellMode === "derived"
        ? null
        : parseOptionalNumber(values.sell_rate);
    const result = await upsertRate({
      id: existing?.id,
      item_key: editingItem.catalogueEntry.item_key,
      rate_type: editingItem.catalogueEntry.rate_type,
      trade: editingItem.catalogueEntry.trade,
      work_area_type: editingItem.catalogueEntry.work_area_type,
      label: editingItem.catalogueEntry.label,
      unit: editingItem.catalogueEntry.unit,
      cost_rate: cost,
      sell_rate: sell,
      markup_percent: parseOptionalNumber(values.markup_percent),
      active: values.active,
    });
    setSaving(false);
    if (result.error) {
      setNotice(result.error);
      return false;
    }
    if (result.rate) {
      const nextRates = existing
        ? rates.map((rate) =>
            rate.id === result.rate!.id ? result.rate! : rate
          )
        : [...rates, result.rate];
      onRatesChange(nextRates);
      setNotice("Regenerate an estimate to apply updated rates.");
      setOpenAreas((prev) => ({
        ...prev,
        [editingItem.workAreaType]: true,
      }));
    }
    return true;
  }

  async function onResetDna(taskKey: string, workAreaType: string) {
    setResetting(taskKey);
    setNotice(null);
    const outcome = await resetCompanyDnaCalibration(taskKey);
    setResetting(null);
    if (outcome.error) {
      setNotice(outcome.error);
      return;
    }
    setNotice("Future estimates will use the Quotr benchmark for this task.");
    setOpenAreas((prev) => ({ ...prev, [workAreaType]: true }));
    onChanged?.();
  }

  const areaCount = filteredGroups.length;
  const operationCount = filteredGroups.reduce(
    (sum, group) => sum + group.operationCount,
    0
  );

  return (
    <div className="space-y-3" data-productivity-by-work-area>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight">
          Labour productivity
        </h3>
        <p className="text-sm text-muted-foreground">
          Hours required per unit. Lower values mean less labour time.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search work areas, tasks, keys, units"
          aria-label="Search labour productivity"
          className="h-11 min-h-11 max-w-md sm:h-9 sm:min-h-9"
        />
        <label className="flex min-h-11 items-center gap-2 text-sm sm:min-h-9">
          <span className="sr-only">Status filter</span>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ProductivityStatusFilter)
            }
            aria-label="Filter by productivity status"
            className="h-11 min-h-11 rounded-md border border-input bg-background px-3 text-sm sm:h-9 sm:min-h-9"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 min-h-11 sm:h-8 sm:min-h-8"
            onClick={() => setAllExpanded(true)}
          >
            Expand all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 min-h-11 sm:h-8 sm:min-h-8"
            onClick={() => setAllExpanded(false)}
          >
            Collapse all
          </Button>
        </div>
        <p className="text-xs text-muted-foreground sm:ml-auto">
          {areaCount} work area{areaCount === 1 ? "" : "s"} · {operationCount}{" "}
          operation{operationCount === 1 ? "" : "s"}
        </p>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={showKeys}
          onChange={(event) => setShowKeys(event.target.checked)}
          className="size-4"
        />
        Show technical keys
      </label>

      {notice ? (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}

      {filteredGroups.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
          No productivity rates match this search or filter.
        </p>
      ) : (
        <div className="space-y-2">
          {filteredGroups.map((group) => {
            const searching = query.trim().length > 0;
            const open = searching || Boolean(openAreas[group.workAreaType]);
            const dna = dnaSummaries.find(
              (row) => row.workAreaType === group.workAreaType
            );
            const calibrationSupported = group.calibrationSupported && dna;
            const calibratedKeys =
              dna?.tasks
                .filter((row) => row.calibrated)
                .map((row) => row.task.calibrationTaskKey) ?? [];
            const panelId = `productivity-panel-${group.workAreaType}`;
            const headerId = `productivity-header-${group.workAreaType}`;

            return (
              <section
                key={group.workAreaType}
                className="rounded-lg border border-border/60"
                data-productivity-work-area={group.workAreaType}
                data-productivity-generation={dna?.generation}
              >
                <h4 className="m-0">
                  <button
                    type="button"
                    id={headerId}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="flex w-full items-start gap-2 px-3 py-3 text-left"
                    onClick={() =>
                      setOpenAreas((prev) => ({
                        ...prev,
                        [group.workAreaType]: !open,
                      }))
                    }
                  >
                    <ChevronDown
                      className={cn(
                        "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                        open ? "rotate-0" : "-rotate-90"
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {group.workAreaLabel}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {headerSummary(group)}
                        {calibrationSupported && dna
                          ? dna.status === "calibrated"
                            ? " · Ready"
                            : dna.status === "partly"
                              ? ` · ${dna.statusLabel}`
                              : ""
                          : ""}
                      </span>
                      {calibrationSupported && dna?.summaryLine ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {dna.summaryLine}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </h4>

                {open ? (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={headerId}
                    className="space-y-3 border-t border-border/60 px-3 py-3"
                  >
                    {calibrationSupported && dna ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {dna.generation !== "v1" ? (
                          <Link
                            href={v2HubHref({
                              workAreaType: group.workAreaType as
                                | "deck"
                                | "fence"
                                | "retaining_wall"
                                | "bathroom",
                              status: dna.status,
                              nextTaskKey: nextCompanyDnaV2Task({
                                workAreaType: group.workAreaType,
                                calibratedTaskKeys: calibratedKeys,
                              })?.calibrationTaskKey,
                            })}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "h-11 min-h-11 sm:h-8 sm:min-h-8"
                            )}
                            data-company-dna-rates-cta
                          >
                            {dna.cta}
                          </Link>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-11 min-h-11 sm:h-8 sm:min-h-8"
                          onClick={() =>
                            setDnaTasksOpen((prev) => ({
                              ...prev,
                              [group.workAreaType]: !prev[group.workAreaType],
                            }))
                          }
                        >
                          {dnaTasksOpen[group.workAreaType]
                            ? "Hide tasks"
                            : "Show tasks"}
                        </Button>
                        {dna.status === "calibrated" &&
                        dna.optionalTotal > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {formatDnaOptionalRemaining({
                              optionalTotal: dna.optionalTotal,
                              optionalCalibrated: dna.optionalCalibrated,
                            })}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {calibrationSupported &&
                    dna &&
                    dnaTasksOpen[group.workAreaType] ? (
                      <DnaTaskPanel
                        dna={dna}
                        rates={rates}
                        canCalibrate={canCalibrate}
                        resetting={resetting}
                        onReset={(taskKey) =>
                          void onResetDna(taskKey, group.workAreaType)
                        }
                      />
                    ) : null}

                    {group.workAreaType === "cladding" ? (
                      <>
                        <h4 className="pt-2 text-sm font-medium">
                          Cladding installation
                        </h4>
                        <ProductivityOperationsList
                          items={group.ordinaryItems.filter(
                            (item) =>
                              item.productivityKey.includes(".install.") &&
                              !item.productivityKey.includes(".cavity.") &&
                              !item.productivityKey.includes(".wall_underlay.") &&
                              !item.productivityKey.includes(".rigid_air_barrier.")
                          )}
                          showKeys={showKeys}
                          readOnly={readOnly}
                          onEdit={(item) => {
                            setEditingKey(item.productivityKey);
                            setNotice(null);
                          }}
                        />
                        <h4 className="pt-2 text-sm font-medium">
                          Cladding accessories
                        </h4>
                        <ProductivityOperationsList
                          items={group.ordinaryItems.filter(
                            (item) =>
                              item.productivityKey.includes(".cavity.") ||
                              item.productivityKey.includes(".wall_underlay.") ||
                              item.productivityKey.includes(".rigid_air_barrier.")
                          )}
                          showKeys={showKeys}
                          readOnly={readOnly}
                          onEdit={(item) => {
                            setEditingKey(item.productivityKey);
                            setNotice(null);
                          }}
                        />
                        <h4 className="pt-2 text-sm font-medium">
                          Cladding removal
                        </h4>
                        <ProductivityOperationsList
                          items={group.ordinaryItems.filter((item) =>
                            item.productivityKey.includes(".remove.")
                          )}
                          showKeys={showKeys}
                          readOnly={readOnly}
                          onEdit={(item) => {
                            setEditingKey(item.productivityKey);
                            setNotice(null);
                          }}
                        />
                      </>
                    ) : (
                    <ProductivityOperationsList
                      items={group.ordinaryItems}
                      showKeys={showKeys}
                      readOnly={readOnly}
                      onEdit={(item) => {
                        setEditingKey(item.productivityKey);
                        setNotice(null);
                      }}
                    />
                    )}

                    {group.legacyItems.length > 0 ? (
                      <details className="rounded-md border border-dashed border-border/70 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                          Legacy rates ({group.legacyItems.length}) — not used
                          for detailed estimating
                        </summary>
                        <div className="mt-2">
                          <ProductivityOperationsList
                            items={group.legacyItems}
                            showKeys={showKeys}
                            readOnly={readOnly}
                            legacy
                            onEdit={(item) => {
                              setEditingKey(item.productivityKey);
                              setNotice(null);
                            }}
                          />
                        </div>
                      </details>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {editingItem && !readOnly ? (
        <RateEditDialog
          key={`${editingItem.productivityKey}-${rateMap.get(editingItem.productivityKey)?.id ?? "new"}`}
          open={Boolean(editingItem)}
          onOpenChange={(open) => {
            if (!open) setEditingKey(null);
          }}
          catalogueEntry={editingItem.catalogueEntry}
          existingRate={rateMap.get(editingItem.productivityKey) ?? null}
          companyGrossMarginPercent={companyGrossMarginPercent}
          onSave={handleSave}
          saving={saving}
        />
      ) : null}
    </div>
  );
}

function ProductivityOperationsList({
  items,
  showKeys,
  readOnly,
  legacy = false,
  onEdit,
}: {
  items: ProductivityRegistryItem[];
  showKeys: boolean;
  readOnly: boolean;
  legacy?: boolean;
  onEdit: (item: ProductivityRegistryItem) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No operations in this group.</p>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden" data-rates-compact-list>
      <div className="hidden border-b border-border/60 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(0,0.45fr)_auto_auto] sm:gap-3">
        <span>Operation</span>
        <span>Your productivity</span>
        <span>Quotr benchmark</span>
        <span>Unit</span>
        <span>Status</span>
        <span className="text-right">Edit</span>
      </div>
      {items.map((item) => {
        const hasCompany = item.companyOverrideHours != null;
        const statusLabel = productivityEffectiveSourceLabel(
          item.effectiveSource
        );
        const legacyLabel = productivityLegacyLabel(item.legacyKind);
        return (
          <div
            key={item.productivityKey}
            className="border-b border-border/50 py-3 last:border-0 sm:grid sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(0,0.45fr)_auto_auto] sm:items-center sm:gap-3 sm:py-2.5"
            data-productivity-key={item.productivityKey}
            data-productivity-legacy={legacy ? "true" : "false"}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{item.label}</p>
              {item.description ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
              {showKeys ? (
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">
                  {item.productivityKey}
                </p>
              ) : null}
              {legacy && legacyLabel ? (
                <Badge variant="outline" className="mt-1 w-fit text-[10px]">
                  {legacyLabel}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1.5 text-sm tabular-nums sm:mt-0">
              <span className="text-xs text-muted-foreground sm:hidden">
                Your productivity{" "}
              </span>
              {formatProductivityHours(item.companyOverrideHours, item.unit)}
            </p>
            <p className="text-sm text-muted-foreground tabular-nums">
              <span className="text-xs sm:hidden">Quotr benchmark </span>
              {item.benchmarkHours != null
                ? formatProductivityHours(item.benchmarkHours, item.unit)
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              h/{formatRateUnit(item.unit)}
            </p>
            <Badge
              variant={hasCompany ? "secondary" : "outline"}
              className="mt-1.5 w-fit text-[10px] sm:mt-0"
            >
              {statusLabel}
            </Badge>
            <div className="mt-2 sm:mt-0 sm:justify-self-end">
              {readOnly ? null : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 min-h-11 sm:h-8 sm:min-h-8"
                  onClick={() => onEdit(item)}
                >
                  <Pencil className="mr-1 size-3.5" />
                  {hasCompany ? "Edit" : "Add"}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DnaTaskPanel(params: {
  dna: ReturnType<typeof summarizeProductivityWorkAreas>[number];
  rates: RatesPageRate[];
  canCalibrate: boolean;
  resetting: string | null;
  onReset: (taskKey: string) => void;
}) {
  const { dna, rates, canCalibrate, resetting, onReset } = params;
  const calibratedKeys = dna.tasks
    .filter((row) => row.calibrated)
    .map((row) => row.task.calibrationTaskKey);
  const rwSystems =
    dna.workAreaType === "retaining_wall"
      ? listRwSystemProgress(calibratedKeys)
      : [];

  if (dna.workAreaType === "retaining_wall") {
    return (
      <div className="space-y-3 rounded-md bg-muted/15 px-2.5 py-2">
        {RW_GROUPS.map(([groupKey, heading]) => {
          const rows = dna.tasks.filter(
            (row) => rwSystemOfTask(row.task.calibrationTaskKey) === groupKey
          );
          if (rows.length === 0) return null;
          const systemRow =
            groupKey === "shared"
              ? null
              : rwSystems.find((item) => item.system === groupKey);
          return (
            <div key={groupKey} data-company-dna-rate-group={groupKey}>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {heading}
                {systemRow
                  ? ` · ${formatDnaRwSystemLine(systemRow).replace(`${systemRow.label}: `, "")}`
                  : ""}
              </p>
              <div className="space-y-2">
                {rows.map((row) => (
                  <DnaTaskRow
                    key={row.task.calibrationTaskKey}
                    row={row}
                    rates={rates}
                    canCalibrate={canCalibrate}
                    resetting={resetting}
                    onReset={onReset}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md bg-muted/15 px-2.5 py-2">
      {dna.tasks.map((row) => (
        <DnaTaskRow
          key={row.task.calibrationTaskKey}
          row={row}
          rates={rates}
          canCalibrate={canCalibrate}
          resetting={resetting}
          onReset={onReset}
        />
      ))}
    </div>
  );
}

function DnaTaskRow(params: {
  row: {
    task: {
      calibrationTaskKey: string;
      label: string;
      productivityRateKey: string;
      authorityUnit: string;
      benchmarkProductivity: number;
    };
    calibrated: boolean;
  };
  rates: RatesPageRate[];
  canCalibrate: boolean;
  resetting: string | null;
  onReset: (taskKey: string) => void;
}) {
  const rate = params.rates.find(
    (item) =>
      item.item_key === params.row.task.productivityRateKey &&
      item.rate_type === "productivity" &&
      item.active
  );
  const used =
    rate?.active && rate.cost_rate != null
      ? rate.source === "calibrated_productivity"
        ? DNA_SOURCE_YOUR_CALIBRATION
        : "Your company rate"
      : DNA_SOURCE_QUOTR_BENCHMARK;
  const calibrated =
    rate?.active &&
    rate.cost_rate != null &&
    rate.source === "calibrated_productivity";

  return (
    <div
      className="rounded-md bg-background/60 px-2.5 py-2"
      data-company-dna-rate-task={params.row.task.calibrationTaskKey}
    >
      <p className="text-sm font-medium">{params.row.task.label}</p>
      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
        {DNA_SOURCE_QUOTR_BENCHMARK}:{" "}
        {formatDnaCompactHoursPerUnit(
          params.row.task.benchmarkProductivity,
          params.row.task.authorityUnit
        )}
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {DNA_SOURCE_YOUR_CALIBRATION}:{" "}
        {rate?.cost_rate != null
          ? formatDnaCompactHoursPerUnit(
              rate.cost_rate,
              params.row.task.authorityUnit
            )
          : "—"}
      </p>
      <p className="text-xs">Used: {used}</p>
      {params.canCalibrate ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Link
            href={`/app/setup/dna/${encodeURIComponent(params.row.task.calibrationTaskKey)}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-11 min-h-11 sm:h-8 sm:min-h-8"
            )}
          >
            {calibrated ? DNA_RECALIBRATE : DNA_CALIBRATE}
          </Link>
          {calibrated ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 min-h-11 sm:h-8 sm:min-h-8"
              disabled={params.resetting === params.row.task.calibrationTaskKey}
              onClick={() => params.onReset(params.row.task.calibrationTaskKey)}
            >
              {DNA_RESET_CTA}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
