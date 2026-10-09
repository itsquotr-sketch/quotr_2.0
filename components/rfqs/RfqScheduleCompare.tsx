"use client";

import type { RfqDetail } from "@/lib/rfqs/load";
import { scheduleRoleLabel, scheduleUnitLabel } from "@/lib/rfqs/schedule";
import { rfqDeliveryFailed, rfqDeliveryLabel, rfqResponseLabel } from "@/lib/rfqs/states";

function money(value: number | null): string {
  if (value == null) return "None";
  return value.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function RfqScheduleCompare({
  detail,
  onOpenFile,
}: {
  detail: RfqDetail;
  onOpenFile: (responseId: string) => void;
}) {
  const latest = detail.recipients.map((recipient) => {
    const versions = detail.responses
      .filter((response) => response.recipientId === recipient.id && response.status === "submitted")
      .sort((a, b) => b.versionNumber - a.versionNumber);
    return { recipient, response: versions[0] ?? null, versions };
  });
  const completePrices = latest.flatMap((item) =>
    item.response?.completeness === "complete" && item.response.priceExGst != null ? [item.response.priceExGst] : []
  );
  const lowestComplete = completePrices.length > 0 ? Math.min(...completePrices) : null;

  return (
    <section className="grid gap-3" data-rfq-schedule-compare>
      {detail.responses.filter((response) => response.status === "submitted").map((response) => (
        <span key={response.id} id={`rfq-response-${response.id}`} />
      ))}
      <h2 className="text-base font-semibold">Item-by-item comparison</h2>
      <p className="text-sm text-foreground/70">A partial total is not ranked against a complete price. A qualification does not make the response cheaper.</p>
      <ul className="grid gap-3 md:hidden">
        {detail.schedule.map((item) => (
          <li key={item.id} className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm">
            {detail.responses.filter((response) => response.status === "submitted").map((response) => <span key={response.id} id={`rfq-response-${response.id}-item-${item.id}`} />)}
            <p className="font-medium break-words">{item.scope}</p>
            {item.specification ? <p className="break-words">{item.specification}</p> : null}
            <p>{item.unit === "lump_sum" ? "Lump sum" : `${item.quantity ?? ""} ${scheduleUnitLabel(item.unit)}`} · {scheduleRoleLabel(item.role)}</p>
            {latest.map(({ recipient, response }) => {
              const line = response?.lines.find((entry) => entry.scheduleItemId === item.id);
              return (
                <p key={recipient.id}>
                  <span className="font-medium">{recipient.tradingName}: </span>
                  {lineStatus(line)}
                </p>
              );
            })}
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-3 font-medium">Item</th>
              {latest.map(({ recipient }) => (
                <th key={recipient.id} className="py-2 pr-3 font-medium">{recipient.tradingName}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.schedule.map((item) => (
              <tr key={item.id} className="border-b border-border align-top" data-rfq-anchor={detail.responses.filter((response) => response.status === "submitted").map((response) => `rfq-response-${response.id}-item-${item.id}`).join(" ")}>
                <td className="py-3 pr-3">
                  <p className="font-medium">{item.scope}</p>
                  <p className="text-foreground/70">{item.unit === "lump_sum" ? "Lump sum" : `${item.quantity ?? ""} ${scheduleUnitLabel(item.unit)}`} · {scheduleRoleLabel(item.role)}</p>
                </td>
                {latest.map(({ recipient, response }) => {
                  const line = response?.lines.find((entry) => entry.scheduleItemId === item.id);
                  return <td key={recipient.id} className="py-3 pr-3">{lineStatus(line)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-3">
        {latest.map(({ recipient, response, versions }) => {
          const complete = response?.completeness === "complete";
          const partial = response?.completeness === "partial";
          const isLowest = complete && response?.priceExGst != null && response.priceExGst === lowestComplete;
          return (
            <li key={recipient.id} className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{recipient.tradingName}</p>
                <p>{offerLabel(recipient.responseState, response?.completeness ?? null, response?.qualified === true, rfqDeliveryFailed(recipient.deliveryState))}</p>
              </div>
              <p>Base total ex GST: {complete ? money(response?.priceExGst ?? null) : partial ? "Partial" : "None"}</p>
              {partial ? <p>Priced required items so far: {money(response?.priceExGst ?? null)}. This is not a complete comparable price.</p> : null}
              {isLowest ? <p>Lowest complete base total.</p> : null}
              <p>Optional items, excluded from the base: {money(response?.optionalExGst ?? null)}</p>
              <p>Alternatives, excluded from the base: {money(response?.alternativeExGst ?? null)}</p>
              {response?.qualified ? (
                <details>
                  <summary className="cursor-pointer text-amber-800">Qualified. Open the explanation before comparing this total.</summary>
                  <p className="whitespace-pre-wrap pt-2">{response.assumptions || "See the item qualifications."}</p>
                  <ul className="grid gap-1 pt-2">
                    {response.lines.filter((line) => line.qualification).map((line) => (
                      <li key={line.scheduleItemId}>{line.qualification}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <details>
                <summary className="cursor-pointer">Version, delivery, and file</summary>
                <div className="grid gap-1 pt-2">
                  <p>{rfqResponseLabel(recipient.responseState)} · {rfqDeliveryLabel(recipient.deliveryState)}</p>
                  <p>Version: {response ? response.versionNumber : "None"}</p>
                  <p>Valid until: {response?.validUntil || "Not stated"}</p>
                  <p>File: {response?.fileReady ? (
                    <button type="button" className="underline" onClick={() => onOpenFile(response.id)}>{response.fileName || "PDF"}</button>
                  ) : "None"}</p>
                  {versions.length > 1 ? versions.map((version) => (
                    <p key={version.id}>Version {version.versionNumber} remains on record.</p>
                  )) : null}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function lineStatus(line: { decision: string; unitPriceExGst: number | null; amountExGst: number | null; reason: string; qualification: string } | undefined): string {
  if (!line) return "Not priced";
  if (line.decision === "excluded") return "Excluded from the total";
  if (line.decision === "not_priced") return `Not priced. ${line.reason}`;
  const unit = line.unitPriceExGst == null ? "" : `${money(line.unitPriceExGst)} unit · `;
  return `${unit}${money(line.amountExGst)} ex GST${line.qualification ? `. ${line.qualification}` : ""}`;
}

function offerLabel(
  responseState: RfqDetail["recipients"][number]["responseState"],
  completeness: "complete" | "partial" | null,
  qualified: boolean,
  deliveryFailed: boolean
): string {
  if (deliveryFailed && responseState === "awaiting") return "Delivery failed";
  if (responseState === "declined") return "Declined";
  if (responseState === "clarification") return "Question asked";
  if (responseState !== "responded") return "No response";
  const base = completeness === "partial" ? "Partial" : completeness === "complete" ? "Complete" : "No response";
  return qualified ? `${base} · Qualified` : base;
}
