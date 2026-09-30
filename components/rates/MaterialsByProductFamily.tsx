"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRateUnit } from "@/lib/rates/catalogue";
import { upsertRate } from "@/lib/rates/actions";
import { formatMoney } from "@/lib/rates/cost-first-presentation";
import {
  RateField,
  RateGridHeader,
  RateGridRow,
  materialRateColumns,
  ratesFilterActionClass,
  ratesFilterControlClass,
  ratesFilterRowClass,
} from "@/components/rates/rate-row-grid";
import {
  MATERIAL_CATEGORY_NAMES,
  type MaterialCategoryId,
} from "@/lib/rates/material-presentation-map";
import {
  buildMaterialRegistry,
  filterMaterialCategories,
  listMaterialWorkAreaFilterOptions,
  materialEffectiveSourceLabel,
  materialLegacyLabel,
  type MaterialCategoryGroup,
  type MaterialFamilyGroup,
  type MaterialRegistryItem,
  type MaterialStatusFilter,
} from "@/lib/rates/material-registry";
import type { RatesPageRate } from "@/lib/rates/types";
import { cn } from "@/lib/utils";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import {
  RateEditDialog,
  parseOptionalNumber,
  type RateEditValues,
} from "./RateEditDialog";

type MaterialsByProductFamilyProps = {
  rates: RatesPageRate[];
  readOnly?: boolean;
  companyGrossMarginPercent?: number;
  onRatesChange: (rates: RatesPageRate[]) => void;
};

const STATUS_OPTIONS: { value: MaterialStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "customised", label: "Customised" },
  { value: "benchmark", label: "Quotr benchmark" },
  { value: "pricing_required", label: "Pricing Required" },
];

function categorySummary(group: MaterialCategoryGroup): string {
  const parts = [
    `${group.familyCount} product famil${group.familyCount === 1 ? "y" : "ies"}`,
    `${group.variantCount} variant${group.variantCount === 1 ? "" : "s"}`,
    `${group.customisedCount} customised`,
    `${group.benchmarkCount} Quotr benchmark${group.benchmarkCount === 1 ? "" : "s"}`,
  ];
  if (group.pricingRequiredCount > 0) {
    parts.push(`${group.pricingRequiredCount} pricing required`);
  }
  return parts.join(" · ");
}

function familySummary(family: MaterialFamilyGroup): string {
  const parts = [
    `${family.variantCount} variant${family.variantCount === 1 ? "" : "s"}`,
  ];
  if (family.statusSummary) parts.push(family.statusSummary);
  return parts.join(" · ");
}

export function MaterialsByProductFamily({
  rates,
  readOnly = false,
  companyGrossMarginPercent = DEFAULT_MARGIN_PERCENT,
  onRatesChange,
}: MaterialsByProductFamilyProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MaterialStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [workAreaFilter, setWorkAreaFilter] = useState("all");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    {}
  );
  const [openFamilies, setOpenFamilies] = useState<Record<string, boolean>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState(false);

  const { categories: allCategories, items: allItems } = useMemo(
    () =>
      buildMaterialRegistry({
        rates,
        editable: !readOnly,
      }),
    [rates, readOnly]
  );

  const filteredCategories = useMemo(
    () =>
      filterMaterialCategories({
        categories: allCategories,
        query,
        status,
        categoryId: categoryFilter,
        workArea: workAreaFilter,
      }),
    [allCategories, query, status, categoryFilter, workAreaFilter]
  );

  const workAreaOptions = useMemo(
    () => listMaterialWorkAreaFilterOptions(allItems),
    [allItems]
  );

  const rateMap = useMemo(
    () => new Map(rates.map((rate) => [rate.item_key, rate])),
    [rates]
  );

  const editingItem =
    allItems.find((item) => item.canonicalKey === editingKey) ?? null;

  const searching =
    query.trim().length > 0 ||
    status !== "all" ||
    categoryFilter !== "all" ||
    workAreaFilter !== "all";

  function setAllExpanded(expanded: boolean) {
    const nextCategories: Record<string, boolean> = {};
    const nextFamilies: Record<string, boolean> = {};
    for (const category of filteredCategories) {
      nextCategories[category.categoryId] = expanded;
      for (const family of category.families) {
        nextFamilies[`${category.categoryId}::${family.familyId}`] = expanded;
      }
    }
    setOpenCategories(nextCategories);
    setOpenFamilies(nextFamilies);
  }

  async function handleSave(values: RateEditValues): Promise<boolean> {
    if (!editingItem) return false;
    setSaving(true);
    setNotice(null);
    const existing = rateMap.get(editingItem.canonicalKey);
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
      setOpenCategories((prev) => ({
        ...prev,
        [editingItem.categoryId]: true,
      }));
      setOpenFamilies((prev) => ({
        ...prev,
        [`${editingItem.categoryId}::${editingItem.familyId}`]: true,
      }));
    }
    return true;
  }

  const categoryCount = filteredCategories.length;
  const familyCount = filteredCategories.reduce(
    (sum, category) => sum + category.familyCount,
    0
  );
  const variantCount = filteredCategories.reduce(
    (sum, category) => sum + category.variantCount,
    0
  );

  return (
    <div className="space-y-3" data-materials-by-product-family>
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">Materials</h2>
        <p className="text-sm text-muted-foreground">
          Your rate is primary when set. Otherwise Quotr benchmark is used
          where one exists. Browse by category, then product family, then exact
          purchasable variant.
        </p>
      </div>

      <div className={ratesFilterRowClass} data-rates-filters>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search families, sizes, thickness, keys, work areas"
          aria-label="Search materials"
          className={cn(
            ratesFilterControlClass,
            "sm:col-span-2 lg:max-w-md lg:flex-1"
          )}
        />
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label="Filter by category"
          className={ratesFilterControlClass}
        >
          <option value="all">All categories</option>
          {(Object.keys(MATERIAL_CATEGORY_NAMES) as MaterialCategoryId[]).map(
            (id) => (
              <option key={id} value={id}>
                {MATERIAL_CATEGORY_NAMES[id]}
              </option>
            )
          )}
        </select>
        <select
          value={workAreaFilter}
          onChange={(event) => setWorkAreaFilter(event.target.value)}
          aria-label="Filter by work area"
          className={ratesFilterControlClass}
        >
          <option value="all">All work areas</option>
          {workAreaOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as MaterialStatusFilter)
          }
          aria-label="Filter by material status"
          className={ratesFilterControlClass}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="flex gap-2 sm:col-span-2 lg:contents">
          <Button
            type="button"
            variant="outline"
            size="touch"
            className={ratesFilterActionClass}
            onClick={() => setAllExpanded(true)}
          >
            Expand all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="touch"
            className={ratesFilterActionClass}
            onClick={() => setAllExpanded(false)}
          >
            Collapse all
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {categoryCount} categor{categoryCount === 1 ? "y" : "ies"} ·{" "}
        {familyCount} famil{familyCount === 1 ? "y" : "ies"} · {variantCount}{" "}
        variant{variantCount === 1 ? "" : "s"}
      </p>

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

      {filteredCategories.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
          No material rates match this search or filter.
        </p>
      ) : (
        <div className="space-y-2">
          {filteredCategories.map((category) => {
            const open =
              searching || Boolean(openCategories[category.categoryId]);
            const panelId = `materials-category-panel-${category.categoryId}`;
            const headerId = `materials-category-header-${category.categoryId}`;
            return (
              <section
                key={category.categoryId}
                className="rounded-lg border border-border/60"
                data-materials-category={category.categoryId}
              >
                <h3 className="m-0">
                  <button
                    type="button"
                    id={headerId}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="flex min-h-11 w-full items-start gap-2 px-3 py-3 text-left"
                    onClick={() =>
                      setOpenCategories((prev) => ({
                        ...prev,
                        [category.categoryId]: !open,
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
                      <span className="block text-sm font-semibold tracking-tight">
                        {category.categoryName}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {categorySummary(category)}
                      </span>
                    </span>
                  </button>
                </h3>

                {open ? (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={headerId}
                    className="space-y-2 border-t border-border/60 px-2 py-2 sm:px-3 sm:py-3"
                  >
                    {category.families.map((family) => {
                      const familyKey = `${category.categoryId}::${family.familyId}`;
                      const familyOpen =
                        searching || Boolean(openFamilies[familyKey]);
                      const familyPanelId = `materials-family-panel-${category.categoryId}-${family.familyId}`;
                      const familyHeaderId = `materials-family-header-${category.categoryId}-${family.familyId}`;
                      return (
                        <div
                          key={family.familyId}
                          className="rounded-md border border-border/50"
                          data-materials-family={family.familyId}
                        >
                          <h4 className="m-0">
                            <button
                              type="button"
                              id={familyHeaderId}
                              aria-expanded={familyOpen}
                              aria-controls={familyPanelId}
                              className="flex min-h-11 w-full items-start gap-2 px-3 py-2.5 text-left"
                              onClick={() =>
                                setOpenFamilies((prev) => ({
                                  ...prev,
                                  [familyKey]: !familyOpen,
                                }))
                              }
                            >
                              <ChevronDown
                                className={cn(
                                  "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                                  familyOpen ? "rotate-0" : "-rotate-90"
                                )}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium">
                                  {family.familyName}
                                </span>
                                {family.familyDescription ? (
                                  <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {family.familyDescription}
                                  </span>
                                ) : null}
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {familySummary(family)}
                                </span>
                              </span>
                            </button>
                          </h4>

                          {familyOpen ? (
                            <div
                              id={familyPanelId}
                              role="region"
                              aria-labelledby={familyHeaderId}
                              className="border-t border-border/50 px-3 py-2"
                            >
                              <MaterialVariantsList
                                items={family.ordinaryItems}
                                layout={family.variantLayout}
                                showKeys={showKeys}
                                readOnly={readOnly}
                                onEdit={(item) => {
                                  setEditingKey(item.canonicalKey);
                                  setNotice(null);
                                }}
                              />
                              {family.legacyItems.length > 0 ? (
                                <details className="mt-2 rounded-md border border-dashed border-border/70 px-3 py-2">
                                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                                    Legacy / Advanced ({family.legacyItems.length})
                                    — kept for earlier estimates
                                  </summary>
                                  <div className="mt-2">
                                    <MaterialVariantsList
                                      items={family.legacyItems}
                                      layout={family.variantLayout}
                                      showKeys={showKeys}
                                      readOnly={readOnly}
                                      legacy
                                      onEdit={(item) => {
                                        setEditingKey(item.canonicalKey);
                                        setNotice(null);
                                      }}
                                    />
                                  </div>
                                </details>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {editingItem && !readOnly ? (
        <RateEditDialog
          key={`${editingItem.canonicalKey}-${rateMap.get(editingItem.canonicalKey)?.id ?? "new"}`}
          open={Boolean(editingItem)}
          onOpenChange={(open) => {
            if (!open) setEditingKey(null);
          }}
          catalogueEntry={editingItem.catalogueEntry}
          existingRate={rateMap.get(editingItem.canonicalKey) ?? null}
          companyGrossMarginPercent={companyGrossMarginPercent}
          onSave={handleSave}
          saving={saving}
        />
      ) : null}
    </div>
  );
}

function MaterialVariantsList({
  items,
  layout,
  showKeys,
  readOnly,
  legacy = false,
  onEdit,
}: {
  items: MaterialRegistryItem[];
  layout: MaterialFamilyGroup["variantLayout"];
  showKeys: boolean;
  readOnly: boolean;
  legacy?: boolean;
  onEdit: (item: MaterialRegistryItem) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No variants in this group.</p>
    );
  }

  const attrLabel =
    layout === "sheet"
      ? "Thickness / sheet"
      : layout === "framing"
        ? "Section / grade"
        : "Variant";

  return (
    <div className="min-w-0 overflow-hidden" data-rates-compact-list>
      <RateGridHeader
        columns={materialRateColumns}
        labels={[
          { text: attrLabel },
          { text: "Your rate", align: "end" },
          { text: "Quotr benchmark", align: "end" },
          { text: "Unit" },
          { text: "Status" },
          { text: "Action", align: "end" },
        ]}
      />
      {items.map((item) => {
        const statusLabel =
          item.effectiveSource === "pricing_required"
            ? "Pricing Required"
            : materialEffectiveSourceLabel(
                item.effectiveSource,
                item.benchmarkKind
              );
        const legacyLabel = materialLegacyLabel(item.legacyKind);
        const primary =
          layout === "sheet"
            ? [item.thickness, item.sheetSize].filter(Boolean).join(" · ") ||
              item.label
            : layout === "framing"
              ? [item.section, item.gradeTreatment].filter(Boolean).join(" · ") ||
                item.label
              : item.colourType || item.label;
        return (
          <RateGridRow
            key={item.canonicalKey}
            columns={materialRateColumns}
            className="sm:grid sm:grid-cols-1"
            data-materials-key={item.canonicalKey}
            data-materials-legacy={legacy ? "true" : "false"}
            data-materials-benchmark={item.benchmarkKind}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{primary}</p>
              {primary !== item.label ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {item.label}
                </p>
              ) : null}
              {item.workAreaLabels.length > 0 ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  Used in: {item.workAreaLabels.join(", ")}
                </p>
              ) : null}
              {item.benchmarkKind === "derived" && item.derivedHint ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {item.derivedHint}
                </p>
              ) : null}
              {item.aliasOfKey ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Alias of {item.aliasOfKey}
                </p>
              ) : null}
              {showKeys ? (
                <p className="mt-0.5 break-all font-mono text-[10px] text-muted-foreground/80">
                  {item.canonicalKey}
                </p>
              ) : null}
              {legacy && legacyLabel ? (
                <Badge variant="outline" className="mt-1 w-fit text-[10px]">
                  {legacyLabel}
                </Badge>
              ) : null}
            </div>
            <RateField label="Your rate" align="end">
              {formatMoney(item.companyOverride)}
            </RateField>
            <RateField label="Quotr benchmark" align="end">
              {formatMoney(item.quotrBenchmarkCost)}
            </RateField>
            <RateField label="Unit">{formatRateUnit(item.unit)}</RateField>
            <RateField
              label="Status"
              attention={item.effectiveSource === "pricing_required"}
            >
              {statusLabel}
            </RateField>
            <div className="flex min-h-11 items-center justify-between gap-2 lg:min-h-0">
              <span className="text-xs text-muted-foreground lg:sr-only">
                Action
              </span>
              {readOnly ? (
                <span className="text-sm text-muted-foreground">—</span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="touch"
                  className="h-11 min-h-11 lg:h-9 lg:min-h-9 lg:w-full"
                  onClick={() => onEdit(item)}
                >
                  <Pencil className="mr-1 size-3.5" />
                  {item.companyOverride != null ? "Edit" : "Add"}
                </Button>
              )}
            </div>
          </RateGridRow>
        );
      })}
    </div>
  );
}
