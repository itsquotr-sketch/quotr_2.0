import Link from "next/link";
import type { SubcontractorRequestActivity } from "@/lib/subcontractors/activity";
import { rfqResponseLabel } from "@/lib/rfqs/states";
import type { RfqResponseState } from "@/lib/rfqs/states";

function whenLabel(value: string | null): string {
  if (!value) return "";
  const date = value.slice(0, 10);
  const [year, month, day] = date.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const index = Number(month) - 1;
  if (!year || !day || index < 0 || index > 11) return date;
  return `${Number(day)} ${names[index]} ${year}`;
}

export function SubcontractorRequests({
  requests,
}: {
  requests: SubcontractorRequestActivity[];
}) {
  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground" data-subcontractor-requests>No requests yet.</p>;
  }
  return (
    <ul className="grid gap-2" data-subcontractor-requests>
      {requests.map((request) => (
        <li key={request.rfqId} className="rounded-xl border border-border/70 bg-card px-3 py-3 text-sm">
          <Link
            href={`/app/projects/${request.projectId}/requests/${request.rfqId}`}
            className="inline-flex min-h-11 items-center font-medium underline-offset-2 hover:underline"
          >
            {request.projectTitle}
          </Link>
          <p className="text-muted-foreground">
            {request.scopeLabel}
            {" · "}
            {rfqResponseLabel(request.responseState as RfqResponseState)}
            {request.when ? ` · ${whenLabel(request.when)}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
