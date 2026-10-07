import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  const questions = rows.reduce((sum, row) => sum + row.questionCount, 0);
  const awaiting = rows.reduce((sum, row) => sum + row.awaitingCount, 0);
  const received = rows.reduce((sum, row) => sum + row.respondedCount, 0);
  return (
    <div className="grid gap-4 pb-28 md:pb-0" data-rfq-list>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Requests</h1>
          <p className="text-sm text-foreground/70">Ask subcontractors to price work. Sending a request does not change the Quote or choose a supplier.</p>
        </div>
        {canEdit ? (
          <Button className="h-11 min-h-11" render={<Link href={`/app/projects/${projectId}/requests/new`} />}>
            New request
          </Button>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-3" data-rfq-queues>
        <p className="rounded-xl border border-border bg-card p-4 text-sm"><span className="block text-lg font-semibold">{questions}</span>Open questions</p>
        <p className="rounded-xl border border-border bg-card p-4 text-sm"><span className="block text-lg font-semibold">{awaiting}</span>Awaiting responses</p>
        <p className="rounded-xl border border-border bg-card p-4 text-sm"><span className="block text-lg font-semibold">{received}</span>Received prices</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm">No requests yet.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/app/projects/${projectId}/requests/${row.id}`} className="grid gap-2 rounded-xl border border-border bg-card p-4">
                <span className="font-medium">{row.scopeLabel || "Request"}</span>
                <span className="text-sm text-foreground/70">
                  {row.status === "draft" ? "Draft" : "Sent"}
                  {" · "}
                  {row.respondedCount} of {row.recipientCount} responded
                  {row.questionCount > 0 ? ` · ${row.questionCount} open question${row.questionCount === 1 ? "" : "s"}` : ""}
                  {row.dueOn ? ` · Due ${row.dueOn}` : ""}
                </span>
                {row.recipients.length > 0 ? (
                  <span className="grid gap-1 text-sm">
                    {row.recipients.map((recipient) => (
                      <span key={`${row.id}-${recipient.name}`}>
                        {recipient.name} · {rfqResponseLabel(recipient.responseState as RfqResponseState)}{recipient.deliveryFailed ? " · Not delivered" : ""}
                      </span>
                    ))}
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
