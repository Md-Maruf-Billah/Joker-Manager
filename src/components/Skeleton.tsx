import { clsx } from "clsx";

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "animate-shimmer rounded-lg bg-[linear-gradient(90deg,#ececee_25%,#f8f8f9_37%,#ececee_63%)] bg-[length:600px_100%]",
        className
      )}
    />
  );
}

export function SkeletonMetric() {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-black/[0.07] bg-card p-5">
      <SkeletonBlock className="h-3 w-20" />
      <SkeletonBlock className="mt-3 h-8 w-28" />
      <SkeletonBlock className="mt-2 h-3 w-24" />
    </div>
  );
}

export function SkeletonPanel({ rows = 3 }: { rows?: number }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-black/[0.07] bg-card shadow-card">
      <div className="border-b border-black/[0.07] p-[18px] px-[26px]">
        <SkeletonBlock className="h-5 w-32" />
        <SkeletonBlock className="mt-2 h-3 w-56" />
      </div>
      <div className="grid gap-3 p-[26px]">
        {Array.from({ length: rows }).map((_, index) => (
          <SkeletonBlock key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonRow({ columns = 6 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-4 py-3">
          <SkeletonBlock className="h-4 w-full max-w-24" />
        </td>
      ))}
    </tr>
  );
}
