export function StatusMessage({
  tone = "info",
  children
}: {
  tone?: "info" | "success" | "warning" | "error";
  children: string;
}) {
  const className = {
    info: "border-paper/10 bg-paper/5 text-muted",
    success: "border-joker-green/35 bg-joker-green/10 text-paper",
    warning: "border-gold-400/35 bg-gold-400/10 text-paper",
    error: "border-joker-red/35 bg-joker-red/10 text-paper"
  }[tone];

  return <div className={`rounded-md border p-3 text-sm ${className}`}>{children}</div>;
}

