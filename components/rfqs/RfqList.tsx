"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RFQ_LIST_FILTER_KEYS, rfqListStorageKey } from "@/components/rfqs/rfq-layout";
import type { RfqListRow } from "@/lib/rfqs/load";
import { rfqResponseLabel, type RfqResponseState } from "@/lib/rfqs/states";

export function RfqList({
  projectId,
  rows,
  canEdit,
}: {
  projectId: string;
  rows: RfqListRow[];
  canEdit: boolean;
}) {
  useEffect(() => {
    const current = new URLSearchParams(window.location.search);
    const kept = new URLSearchParams();
    for (const key of RFQ_LIST_FILTER_KEYS) {
      const value = current.get(key);
      if (value) kept.set(key, value);
    }
    try {
      const storageKey = rfqListStorageKey(projectId);
      if ([...kept.keys()].length === 0) sessionStorage.removeItem(storageKey);
      else sessionStorage.setItem(storageKey, kept.toString());
    } catch {
      /* Private browsing can block storage. The list link still works. */
    }
  }, [projectId]);
  const questions = rows.reduce((sum, row) => sum + row.questionCount, 0);
  const awaiting = rows.reduce((sum, row) => sum + row.awaitingCount, 0);
  const received = rows.reduce((sum, row) => sum + row.respondedCount, 0);
  return (
    <div className="grid gap-3 pb-28 md:pb-0" data-rfq-list>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Requests</h1>
          <p className="text-sm text-foreground/70">Ask subcontractors to price work. Sending a request does not change the Quote or choose a supplier.</p>
        </div>
        {canEdit ? (
          <Button className="h-11 min-h-11" render={<Link href={`/app/projects/${projectId}/requests/new`} />}>
            New request
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-foreground/70" data-rfq-queues>
        {questions} open question{questions === 1 ? "" : "s"} · {awaiting} awaiting · {received} received
      </p>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm">No requests yet.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/app/projects/${projectId}/requests/${row.id}`} className="grid min-h-11 gap-1 rounded-xl border border-border bg-card px-4 py-3">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium break-words">{row.scopeLabel || "Request"}</span>
                  <span className="text-sm">{row.status === "draft" ? "Draft" : "Sent"}</span>
                </span>
                <span className="text-sm text-foreground/70">
                  {row.recipientCount} recipient{row.recipientCount === 1 ? "" : "s"}
                  {" · "}
                  {row.respondedCount} response{row.respondedCount === 1 ? "" : "s"}
                  {row.questionCount > 0 ? ` · ${row.questionCount} open question${row.questionCount === 1 ? "" : "s"}` : ""}
                  {row.dueOn ? ` · Due ${row.dueOn}` : ""}
                </span>
                {row.recipients.length > 0 ? (
                  <span className="truncate text-sm text-foreground/70">
                    {row.recipients.map((recipient) => `${recipient.name} · ${rfqResponseLabel(recipient.responseState as RfqResponseState)}${recipient.deliveryFailed ? " · Not delivered" : ""}`).join(" · ")}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
