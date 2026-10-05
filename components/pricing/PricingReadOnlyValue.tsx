type PricingReadOnlyValueProps = {
  label: string;
  value: string | null | undefined;
};

export function PricingReadOnlyValue({ label, value }: PricingReadOnlyValueProps) {
  const text = value?.trim() ? value : "—";
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}
