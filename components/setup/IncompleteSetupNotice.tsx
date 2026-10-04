import Link from "next/link";

export function IncompleteSetupNotice({
  categories,
  reviewHref,
}: {
  categories: string[];
  reviewHref: string | null;
}) {
  if (categories.length === 0) return null;
  const list = categories.join(", ");

  return (
    <div className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-950">
      <p className="max-w-3xl leading-snug">
        Some setup answers are still missing: {list}.{" "}
        {reviewHref ? (
          <Link
            href={reviewHref}
            className="font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Review setup
          </Link>
        ) : (
          <span>An owner or admin can update this in setup. You can keep working.</span>
        )}
      </p>
    </div>
  );
}
