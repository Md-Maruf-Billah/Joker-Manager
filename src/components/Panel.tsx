import type { ReactNode } from "react";
import { clsx } from "clsx";

export function Panel({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("min-w-0 overflow-hidden rounded-2xl border border-black/[0.07] bg-card shadow-card", className)}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  action,
  children
}: {
  title: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 border-b border-black/[0.07] p-[18px] px-[26px] sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="break-words text-[15.5px] font-bold text-ink">{title}</h2>
        {children ? <p className="mt-1 max-w-2xl break-words text-[12.5px] leading-6 text-muted">{children}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Metric({
  label,
  value,
  detail,
  tone = "default"
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "gold" | "green" | "purple" | "red";
}) {
  const toneClass = {
    default: "text-ink",
    gold: "text-jackpot",
    green: "text-success",
    purple: "text-brand-teal",
    red: "text-brand-red"
  }[tone];

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-black/[0.07] bg-card p-5">
      <div className="break-words text-[12.5px] font-bold uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className={`mt-2.5 break-words text-[26px] font-black leading-tight sm:text-[30px] ${toneClass}`}>{value}</div>
      {detail ? <div className="mt-2 break-words text-[12.5px] text-faint">{detail}</div> : null}
    </div>
  );
}
