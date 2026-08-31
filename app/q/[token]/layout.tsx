export default function PublicQuoteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 overflow-y-auto bg-neutral-100 print:static print:overflow-visible print:bg-white">
      {children}
    </div>
  );
}
