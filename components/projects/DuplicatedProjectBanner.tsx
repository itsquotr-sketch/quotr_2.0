type DuplicatedProjectBannerProps = {
  show: boolean;
};

export function DuplicatedProjectBanner({ show }: DuplicatedProjectBannerProps) {
  if (!show) {
    return null;
  }

  return (
    <div
      className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100"
      role="status"
    >
      <p className="font-medium">Duplicated project</p>
      <p className="mt-0.5 text-xs sm:text-sm">
        Review the scope and regenerate the estimate when you are ready.
      </p>
    </div>
  );
}
