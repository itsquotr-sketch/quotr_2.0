"use client";

import { Button } from "@/components/ui/button";
import {
  SCHEDULE_ROLES,
  SCHEDULE_UNITS,
  emptyScheduleRow,
  scheduleRoleLabel,
  scheduleUnitLabel,
  type ScheduleDraftRow,
  type ScheduleRole,
  type ScheduleUnit,
} from "@/lib/rfqs/schedule";

const fieldClass = "h-11 min-h-11 w-full rounded-md border border-border bg-card px-3 text-base";

export function RfqScheduleEditor({
  rows,
  onChange,
  messageFor,
}: {
  rows: ScheduleDraftRow[];
  onChange: (rows: ScheduleDraftRow[]) => void;
  messageFor: (id: string) => string | undefined;
}) {
  function update(id: string, patch: Partial<ScheduleDraftRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...rows];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    onChange(next);
  }

  return (
    <div className="grid gap-3" data-rfq-schedule-editor>
      <p className="text-sm text-foreground/70">
        Each recipient prices this same list. An alternative is priced separately and is not part of the base total. A lump sum is one total.
      </p>
      {rows.map((row, index) => (
        <article key={row.id} id={`schedule-${row.id}`} className="grid gap-2 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Item {index + 1}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => move(index, -1)}>Move up</Button>
              <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => move(index, 1)}>Move down</Button>
              <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => {
                const copy = { ...row, id: crypto.randomUUID(), scope: row.scope ? `${row.scope} copy` : "" };
                const next = [...rows];
                next.splice(index + 1, 0, copy);
                onChange(next);
              }}>Duplicate</Button>
              <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => onChange(rows.filter((item) => item.id !== row.id))}>Remove</Button>
            </div>
          </div>
          <label className="grid gap-1 text-sm">
            Scope
            <textarea className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-base" value={row.scope} onChange={(event) => update(row.id, { scope: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            Specification, if you have one
            <input className={fieldClass} value={row.specification} onChange={(event) => update(row.id, { specification: event.target.value })} />
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="grid gap-1 text-sm">
              Unit
              <select className={fieldClass} value={row.unit} onChange={(event) => {
                const unit = event.target.value as ScheduleUnit;
                update(row.id, { unit, quantity: unit === "lump_sum" ? "" : row.quantity || "1" });
              }}>
                {SCHEDULE_UNITS.map((unit) => <option key={unit} value={unit}>{scheduleUnitLabel(unit)}</option>)}
              </select>
            </label>
            {row.unit === "lump_sum" ? (
              <p className="self-end text-sm text-foreground/70">One total. Quantity is not multiplied.</p>
            ) : (
              <label className="grid gap-1 text-sm">
                Quantity
                <input className={fieldClass} inputMode="decimal" value={row.quantity} onChange={(event) => update(row.id, { quantity: event.target.value })} />
              </label>
            )}
            <label className="grid gap-1 text-sm">
              Pricing expectation
              <select className={fieldClass} value={row.role} onChange={(event) => update(row.id, { role: event.target.value as ScheduleRole })}>
                {SCHEDULE_ROLES.map((role) => <option key={role} value={role}>{scheduleRoleLabel(role)}</option>)}
              </select>
            </label>
          </div>
          {row.role === "alternative" ? <p className="text-sm">Alternative. The recipient prices it separately. It is not required and it is not in the base total.</p> : null}
          {row.role === "optional" ? <p className="text-sm">Optional. A blank answer stays out of the response total.</p> : null}
          {row.role === "required" ? <p className="text-sm">Required. The recipient prices it or marks it Not priced.</p> : null}
          {row.quantitySource ? (
            <label className="flex min-h-11 items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={row.quantityConfirmed} onChange={(event) => update(row.id, { quantityConfirmed: event.target.checked })} />
              <span>{row.quantitySource}</span>
            </label>
          ) : null}
          {messageFor(`schedule-${row.id}`) ? <p className="text-sm text-red-700">{messageFor(`schedule-${row.id}`)}</p> : null}
        </article>
      ))}
      <Button type="button" variant="outline" className="h-11 min-h-11 w-fit" onClick={() => onChange([...rows, emptyScheduleRow()])}>Add item</Button>
    </div>
  );
}
