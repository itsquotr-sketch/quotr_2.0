import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { RfqListRow } from "@/lib/rfqs/load";

export function RfqList({
  projectId,
  rows,
  canEdit,
}: {
  projectId: string;
  rows: RfqListRow[];
  canEdit: boolean;
}) {
  return (
    <div className="grid gap-4" data-rfq-list>
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
      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm">No requests yet.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/app/projects/${projectId}/requests/${row.id}`} className="grid gap-1 rounded-xl border border-border bg-card p-4">
                <span className="font-medium">{row.scopeLabel || "Request"}</span>
                <span className="text-sm text-foreground/70">
                  {row.status === "draft" ? "Draft" : "Sent"}
                  {" · "}
                  {row.respondedCount} of {row.recipientCount} responded
                  {row.dueOn ? ` · Due ${row.dueOn}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
