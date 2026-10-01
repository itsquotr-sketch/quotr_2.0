import Link from "next/link";
import type { DashboardAttentionItem } from "@/lib/dashboard/attention";
import { Button } from "@/components/ui/button";

export function DashboardAttention({ items }: { items: DashboardAttentionItem[] }) {
  return (
    <section aria-labelledby="dashboard-attention-heading" data-dashboard-attention>
      <h2 id="dashboard-attention-heading" className="text-sm font-semibold tracking-tight">
        Needs attention
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 rounded-lg border border-border/70 bg-card px-3 py-2.5 text-sm text-muted-foreground">
          Nothing needs attention
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.state}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.context}</p>
              </div>
              <Button
                size="touch"
                className="h-11 min-h-11 w-full shrink-0 sm:w-auto"
                render={<Link href={item.href} />}
              >
                {item.action}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
