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
    <section className={clsx("min-w-0 overflow-hidden rounded-lg border border-paper/10 bg-paper/[0.055] shadow-panel", className)}>
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
    <div className="flex min-w-0 flex-col gap-3 border-b border-paper/10 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="break-words text-lg font-semibold text-paper">{title}</h2>
        {children ? <p className="mt-1 max-w-2xl break-words text-sm leading-6 text-muted">{children}</p> : null}
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
    default: "text-paper",
    gold: "text-gold-300",
    green: "text-joker-green",
    purple: "text-joker-purple",
    red: "text-joker-red"
  }[tone];

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-paper/10 bg-felt-900/72 p-5">
      <div className="break-words text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={`mt-3 break-words text-2xl font-black leading-tight sm:text-3xl ${toneClass}`}>{value}</div>
      {detail ? <div className="mt-2 break-words text-sm text-muted">{detail}</div> : null}
    </div>
  );
}
