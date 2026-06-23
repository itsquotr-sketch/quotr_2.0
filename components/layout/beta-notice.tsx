/** Subtle testing notice — hidden in print. */
export function BetaNotice() {
  return (
    <p
      className="border-b border-border/50 bg-muted/20 px-4 py-2 text-center text-xs leading-relaxed text-muted-foreground print:hidden"
      role="status"
    >
      Quotr is in testing. Estimates and quotes are prepared from the information
      you provide — review all pricing and quotes before issuing to clients.
    </p>
  );
}
