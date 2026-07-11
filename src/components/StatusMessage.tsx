export function StatusMessage({
  tone = "info",
  children
}: {
  tone?: "info" | "success" | "warning" | "error";
  children: string;
}) {
  const className = {
    info: "border-black/[0.08] bg-black/[0.03] text-muted",
    success: "border-success/30 bg-success/[0.08] text-success",
    warning: "border-brand-gold/35 bg-brand-gold/10 text-jackpot",
    error: "border-brand-danger/30 bg-brand-danger/[0.07] text-brand-redDark"
  }[tone];

  return <div className={`rounded-[10px] border p-3 text-[13px] ${className}`}>{children}</div>;
}
