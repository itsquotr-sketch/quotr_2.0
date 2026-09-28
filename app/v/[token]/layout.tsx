export default function PublicVariationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 overflow-y-auto bg-neutral-100">
      {children}
    </div>
  );
}
