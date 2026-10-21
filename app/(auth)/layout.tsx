import { AuthShell } from "@/components/auth/AuthShell";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-auth-scroll
      className="fixed inset-0 overflow-y-auto print:static print:h-auto print:overflow-visible"
    >
      <AuthShell>{children}</AuthShell>
    </div>
  );
}
